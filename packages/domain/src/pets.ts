export const petSpecies = ["dog", "cat", "rabbit", "hamster", "guinea-pig", "ferret", "hedgehog", "turtle", "gecko", "bird"] as const;
export type PetSpecies = (typeof petSpecies)[number];
export const petRigFamilies = ["canine-standard", "canine-low", "feline", "rabbit", "small-mammal", "mustelid", "turtle", "gecko", "avian"] as const;
export type PetRigFamily = (typeof petRigFamilies)[number];
export type PetActivityLevel = "calm" | "normal" | "active";

export interface PetVariant { id: string; label: string; model: string; portrait: string; scale: number }
export interface PetBehaviorProfile {
  id: string; curiosity: number; sociability: number; activity: number;
  walkSpeed: number; runSpeed: number; idleSeconds: [number, number]; focusRestSeconds: [number, number];
}
export interface PetAnimationSet { id: string; model: string; clips: Record<string, string> }
export interface PetDefinition {
  id: string; name: string; species: PetSpecies; breed: string; rigFamily: PetRigFamily;
  variant: PetVariant; animationSetId: string; behaviorProfileId: string; colliderRadius: number;
  unlock: { kind: "first-free" | "coins" | "achievement"; value?: number | string };
  compatibleAccessories: string[]; compatibleHabitats: string[]; description: string;
}
export interface OwnedPet {
  id: string; petDefinitionId: string; name: string; acquiredAt: string;
  acquisition: "first-free" | "coins" | "achievement"; accessories: string[]; updatedAt: string;
}
export interface EquippedPetSetup { activePetId: string | null; bedId: string; toyIds: string[]; accessoryId: string | null }
export interface PetPreferences { visible: boolean; automaticMovement: boolean; activityLevel: PetActivityLevel; reducedMotion: boolean }
export interface PetHabitatItem { id: string; label: string; kind: "bed" | "bowl" | "basket" | "shelter" | "perch"; model: string; compatibleSpecies: PetSpecies[] }
export interface PetToyDefinition { id: string; label: string; kind: "ball" | "rope" | "mouse" | "tunnel" | "hanging"; model: string; compatibleSpecies: PetSpecies[] }
const petAssetRevision = "20260912d";

export const petBehaviorProfiles: PetBehaviorProfile[] = [
  { id: "loyal-playful", curiosity: 0.72, sociability: 0.92, activity: 0.62, walkSpeed: 0.42, runSpeed: 0.82, idleSeconds: [22, 42], focusRestSeconds: [75, 150] },
  { id: "bright-active", curiosity: 0.88, sociability: 0.82, activity: 0.84, walkSpeed: 0.46, runSpeed: 0.94, idleSeconds: [18, 34], focusRestSeconds: [70, 135] },
  { id: "calm-curious", curiosity: 0.80, sociability: 0.70, activity: 0.48, walkSpeed: 0.36, runSpeed: 0.72, idleSeconds: [26, 48], focusRestSeconds: [90, 170] },
  { id: "feline-playful", curiosity: 0.92, sociability: 0.66, activity: 0.72, walkSpeed: 0.38, runSpeed: 0.86, idleSeconds: [24, 46], focusRestSeconds: [95, 180] },
  { id: "feline-calm", curiosity: 0.78, sociability: 0.58, activity: 0.42, walkSpeed: 0.32, runSpeed: 0.70, idleSeconds: [30, 54], focusRestSeconds: [110, 195] },
  { id: "small-lively", curiosity: 0.94, sociability: 0.70, activity: 0.78, walkSpeed: 0.28, runSpeed: 0.58, idleSeconds: [20, 40], focusRestSeconds: [90, 170] },
  { id: "small-steady", curiosity: 0.72, sociability: 0.56, activity: 0.34, walkSpeed: 0.18, runSpeed: 0.36, idleSeconds: [34, 58], focusRestSeconds: [120, 210] },
  { id: "avian-cheerful", curiosity: 0.88, sociability: 0.84, activity: 0.68, walkSpeed: 0.22, runSpeed: 0.42, idleSeconds: [22, 42], focusRestSeconds: [100, 180] },
];
const quadrupedClips = {
  idle: "pet_idle", look: "pet_look", walk: "pet_walk", run: "pet_run",
  sitDown: "pet_sit_down", seated: "pet_seated", standUp: "pet_stand_up",
  lieDown: "pet_lie_down", rest: "pet_rest", getUp: "pet_get_up",
  sniff: "pet_sniff", react: "pet_react", play: "pet_play", carry: "pet_carry", celebrate: "pet_celebrate",
};
export const petAnimationSets: PetAnimationSet[] = [{
  id: "canine-standard-v1", model: "pet-canine-animations", clips: quadrupedClips,
}, {
  id: "feline-v1", model: "pet-feline-animations", clips: quadrupedClips,
}, {
  id: "rabbit-v1", model: "pet-rabbit-animations", clips: quadrupedClips,
}, {
  id: "small-mammal-v1", model: "pet-small-mammal-animations", clips: quadrupedClips,
}, {
  id: "mustelid-v1", model: "pet-mustelid-animations", clips: quadrupedClips,
}, {
  id: "turtle-v1", model: "pet-turtle-animations", clips: quadrupedClips,
}, {
  id: "gecko-v1", model: "pet-gecko-animations", clips: quadrupedClips,
}, {
  id: "avian-v1", model: "pet-avian-animations", clips: quadrupedClips,
}];
const dog = (
  id: string,
  name: string,
  breed: string,
  rigFamily: PetRigFamily,
  profile: string,
  price: number,
  description: string,
  scale = 1,
  colliderRadius = .32,
): PetDefinition => ({
  id, name, species: "dog", breed, rigFamily,
  variant: { id: `${id}-classic`, label: "Pelaje clásico", model: `pet-${id}`, portrait: `/selection/pets/${id}.webp?v=${petAssetRevision}`, scale },
  animationSetId: "canine-standard-v1", behaviorProfileId: profile, colliderRadius,
  unlock: price === 0 ? { kind: "first-free" } : { kind: "coins", value: price },
  compatibleAccessories: ["pet-bandana-blue"],
  compatibleHabitats: ["pet-bed-cozy", "pet-bowl-cozy", "pet-toy-basket-cozy"],
  description,
});

