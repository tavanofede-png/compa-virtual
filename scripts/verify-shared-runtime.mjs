import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { open, readFile, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const base = resolve(root, "apps/web/public/selection/shared-spaces");
const ids = ["living", "study", "library", "projects", "patio", "terrace"];
const spaces = [];

for (const id of ids) {
  const path = resolve(base, `${id}-reduced.glb`);
  const metadata = JSON.parse(await readFile(resolve(base, `${id}.json`), "utf8"));
  if (metadata.capacity !== 6 || metadata.anchors?.length !== 6 || new Set(metadata.anchors.map((seat) => seat.id)).size !== 6)
    throw Error(`${id}: la sala necesita seis asientos distintos.`);
  for (const seat of metadata.anchors)
    if (seat.position?.length !== 3 || ![...seat.position, seat.yaw, seat.height].every(Number.isFinite))
      throw Error(`${id}: asiento inválido: ${seat.id}.`);
  const { size } = await stat(path);
  const handle = await open(path, "r");
  const header = Buffer.alloc(12);
  try {
    await handle.read(header, 0, 12, 0);
  } finally {
    await handle.close();
  }
  if (header.toString("ascii", 0, 4) !== "glTF" || header.readUInt32LE(8) !== size)
    throw Error(`${id}: GLB incompleto o inválido.`);
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  spaces.push({ id, url: `/selection/shared-spaces/${id}-reduced.glb`, bytes: size, sha256: hash.digest("hex") });
  console.log(`${id}: GLB y seis asientos válidos (${(size / 1048576).toFixed(1)} MiB)`);
}

const manifestPath = resolve(base, "runtime-manifest.json");
const expected = { version: 1, spaces };
if (process.argv.includes("--write")) {
  await writeFile(manifestPath, JSON.stringify(expected, null, 2) + "\n");
} else {
  const stored = JSON.parse(await readFile(manifestPath, "utf8"));
  if (JSON.stringify(stored) !== JSON.stringify(expected))
    throw Error("El manifiesto de salas no coincide con los GLB y asientos actuales.");
}
