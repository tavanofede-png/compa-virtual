import type { Snapshot } from "./types";
import { today } from "./time";

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
export function homeSummary(s: Snapshot) {
  const date = today(s.profile?.timezone);
  const plan = s.plans.find((p) => p.status === "ACCEPTED");
  const slots = plan?.slots.filter((p) => p.date === date) ?? [];
  const remaining = slots.filter((p) => p.status === "PENDING");
  return {
    date,
    plan,
    slots,
    next: remaining[0],
    minutes: remaining.reduce((sum, p) => sum + p.duration_minutes, 0),
    pending: s.items
      .filter((i) => i.status === "PENDING")
      .sort(
        (a, b) =>
          a.due_date.localeCompare(b.due_date) || a.id.localeCompare(b.id),
      ),
    completed: slots.filter((p) => p.status === "COMPLETE").length,
    checkedIn: s.checkins.some((c) => c.date === date),
  };
}
