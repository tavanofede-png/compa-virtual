import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { open, readFile, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const base = resolve(root, "apps/web/public/selection/models");
const maps = JSON.parse(await readFile(resolve(root, "packages/world3d/src/room-maps.json"), "utf8"));
const ids = [
  "cozy", "minimalista", "tecnologia", "naturaleza", "urbano", "biblioteca-moderna",
  "atico-creativo", "rincon-urbano", "sala-control-gamer",
  "habitacion-invernadero", "estudio-musical", "rincon-explorador",
];
const rooms = [];
for (const id of ids) {
  const map = maps[id];
  if (!map || !map.spawn || !map.chair?.approach || !map.bed?.approach || !map.bounds)
    throw Error(`${id}: faltan anchors del dormitorio.`);
  const path = resolve(base, `${id}-room.glb`);
  const { size } = await stat(path);
  const header = Buffer.alloc(12);
  const file = await open(path, "r");
  try { await file.read(header, 0, 12, 0); } finally { await file.close(); }
  if (header.toString("ascii", 0, 4) !== "glTF" || header.readUInt32LE(8) !== size)
    throw Error(`${id}: GLB incompleto o inválido.`);
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  rooms.push({ id, url: `/selection/models/${id}-room.glb`, bytes: size, sha256: hash.digest("hex") });
}
const expected = { version: 1, rooms };
const path = resolve(base, "room-runtime-manifest.json");
if (process.argv.includes("--write")) await writeFile(path, JSON.stringify(expected, null, 2) + "\n");
else if (JSON.stringify(JSON.parse(await readFile(path, "utf8"))) !== JSON.stringify(expected))
  throw Error("El manifiesto de dormitorios no coincide con los modelos publicados.");
console.log(`Dormitorios verificados: ${rooms.length}, ${(rooms.reduce((n, room) => n + room.bytes, 0) / 1048576).toFixed(1)} MiB bajo demanda.`);
