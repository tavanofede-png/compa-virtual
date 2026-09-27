import { createHash } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { open, readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const base = resolve(root, "apps/web/public/selection/study-spaces");
const authoringRoot = resolve(root, "design/personal-spaces-v1");
const authoringAvailable = existsSync(resolve(authoringRoot, "spatial.mjs"));
if (!authoringAvailable && !process.env.VERCEL)
  throw Error("Falta el validador de StudyZone del archivo maestro.");
const validateLayout = authoringAvailable
  ? (await import("../design/personal-spaces-v1/spatial.mjs")).validateLayout
  : null;
const manifest = JSON.parse(await readFile(resolve(base, "runtime-manifest.json"), "utf8"));
if (manifest.version !== 1 || manifest.spaces.length !== 8)
  throw Error("El runtime necesita los ocho espacios individuales.");
const ids = new Set();
for (const entry of manifest.spaces) {
  if (ids.has(entry.id)) throw Error(`Espacio duplicado: ${entry.id}`);
  ids.add(entry.id);
  const path = resolve(base, `${entry.id}-mobile.glb`);
  if (entry.url !== `/selection/study-spaces/${entry.id}-mobile.glb`)
    throw Error(`${entry.id}: ruta del manifiesto incorrecta.`);
  const { size } = await stat(path);
  if (size !== entry.bytes) throw Error(`${entry.id}: tamaño incorrecto.`);
  const handle = await open(path, "r");
  const header = Buffer.alloc(12);
  try {
    await handle.read(header, 0, 12, 0);
  } finally {
    await handle.close();
  }
  if (header.toString("ascii", 0, 4) !== "glTF" || header.readUInt32LE(8) !== size)
    throw Error(`${entry.id}: GLB incompleto o inválido.`);
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  if (hash.digest("hex") !== entry.sha256)
    throw Error(`${entry.id}: checksum incorrecto.`);
  if (validateLayout) {
    const layout = JSON.parse(await readFile(resolve(authoringRoot, "data", `${entry.id}-model-layout.json`), "utf8"));
    const result = validateLayout(layout);
    if (!result.valid || result.validStudyZones < 1)
      throw Error(`${entry.id}: falta una StudyZone funcional.`);
  }
  console.log(`${entry.id}: GLB válido${validateLayout ? " y StudyZone válida" : ""} (${(size / 1048576).toFixed(1)} MiB)`);
}
