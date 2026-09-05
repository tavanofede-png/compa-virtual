import { z } from "zod";
import { type Snapshot, catalog } from "./types";
import {
  profileSchema,
  itemSchema,
  blockSchema,
  companionSchema,
  penalty,
} from "./validation";
import { generatePlan } from "./planner";
import { today, addDays } from "./time";
export interface Command {
  type: string;
  payload: unknown;
}
const obj = z.record(z.string(), z.unknown());
const text = z.string().trim().min(1).max(4000);
const id = z.string().min(1).max(150);
export function transition(
  previous: Snapshot,
  command: Command,
  now: string,
): Snapshot {
  const s = structuredClone(previous),
    p = obj.parse(command.payload),
    uid = () => crypto.randomUUID();
  const current = today(s.profile?.timezone, now);
  const requireProfile = () => {
    if (!s.profile) throw Error("Completá tu perfil primero.");
    return s.profile;
  };
  const reward = (amount: number) => {
    s.coins += amount;
    s.xp += amount;
  };
  switch (command.type) {
    case "profile.save":
      s.profile = { id: s.profile?.id ?? uid(), ...profileSchema.parse(p) };
      break;
    case "companion.save": {
      const next = companionSchema.parse(p);
      for (const key of ["accessory", "outfit", "decoration"] as const)
        if (next[key] !== "none" && !s.inventory.includes(next[key]))
          throw Error("Primero desbloqueá ese objeto.");
        else if (
          next[key] !== "none" &&
          !catalog.some(
            (item) => item.id === next[key] && item.category === key,
          )
        )
          throw Error("Ese objeto no corresponde a esta parte de tu compa.");
      s.companion = { ...s.companion, ...next };
      break;
    }
    case "subject.save": {
      const value = z
        .object({
          id: id.optional(),
          name: z.string().trim().min(1).max(80),
          color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        })
        .parse(p);
      const existing = s.subjects.find((x) => x.id === value.id);
      if (value.id && !existing) throw Error("Materia no encontrada.");
      if (existing) Object.assign(existing, value);
      else s.subjects.push({ ...value, id: uid() });
      break;
    }
    case "block.save": {
      const value = blockSchema.parse(p);
      const existing = s.blocks.find((x) => x.id === p.id);
      if (p.id && !existing) throw Error("Horario no encontrado.");
      if (existing) Object.assign(existing, value);
      else s.blocks.push({ ...value, id: uid() });
      break;
    }
    case "block.delete":
      s.blocks = s.blocks.filter((x) => x.id !== id.parse(p.id));
      break;
    case "item.save": {
      const value = itemSchema.parse(p);
      if (!s.subjects.some((x) => x.id === value.subject_id))
        throw Error("Elegí una materia.");
      const existing = s.items.find((x) => x.id === p.id);
      if (p.id && !existing) throw Error("Actividad no encontrada.");
      if (existing) Object.assign(existing, value, { status: existing.status });
      else s.items.push({ ...value, status: "PENDING", id: uid() });
      break;
    }
    case "item.complete": {
      const item = s.items.find((x) => x.id === id.parse(p.id));
      if (!item) throw Error("Actividad no encontrada.");
      if (item.status === "DONE") break;
      item.status = "DONE";
      reward(5);
      break;
    }
    case "plan.propose": {
      const profile = requireProfile();
      const active = s.plans.find((x) => x.status === "ACCEPTED");
      const proposed = generatePlan({
        profile,
        items: s.items,
        blocks: s.blocks,
        sessions: s.sessions,
        now,
        locked: active?.slots.filter((x) => x.status === "PENDING"),
      });
      const planId = uid();
      s.plans = s.plans.filter((x) => x.status !== "PROPOSED");
      s.plans.push({
        id: planId,
        status: "PROPOSED",
        version: Math.max(0, ...s.plans.map((x) => x.version)) + 1,
        created_at: now,
        ...proposed,
        slots: proposed.slots.map((x) => ({
          ...x,
          id:
            planId +
            ":" +
            x.academic_item_id +
            ":" +
            x.date +
            ":" +
            x.start_minute,
        })),
      });
      break;
    }
    case "plan.accept": {
      const plan = s.plans.find((x) => x.id === p.id);
      if (!plan || plan.version !== p.version)
        throw Error("El plan cambió. Actualizá para revisarlo.");
      if (plan.status === "ACCEPTED") break;
      if (plan.status !== "PROPOSED") throw Error("Este plan fue reemplazado.");
      s.plans.forEach((x) => {
        if (x.status === "ACCEPTED") x.status = "SUPERSEDED";
      });
      plan.status = "ACCEPTED";
      break;
    }
    case "session.complete": {
      const v = z.object({ slot_id: id, reflection: text }).parse(p);
      const plan = s.plans.find((x) => x.status === "ACCEPTED"),
        slot = plan?.slots.find((x) => x.id === v.slot_id);
      if (!slot)
        throw Error("Aceptá el plan vigente antes de registrar la sesión.");
      if (slot.status === "COMPLETE") break;
      if (slot.status !== "PENDING") throw Error("La sesión ya fue revisada.");
      if (slot.date > current)
        throw Error("Esta sesión está programada para otro día.");
      slot.status = "COMPLETE";
      s.sessions.push({
        id: uid(),
        slot_id: slot.id,
        academic_item_id: slot.academic_item_id,
        method_id: slot.method_id,
        duration_minutes: slot.duration_minutes,
        reflection: v.reflection,
        completed_at: now,
      });
      reward(10);
      break;
    }
    case "checkin.save": {
      const v = z
        .object({
          learned: z.string().max(2000),
          news: z.string().max(2000),
          outcome: z.enum(["DONE", "PENDING", "EXCUSED", "UNCONFIRMED"]),
          exception_reason: z.string().max(1000).optional(),
        })
        .parse(p);
      const existing = s.checkins.find((x) => x.date === current);
      if (existing && existing.outcome !== "UNCONFIRMED")
        throw Error("El check-in de hoy ya está registrado.");
      if (v.outcome === "EXCUSED" && !v.exception_reason?.trim())
        throw Error("Contanos brevemente qué cambió.");
      const active = s.plans.find((x) => x.status === "ACCEPTED");
      const pending =
        active?.slots.filter(
          (x) => x.date === current && x.status === "PENDING",
        ) ?? [];
      const last7 = s.checkins
        .filter(
          (x) => x.date >= addDays(current, -6) && x.outcome === "PENDING",
        )
        .reduce(
          (sum, x) =>
            sum + ((x as typeof x & { deducted?: number }).deducted ?? 0),
          0,
        );
      const deducted = penalty(
        s.coins,
        last7,
        v.outcome === "PENDING" && pending.length > 0,
        v.outcome === "EXCUSED",
      );
      s.coins -= deducted;
      if (v.outcome === "PENDING" || v.outcome === "EXCUSED")
        pending.forEach((x) => {
          x.status = v.outcome === "EXCUSED" ? "EXCUSED" : "MISSED";
        });
      if (existing) Object.assign(existing, v, { deducted });
      else s.checkins.push({ id: uid(), date: current, ...v, deducted });
      break;
    }
    case "memory.save": {
      const v = z
        .object({
          content: text,
          category: z.enum(["PREFERENCE", "TOPIC", "PROGRESS"]),
        })
        .parse(p);
      const existing = s.memories.find((x) => x.id === p.id);
      if (p.id && !existing) throw Error("Recuerdo no encontrado.");
      if (existing) Object.assign(existing, v);
      else s.memories.push({ id: uid(), ...v });
      break;
    }
    case "memory.delete":
      s.memories = s.memories.filter((x) => x.id !== id.parse(p.id));
      break;
    case "inventory.buy": {
      const item = catalog.find((x) => x.id === p.id);
      if (!item) throw Error("Objeto no encontrado.");
      if (s.inventory.includes(item.id)) break;
      if (s.coins < item.price) throw Error("Todavía no alcanzan las monedas.");
      s.coins -= item.price;
      s.inventory.push(item.id);
      break;
    }
    case "preferences.save":
      s.preferences = z
        .object({
          checkin_enabled: z.boolean(),
          checkin_minute: z.number().int().min(0).max(1439),
          quiet_start: z.number().int().min(0).max(1439),
          quiet_end: z.number().int().min(0).max(1439),
          weekends: z.boolean(),
        })
        .parse(p);
      break;
    case "quiz.submit": {
      const v = z
        .object({ id: id, answers: z.record(z.string(), z.string().max(4000)) })
        .parse(p);
      const quiz = s.quizzes.find((x) => x.id === v.id);
      if (!quiz) throw Error("Práctica no encontrada.");
      if (quiz.questions.some((q) => !v.answers[q.id]?.trim()))
        throw Error("Intentá responder todas las preguntas.");
      const normalize = (x: string) =>
        x
          .trim()
          .toLocaleLowerCase("es")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[.,!?¿¡]/g, "")
          .replace(/\s+/g, " ");
      const results = quiz.questions.map((q) => ({
        question_id: q.id,
        correct: normalize(v.answers[q.id]) === normalize(q.answer ?? ""),
        answer: q.answer ?? "",
        explanation: q.explanation ?? "",
      }));
      const prior = s.attempts.filter((x) => x.quiz_id === quiz.id),
        score = Math.round(
          (results.filter((x) => x.correct).length / results.length) * 100,
        );
      s.attempts.push({
        id: uid(),
        quiz_id: quiz.id,
        answers: v.answers,
        results,
        score,
        submitted_at: now,
      });
      if (!prior.length) reward(quiz.kind === "MOCK" ? 15 : 10);
      else if (
        !(s.correction_bonuses ?? []).includes(quiz.id) &&
        score > Math.max(...prior.map((a) => a.score))
      ) {
        reward(5);
        s.correction_bonuses = [...(s.correction_bonuses ?? []), quiz.id];
      }
      break;
    }
    case "flashcard.rate": {
      const value = z
        .object({ quiz_id: id, question_id: id, remembered: z.boolean() })
        .parse(p);
      const quiz = s.quizzes.find(
        (q) => q.id === value.quiz_id && q.kind === "FLASHCARDS",
      );
      if (!quiz?.questions.some((q) => q.id === value.question_id))
        throw Error("Tarjeta no encontrada.");
      const attempt = s.attempts.filter((a) => a.quiz_id === quiz.id).at(-1);
      if (!attempt)
        throw Error("Intentá responder antes de revisar la tarjeta.");
      const reviews = s.flashcard_reviews ?? [],
        previous = reviews.find(
          (r) => r.quiz_id === quiz.id && r.question_id === value.question_id,
        );
      if (previous?.attempt_id === attempt.id) break;
      const box = value.remembered ? Math.min(5, (previous?.box ?? 0) + 1) : 0;
      const review = {
        quiz_id: quiz.id,
        question_id: value.question_id,
        attempt_id: attempt.id,
        box,
        due_date: addDays(current, [1, 2, 4, 7, 14, 30][box]),
      };
      s.flashcard_reviews = [...reviews.filter((r) => r !== previous), review];
      break;
    }
    case "notification.read": {
      const n = s.notifications.find((x) => x.id === p.id);
      if (n) n.read_at = now;
      break;
    }
    default:
      throw Error("Operación no reconocida.");
  }
  const dates = new Set([
    ...s.sessions.map((x) => today(s.profile?.timezone, x.completed_at)),
    ...s.attempts.map((x) => today(s.profile?.timezone, x.submitted_at)),
  ]);
  let date = dates.has(current) ? current : addDays(current, -1),
    streak = 0;
  while (dates.has(date)) {
    streak++;
    date = addDays(date, -1);
  }
  s.streak = streak;
  return s;
}
export function publicSnapshot(state: Snapshot): Snapshot {
  const s = structuredClone(state);
  s.quizzes.forEach((q) =>
    q.questions.forEach((question) => {
      delete question.answer;
      delete question.explanation;
    }),
  );
  return s;
}
