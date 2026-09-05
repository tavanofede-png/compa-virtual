import { Temporal } from "@js-temporal/polyfill";
export const defaultTimezone = "America/Argentina/Buenos_Aires";
export function localNow(timezone = defaultTimezone, instant?: string) {
  return (
    instant ? Temporal.Instant.from(instant) : Temporal.Now.instant()
  ).toZonedDateTimeISO(timezone);
}
export function today(timezone = defaultTimezone, instant?: string) {
  return localNow(timezone, instant).toPlainDate().toString();
}
export function addDays(date: string, days: number) {
  return Temporal.PlainDate.from(date).add({ days }).toString();
}
export function weekday(date: string) {
  return Temporal.PlainDate.from(date).dayOfWeek % 7;
}
export function daysUntil(date: string, from = today()) {
  return Temporal.PlainDate.from(from).until(Temporal.PlainDate.from(date))
    .days;
}
export function clock(minutes: number) {
  return `${Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0")}:${(minutes % 60).toString().padStart(2, "0")}`;
}
export function minuteOf(value: string) {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}
export function dateLabel(date: string) {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}
export function isQuiet(minute: number, start: number, end: number) {
  return start === end
    ? false
    : start < end
      ? minute >= start && minute < end
      : minute >= start || minute < end;
}
export function ageAt(birth: string, date = today()) {
  return Temporal.PlainDate.from(birth).until(Temporal.PlainDate.from(date), {
    largestUnit: "years",
  }).years;
}