const cat = (
  id: string,
  name: string,
  breed: string,
  profile: "feline-playful" | "feline-calm",
  price: number,
  description: string,
  scale = 0.88,
  colliderRadius = .25,
): PetDefinition => ({
  id, name, species: "cat", breed, rigFamily: "feline",
  variant: { id: `${id}-classic`, label: "Pelaje clásico", model: `pet-${id}`, portrait: `/selection/pets/${id}.webp?v=${petAssetRevision}`, scale },
  animationSetId: "feline-v1", behaviorProfileId: profile, colliderRadius,
  unlock: { kind: "coins", value: price },
  compatibleAccessories: ["pet-collar-classic"],
  compatibleHabitats: ["pet-bed-cozy", "pet-bowl-cozy", "pet-toy-basket-cozy"],
  description,
});

const pet = (
  id: string,
  name: string,
  species: PetSpecies,
  breed: string,
  rigFamily: PetRigFamily,
  profile: string,
  price: number,
  description: string,
  scale: number,
  colliderRadius: number,
): PetDefinition => ({
  id, name, species, breed, rigFamily,
  variant: { id: `${id}-classic`, label: "Estilo clásico", model: `pet-${id}`, portrait: `/selection/pets/${id}.webp?v=${petAssetRevision}`, scale },
  animationSetId: `${rigFamily}-v1`, behaviorProfileId: profile, colliderRadius,
  unlock: { kind: "coins", value: price },
  compatibleAccessories: ["pet-collar-classic"],
  compatibleHabitats: ["pet-bed-cozy", "pet-bowl-cozy", "pet-toy-basket-cozy"],
  description,
});

