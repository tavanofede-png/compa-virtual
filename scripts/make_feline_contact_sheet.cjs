const sharp = require("../node_modules/.pnpm/sharp@0.35.4_@types+node@22.19.19/node_modules/sharp");

const ids = [
  "orange-tabby",
  "black-cat",
  "siamese",
  "ragdoll",
  "british-shorthair",
  "maine-coon",
  "calico",
  "sphynx",
];

async function main() {
  const background = Buffer.from(
    '<svg width="1200" height="650" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#f6f1e9"/></svg>',
  );
  const composites = [];
  for (let index = 0; index < ids.length; index += 1) {
    const id = ids[index];
    const left = (index % 4) * 300;
    const top = Math.floor(index / 4) * 325;
    const portrait = await sharp(`apps/web/public/selection/pets/${id}.webp`)
      .resize(300, 300, { fit: "contain" })
      .png()
      .toBuffer();
    composites.push({ input: portrait, left, top });
    composites.push({
      input: Buffer.from(
        `<svg width="300" height="25" xmlns="http://www.w3.org/2000/svg"><text x="12" y="18" font-size="15" font-family="Arial" fill="#122030">${id}</text></svg>`,
      ),
      left,
      top: top + 300,
    });
  }
  await sharp(background)
    .composite(composites)
    .jpeg({ quality: 92 })
    .toFile("apps/web/public/selection/pets/feline-contact-sheet.jpg");
}

main();
