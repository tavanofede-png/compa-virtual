import { localNow, weekday, isQuiet } from "./time";
import type { Snapshot } from "./types";
export function dueReminders(s: Snapshot, instant: string) {
  if (!s.profile) return [];
  const now = localNow(s.profile.timezone, instant),
    date = now.toPlainDate().toString(),
    minute = now.hour * 60 + now.minute,
    p = s.preferences;
  if (!p.weekends && [0, 6].includes(weekday(date))) return [];
  if (
    isQuiet(minute, p.quiet_start, p.quiet_end) ||
    isQuiet(minute, s.profile.sleep_start, s.profile.sleep_end)
  )
    return [];
  if (
    s.blocks.some(
      (b) =>
        b.kind !== "AVAILABLE" &&
        (b.exception_date
          ? b.exception_date === date
          : b.day_of_week === weekday(date)) &&
        minute >= b.start_minute &&
        minute < b.end_minute,
    )
  )
    return [];
  const drafts: {
    id: string;
    date: string;
    title: string;
    body: string;
    route: string;
  }[] = [];
  if (
    p.checkin_enabled &&
    !s.checkins.some((c) => c.date === date && c.outcome !== "UNCONFIRMED") &&
    minute >= p.checkin_minute &&
    minute <= p.checkin_minute + 180
  )
    drafts.push({
      id: "checkin",
      date,
      title: "Un minuto para tu día",
      body: "Registrá lo que aprendiste y ajustemos el próximo paso.",
      route: "today",
    });
  const plan = s.plans.find((x) => x.status === "ACCEPTED");
  for (const slot of plan?.slots ?? [])
    if (
      slot.status === "PENDING" &&
      slot.date === date &&
      minute >= slot.start_minute - 10 &&
      minute <= slot.start_minute + 5
    )
      drafts.push({
        id: "session:" + slot.id,
        date,
        title: "Tu próximo bloque está cerca",
        body: "Tu plan tiene una sesión preparada. Podés revisar el objetivo.",
        route: "today",
      });
  for (const item of s.items)
    if (item.status === "PENDING" && item.due_date === date && item.due_time) {
      const [h, m] = item.due_time.split(":").map(Number),
        due = h * 60 + m;
      if (minute >= due - 60 && minute <= due - 45)
        drafts.push({
          id: "item:" + item.id,
          date,
          title: "Un recordatorio de tu agenda",
          body: "Se acerca el horario de una actividad. Revisá lo que preparaste.",
          route: "agenda",
        });
    }
  return drafts;
}
