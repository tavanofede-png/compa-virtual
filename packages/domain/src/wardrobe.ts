import { wardrobeItems } from "./wardrobe-catalog";
export { wardrobeItems } from "./wardrobe-catalog";
import type { WardrobeItem } from "./wardrobe-catalog";

const signatureSlots = {
  back: "back",
  bottom: "bottom",
  face_accessory: "face_accessory",
  hand_prop: "handheld",
  shoes: "shoes",
  top: "top",
} as const;

const signatureCharacters = [
  ["lux", "Lux", "#EEE4D3", ["back", "bottom", "shoes", "top"]],
  ["finn", "Finn", "#3B619C", ["back", "bottom", "face_accessory", "hand_prop", "shoes", "top"]],
  ["elise", "Elise", "#819268", ["back", "bottom", "shoes", "top"]],
  ["kai", "Kai", "#F2E8D6", ["back", "bottom", "face_accessory", "shoes", "top"]],
  ["noa", "Noa", "#3C5342", ["back", "bottom", "face_accessory", "hand_prop", "shoes", "top"]],
  ["rem", "Rem", "#282326", ["back", "bottom", "face_accessory", "shoes", "top"]],
  ["sage", "Sage", "#787459", ["back", "bottom", "face_accessory", "shoes", "top"]],
  ["orion", "Orion", "#AF906C", ["back", "bottom", "face_accessory", "shoes", "top"]],
] as const;

export const signatureWardrobeItems: WardrobeItem[] = signatureCharacters.flatMap(
  ([id, name, color, parts]) =>
    parts.map((part) => ({
      id: `${id}-signature-${part}`,
      family: "signature",
      slot: signatureSlots[part],
      color,
      design: "signature",
      label: `${name} · conjunto original`,
    })),
);

export const allWardrobeItems = [...wardrobeItems, ...signatureWardrobeItems];
export const wardrobeItem = (id: string) =>
  allWardrobeItems.find((item) => item.id === id);
export const wardrobeCategories = [
  { id: "top", name: "Remeras y buzos", slots: ["top"] },
  { id: "outerwear", name: "Camperas", slots: ["outerwear"] },
  { id: "bottom", name: "Pantalones", slots: ["bottom"] },
  { id: "shoes", name: "Calzado", slots: ["shoes"] },
  { id: "headwear", name: "Gorras", slots: ["headwear"] },
  { id: "face_accessory", name: "Anteojos", slots: ["face_accessory"] },
  { id: "bags", name: "Bolsos", slots: ["back", "crossbody"] },
  {
    id: "accessories",
    name: "Accesorios",
    slots: ["neck", "waist", "wrist", "charm"],
  },
];
export function equipWardrobe(current: string[], id: string): string[] {
  const item = wardrobeItem(id);
  if (!item) throw Error("Esta prenda no está disponible.");
  const conflicts =
    item.slot === "top" || item.slot === "outerwear"
      ? ["top", "outerwear"]
      : [item.slot];
  return [
    ...current.filter(
      (v) =>
        !conflicts.includes(wardrobeItem(v)?.slot ?? ""),
    ),
    id,
  ];
}
export function wardrobeError(ids: string[]): string | null {
  const items = ids.map(wardrobeItem);
  if (items.some((i) => !i)) return "Elegí prendas del catálogo disponible.";
  const slots = items.map((i) => i!.slot);
  if (new Set(slots).size !== slots.length)
    return "Elegí una sola prenda por categoría.";
  if (slots.includes("top") && slots.includes("outerwear"))
    return "Elegí un buzo o una campera para evitar superposiciones.";
  if (
    !slots.includes("bottom") ||
    !slots.includes("shoes") ||
    !slots.some((s) => s === "top" || s === "outerwear")
  )
    return "Completá el conjunto con una prenda superior, pantalón o short y calzado.";
  return null;
}
