/** Repack normals and 0–1 UVs without changing any positions, indices or scene nodes.
 * glTF's KHR_mesh_quantization is supported by the existing Three GLTFLoader.
 * Run: node scripts/compact-study-glb.mjs <source.glb> <candidate.glb>
 */
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const types = { NORMAL: 5120, TEXCOORD_0: 5123 };
function parse(source) {
  if (source.toString("ascii", 0, 4) !== "glTF" || source.readUInt32LE(4) !== 2 || source.readUInt32LE(8) !== source.length)
    throw Error("GLB de origen inválido.");
  const jsonLength = source.readUInt32LE(12);
  if (source.toString("ascii", 16, 20) !== "JSON") throw Error("Falta JSON del GLB.");
  const binHeader = 20 + jsonLength;
  if (source.toString("ascii", binHeader + 4, binHeader + 8) !== "BIN\0") throw Error("El GLB debe tener un BIN único.");
  const binary = source.subarray(binHeader + 8);
  if (binary.length !== source.readUInt32LE(binHeader) || binHeader + 8 + binary.length !== source.length)
    throw Error("BIN incompleto.");
  const json = JSON.parse(source.toString("utf8", 20, 20 + jsonLength));
  if (json.buffers?.length !== 1 || json.buffers[0].byteLength !== binary.length)
    throw Error("Este compactador solo acepta un buffer BIN.");
  return { json, binary };
}
export function compactStudyGlb(source) {
  const { json, binary } = parse(source);
  const owners = new Map();
  for (let index = 0; index < json.accessors.length; index++) {
    const view = json.accessors[index].bufferView;
    if (view !== undefined) owners.set(view, (owners.get(view) ?? 0) + 1);
  }
  const replacements = new Map();
  let maxNormalError = 0, maxUvError = 0, quantizedNormals = 0, quantizedUvs = 0, skippedUvs = 0;
  for (const mesh of json.meshes ?? []) for (const primitive of mesh.primitives) {
    for (const semantic of Object.keys(types)) {
      const index = primitive.attributes?.[semantic];
      if (index === undefined) continue;
      const accessor = json.accessors[index], view = json.bufferViews[accessor.bufferView];
      if (accessor.componentType !== 5126 || accessor.byteOffset || view.byteStride || owners.get(accessor.bufferView) !== 1)
        throw Error(`${semantic}: accessor intercalado o compartido; no se puede compactar sin alterar semántica.`);
      const size = semantic === "NORMAL" ? 3 : 2;
      const offset = view.byteOffset ?? 0;
      if (view.byteLength !== accessor.count * size * 4 || offset + view.byteLength > binary.length)
        throw Error(`${semantic}: longitud inválida.`);
      const packed = Buffer.alloc(accessor.count * 4);
      let uvOutOfRange = false;
      for (let i = 0; i < accessor.count && !uvOutOfRange; i++) for (let c = 0; c < size; c++) {
        const original = binary.readFloatLE(offset + (i * size + c) * 4);
        if (!Number.isFinite(original)) throw Error(`${semantic}: coordenada no finita.`);
        if (semantic === "NORMAL") {
          if (original < -1.001 || original > 1.001) throw Error("Normal fuera de rango.");
          const quantized = Math.round(Math.min(1, Math.max(-1, original)) * 127);
          packed.writeInt8(quantized, i * 4 + c);
          maxNormalError = Math.max(maxNormalError, Math.abs(original - quantized / 127));
        } else {
          if (original < -0.000001 || original > 1.000001) { uvOutOfRange = true; break; }
          const quantized = Math.round(Math.min(1, Math.max(0, original)) * 65535);
          packed.writeUInt16LE(quantized, i * 4 + c * 2);
          maxUvError = Math.max(maxUvError, Math.abs(original - quantized / 65535));
        }
      }
      if (uvOutOfRange) { skippedUvs += accessor.count; continue; }
      replacements.set(accessor.bufferView, packed);
      accessor.componentType = types[semantic];
      accessor.normalized = true;
      delete accessor.min; delete accessor.max;
      if (semantic === "NORMAL") { view.byteStride = 4; quantizedNormals += accessor.count; }
      else quantizedUvs += accessor.count;
    }
  }
  if (!quantizedNormals) throw Error("Faltan normales; revisar el perfil en vez de publicar una variante vacía.");
  const chunks = []; let total = 0;
  for (let index = 0; index < json.bufferViews.length; index++) {
    const view = json.bufferViews[index];
    if (view.buffer !== 0 || (view.byteOffset ?? 0) + view.byteLength > binary.length)
      throw Error("BufferView fuera del BIN.");
    const part = replacements.get(index) ?? binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
    if (total % 4) { const padding = Buffer.alloc(4 - total % 4); chunks.push(padding); total += padding.length; }
    view.byteOffset = total; view.byteLength = part.length;
    chunks.push(part); total += part.length;
  }
  if (total % 4) { const padding = Buffer.alloc(4 - total % 4); chunks.push(padding); total += padding.length; }
  json.buffers[0].byteLength = total;
  json.extensionsUsed = [...new Set([...(json.extensionsUsed ?? []), "KHR_mesh_quantization"])];
  json.extensionsRequired = [...new Set([...(json.extensionsRequired ?? []), "KHR_mesh_quantization"])];
  const encoded = Buffer.from(JSON.stringify(json));
  const jsonPadding = Buffer.alloc((4 - encoded.length % 4) % 4, 0x20);
  const output = Buffer.allocUnsafe(28 + encoded.length + jsonPadding.length + total);
  output.write("glTF", 0, "ascii"); output.writeUInt32LE(2, 4); output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(encoded.length + jsonPadding.length, 12); output.write("JSON", 16, "ascii");
  encoded.copy(output, 20); jsonPadding.copy(output, 20 + encoded.length);
  const binStart = 20 + encoded.length + jsonPadding.length;
  output.writeUInt32LE(total, binStart); output.write("BIN\0", binStart + 4, "ascii");
  let cursor = binStart + 8;
  for (const chunk of chunks) { chunk.copy(output, cursor); cursor += chunk.length; }
  if (cursor !== output.length || maxNormalError > 0.008 || maxUvError > 0.000016)
    throw Error("La compactación superó el error permitido.");
  return { buffer: output, report: { inputBytes: source.length, outputBytes: output.length,
    quantizedNormals, quantizedUvs, skippedUvs, maxNormalError, maxUvError, positionsUnchanged: true, indicesUnchanged: true,
    nodesUnchanged: true, materialsUnchanged: true } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) throw Error("Uso: node scripts/compact-study-glb.mjs <source.glb> <candidate.glb>");
  const result = compactStudyGlb(await readFile(input));
  await writeFile(output, result.buffer);
  console.log(JSON.stringify(result.report));
}
