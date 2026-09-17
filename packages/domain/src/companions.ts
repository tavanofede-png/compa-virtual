import { defaultCompanion, type Companion } from "./types";

export const characterIds = [
  "nova",
  "jay",
  "milo",
  "zoe",
  "sky",
  "harper",
  "river",
  "aria",
  "lux",
  "finn",
  "elise",
  "kai",
  "noa",
  "rem",
  "sage",
  "orion",
] as const;
export type CharacterId = (typeof characterIds)[number];
export const characters = [
  {
    id: "nova",
    name: "Nova",
    trait: "Con calma",
    description: "Para desarmar lo difícil en pasos pequeños, sin apurarte.",
    greeting: "Vamos a encontrar tu ritmo. Un paso por vez.",
    color: "#668C93",
    outfit: [
      "tee-white-planet",
      "cargo-denim-plain",
      "sneaker-pink-panel",
      "crossbody-pink-label",
      "glasses-pink-round",
    ],
  },
  {
    id: "jay",
    name: "Jay",
    trait: "Con entusiasmo",
    description: "Una compañía que celebra tus avances y te ayuda a arrancar.",
    greeting: "Empecemos por algo que hoy sí podamos hacer.",
    color: "#AA5B4E",
    outfit: [
      "varsity-red-a",
      "cargo-black-orange-stitch",
      "sneaker-red-panel",
      "backpack-black-smile",
      "watch-gold-analog",
    ],
  },
  {
    id: "milo",
    name: "Milo",
    trait: "Con humor",
    description:
      "Ideas claras, un poco de humor y otra manera de mirar los problemas.",
    greeting: "¿Y si esa materia difícil termina sorprendiéndonos?",
    color: "#B18331",
    outfit: [
      "hoodie-ivory-better-days",
      "cargo-black-plain",
      "sneaker-yellow-panel",
      "cap-yellow-smile",
      "crossbody-black-cat",
    ],
  },
  {
    id: "zoe",
    name: "Zoe",
    trait: "Con curiosidad",
    description: "Para hacer preguntas, conectar ideas y entender el porqué.",
    greeting: "Hay una buena pregunta detrás de cada descubrimiento.",
    color: "#826695",
    outfit: [
      "sweater-ivory-cable",
      "shorts-olive-cargo",
      "boot-brown-hiker",
      "glasses-gold-round",
      "backpack-purple-plain",
    ],
  },
  {
    id: "sky",
    name: "Sky",
    trait: "Con creatividad",
    description:
      "Ejemplos, conexiones y formas nuevas de explicar lo que aprendés.",
    greeting: "Probemos una forma distinta de entenderlo.",
    color: "#A56084",
    outfit: [
      "utility-black-purple",
      "cargo-ivory-chain",
      "sneaker-purple-panel",
      "beanie-gray-label",
      "crossbody-black-checker",
    ],
  },
  {
    id: "harper",
    name: "Harper",
    trait: "Con organización",
    description:
      "Para transformar una semana cargada en un plan que puedas seguir.",
    greeting: "Hagamos lugar para lo importante, y también para descansar.",
    color: "#567D65",
    outfit: [
      "sweater-green-stripe",
      "cargo-tan-plain",
      "boot-olive-hiker",
      "glasses-black-rect",
      "backpack-olive-plain",
    ],
  },
  {
    id: "river",
    name: "River",
    trait: "A tu ritmo",
    description: "Un espacio para avanzar sin compararte y volver a intentar.",
    greeting: "No hace falta correr. Encontramos juntos el próximo paso.",
    color: "#5A7F9C",
    outfit: [
      "tee-blue-double-stripe",
      "sportshorts-black-piping",
      "sneaker-blue-panel",
      "headphones-blue-cat",
      "cap-blue-label",
    ],
  },
  {
    id: "aria",
    name: "Aria",
    trait: "Con energía",
    description: "Pequeños desafíos para poner las ideas en movimiento.",
    greeting: "Elegimos un objetivo pequeño y nos ponemos en marcha.",
    color: "#AD625C",
    outfit: [
      "puffer-ivory-label",
      "cargo-black-orange-stitch",
      "boot-yellow-hiker",
      "bucket-green-flower",
      "backpack-pink-plain",
    ],
  },
  {
    id: "lux",
    name: "Lux",
    trait: "Con optimismo",
    description: "Una mirada luminosa para reconocer avances y volver a probar.",
    greeting: "Siempre hay algo que hoy podemos hacer un poquito mejor.",
    color: "#D985A7",
    outfit: [
      "lux-signature-back",
      "lux-signature-bottom",
      "lux-signature-shoes",
      "lux-signature-top",
    ],
  },
  {
    id: "finn",
    name: "Finn",
    trait: "En movimiento",
    description: "Energía práctica para empezar, sostener el ritmo y avanzar.",
    greeting: "Nos ponemos en movimiento y resolvemos el primer paso.",
    color: "#3B619C",
    outfit: [
      "finn-signature-back",
      "finn-signature-bottom",
      "finn-signature-face_accessory",
      "finn-signature-hand_prop",
      "finn-signature-shoes",
      "finn-signature-top",
    ],
  },
  {
    id: "elise",
    name: "Elise",
    trait: "Con imaginación",
    description: "Una compañía serena para conectar ideas y aprender creando.",
    greeting: "Veamos qué historia puede ayudarnos a entenderlo.",
    color: "#819268",
    outfit: [
      "elise-signature-back",
      "elise-signature-bottom",
      "elise-signature-shoes",
      "elise-signature-top",
    ],
  },
  {
    id: "kai",
    name: "Kai",
    trait: "Con confianza",
    description: "Impulso y seguridad para enfrentar desafíos sin rendirse.",
    greeting: "Vamos con decisión: ya tenés con qué empezar.",
    color: "#C7614F",
    outfit: [
      "kai-signature-back",
      "kai-signature-bottom",
      "kai-signature-face_accessory",
      "kai-signature-shoes",
      "kai-signature-top",
    ],
  },
  {
    id: "noa",
    name: "Noa",
    trait: "Con foco",
    description: "Calma y concentración para convertir objetivos en pasos claros.",
    greeting: "Elegimos una meta concreta y le damos toda la atención.",
    color: "#3C5342",
    outfit: [
      "noa-signature-back",
      "noa-signature-bottom",
      "noa-signature-face_accessory",
      "noa-signature-hand_prop",
      "noa-signature-shoes",
      "noa-signature-top",
    ],
  },
  {
    id: "rem",
    name: "Rem",
    trait: "Con creatividad",
    description: "Ideas distintas para expresarte y encontrar tu propia respuesta.",
    greeting: "Probemos otra perspectiva y hagamos que la idea sea tuya.",
    color: "#B96852",
    outfit: [
      "rem-signature-back",
      "rem-signature-bottom",
      "rem-signature-face_accessory",
      "rem-signature-shoes",
      "rem-signature-top",
    ],
  },
  {
    id: "sage",
    name: "Sage",
    trait: "Con perspectiva",
    description: "Una mirada amplia para relacionar lo nuevo con lo que ya sabés.",
    greeting: "Miremos el panorama completo y encontremos la conexión.",
    color: "#787459",
    outfit: [
      "sage-signature-back",
      "sage-signature-bottom",
      "sage-signature-face_accessory",
      "sage-signature-shoes",
      "sage-signature-top",
    ],
  },
  {
    id: "orion",
    name: "Orion",
    trait: "Con aventura",
    description: "Curiosidad para explorar temas nuevos y descubrir hasta dónde llegan.",
    greeting: "Hay algo nuevo por descubrir. Empecemos por la primera pista.",
    color: "#4F7F91",
    outfit: [
      "orion-signature-back",
      "orion-signature-bottom",
      "orion-signature-face_accessory",
      "orion-signature-shoes",
      "orion-signature-top",
    ],
  },
] satisfies {
  id: CharacterId;
  name: string;
  trait: string;
  description: string;
  greeting: string;
  color: string;
  outfit: string[];
}[];

