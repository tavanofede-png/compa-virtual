import type { AgentEffect, PlanSlot, Snapshot } from "./types";
import { localNow } from "./time";

const routes = new Set<AgentEffect["target"]>([
  "room", "today", "agenda", "study", "progress", "compa", "spaces", "together",
]);

export function resolveNotificationIntent(
  state: Snapshot,
  notificationId: string,
  requestedRoute: string,
  now: string,
): AgentEffect["target"] | null {
  if (!state.profile) return null;
  if (!routes.has(requestedRoute as AgentEffect["target"])) return null;
  const notice = state.notifications.find((item) => item.id === notificationId);
  if (!notice || notice.route !== requestedRoute) return null;
  const age = Date.parse(now) - Date.parse(notice.created_at);
  if (!Number.isFinite(age) || age < 0 || age > 36 * 60 * 60 * 1000) return null;
  const timezone = state.profile.timezone;
  const date = localNow(timezone, now).toPlainDate().toString();
  const separator = notificationId.lastIndexOf(":");
  const noticeDate = notificationId.slice(separator + 1);
  if (noticeDate !== date) return null;
  if (notificationId.startsWith("daily-study:")) {
    if (state.activeSession || state.sessions.some((session) =>
      localNow(timezone, session.completed_at).toPlainDate().toString() === date,
    )) return null;
  } else if (notificationId.startsWith("session:")) {
    const slotId = notificationId.slice("session:".length, separator);
    if (!state.plans.some((plan) => plan.status === "ACCEPTED" &&
      plan.slots.some((slot) => slot.id === slotId && slot.status === "PENDING" && slot.date === date))) return null;
  } else if (notificationId.startsWith("item:")) {
    const itemId = notificationId.slice("item:".length, separator);
    if (!state.items.some((item) => item.id === itemId && item.status === "PENDING" && item.due_date === date)) return null;
  } else if (notificationId.startsWith("checkin:")) {
    if (state.checkins.some((checkin) => checkin.date === date && checkin.outcome !== "UNCONFIRMED")) return null;
  } else if (notificationId.startsWith("custom:")) {
    const reminderId = notificationId.slice("custom:".length, separator);
    if (!state.studyReminders.some((reminder) => reminder.id === reminderId && reminder.enabled &&
      (!reminder.date || reminder.date === date))) return null;
  } else return null;
  return requestedRoute as AgentEffect["target"];
}

export function resolveNotificationLaunch(
  state: Snapshot, notificationId: string, requestedRoute: string, now: string,
): { target: AgentEffect["target"]; focus: boolean; slot?: PlanSlot } | null {
  const target = resolveNotificationIntent(state, notificationId, requestedRoute, now);
  if (!target) return null;
  if (notificationId.startsWith("daily-study:"))
    return { target: "study", focus: true };
  if (notificationId.startsWith("session:")) {
    const slotId = notificationId.slice("session:".length, notificationId.lastIndexOf(":"));
    const slot = state.plans.filter((plan) => plan.status === "ACCEPTED")
      .flatMap((plan) => plan.slots).find((entry) => entry.id === slotId);
    if (!slot) return null;
    return { target: "study", focus: true, slot };
  }
  return { target, focus: false };
}
