export const studySpaces = [
  {
    id: "library",
    name: "Rincón de biblioteca",
    description: "Bibliotecas envolventes, lectura cómoda y una mesa de trabajo completa.",
    atmosphere: "Ideas que viven entre libros",
    accent: "#6f7d57",
  },
  {
    id: "terrace",
    name: "Terraza al atardecer",
    description: "Ciudad, faroles y aire libre para mirar un problema desde otra perspectiva.",
    atmosphere: "Grandes ideas, otra vista",
    accent: "#c67558",
  },
  {
    id: "pergola",
    name: "Pérgola de jardín",
    description: "Madera, flores y luz cálida alrededor de una zona de estudio protegida.",
    atmosphere: "La concentración también florece",
    accent: "#69845b",
  },
  {
    id: "cafe",
    name: "Rincón de café",
    description: "Una cafetería tranquila con vitrina, mesa amplia y todos tus útiles cerca.",
    atmosphere: "Buenas ideas recién hechas",
    accent: "#a86e4d",
  },
  {
    id: "minimal",
    name: "Estudio minimalista",
    description: "Superficies despejadas, organización precisa y luz suave para enfocarte.",
    atmosphere: "Menos ruido, más foco",
    accent: "#8795a4",
  },
  {
    id: "tech",
    name: "Estudio tecnológico",
    description: "Monitores, periféricos y luz ambiental para proyectos digitales exigentes.",
    atmosphere: "Tus ideas, con más potencia",
    accent: "#6d62bb",
  },
  {
    id: "pavilion",
    name: "Pabellón del parque",
    description: "Un refugio abierto al verde con bancos, agua y una mesa preparada para estudiar.",
    atmosphere: "Aire fresco, mente clara",
    accent: "#668769",
  },
  {
    id: "loft",
    name: "Ático acogedor",
    description: "Vigas, textiles y bibliotecas a medida en un espacio íntimo y cálido.",
    atmosphere: "Pequeños pasos, grandes cambios",
    accent: "#9b6f59",
  },
] as const;

export type StudySpaceId = (typeof studySpaces)[number]["id"];

export const studySpacePreview = (id: StudySpaceId) =>
  `/selection/study-spaces/${id}.jpg`;

export function studySpaceById(id: string | null | undefined) {
  return studySpaces.find((space) => space.id === id) ?? studySpaces[0];
}
