import type {
  AcademicItem,
  Profile,
  WeeklyBlock,
  PlanSlot,
  StudySession,
  StudyPlan,
} from "./types";
import {
  addDays,
  daysUntil,
  weekday,
  localNow,
  minuteOf,
  isQuiet,
} from "./time";
export interface PlannerInput {
  profile: Profile;
  items: AcademicItem[];
  blocks: WeeklyBlock[];
  sessions: StudySession[];
  now: string;
  locked?: PlanSlot[];
  horizon?: number;
}
export function availableMinutes(
  date: string,
  profile: Profile,
  blocks: WeeklyBlock[],
): boolean[] {
  const relevant = blocks.filter((b) =>
    b.exception_date
      ? b.exception_date === date
      : b.day_of_week === weekday(date),
  );
  const free = Array<boolean>(1440).fill(false);
  for (const b of relevant.filter((b) => b.kind === "AVAILABLE"))
    for (let t = b.start_minute; t < b.end_minute; t++) free[t] = true;
  for (const b of relevant.filter((b) => b.kind !== "AVAILABLE"))
    for (let t = b.start_minute; t < b.end_minute; t++) free[t] = false;
  return free.map(
    (v, t) => v && !isQuiet(t, profile.sleep_start, profile.sleep_end),
  );
}
export function generatePlan(
  input: PlannerInput,
): Pick<StudyPlan, "slots" | "unscheduled"> {
  const now = localNow(input.profile.timezone, input.now),
    start = now.toPlainDate().toString();
  const days = Math.min(input.horizon ?? 60, 60),
    capacities = new Map<
      string,
      { free: boolean[]; used: number; limit: number }
    >();
  for (let d = 0; d < days; d++) {
    const date = addDays(start, d),
      free = availableMinutes(date, input.profile, input.blocks);
    if (d === 0)
      for (let m = 0; m < now.hour * 60 + now.minute; m++) free[m] = false;
    const school = input.blocks.some(
      (b) =>
        b.kind === "SCHOOL" &&
        (b.exception_date
          ? b.exception_date === date
          : b.day_of_week === weekday(date)),
    );
    capacities.set(date, {
      free,
      used: 0,
      limit: Math.min(
        school
          ? (input.profile.school_day_limit ?? 60)
          : (input.profile.free_day_limit ?? 90),
        Math.floor(free.filter(Boolean).length * 0.8),
      ),
    });
  }
  const slots: PlanSlot[] = [],
    unscheduled: StudyPlan["unscheduled"] = [];
  const reserve = (s: PlanSlot) => {
    const cap = capacities.get(s.date);
    if (!cap) return false;
    if (
      s.start_minute < 0 ||
      s.start_minute + s.duration_minutes > 1440 ||
      cap.used + s.duration_minutes > cap.limit
    )
      return false;
    if (
      !cap.free
        .slice(s.start_minute, s.start_minute + s.duration_minutes)
        .every(Boolean)
    )
      return false;
    for (
      let t = Math.max(0, s.start_minute - 5);
      t < Math.min(1440, s.start_minute + s.duration_minutes + 5);
      t++
    )
      cap.free[t] = false;
    cap.used += s.duration_minutes;
    slots.push(s);
    return true;
  };
  for (const locked of [...(input.locked ?? [])].sort(
    (a, b) => a.date.localeCompare(b.date) || a.start_minute - b.start_minute,
  )) {
    const item = input.items.find(
      (i) => i.id === locked.academic_item_id && i.status === "PENDING",
    );
    if (
      item &&
      locked.status === "PENDING" &&
      locked.date <= item.due_date &&
      !(
        item.kind === "EXAM" &&
        !item.due_time &&
        locked.date === item.due_date
      ) &&
      (!item.due_time ||
        locked.date !== item.due_date ||
        locked.start_minute + locked.duration_minutes <=
          minuteOf(item.due_time))
    )
      reserve(locked);
  }
  const ordered = input.items
    .filter((i) => i.status === "PENDING")
    .sort(
      (a, b) =>
        a.due_date.localeCompare(b.due_date) ||
        b.priority - a.priority ||
        b.difficulty - a.difficulty ||
        a.id.localeCompare(b.id),
    );
  for (const item of ordered) {
    let remaining = Math.max(
      0,
      item.effort_minutes -
        input.sessions
          .filter((s) => s.academic_item_id === item.id)
          .reduce((a, s) => a + s.duration_minutes, 0) -
        slots
          .filter((s) => s.academic_item_id === item.id)
          .reduce((a, s) => a + s.duration_minutes, 0),
    );
    const last = Math.min(
      days - 1,
      daysUntil(item.due_date, start) -
        (item.kind === "EXAM" && !item.due_time ? 1 : 0),
    );
    let index = 0;
    while (remaining > 0) {
      const duration =
          remaining < 10
            ? 10
            : remaining > 25 && remaining < 35
              ? remaining - 10
              : Math.min(25, remaining),
        candidates = Array.from({ length: Math.max(0, last + 1) }, (_, d) =>
          addDays(start, d),
        );
      if (item.kind === "EXAM")
        candidates.sort(
          (a, b) =>
            slots.filter((s) => s.academic_item_id === item.id && s.date === a)
              .length -
              slots.filter(
                (s) => s.academic_item_id === item.id && s.date === b,
              ).length || a.localeCompare(b),
        );
      let placed = false;
      for (const date of candidates) {
        const cap = capacities.get(date)!;
        if (cap.used + duration > cap.limit) continue;
        const cutoff =
          date === item.due_date && item.due_time
            ? minuteOf(item.due_time)
            : 1440;
        for (let minute = 0; minute + duration <= cutoff; minute += 5) {
          if (!cap.free.slice(minute, minute + duration).every(Boolean))
            continue;
          const methods =
            item.kind === "EXAM"
              ? [
                  "self-explanation",
                  "retrieval",
                  "interleaving",
                  "practice-testing",
                  "spaced-retrieval",
                ]
              : ["worked-examples", "self-explanation", "retrieval"];
          const method = methods[Math.min(index, methods.length - 1)];
          const topic =
            item.topics[index % Math.max(item.topics.length, 1)] ?? item.title;
          const slot: PlanSlot = {
            id: `${item.id}:${date}:${minute}`,
            academic_item_id: item.id,
            date,
            start_minute: minute,
            duration_minutes: duration,
            method_id: method,
            objective: `${topic}: ${method === "retrieval" ? "recordar sin mirar y comprobar" : "practicar y revisar lo aprendido"}`,
            status: "PENDING",
          };
          if (reserve(slot)) {
            remaining = Math.max(0, remaining - duration);
            index++;
            placed = true;
            break;
          }
        }
        if (placed) break;
      }
      if (!placed) break;
    }
    if (remaining > 0)
      unscheduled.push({
        academic_item_id: item.id,
        minutes: remaining,
        reason:
          last < 0
            ? "La fecha ya pasó o no queda tiempo antes del examen."
            : "No hay suficiente disponibilidad. Podés ajustar el esfuerzo o liberar un horario.",
      });
  }
  return {
    slots: slots.sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.start_minute - b.start_minute ||
        a.id.localeCompare(b.id),
    ),
    unscheduled,
  };
}
