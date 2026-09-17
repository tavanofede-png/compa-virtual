import { z } from "zod";
import { characterIds, roomIds } from "./companions";
import { wardrobeError } from "./wardrobe";
const date = z.iso.date();
export const profileSchema = z.object({
  nickname: z.string().trim().min(1).max(40),
  birth_date: date,
  school_year: z.number().int().min(1).max(7),
  timezone: z
    .string()
    .min(1)
    .refine((v) => {
      try {
        new Intl.DateTimeFormat("es", { timeZone: v });
        return true;
      } catch {
        return false;
      }
    }, "Zona horaria inválida"),
  country: z.literal("AR"),
  sleep_start: z.number().int().min(0).max(1439),
  sleep_end: z.number().int().min(0).max(1439),
  autonomy_level: z.number().int().min(1).max(4),
  onboarding_complete: z.boolean(),
  school_day_limit: z.number().int().min(10).max(180).default(60),
  free_day_limit: z.number().int().min(10).max(240).default(90),
});
export const itemSchema = z.object({
  subject_id: z.uuid(),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(4000).default(""),
  kind: z.enum([
    "TASK",
    "EXAM",
    "PROJECT",
    "READING",
    "PRESENTATION",
    "HOMEWORK",
    "OTHER",
  ]),
  due_date: date,
  due_time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable()
    .optional(),
  priority: z.number().int().min(1).max(3),
  difficulty: z.number().int().min(1).max(5),
  effort_minutes: z.number().int().min(10).max(1200),
  status: z.enum(["PENDING", "DONE"]).default("PENDING"),
  source: z.enum(["MANUAL", "AI_EXTRACTED"]).default("MANUAL"),
  topics: z.array(z.string().max(100)).max(30),
});
export const blockSchema = z
  .object({
    label: z.string().trim().min(1).max(80),
    day_of_week: z.number().int().min(0).max(6),
    start_minute: z.number().int().min(0).max(1439),
    end_minute: z.number().int().min(1).max(1440),
    kind: z.enum(["AVAILABLE", "SCHOOL", "BUSY", "REST"]),
    exception_date: date.nullable().optional(),
  })
  .refine(
    (b) => b.end_minute > b.start_minute,
    "El fin debe ser posterior al inicio.",
  );
export const companionSchema = z
  .object({
    character_id: z.enum(characterIds).optional(),
    room_style: z.enum(roomIds).optional(),
    wardrobe: z.array(z.string().max(80)).max(12).optional(),
    avatar_style: z.enum(["boy", "girl", "neutral"]).optional(),
    skin_tone: z.number().int().min(0).max(7).optional(),
    hair_style: z
      .enum(["short", "curls", "afro", "bob", "long", "braids"])
      .optional(),
    hair_color: z.number().int().min(0).max(5).optional(),
    clothing_style: z.enum(["hoodie", "tee", "jacket", "overshirt"]).optional(),
    clothing_color: z.number().int().min(0).max(7).optional(),
    name: z.string().trim().min(1).max(30),
    base: z.number().int().min(0).max(2),
    palette: z.number().int().min(0).max(7),
    eyes: z.number().int().min(0).max(5),
    mouth: z.number().int().min(0).max(5),
    accessory: z.string().max(40),
    outfit: z.string().max(40),
    personality: z.string().max(40),
    room_theme: z.enum(["evening", "day", "night"]),
    decoration: z.string().max(40),
  })
  .superRefine((value, context) => {
    if (value.character_id && (!value.room_style || !value.wardrobe)) {
      context.addIssue({
        code: "custom",
        message: "Elegí una habitación y un conjunto para tu compa.",
      });
    }
    if (value.wardrobe) {
      const message = wardrobeError(value.wardrobe);
      if (message)
        context.addIssue({ code: "custom", message, path: ["wardrobe"] });
    }
  });
export function penalty(
  balance: number,
  lastSevenDays: number,
  recognized: boolean,
  excused: boolean,
) {
  return !recognized || excused
    ? 0
    : Math.min(5, Math.max(0, balance), Math.max(0, 15 - lastSevenDays));
}
export const uploadTypes = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "image/jpeg",
  "image/png",
  "image/webp",
];
export const maxUploadBytes = 25 * 1024 * 1024;
export function validateUpload(name: string, type: string, size: number) {
  if (!uploadTypes.includes(type))
    throw Error("Usá PDF, DOCX, TXT, JPG, PNG o WebP.");
  if (size <= 0 || size > maxUploadBytes)
    throw Error("El archivo debe tener contenido y pesar hasta 25 MB.");
  const exts: Record<string, string[]> = {
    "application/pdf": ["pdf"],
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
      "docx",
    ],
    "text/plain": ["txt"],
    "image/jpeg": ["jpg", "jpeg"],
    "image/png": ["png"],
    "image/webp": ["webp"],
  };
  if (!exts[type]?.includes(name.split(".").pop()?.toLowerCase() ?? ""))
    throw Error("La extensión no coincide con el tipo de archivo.");
}
