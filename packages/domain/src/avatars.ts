import type { Companion } from "./types";
export const skinTones = [
  { name: "Porcelana", color: "#f6d5be" },
  { name: "Claro", color: "#eac0a2" },
  { name: "Dorado", color: "#dba476" },
  { name: "Oliva", color: "#bd875f" },
  { name: "Canela", color: "#a9714d" },
  { name: "Cobrizo", color: "#895333" },
  { name: "Cacao", color: "#67412e" },
  { name: "Ébano", color: "#442e27" },
];
export const hairColors = [
  { name: "Negro", color: "#25212a" },
  { name: "Castaño oscuro", color: "#48302a" },
  { name: "Castaño", color: "#795039" },
  { name: "Rubio", color: "#d8ad62" },
  { name: "Pelirrojo", color: "#a64e32" },
  { name: "Violeta", color: "#7764a5" },
];
export const clothingColors = [
  { name: "Índigo", color: "#5965aa" },
  { name: "Bosque", color: "#4d8272" },
  { name: "Terracota", color: "#c47760" },
  { name: "Mostaza", color: "#d5a847" },
  { name: "Lavanda", color: "#a091c1" },
  { name: "Cielo", color: "#6b9bbd" },
  { name: "Crema", color: "#e8dcc3" },
  { name: "Grafito", color: "#414656" },
];
export const hairStyles = [
  { id: "short", name: "Corto con flequillo" },
  { id: "curls", name: "Rizos" },
  { id: "afro", name: "Afro" },
  { id: "bob", name: "Media melena" },
  { id: "long", name: "Largo ondulado" },
  { id: "braids", name: "Trenzas" },
] as const;
export const clothingStyles = [
  { id: "hoodie", name: "Buzo con capucha" },
  { id: "tee", name: "Remera y jeans" },
  { id: "jacket", name: "Campera universitaria" },
  { id: "overshirt", name: "Camisa abierta" },
] as const;
export interface AvatarAppearance {
  avatar_style: "boy" | "girl" | "neutral";
  skin_tone: number;
  hair_style: (typeof hairStyles)[number]["id"];
  hair_color: number;
  clothing_style: (typeof clothingStyles)[number]["id"];
  clothing_color: number;
}
export const avatarPresets: (AvatarAppearance & { name: string })[] = [
  {
    name: "Leo",
    avatar_style: "boy",
    skin_tone: 2,
    hair_style: "short",
    hair_color: 1,
    clothing_style: "hoodie",
    clothing_color: 0,
  },
  {
    name: "Alma",
    avatar_style: "girl",
    skin_tone: 4,
    hair_style: "curls",
    hair_color: 0,
    clothing_style: "jacket",
    clothing_color: 1,
  },
  {
    name: "Nico",
    avatar_style: "boy",
    skin_tone: 6,
    hair_style: "afro",
    hair_color: 0,
    clothing_style: "tee",
    clothing_color: 3,
  },
  {
    name: "Zoe",
    avatar_style: "girl",
    skin_tone: 1,
    hair_style: "long",
    hair_color: 4,
    clothing_style: "hoodie",
    clothing_color: 4,
  },
  {
    name: "Dani",
    avatar_style: "neutral",
    skin_tone: 3,
    hair_style: "bob",
    hair_color: 2,
    clothing_style: "overshirt",
    clothing_color: 5,
  },
  {
    name: "Sol",
    avatar_style: "girl",
    skin_tone: 5,
    hair_style: "braids",
    hair_color: 1,
    clothing_style: "tee",
    clothing_color: 2,
  },
];
export function avatarAppearance(c: Companion): AvatarAppearance {
  const fallback = avatarPresets[Math.abs(c.base ?? 0) % avatarPresets.length];
  return {
    avatar_style: c.avatar_style ?? fallback.avatar_style,
    skin_tone: c.skin_tone ?? fallback.skin_tone,
    hair_style: c.hair_style ?? fallback.hair_style,
    hair_color: c.hair_color ?? fallback.hair_color,
    clothing_style: c.clothing_style ?? fallback.clothing_style,
    clothing_color:
      c.clothing_color ?? Math.abs(c.palette ?? 0) % clothingColors.length,
  };
}