export const roomIds = [
  "cozy",
  "minimalista",
  "tecnologia",
  "naturaleza",
  "urbano",
  "biblioteca-moderna",
] as const;
export type RoomId = (typeof roomIds)[number];
export const rooms = [
  {
    id: "cozy",
    name: "Cozy moderno",
    description: "Luz cálida, madera y un rincón para bajar un cambio.",
    theme: "evening",
  },
  {
    id: "minimalista",
    name: "Minimalista",
    description: "Líneas simples y espacio para concentrarte.",
    theme: "day",
  },
  {
    id: "tecnologia",
    name: "Tecnología",
    description: "Luces, pantallas y un escritorio con tu energía.",
    theme: "night",
  },
  {
    id: "naturaleza",
    name: "Naturaleza",
    description: "Verde, luz de día y materiales cálidos.",
    theme: "day",
  },
  {
    id: "urbano",
    name: "Urbano",
    description: "Música, contrastes y detalles con personalidad.",
    theme: "night",
  },
  {
    id: "biblioteca-moderna",
    name: "Biblioteca moderna",
    description: "Libros a mano y un lugar para cada idea.",
    theme: "evening",
  },
] satisfies { id: RoomId; name: string; description: string; theme: string }[];
export const autonomyOptions = [
  {
    value: 1,
    name: "Paso a paso",
    description: "Quiero ayuda para elegir por dónde empezar.",
  },
  {
    value: 2,
    name: "Decidimos juntos",
    description: "Prefiero recibir propuestas y elegir mi plan.",
  },
  {
    value: 3,
    name: "Una segunda mirada",
    description: "Armo mi plan y pido ayuda para revisarlo.",
  },
  {
    value: 4,
    name: "A mi manera",
    description: "Me organizo y busco ayuda cuando la necesito.",
  },
];
export const onboardingSteps = [
  "Tu compa",
  "Su estilo",
  "Su habitación",
  "Sobre vos",
  "Tu ritmo",
  "Todo listo",
] as const;
export function characterById(id?: string) {
  return characters.find((c) => c.id === id) ?? characters[2];
}
export function roomById(id?: string) {
  return rooms.find((r) => r.id === id) ?? rooms[0];
}
export function selectCharacter(
  id: CharacterId,
  previous: Companion = defaultCompanion,
): Companion {
  const c = characterById(id);
  return {
    ...previous,
    character_id: id,
    name: c.name,
    personality: c.trait,
    wardrobe: [...c.outfit],
    accessory: "none",
    outfit: "none",
    room_style: previous.room_style ?? "cozy",
  };
}
