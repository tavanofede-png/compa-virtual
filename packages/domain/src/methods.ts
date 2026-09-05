import type { StudyMethod } from "./types";
const entries: [string, string, StudyMethod["evidence"], string, string[]][] = [
  [
    "retrieval",
    "Recuperación activa",
    "ALTA",
    "Traer una idea a la memoria antes de consultar.",
    [
      "Elegí una pregunta concreta.",
      "Cerrá el material y respondé sin mirar.",
      "Compará, corregí y volvé a intentarlo.",
    ],
  ],
  [
    "practice-testing",
    "Práctica de examen",
    "ALTA",
    "Ensayar preguntas representativas con devolución.",
    [
      "Elegí temas y un tiempo posible.",
      "Respondé antes de ver soluciones.",
      "Analizá errores y repetí otro ejemplo.",
    ],
  ],
  [
    "spaced-practice",
    "Práctica espaciada",
    "ALTA",
    "Distribuir el estudio en encuentros separados.",
    [
      "Dividí el tema.",
      "Reservá encuentros en varios días.",
      "Revisá lo que cuesta más en el siguiente encuentro.",
    ],
  ],
  [
    "spaced-retrieval",
    "Recuperación espaciada",
    "ALTA",
    "Recordar una idea en días diferentes.",
    [
      "Respondé de memoria.",
      "Comprobá la respuesta.",
      "Programá una nueva recuperación para otro día.",
    ],
  ],
  [
    "interleaving",
    "Práctica intercalada",
    "MODERADA",
    "Distinguir cuándo aplicar procedimientos relacionados.",
    [
      "Aprendé un ejemplo de cada procedimiento.",
      "Mezclá problemas sin etiquetar su tipo.",
      "Explicá por qué elegiste cada procedimiento.",
    ],
  ],
  [
    "self-explanation",
    "Autoexplicación",
    "MODERADA",
    "Explicar por qué funciona cada paso.",
    [
      "Leé un paso o una idea.",
      "Explicá por qué tiene sentido con tus palabras.",
      "Detectá el salto que no entendés y comprobalo.",
    ],
  ],
  [
    "feynman",
    "Explicar con palabras simples",
    "MODERADA",
    "Una variante de autoexplicación sin jerga innecesaria.",
    [
      "Elegí una idea.",
      "Explicásela a alguien que recién empieza.",
      "Buscá y corregí lo que no pudiste explicar.",
    ],
  ],
  [
    "cornell",
    "Notas Cornell",
    "ORGANIZACIÓN",
    "Organizar apuntes con preguntas y síntesis.",
    [
      "Anotá ideas en una columna amplia.",
      "Escribí preguntas al costado.",
      "Tapá los apuntes y contestá; cerrá con una síntesis.",
    ],
  ],
  [
    "pomodoro",
    "Pomodoro",
    "ORGANIZACIÓN",
    "Hacer más fácil comenzar y descansar.",
    [
      "Elegí un objetivo pequeño.",
      "Trabajá 25 minutos; podés empezar con 10.",
      "Descansá 5 minutos y evaluá si conviene continuar.",
    ],
  ],
  [
    "time-blocking",
    "Bloques de tiempo",
    "ORGANIZACIÓN",
    "Reservar un lugar real para estudiar en la semana.",
    [
      "Marcá colegio, sueño y actividades.",
      "Elegí un espacio disponible.",
      "Reservá una acción concreta dejando margen.",
    ],
  ],
  [
    "backward-planning",
    "Planificación hacia atrás",
    "ORGANIZACIÓN",
    "Preparar pasos desde una fecha de entrega.",
    [
      "Anotá la fecha real.",
      "Separá revisión, práctica y comprensión.",
      "Ubicá los pasos anteriores dejando margen.",
    ],
  ],
  [
    "blurting",
    "Hoja en blanco",
    "ALTA",
    "Recuperar lo que recordás y detectar huecos.",
    [
      "Cerrá el material.",
      "Escribí o dibujá lo que recordás.",
      "Compará y corregí con otro color.",
    ],
  ],
  [
    "flashcards",
    "Tarjetas y Leitner",
    "ALTA",
    "Preguntas breves que exigen recordar.",
    [
      "Escribí una sola pregunta por tarjeta.",
      "Intentá responder antes de darla vuelta.",
      "Volvé antes a las difíciles y espaciá las recordadas.",
    ],
  ],
  [
    "concept-maps",
    "Mapas conceptuales",
    "MIXTA",
    "Representar relaciones entre ideas.",
    [
      "Elegí conceptos centrales.",
      "Unilos con verbos que expliquen la relación.",
      "Reconstruí el mapa sin mirar y comprobalo.",
    ],
  ],
  [
    "elaborative-interrogation",
    "Preguntar por qué",
    "MODERADA",
    "Relacionar una afirmación con conocimientos previos.",
    [
      "Elegí una afirmación.",
      "Preguntá por qué y cómo se conecta con otra idea.",
      "Verificá la explicación en una fuente confiable.",
    ],
  ],
  [
    "worked-examples",
    "Ejemplos resueltos",
    "MODERADA",
    "Estudiar el razonamiento antes de resolver un caso nuevo.",
    [
      "Leé un ejemplo similar resuelto.",
      "Explicá cada paso y su motivo.",
      "Resolvé otro ejemplo con menos ayuda.",
    ],
  ],
  [
    "sq3r",
    "SQ3R: lectura guiada",
    "MIXTA",
    "Explorar, preguntar, leer, recordar y revisar.",
    [
      "Explorá títulos y formulá preguntas.",
      "Leé buscando respuestas.",
      "Recordá sin mirar y revisá lo que falta.",
    ],
  ],
];
export const methods: StudyMethod[] = entries.map(
  ([id, name, evidence, description, steps]) => ({
    id,
    name,
    evidence,
    description,
    steps,
    category: evidence === "ORGANIZACIÓN" ? "Organización" : "Aprendizaje",
    objective: description,
    when:
      id === "worked-examples"
        ? "Al comenzar un procedimiento nuevo."
        : "Cuando necesitás comprender, recordar o revisar un tema.",
    avoid:
      "No lo uses como único recurso ni como prueba automática de dominio.",
    duration: id === "pomodoro" ? 25 : 10,
    subjects:
      id === "worked-examples"
        ? ["Matemática", "Física", "Química"]
        : ["Todas"],
    age: "Secundaria",
    example:
      id === "retrieval"
        ? "Sin mirar el apunte, explicá qué cambia en una reacción química."
        : "Elegí una idea del tema actual y aplicá los pasos; después comprobá con el material.",
    prompt:
      "Enseñá " +
      name +
      " con una pregunta por vez. Pedí un intento y ofrecé feedback. No resuelvas una entrega escolar.",
    evidence_note:
      evidence === "ORGANIZACIÓN"
        ? "Herramienta de organización; no implica una ventaja universal de aprendizaje."
        : evidence === "MIXTA"
          ? "Los resultados dependen de la tarea y la implementación. Revisión pedagógica pendiente."
          : "La categoría corresponde a la técnica subyacente, no a una validación clínica de esta app. Revisión pedagógica pendiente.",
  }),
);
export const methodById = (id: string) =>
  methods.find((m) => m.id === id) ?? methods[0];
