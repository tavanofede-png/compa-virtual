import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { validateLayout } from "../design/personal-spaces-v1/spatial.mjs";
import { compactStudyGlb } from "./compact-study-glb.mjs";

const root = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(
  await readFile(resolve(root, "design/personal-spaces-v1/data/asset-manifest.json"), "utf8"),
);
const output = resolve(root, "apps/web/public/selection/study-spaces");
await mkdir(output, { recursive: true });
const digest = async (path) => {
  const hash = createHash("sha256");
  for await (const part of createReadStream(path)) hash.update(part);
  return hash.digest("hex");
};
const runtime = [];
const layouts = {};
for (const source of manifest.spaces) {
  const id = source.id;
  const layout = JSON.parse(
    await readFile(resolve(root, source.layout), "utf8"),
  );
  const valid = validateLayout(layout);
  if (!valid.valid || valid.validStudyZones < 1)
    throw Error(`${id}: StudyZone inválida.`);
  const zone = layout.studyZones[0];
  const seat = layout.items.find((item) => item.id === zone.seatId);
  const desk = layout.items.find((item) => item.id === zone.surfaceId);
  if (!seat || !desk) throw Error(`${id}: falta asiento o superficie.`);
  layouts[id] = {
    width: layout.width,
    depth: layout.depth,
    seat: [seat.x - layout.width / 2, seat.h, seat.z - layout.depth / 2],
    yaw: Math.atan2(desk.x - seat.x, desk.z - seat.z),
    approach: [
      zone.approach[0] - layout.width / 2,
      zone.approach[1] - layout.depth / 2,
    ],
  };
  const candidate = resolve(
    root,
    "work/study-runtime-candidates",
    `${id}-mobile.glb`,
  );
  const report = JSON.parse(
    await readFile(
      resolve(root, "work/study-runtime-candidates", `${id}-mobile.json`),
      "utf8",
    ),
  );
  const bytes = await stat(candidate);
  if (bytes.size !== report.candidate_bytes || bytes.size >= 95_000_000)
    throw Error(`${id}: candidato incompleto o demasiado grande.`);
  const destination = resolve(output, `${id}-mobile.glb`);
  const compact = compactStudyGlb(await readFile(candidate));
  await writeFile(destination, compact.buffer);
  const sha256 = await digest(destination);
  layouts[id].assetRevision = sha256.slice(0, 12);
  runtime.push({
    id,
    url: `/selection/study-spaces/${id}-mobile.glb`,
    bytes: compact.report.outputBytes,
    sha256,
    geometry: report.after,
    compact: compact.report,
    sourceSha256: source.sha256,
    status: "web-staged-android-performance-pending",
  });
}
const source = `// Generated from validated Blender layouts by scripts/stage-personal-study.mjs.\nimport type { StudySpaceId } from "./study-spaces";\nexport interface StudySpaceLayout {\n  width: number;\n  depth: number;\n  seat: [number, number, number];\n  yaw: number;\n  approach: [number, number];\n  assetRevision: string;\n}\nexport const studySpaceLayouts: Record<StudySpaceId, StudySpaceLayout> = ${JSON.stringify(layouts, null, 2)};\n`;
await writeFile(resolve(root, "packages/domain/src/study-space-layouts.ts"), source);
await writeFile(
  resolve(output, "runtime-manifest.json"),
  JSON.stringify({ version: 1, spaces: runtime }, null, 2) + "\n",
);
console.log(
  `Staged ${runtime.length} study scenes (${runtime.reduce((sum, item) => sum + item.bytes, 0)} bytes).`,
);
