import face from "../../assets/facial-metadata.json";
import faceCrops from "../../assets/facial-crop-bounds.json";
import equipment from "../../assets/equipment-metadata.json";
import type { Companion } from "./types";
export const eyeNames = face.eyeNames,
  mouthNames = face.mouthNames;
export const atlasInfo = {
  bases: { file: "faceless-bases-final.png", width: 2172, height: 724 },
  face: { file: "facial-features-atlas.png", width: 2172, height: 724 },
  equipment: { file: "equipment-atlas-v2.png", width: 1254, height: 1254 },
};
export interface SpriteLayer {
  atlas: keyof typeof atlasInfo;
  crop: { x: number; y: number; width: number; height: number };
  x: number;
  y: number;
  width: number;
  height: number;
  hue?: number;
}
export function equipmentSprite(id: string, width = 100): SpriteLayer | null {
  const item = equipment.items.find(
    (x) => x.id === (id === "star-shirt" ? "shirt" : id),
  );
  if (!item) return null;
  return {
    atlas: "equipment",
    crop: item.tightCrop,
    x: 0,
    y: 0,
    width,
    height: (width * item.tightCrop.height) / item.tightCrop.width,
  };
}
export function spriteLayers(c: Companion): SpriteLayer[] {
  const anchor = [
    face.creatures.moss,
    face.creatures.amber,
    face.creatures.lilac,
  ][c.base];
  const layers: SpriteLayer[] = [
    {
      atlas: "bases",
      crop: { x: c.base * 724, y: 0, width: 724, height: 724 },
      x: 0,
      y: 0,
      width: 724,
      height: 724,
      hue: c.palette * 36,
    },
  ];
  for (const [row, index, target, width] of [
    [0, c.eyes, anchor.eyes, anchor.eyesWidth],
    [1, c.mouth, anchor.mouth, anchor.mouthWidth],
  ] as const) {
    const crop = faceCrops.find((x) => x.row === row && x.column === index)!;
    const height = (width * crop.height) / crop.width;
    layers.push({
      atlas: "face",
      crop: {
        x: crop.cropX,
        y: crop.cropY,
        width: crop.width,
        height: crop.height,
      },
      x: target[0] - width / 2,
      y: target[1] - height / 2,
      width,
      height,
    });
  }
  for (const id of [c.outfit, c.accessory]) {
    const item = equipment.items.find(
      (x) => x.id === (id === "star-shirt" ? "shirt" : id),
    );
    if (!item) continue;
    const target =
      item.targetAnchor === "eyes"
        ? anchor.eyes
        : item.targetAnchor === "head"
          ? anchor.head
          : anchor.neck;
    let width =
        anchor.bodyWidth * (item.relativeWidthToCreatureVisibleBounds ?? 0.6),
      height = (width * item.tightCrop.height) / item.tightCrop.width;
    if (id === c.outfit) {
      const maxHeight =
        (anchor.foot[1] - target[1]) / (1 - item.sourceAnchorNormalized[1]);
      if (height > maxHeight) {
        width *= maxHeight / height;
        height = maxHeight;
      }
    }
    layers.push({
      atlas: "equipment",
      crop: item.tightCrop,
      x: target[0] - width * item.sourceAnchorNormalized[0],
      y: target[1] - height * item.sourceAnchorNormalized[1],
      width,
      height,
    });
  }
  return layers;
}
