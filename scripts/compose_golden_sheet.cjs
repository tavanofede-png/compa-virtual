// Compose the 16:9 Miel character sheet from the Blender renders.
// Layout mirrors the approved concept board: hero left, turnaround top right,
// face + description middle right, poses bottom right.
const fs = require("fs");
const path = require("path");
const sharp = require("../node_modules/.pnpm/sharp@0.35.4_@types+node@22.19.19/node_modules/sharp");

const STAGE = path.join(__dirname, "../renders/golden-stylized");
const W = 2560;
const H = 1440;
const PAPER = { r: 243, g: 236, b: 226, alpha: 1 };
const INK = "#2a2018";
const MUTED = "#7a6a58";
const RULE = "#d8cbb8";
const FONT = "Segoe UI, Arial, sans-serif";
const SCRIPT = "Segoe Script, Brush Script MT, cursive";

const svg = (width, height, body) =>
  Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`);

const text = (x, y, size, content, { weight = 400, fill = INK, spacing = 0, family = FONT, anchor = "start" } = {}) =>
  `<text x="${x}" y="${y}" font-size="${size}" font-family="${family}" font-weight="${weight}" fill="${fill}" letter-spacing="${spacing}" text-anchor="${anchor}">${content}</text>`;

const caption = (content, width = 360) =>
  svg(width, 40, text(0, 28, 21, content, { weight: 700, fill: MUTED, spacing: 2 }));

const paw = (x, y, scale, fill = MUTED) => `
  <g transform="translate(${x} ${y}) scale(${scale})">
    <ellipse cx="0" cy="8" rx="9" ry="7.5" fill="${fill}"/>
    <ellipse cx="-9" cy="-4" rx="3.6" ry="4.6" fill="${fill}"/>
    <ellipse cx="-3" cy="-9" rx="3.4" ry="4.4" fill="${fill}"/>
    <ellipse cx="3" cy="-9" rx="3.4" ry="4.4" fill="${fill}"/>
    <ellipse cx="9" cy="-4" rx="3.6" ry="4.6" fill="${fill}"/>
  </g>`;

async function fit(file, boxW, boxH, trim = true) {
  let image = sharp(path.join(STAGE, file));
  if (trim) image = image.trim({ threshold: 8 });
  const trimmed = await image.png().toBuffer();
  return sharp(trimmed)
    .resize(boxW, boxH, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

async function main() {
  const composites = [];

  // Header
  composites.push({
    input: svg(W, 110, `
      ${text(56, 40, 18, "CONCEPTO OPCIÓN 2 · MODELO 3D", { weight: 700, fill: MUTED, spacing: 4 })}
      ${text(56, 84, 44, "MIEL", { weight: 700 })}
      ${text(200, 80, 24, "Golden retriever · mascota stylized 3D premium", { fill: MUTED })}
      ${text(1690, 80, 21, "Anatomía real · estilo estilizado · pelaje real (grooming Blender)", { fill: MUTED })}
      ${paw(2318, 62, 1.6)}
      ${text(2352, 52, 17, "UN COMPAÑERO", { weight: 700, fill: MUTED, spacing: 3 })}
      ${text(2352, 78, 17, "PARA LA VIDA", { weight: 700, fill: MUTED, spacing: 3 })}
    `),
    left: 0,
    top: 0,
  });

  // Hero
  composites.push({ input: await fit("hero.png", 960, 1110), left: 90, top: 155 });
  composites.push({ input: caption("VISTA HERO · 3/4"), left: 56, top: 1290 });
  composites.push({
    input: svg(700, 50, `
      <line x1="0" y1="26" x2="40" y2="26" stroke="${MUTED}" stroke-width="2"/>
      ${text(56, 33, 19, "LA VIDA ES MEJOR A SU LADO", { weight: 700, fill: MUTED, spacing: 4 })}
      ${paw(470, 26, 1.1)}
    `),
    left: 56,
    top: 1345,
  });

  // Turnaround
  const turn = [
    ["front.png", "FRENTE"],
    ["side.png", "PERFIL"],
    ["back.png", "ESPALDA"],
    ["three-quarter.png", "3/4"],
  ];
  for (let i = 0; i < turn.length; i += 1) {
    const x = 1130 + i * 350;
    composites.push({ input: await fit(turn[i][0], 320, 310), left: x, top: 140 });
    composites.push({ input: svg(320, 40, text(160, 28, 20, turn[i][1], { weight: 700, fill: MUTED, spacing: 2, anchor: "middle" })), left: x, top: 462 });
  }

  // Face + description
  composites.push({ input: await fit("face.png", 620, 400), left: 1130, top: 530 });
  composites.push({ input: svg(320, 40, text(160, 28, 20, "ROSTRO", { weight: 700, fill: MUTED, spacing: 2, anchor: "middle" })), left: 1280, top: 942 });

  const lines = [
    "Joven, noble y compañero.",
    "Hocico medio, orejas caídas.",
    "Pelaje dorado-crema con variaciones sutiles,",
    "pecho más claro.",
    "Cola esponjosa y patas fuertes y proporcionadas.",
    "Expresión cálida y tranquila,",
    "lista para convivir en el estudio.",
  ];
  composites.push({
    input: svg(740, 420, `
      <rect x="1" y="1" width="738" height="418" rx="22" fill="none" stroke="${RULE}" stroke-width="2"/>
      <line x1="500" y1="60" x2="500" y2="360" stroke="${RULE}" stroke-width="2"/>
      ${text(40, 58, 21, "DESCRIPCIÓN", { weight: 700, spacing: 2 })}
      ${lines.map((line, i) => text(40, 112 + i * 40, 22, line)).join("")}
      ${text(618, 120, 40, "Más", { family: SCRIPT, fill: MUTED, anchor: "middle" })}
      ${text(618, 166, 40, "que una", { family: SCRIPT, fill: MUTED, anchor: "middle" })}
      ${text(618, 212, 40, "mascota", { family: SCRIPT, fill: MUTED, anchor: "middle" })}
      <path d="M618 262 c-6 -14 -26 -12 -26 4 c0 12 18 22 26 30 c8 -8 26 -18 26 -30 c0 -16 -20 -18 -26 -4z" fill="${MUTED}"/>
      ${["LEALTAD", "ALEGRÍA", "BIENESTAR", "SIEMPRE CONTIGO"].map((w, i) => text(618, 326 + i * 26, 15, w, { weight: 700, fill: MUTED, spacing: 3, anchor: "middle" })).join("")}
    `),
    left: 1770,
    top: 530,
  });

  // Poses
  composites.push({ input: caption("POSES Y ACCIONES", 400), left: 1130, top: 985 });
  const poses = [
    ["pose-sit.png", "SENTADO"],
    ["pose-rest.png", "DESCANSANDO"],
    ["pose-trot.png", "TROTANDO"],
    ["pose-play.png", "JUGANDO"],
    ["pose-lookup.png", "MIRANDO ARRIBA"],
  ];
  for (let i = 0; i < poses.length; i += 1) {
    const x = 1110 + i * 282;
    composites.push({ input: await fit(poses[i][0], 260, 280), left: x, top: 1030 });
    composites.push({ input: svg(260, 40, text(130, 28, 19, poses[i][1], { weight: 700, fill: MUTED, spacing: 2, anchor: "middle" })), left: x, top: 1325 });
  }

  const out = path.join(STAGE, "miel-character-sheet.png");
  await sharp({ create: { width: W, height: H, channels: 4, background: PAPER } })
    .composite(composites)
    .png()
    .toFile(out);
  console.log("SHEET", out, fs.statSync(out).size);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
