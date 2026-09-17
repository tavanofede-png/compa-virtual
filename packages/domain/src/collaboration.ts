import { z } from "zod";
import { Temporal } from "@js-temporal/polyfill";

// Shared collaboration is deliberately independent of the per-student Snapshot.
export const sharedSpaces = [
  {
    id: "living",
    name: "Living colaborativo",
    description: "Un encuentro alrededor de la mesa.",
    color: "#b77d48",
  },
  {
    id: "study",
    name: "Sala de estudio",
    description: "Un objetivo y un lugar para cada uno.",
    color: "#54778b",
  },
  {
    id: "library",
    name: "Biblioteca moderna",
    description: "Lectura, preguntas y nuevas ideas.",
    color: "#58775c",
  },
  {
    id: "projects",
    name: "Sala de proyectos",
    description: "Un espacio para hacer equipo.",
    color: "#b47442",
  },
  {
    id: "patio",
    name: "Patio de estudio",
    description: "Concentrarse entre plantas y luz.",
    color: "#748552",
  },
  {
    id: "terrace",
    name: "Terraza de aprendizaje",
    description: "Una pausa y otra perspectiva.",
    color: "#887394",
  },
] as const;
export type SharedSpaceId = (typeof sharedSpaces)[number]["id"];
export const sessionModes = [
  { id: "silent", name: "Estudio silencioso" },
  { id: "review", name: "Repaso grupal" },
  { id: "project", name: "Trabajo práctico" },
] as const;
export type GroupSessionState =
  "scheduled" | "active" | "completed" | "cancelled";
export interface StudyGroupMember {
  user_id: string;
  nickname: string;
  role: "owner" | "member";
}
export interface StudyGroup {
  id: string;
  name: string;
  owner_id: string | null;
  status: "active" | "archived";
  revision: number;
  members: StudyGroupMember[];
}
export interface GroupStudySession {
  id: string;
  group_id: string | null;
  host_id: string | null;
  title: string;
  objective: string;
  session_type: "silent" | "review" | "project";
  space_template_id: SharedSpaceId;
  scheduled_start_at: string;
  timezone: string;
  planned_duration: number;
  status: GroupSessionState;
  revision: number;
  started_at: string | null;
  ended_at: string | null;
  participant_count: number;
}
export interface CollaborationInvite {
  id: string;
  scope: "group" | "session";
  title: string;
  inviter: string;
  recipient: string;
  direction: "received" | "sent";
  status: "pending" | "accepted" | "declined" | "revoked" | "expired";
  expires_at: string;
  created_at: string;
}
export interface CollaborationOverview {
  enabled: boolean;
  reason?: string;
  user_id: string;
  contact_code: string;
  groups: StudyGroup[];
  sessions: GroupStudySession[];
  invitations: CollaborationInvite[];
  server_time: string;
}
export interface GroupSessionDetail {
  room?: SharedRoomState;
  session: GroupStudySession;
  instance_id: string;
  meeting_url: string | null;
  participants: {
    user_id: string;
    nickname: string;
    role: "host" | "participant";
  }[];
  server_time: string;
}
export interface SharedRoomPresence {
  user_id: string;
  seat_id: string;
  expires_at: string;
  activity: "available" | "focused" | "break";
  hand_raised: boolean;
  reaction: string | null;
  reaction_at: string | null;
  appearance: { character_id?: string; wardrobe?: string[] };
}
export interface SharedRoomState {
  presence: SharedRoomPresence[];
  timer: {
    phase: "focus" | "break";
    running: boolean;
    deadline: string | null;
    remaining_seconds: number;
    revision: number;
  } | null;
  goals: {
    id: string;
    title: string;
    done: boolean;
    revision: number;
    created_by: string | null;
  }[];
}
export function sharedTimerSeconds(
  timer: SharedRoomState["timer"],
  serverNow: number,
): number {
  if (!timer) return 1500;
  return Math.min(
    timer.remaining_seconds,
    Math.max(
      0,
      timer.running && timer.deadline
        ? Math.ceil((Date.parse(timer.deadline) - serverNow) / 1000)
        : timer.remaining_seconds,
    ),
  );
}
export interface CollaborationReceipt {
  group_id?: string;
  session_id?: string;
  invite_id?: string;
}
const uuid = z.uuid();
const name = z.string().trim().min(1, "Escribí un nombre.").max(100);
const revision = z.number().int().nonnegative();
export function normalizeMeetUrl(
  value: string | null | undefined,
): string | null {
  if (!value?.trim()) return null;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw Error("Pegá un enlace válido de Google Meet.");
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== "meet.google.com" ||
    url.port ||
    url.username ||
    url.password ||
    !/^\/[a-z]{3}-[a-z]{4}-[a-z]{3}\/?$/.test(url.pathname)
  )
    throw Error("Usá un enlace https://meet.google.com/abc-defg-hij.");
  return "https://meet.google.com" + url.pathname.replace(/\/$/, "");
}
const meetUrl = z
  .string()
  .max(300)
  .nullable()
  .optional()
  .transform((v, ctx) => {
    try {
      return normalizeMeetUrl(v);
    } catch (error) {
      ctx.addIssue({ code: "custom", message: (error as Error).message });
      return z.NEVER;
    }
  });
