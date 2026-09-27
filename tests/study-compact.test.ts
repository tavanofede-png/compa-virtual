import { expect, it } from "vitest";
import { compactStudyGlb } from "../scripts/compact-study-glb.mjs";

function fixture(tiledUv = false) {
  const count = 1000;
  const positions = Buffer.alloc(count * 12);
  const normals = Buffer.alloc(count * 12);
  const uvs = Buffer.alloc(count * 8);
  const indices = Buffer.alloc(count * 2);
  for (let i = 0; i < count; i++) {
    positions.writeFloatLE(i / 100, i * 12);
    normals.writeFloatLE(1, i * 12 + 8);
    uvs.writeFloatLE(tiledUv ? 1.25 : i / count, i * 8);
    uvs.writeFloatLE(0.5, i * 8 + 4);
    indices.writeUInt16LE(i, i * 2);
  }
  const binary = Buffer.concat([positions, normals, uvs, indices]);
  const json = {
    asset: { version: "2.0" },
    buffers: [{ byteLength: binary.length }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: positions.length },
      { buffer: 0, byteOffset: positions.length, byteLength: normals.length },
      {
        buffer: 0,
        byteOffset: positions.length + normals.length,
        byteLength: uvs.length,
      },
      {
        buffer: 0,
        byteOffset: positions.length + normals.length + uvs.length,
        byteLength: indices.length,
      },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count, type: "VEC3" },
      { bufferView: 1, componentType: 5126, count, type: "VEC3" },
      { bufferView: 2, componentType: 5126, count, type: "VEC2" },
      { bufferView: 3, componentType: 5123, count, type: "SCALAR" },
    ],
    meshes: [
      {
        primitives: [
          {
            attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 },
            indices: 3,
            material: 0,
          },
        ],
      },
    ],
    materials: [{ name: "Wood" }],
    nodes: [{ name: "StudyDesk", mesh: 0 }],
  };
  const encoded = Buffer.from(JSON.stringify(json));
  const paddedLength = Math.ceil(encoded.length / 4) * 4;
  const output = Buffer.alloc(28 + paddedLength + binary.length, 0x20);
  output.write("glTF", 0, "ascii");
  output.writeUInt32LE(2, 4);
  output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(paddedLength, 12);
  output.write("JSON", 16, "ascii");
  encoded.copy(output, 20);
  output.writeUInt32LE(binary.length, 20 + paddedLength);
  output.write("BIN\0", 24 + paddedLength, "ascii");
  binary.copy(output, 28 + paddedLength);
  return output;
}

function glb(buffer: Buffer) {
  const jsonLength = buffer.readUInt32LE(12);
  return {
    json: JSON.parse(buffer.toString("utf8", 20, 20 + jsonLength)),
    binary: buffer.subarray(28 + jsonLength),
  };
}
function attributeBytes(model: ReturnType<typeof glb>, accessorIndex: number) {
  const accessor = model.json.accessors[accessorIndex];
  const view = model.json.bufferViews[accessor.bufferView];
  return model.binary.subarray(
    view.byteOffset ?? 0,
    (view.byteOffset ?? 0) + view.byteLength,
  );
}

it("compacts geometry without moving vertices or changing interaction names", () => {
  const source = fixture();
  const { buffer, report } = compactStudyGlb(source);
  const before = glb(source),
    after = glb(buffer);
  expect(report.outputBytes).toBeLessThan(source.length * 0.75);
  expect(after.json.nodes).toEqual(before.json.nodes);
  expect(after.json.materials).toEqual(before.json.materials);
  expect(after.json.meshes).toEqual(before.json.meshes);
  expect(after.json.extensionsRequired).toContain("KHR_mesh_quantization");
  expect(attributeBytes(after, 0)).toEqual(attributeBytes(before, 0));
  expect(attributeBytes(after, 3)).toEqual(attributeBytes(before, 3));
  expect(report.maxNormalError).toBeLessThan(0.008);
  expect(report.maxUvError).toBeLessThan(0.000016);
});

it("preserves out-of-range UVs instead of damaging tiled textures", () => {
  const source = fixture(true);
  const { buffer, report } = compactStudyGlb(source);
  expect(report.skippedUvs).toBe(1000);
  expect(attributeBytes(glb(buffer), 2)).toEqual(
    attributeBytes(glb(source), 2),
  );
});
