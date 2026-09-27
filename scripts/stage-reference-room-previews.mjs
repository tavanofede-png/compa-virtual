import { createRequire } from "node:module";
import { resolve } from "node:path";
import { access } from "node:fs/promises";

const root = resolve(import.meta.dirname, "..");
const sharp = createRequire(resolve(root, "apps/web/package.json"))("sharp");
const ids = [
  "atico-creativo",
  "rincon-urbano",
  "sala-control-gamer",
  "habitacion-invernadero",
  "estudio-musical",
  "rincon-explorador",
];
for (const id of ids) {
  const source = resolve(root, `renders/reference-rooms/${id}-review.png`);
  const model = resolve(root, `apps/web/public/selection/models/${id}-room.glb`);
  await Promise.all([access(source), access(model)]);
  await sharp(source)
    .resize(1200, 900, { fit: "cover", position: "centre" })
    .webp({ quality: 88 })
    .toFile(resolve(root, `apps/web/public/selection/rooms/${id}.webp`));
}
console.info("Seis vistas de selección generadas desde los renders del modelo real.");
