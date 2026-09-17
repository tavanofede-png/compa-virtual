import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ageAt,
  collaborationCommandSchema,
  characterById,
  wardrobeItem,
  type Profile,
} from "@compa/domain";
import { z } from "zod";

const errors: Record<string, [number, string]> = {
  ROOM_CONTROLLED: [
    409,
    "La sala se está controlando desde otra ventana o tu conexión venció. Volvé a entrar para tomar el control.",
  ],
  ROOM_SEAT_BUSY: [
    409,
    "Alguien acaba de ocupar ese lugar. Elegí otro asiento.",
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
  // Social eligibility is independent of AI consent. The initial rollout is adult-only.
  const birth = z.iso.date().safeParse(profile.birth_date);
  const age = birth.success ? ageAt(birth.data) : NaN;
  if (!Number.isFinite(age) || age < 18 || age > 120)
    return unavailable(
      "Las sesiones compartidas de esta primera beta están disponibles para mayores de 18 años.",
    );
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
  if (body.type === "collaboration.overview") {
    z.object({}).strict().parse(body.payload);
    result = await db.rpc("collaboration_read", { p_user: userId });
  } else if (body.type === "collaboration.session") {
    const p = z.object({ session_id: z.uuid() }).strict().parse(body.payload);
    result = await db.rpc("collaboration_read", {
      p_user: userId,
      p_session: p.session_id,
    });
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
    result = await db.rpc(
      command.action.startsWith("room.")
        ? "shared_room_command"
        : "collaboration_command",
      {
        p_user: userId,
        p_operation: operation,
        p_command: command,
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
