import fs from "node:fs";
import path from "node:path";

const modelsDir = path.resolve("apps/web/public/selection/models");
const characterIds = [
  "nova",
  "jay",
  "milo",
  "zoe",
  "sky",
  "harper",
  "river",
  "aria",
  "lux",
  "finn",
  "elise",
  "kai",
  "noa",
  "rem",
  "sage",
  "orion",
];

function readGlbJson(file) {
  const bytes = fs.readFileSync(file);
  if (bytes.readUInt32LE(0) !== 0x46546c67) throw new Error(`${file} no es GLB`);
  let offset = 12;
  while (offset < bytes.length) {
    const length = bytes.readUInt32LE(offset);
    const type = bytes.readUInt32LE(offset + 4);
    if (type === 0x4e4f534a) {
      return JSON.parse(bytes.subarray(offset + 8, offset + 8 + length).toString("utf8"));
    }
    offset += 8 + length;
  }
  throw new Error(`${file} no contiene un bloque JSON`);
}

const failures = [];
for (const id of characterIds) {
  const file = path.join(modelsDir, `${id}-body.glb`);
  const gltf = readGlbJson(file);
  const materialNames = (gltf.materials ?? []).map((entry) => entry.name ?? "");
  const targets = new Set();
  for (const node of gltf.nodes ?? []) {
    const names = [node.name ?? ""];
    if (node.mesh !== undefined) {
      for (const primitive of gltf.meshes?.[node.mesh]?.primitives ?? []) {
        if (primitive.material !== undefined) names.push(materialNames[primitive.material] ?? "");
      }
    }
    if (/mouth|smile|lip/i.test(names.join(" "))) targets.add(names.filter(Boolean).join(" / "));
  }
  if (targets.size === 0) failures.push(id);
  console.log(`${targets.size > 0 ? "OK" : "FALTA"} ${id}: ${[...targets].join(", ") || "sin objetivo de boca"}`);
}

if (failures.length > 0) {
  console.error(`Faltan objetivos de boca en: ${failures.join(", ")}`);
  process.exit(1);
}

