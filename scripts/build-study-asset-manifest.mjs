import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { open, readFile, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { validateLayout } from "../design/personal-spaces-v1/spatial.mjs";

const root = resolve(import.meta.dirname, "..");
const base = resolve(root, "design/personal-spaces-v1");
const ids = [
  "library",
  "terrace",
  "pergola",
  "cafe",
  "minimal",
  "tech",
  "pavilion",
  "loft",
];

async function sha256(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

const spaces = [];
for (const id of ids) {
  const layoutPath = resolve(base, "data", `${id}-model-layout.json`);
  const modelPath = resolve(base, "models", `${id}.glb`);
  const previewPath = resolve(
    root,
    "apps/web/public/selection/study-spaces",
    `${id}.jpg`,
  );
  const layout = JSON.parse(await readFile(layoutPath, "utf8"));
  const validation = validateLayout(layout);
  if (!validation.valid || validation.validStudyZones < 1)
    throw Error(`${id}: no tiene una StudyZone válida.`);
  const header = Buffer.alloc(20);
  const file = await open(modelPath, "r");
  let geometry;
  try {
    await file.read(header, 0, 20, 0);
    const jsonLength = header.readUInt32LE(12);
    if (header.readUInt32LE(16) !== 0x4e4f534a || jsonLength > 10_000_000)
      throw Error(`${id}: encabezado JSON GLB inválido.`);
    const jsonChunk = Buffer.alloc(jsonLength);
    await file.read(jsonChunk, 0, jsonLength, 20);
    const gltf = JSON.parse(jsonChunk.toString("utf8"));
    const primitives = (gltf.meshes ?? []).flatMap((mesh) => mesh.primitives);
    geometry = {
      meshes: gltf.meshes?.length ?? 0,
      primitives: primitives.length,
      vertices: primitives.reduce(
        (total, primitive) =>
          total +
          (gltf.accessors?.[primitive.attributes?.POSITION]?.count ?? 0),
        0,
      ),
      triangles: primitives.reduce((total, primitive) => {
        if (primitive.mode !== undefined && primitive.mode !== 4) return total;
        const positions =
          gltf.accessors?.[primitive.attributes?.POSITION]?.count ?? 0;
        const indices =
          primitive.indices === undefined
            ? positions
            : (gltf.accessors?.[primitive.indices]?.count ?? 0);
        return total + Math.floor(indices / 3);
      }, 0),
      materials: gltf.materials?.length ?? 0,
      images: gltf.images?.length ?? 0,
    };
  } finally {
    await file.close();
  }
  const model = await stat(modelPath);
  if (
    header.readUInt32LE(0) !== 0x46546c67 ||
    header.readUInt32LE(8) !== model.size
  )
    throw Error(`${id}: el archivo GLB está incompleto.`);
  const preview = await stat(previewPath);
  if (!preview.size) throw Error(`${id}: falta su preview.`);
  spaces.push({
    id,
    source: `design/personal-spaces-v1/models/${id}.glb`,
    preview: `/selection/study-spaces/${id}.jpg`,
    layout: `design/personal-spaces-v1/data/${id}-model-layout.json`,
    sha256: await sha256(modelPath),
    bytes: model.size,
    geometry,
    studyZoneIds: layout.studyZones.map((zone) => zone.id),
    status: "source-validated-runtime-and-android-pending",
  });
}
const manifest = {
  version: 1,
  units: "meters",
  scope:
    "Fuentes 3D individuales; no certifica rendimiento, interacción ni publicación Android.",
  spaces,
};
const destination = resolve(base, "data", "asset-manifest.json");
await writeFile(destination, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  `Manifest verificado: ${spaces.length} espacios, ${spaces.reduce((total, entry) => total + entry.bytes, 0)} bytes.`,
);
