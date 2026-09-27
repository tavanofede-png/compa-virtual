import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { CONSENT_POLICY_VERSION, ageAt, type Profile } from "@compa/domain";
import { createFamilyToken, familyPortalConfiguration, hashFamilyToken, hasFamilyCapability } from "./family-permissions";
import { voiceConfiguration } from "./voice-input";

const decisionSchema = z.object({
  consent_id: z.uuid(),
  action: z.enum(["VERIFY_FAMILY", "REVOKE_FAMILY"]),
  method: z.enum(["independent-call", "in-person", "video-call"]).optional(),
  evidence_reference: z.string().trim().min(4).max(120).optional(),
  reason: z.string().trim().min(8).max(300).optional(),
}).strict();

export async function handleOperator(
  db: SupabaseClient,
  env: Record<string, string | undefined>,
  userId: string,
  accessToken: string,
  body: { type: string; payload: Record<string, unknown> },
  json: (value: unknown, status?: number) => Response,
): Promise<Response> {
  const allowed = (env.OPERATOR_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (!allowed.includes(userId))
    return json({ error: "No tenés acceso al panel de operación." }, 403);
  const { data: assurance, error: assuranceError } =
    await db.auth.mfa.getAuthenticatorAssuranceLevel(accessToken);
  if (assuranceError || assurance?.currentLevel !== "aal2")
    return json({ error: "Verificá el segundo factor de tu cuenta para operar." }, 403);

  const overview = async () => {
    const { data: consents, error } = await db
      .from("consents")
      .select("id,user_id,policy_version,basis,evidence_reference,created_at,verified_at,revoked_at")
      .eq("policy_version", CONSENT_POLICY_VERSION)
      .eq("basis", "parental-guardian")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    const ids = [...new Set((consents ?? []).map((row) => row.user_id))];
    const states = ids.length
      ? await db.from("student_states").select("user_id,state").in("user_id", ids)
      : { data: [], error: null };
    if (states.error) throw states.error;
    const profiles = new Map((states.data ?? []).map((row) => [
      row.user_id,
      (row.state as { profile?: Profile }).profile,
    ]));
    const emails = new Map<string, string>();
    await Promise.all(ids.map(async (id) => {
      const { data, error: userError } = await db.auth.admin.getUserById(id);
      if (userError) throw userError;
      emails.set(id, data.user?.email ?? "");
    }));
    const { data: audit, error: auditError } = await db
      .from("operator_audit")
      .select("id,operator_user_id,target_user_id,consent_id,action,method,evidence_reference,reason,created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (auditError) throw auditError;
    const grants = ids.length ? await db.from("capability_grants")
      .select("consent_id,capability,revoked_at").in("user_id", ids)
      .eq("policy_version", CONSENT_POLICY_VERSION) : { data: [], error: null };
    if (grants.error) throw grants.error;
    return {
      requests: (consents ?? []).map((row) => {
        const profile = profiles.get(row.user_id);
        return {
          id: row.id,
          user_id: row.user_id,
          student_email: emails.get(row.user_id) ?? "",
          student_name: profile?.nickname ?? "Sin nombre",
          age: profile?.birth_date ? ageAt(profile.birth_date) : null,
          guardian_name: row.evidence_reference ?? "",
          created_at: row.created_at,
          verified_at: row.verified_at,
          revoked_at: row.revoked_at,
          permissions: Object.fromEntries(["service", "ai", "social"].map((capability) => [
            capability, Boolean(row.verified_at && !row.revoked_at && grants.data?.some((grant) =>
              grant.consent_id === row.id && grant.capability === capability && !grant.revoked_at)),
          ])),
        };
      }),
      audit: audit ?? [],
    };
  };

  if (body.type === "operator.overview") {
    z.object({}).strict().parse(body.payload);
    return json(await overview());
  }
  if (body.type === "operator.health") {
    z.object({}).strict().parse(body.payload);
    const result = await db.rpc("operational_scan");
    if (result.error) return json({ error: "No pudimos comprobar las señales operativas. Revisá la conexión con la base." }, 503);
    return json(result.data);
  }
  if (body.type === "operator.supportQueue") {
    const input = z.object({ status: z.enum(["open", "in_progress", "waiting_student", "resolved"]).nullable().optional(),
      before: z.object({ priority: z.enum(["normal", "urgent"]), updated_at: z.iso.datetime({ offset: true }), id: z.uuid() }).strict().optional() })
      .strict().parse(body.payload);
    const result = await db.rpc("operator_support_queue", { p_status: input.status ?? null,
      p_before_priority: input.before?.priority ?? null,
      p_before_updated: input.before?.updated_at ?? null,
      p_before_id: input.before?.id ?? null });
    if (result.error) return json({ error: "No pudimos cargar las consultas de soporte." }, 503);
    return json({ tickets: result.data });
  }
  if (body.type === "operator.supportUpdate") {
    const input = z.object({ ticket_id: z.uuid(), operation_id: z.uuid(),
      status: z.enum(["open", "in_progress", "waiting_student", "resolved"]),
      response: z.string().trim().min(4).max(2000).optional(),
    }).strict().parse(body.payload);
    const result = await db.rpc("operator_support_update", {
      p_operator: userId, p_ticket: input.ticket_id, p_operation: input.operation_id,
      p_status: input.status, p_response: input.response ?? null,
    });
    if (result.error) return json({ error: "No pudimos confirmar el cambio. Actualizá la consulta antes de reintentar." }, 503);
    return json({ ticket: result.data });
  }
  if (body.type === "operator.chatReports") {
    z.object({}).strict().parse(body.payload);
    const result = await db.rpc("operator_chat_reports");
    if (result.error) return json({ error: "No pudimos cargar los reportes del chat." }, 503);
    return json({ reports: result.data });
  }
  if (body.type === "operator.chatControl") {
    z.object({}).strict().parse(body.payload);
    const result = await db.rpc("operator_chat_control");
    if (result.error) return json({ error: "No pudimos comprobar el estado del chat." }, 503);
    return json({ ...result.data, configured: env.SOCIAL_CHAT_ENABLED === "true"
      && env.SOCIAL_CHAT_MODERATION_READY === "true" });
  }
  if (body.type === "operator.setChatControl") {
    const input = z.object({ writable: z.boolean(), reason: z.string().trim().min(8).max(300) })
      .strict().parse(body.payload);
    if (input.writable && (env.SOCIAL_CHAT_ENABLED !== "true" || env.SOCIAL_CHAT_MODERATION_READY !== "true"))
      return json({ error: "Primero habilitá el chat y la moderación en el servidor." }, 403);
    const result = await db.rpc("operator_chat_set_writable", {
      p_operator: userId, p_writable: input.writable, p_reason: input.reason,
    });
    if (result.error) return json({ error: "No pudimos confirmar el nuevo estado del chat." }, 503);
    return json({ ...result.data, configured: env.SOCIAL_CHAT_ENABLED === "true"
      && env.SOCIAL_CHAT_MODERATION_READY === "true" });
  }
  if (body.type === "operator.chatDecision") {
    const input = z.object({ report_id: z.uuid(), action: z.enum(["approve", "hide", "dismiss"]),
      reason: z.string().trim().min(8).max(300),
    }).strict().parse(body.payload);
    const result = await db.rpc("operator_chat_decide", {
      p_operator: userId, p_report: input.report_id,
      p_action: input.action, p_reason: input.reason,
    });
    if (result.error) return json({ error: "No pudimos confirmar la decisión. Actualizá los reportes." }, 503);
    return json(result.data);
  }
  if (body.type === "operator.voiceBudget" || body.type === "operator.verifyVoiceBudget") {
    const config = voiceConfiguration(env);
    if (body.type === "operator.verifyVoiceBudget") {
      const value = z.object({ operation_id: z.uuid(), free_account_confirmed: z.literal(true),
        remaining_neurons: z.number().int().min(0).max(10000), reason: z.string().trim().min(10).max(500) }).strict().parse(body.payload);
      if (!config.enabled) return json({ error: "Falta habilitar y configurar Whisper en el servidor." }, 503);
      const result = await db.rpc("voice_verify_budget", { p_operator: userId, p_account: config.account,
        p_remaining: value.remaining_neurons, p_reason: value.reason, p_operation: value.operation_id });
      if (result.error) return json({ error: "No pudimos confirmar la reserva de cuota. Actualizá antes de reintentar." }, 503);
    } else z.object({}).strict().parse(body.payload);
    if (!config.enabled) return json({ configured: false, pool: null });
    const pool = await db.from("voice_quota_pools").select("day,remaining_neurons,free_plan_verified,verified_at,valid_until")
      .eq("account_id", config.account).maybeSingle();
    if (pool.error) return json({ error: "No pudimos consultar la cuota de voz." }, 503);
    return json({ configured: true, account: config.account.slice(-6), pool: pool.data });
  }
  if (body.type === "operator.materialJobs") {
    const value = z.object({ before: z.object({ updated_at: z.iso.datetime({ offset: true }), id: z.uuid() }).strict().optional() }).strict().parse(body.payload);
    let query = db.from("material_jobs")
      .select("id,user_id,material_id,status,phase,attempts,indexing_status,completed_units,total_units,lease_expires_at,updated_at,error_code")
      .order("updated_at", { ascending: false }).order("id", { ascending: false }).limit(101);
    if (value.before) query = query.or(`updated_at.lt.${value.before.updated_at},and(updated_at.eq.${value.before.updated_at},id.lt.${value.before.id})`);
    const { data, error } = await query;
    if (error) throw error;
    const cleanup = await db.from("material_object_deletions").select("path", { count: "exact", head: true });
    if (cleanup.error) throw cleanup.error;
    const jobs = (data ?? []).slice(0, 100);
    const last = jobs.at(-1);
    return json({ jobs, cleanup_pending: cleanup.count ?? 0,
      nextCursor: (data?.length ?? 0) > 100 && last ? { id: last.id, updated_at: last.updated_at } : null });
  }
  if (body.type === "operator.retryMaterial") {
    const value = z.object({ user_id: z.uuid(), material_id: z.string().min(1).max(150),
      operation_id: z.uuid(), reason: z.string().trim().min(8).max(300) }).strict().parse(body.payload);
    const { data: row, error } = await db.from("student_states").select("state").eq("user_id", value.user_id).maybeSingle();
    if (error) throw error;
    const profile = (row?.state as { profile?: Profile } | undefined)?.profile;
    if (!profile) return json({ error: "Cuenta no encontrada." }, 404);
    if (ageAt(profile.birth_date) < 18 && (env.MINOR_BETA_APPROVED !== "true" || !await hasFamilyCapability(db, value.user_id, "service")))
      return json({ error: "La cuenta no tiene autorizado el servicio. No se reencoló el material." }, 403);
    const result = await db.rpc("operator_retry_material", { p_operator: userId, p_user: value.user_id,
      p_material: value.material_id, p_operation: value.operation_id, p_reason: value.reason });
    if (result.error) return json({ error: "No pudimos confirmar el reintento. Actualizá el estado antes de repetirlo." }, 503);
    return json({ confirmed: true });
  }
  if (body.type === "operator.familyLink") {
    const value = z.object({ consent_id: z.uuid() }).strict().parse(body.payload);
    const config = familyPortalConfiguration(env);
    if (!config) return json({ error: "Falta habilitar el acceso familiar y configurar sus documentos aprobados." }, 503);
    const token = createFamilyToken();
    const { data, error } = await db.rpc("operator_family_link", {
      p_operator: userId, p_consent: value.consent_id, p_hash: await hashFamilyToken(token),
      p_terms: config.terms_url, p_privacy: config.privacy_url,
    });
    if (error) return json({ error: error.message === "FAMILY_LINK_COOLDOWN"
      ? "Esperá un minuto antes de emitir otro enlace."
      : "La autorización ya no permite emitir un enlace. Actualizá la lista." }, 409);
    return json({ link: config.portal_url + "#" + token, expires_at: data.expires_at });
  }
  if (body.type === "operator.consentDecision") {
    const value = decisionSchema.parse(body.payload);
    if (value.action === "VERIFY_FAMILY" &&
        (!value.method || !value.evidence_reference))
      return json({ error: "Registrá cómo verificaste a la familia y la referencia del caso." }, 400);
    if (value.action === "REVOKE_FAMILY" && !value.reason)
      return json({ error: "Indicá por qué se revoca la autorización." }, 400);
    const { data, error } = await db.rpc("operator_consent_decision", {
      p_operator: userId,
      p_consent: value.consent_id,
      p_action: value.action,
      p_method: value.method ?? null,
      p_reference: value.evidence_reference ?? null,
      p_reason: value.reason ?? null,
    });
    if (error) {
      const known: Record<string, string> = {
        CONSENT_NOT_FOUND: "La solicitud ya no está disponible.",
        CONSENT_REVOKED: "Esta solicitud fue revocada. Pedí una nueva.",
        CONSENT_ALREADY_ACTIVE: "La cuenta ya tiene una autorización vigente. Actualizá la lista antes de continuar.",
        CONSENT_EVIDENCE_REQUIRED: "Falta registrar la verificación independiente.",
        CONSENT_STUDENT_INELIGIBLE: "La cuenta no corresponde a un alumno de 13 a 17 años.",
        CONSENT_REASON_REQUIRED: "Indicá el motivo de la revocación.",
        CONSENT_ACCOUNT_DELETING: "La cuenta está en proceso de eliminación.",
      };
      return json({ error: known[error.message] ?? "No pudimos confirmar la decisión. Revisá el estado actual." },
        known[error.message] ? 409 : 503);
    }
    return json({ decision: data, ...(await overview()) });
  }
  return json({ error: "Operación desconocida." }, 400);
}
