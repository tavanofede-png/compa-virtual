import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ageAt,
  collaborationCommandSchema,
  characterById,
  wardrobeItem,
  type Profile,
} from "@compa/domain";
import { z } from "zod";
import { hasFamilyCapability } from "./family-permissions";

const errors: Record<string, [number, string]> = {
  ROOM_CONTROLLED: [
    409,
    "La sala se está controlando desde otra ventana o tu conexión venció. Volvé a entrar para tomar el control.",
  ],
  ROOM_SEAT_BUSY: [
    409,
    "Alguien acaba de ocupar ese lugar. Elegí otro asiento.",
  ],
  ROOM_OTHER_SESSION: [
    409,
    "Ya estás en otra sala. Salí de ella antes de entrar a este encuentro.",
  ],
  ROOM_COOLDOWN: [429, "Esperá un momento antes de enviar otra reacción."],
  COLLAB_TOO_FEW: [
    409,
    "Para iniciar, al menos otra persona debe aceptar la invitación.",
  ],
  COLLAB_NOT_FOUND: [
    404,
    "No tenés acceso o ya no está disponible. Actualizá la pantalla.",
  ],
  COLLAB_FORBIDDEN: [403, "No tenés permiso para hacer este cambio."],
  COLLAB_CONFLICT: [
    409,
    "La sesión o el grupo cambió. Actualizá antes de volver a intentar.",
  ],
  COLLAB_STATE: [409, "Ese cambio no está disponible en el estado actual."],
  COLLAB_OPEN_SESSIONS: [
    409,
    "Finalizá o cancelá las sesiones del grupo antes de archivarlo.",
  ],
  COLLAB_HOST: [
    409,
    "Transferí primero la organización de las sesiones que corresponda.",
  ],
  COLLAB_LIMIT: [
    429,
    "Alcanzaste el límite por ahora. Volvé a intentar más tarde.",
  ],
  COLLAB_DATE: [400, "Elegí un horario futuro dentro del próximo año."],
  COLLAB_EARLY: [
    409,
    "Podés iniciar desde 15 minutos antes del horario programado.",
  ],
  COLLAB_RECIPIENT: [
    404,
    "No se pudo enviar la invitación. Revisá el código con tu compañero.",
  ],
  COLLAB_GROUP_MEMBER: [
    409,
    "Esa persona primero debe aceptar la invitación al grupo.",
  ],
  COLLAB_DUPLICATE: [
    409,
    "Esa persona ya participa o tiene una invitación pendiente.",
  ],
  COLLAB_FULL: [
    409,
    "No quedan lugares. Las invitaciones pendientes también reservan un lugar.",
  ],
  COLLAB_INVITE_CLOSED: [
    410,
    "Esta invitación venció o ya fue respondida o revocada.",
  ],
  COLLAB_INVALID: [400, "Revisá los datos e intentá de nuevo."],
  CHAT_INVALID: [400, "Revisá el mensaje e intentá de nuevo."],
  CHAT_LINK: [400, "El chat del encuentro no permite enlaces ni correos."],
  CHAT_RATE: [429, "Esperá un momento antes de enviar otro mensaje."],
  CHAT_READ_ONLY: [403, "El chat está en solo lectura por decisión del equipo de moderación."],
  CHAT_BLOCKED_PEER: [403, "No podés compartir el encuentro con una persona bloqueada."],
};
export async function handleCollaboration(
  db: SupabaseClient,
  env: Record<string, string | undefined>,
  userId: string,
  body: {
    type: string;
    payload: Record<string, unknown>;
    operationId?: string;
  },
  json: (value: unknown, status?: number) => Response,
): Promise<Response> {
  const unavailable = (reason: string) =>
    body.type === "collaboration.overview"
      ? json({
          enabled: false,
          reason,
          user_id: userId,
          contact_code: "",
          groups: [],
          sessions: [],
          invitations: [],
          server_time: new Date().toISOString(),
        })
      : json({ error: reason }, 403);
  if (env.COLLABORATION_ENABLED !== "true")
    return unavailable(
      "Estudiar juntos todavía no está habilitado en este entorno.",
    );
  const { data, error } = await db
    .from("student_states")
    .select("state")
    .eq("user_id", userId)
    .maybeSingle();
  if (error)
    return json({ error: "No pudimos verificar tu perfil. Reintentá." }, 503);
  const profile = data?.state?.profile as Profile | undefined;
  if (!profile?.onboarding_complete)
    return unavailable("Completá tu perfil para estudiar con otros.");
  // Social permission is separate from AI and service permission. The family
  // grant is checked on every read, command and room heartbeat, so revocation
  // stops new operations even for an already-open client.
  const birth = z.iso.date().safeParse(profile.birth_date);
  const age = birth.success ? ageAt(birth.data) : NaN;
  if (!Number.isFinite(age) || age < 13 || age > 120)
    return unavailable("Este perfil no puede ingresar a encuentros compartidos.");
  if (age < 18) {
    if (env.MINOR_BETA_APPROVED !== "true" || env.SOCIAL_MINOR_BETA_APPROVED !== "true")
      return unavailable("Los encuentros para menores todavía no están habilitados en este entorno.");
    try {
      if (!await hasFamilyCapability(db, userId, "social"))
        return unavailable("Tu familia todavía no habilitó los encuentros compartidos.");
    } catch {
      return json({ error: "No pudimos comprobar el permiso social. Reintentá." }, 503);
    }
  }
  const identity = await db.rpc("collaboration_identity", {
    p_user: userId,
    p_nickname: profile.nickname.trim() || "Compañero",
  });
  if (identity.error)
    return json(
      { error: "Estudiar juntos no está disponible. Reintentá más tarde." },
      503,
    );
  let result;
  let chatWriteEnabled = env.SOCIAL_CHAT_ENABLED === "true"
    && env.SOCIAL_CHAT_MODERATION_READY === "true"
    && (age >= 18 || env.SOCIAL_CHAT_MINOR_APPROVED === "true");
  if (chatWriteEnabled && ["collaboration.chat.page", "collaboration.chat.send"].includes(body.type)) {
    const control = await db.rpc("social_chat_writable");
    chatWriteEnabled = !control.error && control.data === true;
  }
  if (body.type === "collaboration.overview") {
    z.object({}).strict().parse(body.payload);
    result = await db.rpc("collaboration_read", { p_user: userId });
    if (!result.error) {
      const joinable = await db.rpc("collaboration_group_sessions", { p_user: userId });
      if (joinable.error) result = joinable;
      else result = { ...result, data: {
        ...result.data,
        sessions: [...(result.data?.sessions ?? []), ...(joinable.data ?? [])]
          .sort((a, b) => Date.parse(b.scheduled_start_at) - Date.parse(a.scheduled_start_at)),
      } };
    }
  } else if (body.type === "collaboration.session") {
    const p = z.object({ session_id: z.uuid() }).strict().parse(body.payload);
    result = await db.rpc("collaboration_read", {
      p_user: userId,
      p_session: p.session_id,
    });
    // Legacy records may contain external call links. Kusiy's student
    // encounters only expose the in-app room; do not disclose those links.
    if (!result.error && result.data)
      result = { ...result, data: { ...result.data, meeting_url: null } };
  } else if (body.type === "collaboration.chat.page") {
    const p = z.object({ session_id: z.uuid(), before: z.object({
      created_at: z.iso.datetime({ offset: true }), id: z.uuid(),
    }).strict().optional() }).strict().parse(body.payload);
    result = await db.rpc("collaboration_chat_read", {
      p_user: userId, p_session: p.session_id,
      p_before_time: p.before?.created_at ?? null, p_before_id: p.before?.id ?? null,
    });
    if (!result.error) result = { ...result, data: {
      ...result.data, enabled: chatWriteEnabled,
    } };
  } else if (body.type === "collaboration.chat.send") {
    if (!chatWriteEnabled) return json({ error: "El chat está en solo lectura hasta que la moderación esté disponible." }, 403);
    const p = z.object({ session_id: z.uuid(), body: z.string().trim().min(1).max(1000) })
      .strict().parse(body.payload);
    result = await db.rpc("collaboration_chat_send", {
      p_user: userId, p_operation: z.uuid().parse(body.operationId),
      p_session: p.session_id, p_body: p.body,
    });
  } else if (body.type === "collaboration.chat.report") {
    const p = z.object({ session_id: z.uuid(), message_id: z.uuid(),
      category: z.enum(["harassment", "personal-data", "sexual", "violence", "other"]),
      detail: z.string().trim().max(500).optional(),
    }).strict().parse(body.payload);
    result = await db.rpc("collaboration_chat_report", {
      p_user: userId, p_session: p.session_id, p_message: p.message_id,
      p_category: p.category, p_detail: p.detail ?? null,
    });
  } else if (body.type === "collaboration.chat.block") {
    const p = z.object({ target_id: z.uuid() }).strict().parse(body.payload);
    result = await db.rpc("collaboration_chat_block", { p_user: userId, p_target: p.target_id });
  } else if (body.type === "collaboration.command") {
    const command = collaborationCommandSchema.parse(body.payload);
    const operation = z.uuid().parse(body.operationId);
    const companion = data?.state?.companion;
    const character = characterById(companion?.character_id);
    const appearance = {
      character_id: character.id,
      wardrobe: (companion?.wardrobe ?? character.outfit)
        .filter((id: string) => Boolean(wardrobeItem(id)))
        .slice(0, 12),
    };
    // Keep the older command shape compatible while preventing new external
    // calls even from a client that still sends a Meet URL.
    const safeCommand = command.action === "session.create" || command.action === "session.update"
      ? { ...command, meeting_url: null }
      : command;
    result = await db.rpc(
      command.action.startsWith("room.") ? "shared_room_command"
        : command.action === "session.join" ? "collaboration_join_group_session"
        : "collaboration_command",
      {
        p_user: userId,
        p_operation: operation,
        p_command: safeCommand,
        ...(command.action.startsWith("room.")
          ? { p_appearance: appearance }
          : {}),
      },
    );
  } else return json({ error: "Operación desconocida." }, 400);
  if (result.error) {
    const [status, message] = errors[result.error.message] ?? [
      503,
      "No pudimos confirmar el resultado. Reintentá para comprobar si se guardó.",
    ];
    return json({ error: message }, status);
  }
  return json(result.data);
}