export const petDefinitions: PetDefinition[] = [
  dog("golden-retriever", "Miel", "Golden retriever", "canine-standard", "loyal-playful", 0, "Leal, tranquilo durante el estudio y siempre listo para jugar."),
  dog("border-collie", "Pixel", "Border collie", "canine-standard", "bright-active", 150, "Atento y veloz. Disfruta descubrir rutas nuevas y aprender señales."),
  dog("corgi", "Chispa", "Corgi", "canine-low", "bright-active", 165, "Alegre, expresivo y con una energía enorme en patas cortitas.", .96, .30),
  dog("dachshund", "Cacao", "Dachshund", "canine-low", "calm-curious", 180, "Curioso y decidido. Investiga cada rincón de la habitación.", .94, .28),
  dog("french-bulldog", "Bruno", "Bulldog francés", "canine-standard", "loyal-playful", 195, "Compañero, juguetón y feliz de descansar cerca del escritorio.", .96, .33),
  dog("shiba-inu", "Kumo", "Shiba inu", "canine-standard", "calm-curious", 215, "Independiente y sereno, con una cola que delata su entusiasmo."),
  dog("poodle", "Rulo", "Caniche", "canine-standard", "bright-active", 235, "Creativo y sociable, con un pelaje esculpido en rizos voxel."),
  dog("husky", "Nube", "Husky", "canine-standard", "bright-active", 260, "Aventurero, comunicativo y siempre preparado para caminar.", 1.04, .34),
  cat("orange-tabby", "Mango", "Gato naranja", "feline-playful", 190, "Amistoso y curioso, convierte cada paseo por el cuarto en una pequeña aventura."),
  cat("black-cat", "Ónix", "Gato negro", "feline-calm", 205, "Seguro y observador, disfruta acompañar en silencio desde un rincón cercano."),
  cat("siamese", "Luna", "Siamés", "feline-playful", 220, "Curioso y expresivo, siempre encuentra algo nuevo para investigar."),
  cat("ragdoll", "Mora", "Ragdoll", "feline-calm", 235, "Dulce y serena, prefiere descansar cerca mientras estudiás."),
  cat("british-shorthair", "Nube", "British shorthair", "feline-calm", 250, "Calmo y constante, acompaña cada pequeño paso con paciencia.", .90, .27),
  cat("maine-coon", "Bosque", "Maine coon", "feline-playful", 285, "Majestuoso y sociable, explora el cuarto con una presencia enorme.", .98, .29),
  cat("calico", "Pipa", "Calico", "feline-playful", 270, "Creativa y alegre, con un patrón de pelaje único y mucha personalidad."),
  cat("sphynx", "Duna", "Sphynx", "feline-calm", 300, "Singular y afectuosa, busca lugares cálidos y tranquilos.", .86, .23),
  pet("rabbit", "Trébol", "rabbit", "Conejo", "rabbit", "small-lively", 210, "Gentil y curioso, alterna pequeños saltos con descansos tranquilos.", .43, .15),
  pet("hamster", "Pipo", "hamster", "Hámster", "small-mammal", "small-lively", 175, "Pequeño, atento y lleno de energía para investigar su rincón.", .58, .12),
  pet("guinea-pig", "Mota", "guinea-pig", "Cobayo", "small-mammal", "small-steady", 195, "Sociable y sereno, disfruta estar cerca mientras avanzás.", .72, .17),
  pet("ferret", "Tilo", "ferret", "Hurón", "mustelid", "small-lively", 240, "Juguetón y flexible, recorre rutas autorizadas con mucha curiosidad.", .66, .15),
  pet("hedgehog", "Púa", "hedgehog", "Erizo", "small-mammal", "small-steady", 225, "Valiente y tranquilo, se anima a explorar de a poco.", .66, .14),
  pet("turtle", "Oliva", "turtle", "Tortuga", "turtle", "small-steady", 250, "Constante y paciente, celebra el progreso paso a paso.", .67, .17),
  pet("gecko", "Sol", "gecko", "Gecko", "gecko", "small-steady", 265, "Distinto y observador, descubre perspectivas nuevas desde su zona segura.", .46, .13),
  pet("budgie", "Cielo", "bird", "Periquito", "avian", "avian-cheerful", 280, "Alegre y sociable, aporta una nota brillante a cada día.", .54, .12),
];
export const petHabitats: PetHabitatItem[] = [
  { id: "pet-bed-cozy", label: "Camita Cozy", kind: "bed", model: "pet-bed-cozy", compatibleSpecies: ["dog", "cat", "rabbit", "guinea-pig", "ferret", "hedgehog", "turtle"] },
  { id: "pet-bowl-cozy", label: "Bowl de agua", kind: "bowl", model: "pet-bowl-cozy", compatibleSpecies: [...petSpecies] },
  { id: "pet-toy-basket-cozy", label: "Cesto de juguetes", kind: "basket", model: "pet-toy-basket-cozy", compatibleSpecies: ["dog", "cat", "rabbit", "hamster", "guinea-pig", "ferret", "hedgehog"] },
];
export const petToys: PetToyDefinition[] = [
  { id: "pet-ball-cozy", label: "Pelota", kind: "ball", model: "pet-ball-cozy", compatibleSpecies: ["dog", "cat", "rabbit", "ferret"] },
  { id: "pet-rope-cozy", label: "Cuerda", kind: "rope", model: "pet-rope-cozy", compatibleSpecies: ["dog", "ferret"] },
];
export const defaultPetPreferences: PetPreferences = { visible: true, automaticMovement: true, activityLevel: "normal", reducedMotion: false };
export const defaultPetSetup: EquippedPetSetup = { activePetId: null, bedId: "pet-bed-cozy", toyIds: ["pet-ball-cozy", "pet-rope-cozy"], accessoryId: "pet-bandana-blue" };
export function petDefinition(id?: string) { return petDefinitions.find((pet) => pet.id === id) ?? petDefinitions[0] }
export function activePet(state: { ownedPets?: OwnedPet[]; activePetId?: string | null }) { return state.ownedPets?.find((pet) => pet.id === state.activePetId) ?? null }
