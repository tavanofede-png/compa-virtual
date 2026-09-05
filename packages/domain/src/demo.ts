import { emptySnapshot, type Snapshot } from "./types";
import { today, addDays } from "./time";
export function demoSnapshot(): Snapshot {
  const s = emptySnapshot(),
    date = today(),
    math = "00000000-0000-4000-8000-000000000001",
    bio = "00000000-0000-4000-8000-000000000002";
  s.profile = {
    id: "00000000-0000-4000-8000-000000000099",
    nickname: "Alex",
    birth_date: "2000-01-01",
    school_year: 3,
    timezone: "America/Argentina/Buenos_Aires",
    country: "AR",
    sleep_start: 1380,
    sleep_end: 420,
    autonomy_level: 2,
    onboarding_complete: true,
  };
  s.subjects = [
    { id: math, name: "Matemática", color: "#bd663f" },
    { id: bio, name: "Biología", color: "#638665" },
  ];
  s.blocks = Array.from({ length: 7 }, (_, day) => ({
    id: crypto.randomUUID(),
    label: "Mi tiempo para estudiar",
    day_of_week: day,
    start_minute: 900,
    end_minute: 1260,
    kind: "AVAILABLE" as const,
  }));
  s.items = [
    {
      id: "00000000-0000-4000-8000-000000000003",
      subject_id: math,
      title: "Practicar ecuaciones",
      description: "Resolver y comprobar los ejercicios de la guía.",
      kind: "TASK",
      due_date: addDays(date, 2),
      due_time: null,
      priority: 2,
      difficulty: 3,
      effort_minutes: 50,
      status: "PENDING",
      source: "MANUAL",
      topics: ["Ecuaciones de primer grado"],
    },
    {
      id: "00000000-0000-4000-8000-000000000004",
      subject_id: bio,
      title: "Evaluación: la célula",
      description: "Organelas y diferencias entre células.",
      kind: "EXAM",
      due_date: addDays(date, 5),
      due_time: null,
      priority: 3,
      difficulty: 3,
      effort_minutes: 100,
      status: "PENDING",
      source: "MANUAL",
      topics: ["Organelas", "Célula animal y vegetal"],
    },
  ];
  s.coins = 30;
  s.xp = 40;
  s.quizzes = [
    {
      id: "demo-quiz",
      subject_id: math,
      title: "Una ecuación, un paso",
      kind: "QUIZ",
      basis: "GENERAL",
      questions: [
        {
          id: "demo-q1",
          prompt: "Si 2x + 4 = 10, ¿cuánto vale x?",
          kind: "CHOICE",
          options: ["2", "3", "5", "7"],
          answer: "3",
          explanation:
            "Restá 4 de ambos lados: 2x = 6. Dividí ambos lados por 2: x = 3. Comprobación: 2 × 3 + 4 = 10.",
          topic: "Ecuaciones",
          citations: [],
        },
      ],
    },
  ];
  return s;
}