const zone = z
  .string()
  .max(80)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("es", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Revisá la zona horaria.");
const fields = {
  title: name,
  objective: z.string().trim().min(1, "Elegí un objetivo.").max(500),
  session_type: z.enum(["silent", "review", "project"]),
  space_template_id: z.enum([
    "living",
    "study",
    "library",
    "projects",
    "patio",
    "terrace",
  ]),
  scheduled_start_at: z.iso.datetime({ offset: true }),
  timezone: zone,
  planned_duration: z.number().int().min(15).max(180),
  meeting_url: meetUrl,
};
export const collaborationCommandSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("room.enter"),
      session_id: uuid,
      connection_id: uuid,
      takeover: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("room.heartbeat"),
      session_id: uuid,
      connection_id: uuid,
    })
    .strict(),
  z
    .object({
      action: z.literal("room.leave"),
      session_id: uuid,
      connection_id: uuid,
    })
    .strict(),
  z
    .object({
      action: z.literal("room.seat"),
      session_id: uuid,
      connection_id: uuid,
      seat_id: z.string().regex(/^SEAT_0[1-6]$/),
    })
    .strict(),
  z
    .object({
      action: z.literal("room.activity"),
      session_id: uuid,
      connection_id: uuid,
      activity: z.enum(["available", "focused", "break"]),
    })
    .strict(),
  z
    .object({
      action: z.literal("room.hand"),
      session_id: uuid,
      connection_id: uuid,
      raised: z.boolean(),
    })
    .strict(),
  z
    .object({
      action: z.literal("room.react"),
      session_id: uuid,
      connection_id: uuid,
      reaction: z.enum([
        "hello",
        "thanks",
        "idea",
        "agree",
        "celebrate",
        "question",
      ]),
    })
    .strict(),
  z
    .object({
      action: z.literal("room.timer"),
      session_id: uuid,
      revision,
      operation: z.enum(["focus", "break", "pause", "resume"]),
    })
    .strict(),
  z
    .object({
      action: z.literal("room.goal.add"),
      session_id: uuid,
      title: z.string().trim().min(1).max(160),
    })
    .strict(),
  z
    .object({
      action: z.literal("room.goal.toggle"),
      session_id: uuid,
      goal_id: uuid,
      revision,
      done: z.boolean(),
    })
    .strict(),
  z.object({ action: z.literal("group.create"), name }).strict(),
  z
    .object({ action: z.literal("group.archive"), group_id: uuid, revision })
    .strict(),
  z
    .object({ action: z.literal("group.leave"), group_id: uuid, revision })
    .strict(),
  z
    .object({
      action: z.literal("group.remove"),
      group_id: uuid,
      user_id: uuid,
      revision,
    })
    .strict(),
  z
    .object({
      action: z.literal("group.transfer"),
      group_id: uuid,
      user_id: uuid,
      revision,
    })
    .strict(),
  z
    .object({
      action: z.literal("session.create"),
      group_id: uuid.nullable(),
      ...fields,
    })
    .strict(),
  z
    .object({
      action: z.literal("session.update"),
      session_id: uuid,
      revision,
      ...fields,
    })
    .strict(),
  z
    .object({ action: z.literal("session.start"), session_id: uuid, revision })
    .strict(),
  z
    .object({
      action: z.literal("session.complete"),
      session_id: uuid,
      revision,
    })
    .strict(),
  z
    .object({ action: z.literal("session.cancel"), session_id: uuid, revision })
    .strict(),
  z
    .object({
      action: z.literal("session.remove"),
      session_id: uuid,
      user_id: uuid,
      revision,
    })
    .strict(),
  z
    .object({ action: z.literal("session.leave"), session_id: uuid, revision })
    .strict(),
  z
    .object({
      action: z.literal("session.transfer"),
      session_id: uuid,
      user_id: uuid,
      revision,
    })
    .strict(),
  z
    .object({
      action: z.literal("invite.create"),
      scope: z.enum(["group", "session"]),
      target_id: uuid,
      contact_code: z
        .string()
        .trim()
        .toLowerCase()
        .regex(
          /^[a-f0-9]{64}$/,
          "Pedile su código de compañero a la persona que querés invitar.",
        ),
    })
    .strict(),
  z
    .object({
      action: z.literal("invite.respond"),
      invite_id: uuid,
      accept: z.boolean(),
    })
    .strict(),
  z.object({ action: z.literal("invite.revoke"), invite_id: uuid }).strict(),
]);
export type CollaborationCommand = z.input<typeof collaborationCommandSchema>;
export function sessionStateLabel(status: GroupSessionState) {
  return {
    scheduled: "Programada",
    active: "En curso",
    completed: "Completada",
    cancelled: "Cancelada",
  }[status];
}

/** Reject impossible dates and ambiguous/missing daylight-saving times. */
export function sessionLocalStart(
  date: string,
  time: string,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time))
    throw Error("Revisá el día y la hora.");
  const [year, month, day] = date.split("-").map(Number),
    [hour, minute] = time.split(":").map(Number);
  try {
    return Temporal.ZonedDateTime.from(
      { year, month, day, hour, minute, timeZone },
      { overflow: "reject", disambiguation: "reject" },
    )
      .toInstant()
      .toString();
  } catch {
    throw Error(
      "Revisá el horario: no existe o se repite por un cambio de hora. Elegí otro momento.",
    );
  }
}
export function sessionLocalFields(value = new Date(Date.now() + 3600000)) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`,
    time: `${pad(value.getHours())}:${pad(value.getMinutes())}`,
  };
}
