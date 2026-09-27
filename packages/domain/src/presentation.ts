import type { PlanSlot, Snapshot } from "./types";
import { addDays, clock, dateLabel, localNow, today, weekday } from "./time";
import { methodById, methods } from "./methods";

export const freeStudyDurations = [10, 20, 25, 30, 45, 60] as const;

export function prepareFreeStudy(s: Snapshot) {
  const previous = s.sessions
    .filter((session) => session.source === "FREE")
    .sort((a, b) => b.completed_at.localeCompare(a.completed_at))[0];
  const chosenMinutes = previous?.planned_minutes ?? 25;
  const plannedMinutes = freeStudyDurations.reduce((best, candidate) =>
    Math.abs(candidate - chosenMinutes) < Math.abs(best - chosenMinutes)
      ? candidate
      : best,
  );
  const subjectId = previous?.subject_id;
  const methodId = previous?.method_id;
  return {
    subjectId: subjectId && s.subjects.some((subject) => subject.id === subjectId)
      ? subjectId
      : "",
    methodId: methodId && methods.some((method) => method.id === methodId)
      ? methodId
      : "retrieval",
    plannedMinutes,
    remembered: Boolean(previous),
  };
}

export function prepareDailyStudy(s: Snapshot, instant?: string) {
  const remembered = prepareFreeStudy(s);
  const date = today(s.profile?.timezone, instant);
  const through = addDays(date, 7);
  const studiedToday = new Set(
    s.sessions
      .filter(
        (session) =>
          session.academic_item_id &&
          (session.actual_seconds ?? 0) >= 300 &&
          today(s.profile?.timezone, session.completed_at) === date,
      )
      .map((session) => session.academic_item_id),
  );
  const item = s.items
    .filter(
      (entry) =>
        entry.status === "PENDING" &&
        entry.due_date >= date &&
        entry.due_date <= through &&
        !studiedToday.has(entry.id) &&
        s.subjects.some((subject) => subject.id === entry.subject_id),
    )
    .sort(
      (a, b) =>
        a.due_date.localeCompare(b.due_date) ||
        (a.due_time ?? "").localeCompare(b.due_time ?? "") ||
        b.priority - a.priority ||
        a.id.localeCompare(b.id),
    )[0];
  if (item)
    return {
      ...remembered,
      objective: item.title,
      subjectId: item.subject_id,
      academicItemId: item.id,
      origin: "ACTIVITY" as const,
    };
  const subject = s.subjects.find((entry) => entry.id === remembered.subjectId);
  return {
    ...remembered,
    objective: subject ? `Repasar ${subject.name}` : "",
    academicItemId: undefined,
    origin: subject ? ("RECENT" as const) : ("EMPTY" as const),
  };
}

