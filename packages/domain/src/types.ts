export type ItemKind =
  | "TASK"
  | "EXAM"
  | "PROJECT"
  | "READING"
  | "PRESENTATION"
  | "HOMEWORK"
  | "OTHER";
export type Source =
  "MANUAL" | "VOICE" | "CLASSROOM" | "PHOTO" | "AI_EXTRACTED";
export interface Profile {
  id: string;
  nickname: string;
  birth_date: string;
  school_year: number;
  timezone: string;
  country: string;
  sleep_start: number;
  sleep_end: number;
  autonomy_level: number;
  onboarding_complete: boolean;
  school_day_limit?: number;
  free_day_limit?: number;
}
export interface Companion {
  id: string;
  name: string;
  base: number;
  palette: number;
  eyes: number;
  mouth: number;
  accessory: string;
  outfit: string;
  personality: string;
  room_theme: string;
  decoration: string;
}
export interface Subject {
  id: string;
  name: string;
  color: string;
}
export interface WeeklyBlock {
  id: string;
  label: string;
  day_of_week: number;
  start_minute: number;
  end_minute: number;
  kind: "AVAILABLE" | "SCHOOL" | "BUSY" | "REST";
  exception_date?: string | null;
}
export interface AcademicItem {
  id: string;
  subject_id: string;
  title: string;
  description: string;
  kind: ItemKind;
  due_date: string;
  due_time?: string | null;
  priority: number;
  difficulty: number;
  effort_minutes: number;
  status: "PENDING" | "DONE";
  source: Source;
  topics: string[];
}
export interface PlanSlot {
  id: string;
  academic_item_id: string;
  date: string;
  start_minute: number;
  duration_minutes: number;
  method_id: string;
  objective: string;
  status: "PENDING" | "COMPLETE" | "MISSED" | "EXCUSED";
}
export interface StudyPlan {
  id: string;
  status: "PROPOSED" | "ACCEPTED" | "SUPERSEDED";
  version: number;
  slots: PlanSlot[];
  unscheduled: { academic_item_id: string; minutes: number; reason: string }[];
  created_at: string;
}
export interface StudySession {
  id: string;
  slot_id: string;
  academic_item_id: string;
  method_id: string;
  duration_minutes: number;
  reflection: string;
  completed_at: string;
}
export interface Checkin {
  id: string;
  date: string;
  learned: string;
  news: string;
  outcome: "DONE" | "PENDING" | "EXCUSED" | "UNCONFIRMED";
  exception_reason?: string;
  deducted?: number;
}
export interface Material {
  id: string;
  subject_id: string;
  title: string;
  path: string;
  mime_type: string;
  size: number;
  status: "QUEUED" | "PROCESSING" | "READY" | "FAILED";
  error_message?: string | null;
  page_count?: number;
}
export interface Citation {
  material_id: string;
  chunk_id: string;
  label: string;
}
export interface Question {
  id: string;
  prompt: string;
  kind: "CHOICE" | "SHORT";
  options: string[];
  answer?: string;
  explanation?: string;
  topic: string;
  citations: Citation[];
}
export interface Quiz {
  id: string;
  subject_id: string;
  title: string;
  kind: "QUIZ" | "MOCK" | "FLASHCARDS";
  material_id?: string | null;
  questions: Question[];
  basis: "MATERIAL" | "GENERAL";
}
export interface Attempt {
  id: string;
  quiz_id: string;
  answers: Record<string, string>;
  results: {
    question_id: string;
    correct: boolean;
    explanation: string;
    answer: string;
  }[];
  score: number;
  submitted_at: string;
}
export interface Memory {
  id: string;
  content: string;
  category: "PREFERENCE" | "TOPIC" | "PROGRESS";
}
export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  created_at: string;
}
export interface Notification {
  id: string;
  title: string;
  body: string;
  route: string;
  created_at: string;
  read_at?: string | null;
}
export interface NotificationPreferences {
  checkin_enabled: boolean;
  checkin_minute: number;
  quiet_start: number;
  quiet_end: number;
  weekends: boolean;
}
export interface Snapshot {
  correction_bonuses?: string[];
  flashcard_reviews?: {
    quiz_id: string;
    question_id: string;
    attempt_id: string;
    box: number;
    due_date: string;
  }[];
  profile: Profile | null;
  companion: Companion;
  subjects: Subject[];
  blocks: WeeklyBlock[];
  items: AcademicItem[];
  plans: StudyPlan[];
  sessions: StudySession[];
  checkins: Checkin[];
  materials: Material[];
  quizzes: Quiz[];
  attempts: Attempt[];
  memories: Memory[];
  messages: Message[];
  notifications: Notification[];
  inventory: string[];
  coins: number;
  xp: number;
  streak: number;
  preferences: NotificationPreferences;
}
export interface StudyMethod {
  id: string;
  name: string;
  category: string;
  description: string;
  objective: string;
  when: string;
  avoid: string;
  steps: string[];
  duration: number;
  subjects: string[];
  age: string;
  example: string;
  prompt: string;
  evidence: "ALTA" | "MODERADA" | "MIXTA" | "ORGANIZACIÓN";
  evidence_note: string;
}
export const personalities = [
  "Tranquilo",
  "Motivador",
  "Divertido",
  "Directo",
  "Curioso",
  "Tranquilo con humor",
  "Entusiasta",
];
export const palettes = [
  "Musgo",
  "Miel",
  "Lavanda",
  "Océano",
  "Coral",
  "Menta",
  "Cielo",
  "Durazno",
];
export const catalog = [
  {
    id: "scarf",
    name: "Bufanda aventurera",
    category: "accessory",
    price: 30,
    symbol: "🧣",
  },
  {
    id: "glasses",
    name: "Anteojos curiosos",
    category: "accessory",
    price: 40,
    symbol: "👓",
  },
  {
    id: "headphones",
    name: "Auriculares de foco",
    category: "accessory",
    price: 50,
    symbol: "🎧",
  },
  {
    id: "bow",
    name: "Moño de explorador",
    category: "accessory",
    price: 25,
    symbol: "🎀",
  },
  {
    id: "star-shirt",
    name: "Remera estelar",
    category: "outfit",
    price: 35,
    symbol: "⭐",
  },
  {
    id: "overalls",
    name: "Jardinero de ideas",
    category: "outfit",
    price: 45,
    symbol: "🌿",
  },
  {
    id: "plant",
    name: "Planta de escritorio",
    category: "decoration",
    price: 25,
    symbol: "🌱",
  },
  {
    id: "lamp",
    name: "Lámpara de estrellas",
    category: "decoration",
    price: 45,
    symbol: "💡",
  },
  {
    id: "globe",
    name: "Un mundo por descubrir",
    category: "decoration",
    price: 60,
    symbol: "🌍",
  },
] as const;
export const defaultCompanion: Companion = {
  id: "companion",
  name: "Milo",
  base: 0,
  palette: 0,
  eyes: 0,
  mouth: 0,
  accessory: "none",
  outfit: "none",
  personality: "Tranquilo con humor",
  room_theme: "evening",
  decoration: "none",
};
export const emptySnapshot = (): Snapshot => ({
  profile: null,
  companion: { ...defaultCompanion },
  subjects: [],
  blocks: [],
  items: [],
  plans: [],
  sessions: [],
  checkins: [],
  materials: [],
  quizzes: [],
  attempts: [],
  memories: [],
  messages: [],
  notifications: [],
  inventory: [],
  coins: 0,
  xp: 0,
  streak: 0,
  preferences: {
    checkin_enabled: true,
    checkin_minute: 1080,
    quiet_start: 1320,
    quiet_end: 420,
    weekends: false,
  },
});