export const designTokens = {
  background: "#f8f4f0",
  surface: "#fffdfa",
  ink: "#101e32",
  muted: "#677186",
  yellow: "#ffca55",
  yellowEdge: "#e5a52d",
  blue: "#345cce",
  green: "#428466",
  line: "#e8e1db",
  purple: "#8960c7",
  radius: 24,
  touch: 48,
} as const;
export const destinations = [
  { id: "room", label: "Inicio" },
  { id: "agenda", label: "Agenda" },
  { id: "study", label: "Estudiar" },
  { id: "progress", label: "Logros" },
  { id: "compa", label: "Compa" },
] as const;
export function homeSummary(s: Snapshot, instant?: string) {
  const timezone = s.profile?.timezone;
  const date = today(timezone, instant);
  const plan = s.plans.find((p) => p.status === "ACCEPTED");
  const slots = (plan?.slots.filter((p) => p.date === date) ?? []).sort(
    (a, b) => a.start_minute - b.start_minute,
  );
  const remaining = slots.filter((p) => p.status === "PENDING");
  const pending = s.items
    .filter((item) => item.status === "PENDING")
    .sort(
      (a, b) =>
        a.due_date.localeCompare(b.due_date) || a.id.localeCompare(b.id),
    );
  const dueToday = pending.filter((item) => item.due_date === date);
  const overdue = pending.filter((item) => item.due_date < date);
  const nextDue = pending.find((item) => item.due_date >= date);
  const completedSessions = s.sessions.filter(
    (session) =>
      localNow(timezone, session.completed_at).toPlainDate().toString() === date,
  ).length;
  const routineTime =
    s.preferences.daily_study_enabled &&
    (s.preferences.weekends || ![0, 6].includes(weekday(date))) &&
    !s.activeSession &&
    completedSessions === 0
      ? clock(s.preferences.daily_study_minute ?? 1020)
      : undefined;
  let deadlineSummary = "Sin entregas pendientes";
  if (overdue.length)
    deadlineSummary = `${overdue.length} ${overdue.length === 1 ? "actividad con fecha anterior" : "actividades con fecha anterior"} para revisar`;
  else if (dueToday.length)
    deadlineSummary = `${dueToday.length} ${dueToday.length === 1 ? "actividad vence" : "actividades vencen"} hoy`;
  else if (nextDue)
    deadlineSummary = `Próxima fecha: ${nextDue.title} · ${dateLabel(nextDue.due_date)}`;
  return {
    date,
    plan,
    slots,
    next: remaining[0],
    minutes: remaining.reduce((sum, p) => sum + p.duration_minutes, 0),
    pending,
    dueToday,
    overdue,
    nextDue,
    completedSessions,
    routineTime,
    progressSummary: `${completedSessions} ${completedSessions === 1 ? "sesión completada" : "sesiones completadas"} hoy`,
    deadlineSummary,
    completed: slots.filter((p) => p.status === "COMPLETE").length,
    checkedIn: s.checkins.some((c) => c.date === date),
  };
}

export type StudyActionKind =
  | "free-study"
  | "propose-plan"
  | "review-plan"
  | "start-session"
  | "resume-session"
  | "practice"
  | "see-agenda";

export interface StudyAction {
  kind: StudyActionKind;
  cta: string;
  detail: string;
  slot?: PlanSlot;
  quizId?: string;
}

export function nextStudyAction(s: Snapshot, instant?: string): StudyAction {
  const day = homeSummary(s, instant);
  if (s.activeSession)
    return {
      kind: "resume-session",
      cta: "Continuar mi sesión",
      detail: s.activeSession.objective,
    };
  const proposed = s.plans.find((p) => p.status === "PROPOSED");
  const dueCards = (s.flashcard_reviews ?? []).filter(
    (review) => review.due_date <= day.date,
  );
  if (proposed && !day.plan)
    return {
      kind: "review-plan",
      cta: "Revisar el plan propuesto",
      detail: "Kusiy armó una propuesta. Aceptala solo si te cierra.",
    };
  if (day.next) {
    const method = methodById(day.next.method_id);
    return {
      kind: "start-session",
      cta: "Empezar sesión",
      detail: `${method.name} · ${day.next.duration_minutes} min`,
      slot: day.next,
    };
  }
  if (day.pending.length && !day.plan) {
    const prepared = prepareDailyStudy(s, instant);
    if (prepared.academicItemId)
      return {
        kind: "free-study",
        cta: "Estudiar ahora",
        detail: `Sugerencia: ${prepared.objective} · ${prepared.plannedMinutes} min. Podés cambiarla.`,
      };
    return {
      kind: "propose-plan",
      cta: "Preparar mi plan",
      detail: "Hay actividades pendientes. Generamos bloques para estudiarlos.",
    };
  }
  if (dueCards[0])
    return {
      kind: "practice",
      cta: "Repasar tarjetas",
      detail: "Hay recuperaciones programadas para hoy.",
      quizId: dueCards[0].quiz_id,
    };
  if (day.pending.length)
    return {
      kind: "see-agenda",
      cta: "Ver mi agenda",
      detail: "Hoy no quedan bloques. Revisá lo que sigue.",
    };
  return {
    kind: "free-study",
    cta: "Estudiar libre",
    detail: s.subjects.length
      ? "Elegí qué querés repasar. No hace falta crear una tarea ni un plan."
      : "Podés empezar ahora y agregar tus materias después.",
  };
}
