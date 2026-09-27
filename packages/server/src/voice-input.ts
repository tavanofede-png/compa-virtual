import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ageAt, validateVoiceWav, type Snapshot } from "@compa/domain";
import { hasFamilyCapability } from "./family-permissions";

type Env = Record<string, string | undefined>;
export function voiceConfiguration(env: Env) {
  const account = env.CLOUDFLARE_VOICE_ACCOUNT_ID?.trim() || env.CLOUDFLARE_ACCOUNT_ID?.trim() || "";
  const token = env.CLOUDFLARE_VOICE_API_TOKEN?.trim() || env.CLOUDFLARE_API_TOKEN?.trim();
  return { account, token, enabled: env.VOICE_ENABLED === "true" && /^[a-f0-9]{32}$/.test(account) && Boolean(token),
    studentLimit: Math.floor(Math.min(600, Math.max(1, Number(env.VOICE_STUDENT_DAILY_SECONDS) || 600))) };
}

async function readLimited(request: Request, limit: number) {
  if (Number(request.headers.get("Content-Length")) > limit) throw Error("Audio demasiado largo.");
  const reader = request.body?.getReader();
  if (!reader) throw Error("Falta el audio.");
  const parts: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) throw Error("Audio demasiado largo.");
      parts.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.length; }
  return bytes.buffer;
}
function base64(bytes: ArrayBuffer) {
  const values = new Uint8Array(bytes); let binary = "";
  for (let offset = 0; offset < values.length; offset += 8192)
    binary += String.fromCharCode(...values.subarray(offset, offset + 8192));
  return btoa(binary);
}
export async function voicePermission(db: SupabaseClient, env: Env, userId: string) {
  const [state, control] = await Promise.all([
    db.from("student_states").select("state").eq("user_id", userId).maybeSingle(),
    db.from("account_controls").select("deleting").eq("user_id", userId).maybeSingle(),
  ]);
  if (state.error || control.error) throw Error("No pudimos comprobar los permisos de la cuenta.");
  const profile = (state.data?.state as Snapshot | undefined)?.profile;
  if (!profile || control.data?.deleting) return false;
  const age = ageAt(profile.birth_date);
  if (age < 13) return false;
  // Approval is specific to Cloudflare audio; approval for another AI provider cannot enable it.
  if (age < 18) return env.MINOR_BETA_APPROVED === "true" && env.VOICE_MINOR_DATA_APPROVED === "true" &&
    await hasFamilyCapability(db, userId, "ai");
  return true;
}
export function createVoiceHandler(env: Env, dependencies?: { db?: SupabaseClient; fetch?: typeof fetch }) {
  const db = dependencies?.db ?? createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const provider = dependencies?.fetch ?? fetch;
  const config = voiceConfiguration(env);
  return async (request: Request): Promise<Response> => {
    const origins = (env.ALLOWED_ORIGINS ?? "http://localhost:3000").split(",").map((item) => item.trim());
    const origin = request.headers.get("Origin") ?? "";
    const json = (data: unknown, status = 200) => new Response(status === 204 ? null : JSON.stringify(data), { status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store", Vary: "Origin",
        "Access-Control-Allow-Origin": origins.includes(origin) ? origin : origins[0],
        "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-operation-id",
        "Access-Control-Allow-Methods": "POST, OPTIONS" } });
    if (request.method === "OPTIONS") return json(null, 204);
    if (request.method !== "POST") return json({ error: "Método inválido." }, 405);
    const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Iniciá sesión." }, 401);
    const auth = await db.auth.getUser(token);
    if (auth.error || !auth.data.user) return json({ error: "Tu sesión venció. Volvé a ingresar." }, 401);
    const userId = auth.data.user.id;
    let operation: string | null = null;
    try {
      if (!await voicePermission(db, env, userId)) return json({ error: "La cuenta no tiene habilitada la conversación por micrófono." }, 403);
      const resets = new Date(); resets.setUTCHours(24, 0, 0, 0);
      const day = new Date().toISOString().slice(0, 10);
      if (request.headers.get("Content-Type")?.startsWith("application/json")) {
        const body = JSON.parse(new TextDecoder().decode(await readLimited(request, 1024)));
        if (!body || typeof body !== "object" || Array.isArray(body) || body.type !== "status") return json({ error: "Solicitud inválida." }, 400);
        if (!config.enabled) return json({ available: false, reason: "El micrófono todavía no está habilitado. Podés seguir por texto y escuchar las respuestas.", remainingSeconds: 0, resetsAt: resets.toISOString() });
        const [pool, usage] = await Promise.all([
          db.from("voice_quota_pools").select("day,remaining_neurons,free_plan_verified,valid_until").eq("account_id", config.account).maybeSingle(),
          db.from("voice_requests").select("seconds").eq("user_id", userId).eq("day", day),
        ]);
        if (pool.error || usage.error) throw Error("No pudimos consultar la cuota de voz.");
        const remaining = Math.max(0, config.studentLimit - (usage.data ?? []).reduce((sum, item) => sum + item.seconds, 0));
        const verified = pool.data?.day === day && pool.data.free_plan_verified && Date.parse(pool.data.valid_until) > Date.now();
        const available = Boolean(verified && pool.data!.remaining_neurons >= 23 && remaining > 0);
        return json({ available, remainingSeconds: remaining, resetsAt: resets.toISOString(), reason: available ? undefined :
          !verified ? "Falta verificar la cuota gratuita compartida. Seguimos por texto y lectura por voz." :
          !remaining ? "Usaste la cuota diaria de micrófono. Se renueva a las 00:00 UTC." : "La cuota gratuita compartida está agotada. Seguimos por texto y lectura por voz." });
      }
      if (!config.enabled) return json({ error: "El micrófono todavía no está habilitado." }, 503);
      if (request.headers.get("Content-Type") !== "audio/wav") return json({ error: "Formato de audio inválido." }, 415);
      operation = request.headers.get("x-operation-id");
      if (!operation || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(operation))
        return json({ error: "Falta el identificador de la intervención." }, 400);
      const audio = await readLimited(request, 800044), { seconds } = validateVoiceWav(audio);
      const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", audio))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
      const reservation = await db.rpc("voice_reserve", { p_user: userId, p_account: config.account,
        p_operation: operation, p_fingerprint: hash, p_seconds: seconds, p_student_limit: config.studentLimit });
      if (reservation.error) return json({ error: "No pudimos reservar la cuota de voz. El audio no se envió." }, 503);
      if (reservation.data !== "RESERVED") {
        const errors: Record<string, string> = {
          FORBIDDEN: "La cuenta ya no tiene permiso para usar el micrófono.", BUDGET_UNVERIFIED: "Falta verificar la cuota gratuita compartida.",
          STUDENT_LIMIT: "Usaste la cuota diaria de micrófono. Se renueva a las 00:00 UTC.", GLOBAL_LIMIT: "La cuota gratuita compartida está agotada.",
          BUSY: "La intervención anterior todavía está en curso. Esperá unos segundos.", ALREADY_USED: "Esta intervención ya se procesó. No volvimos a enviar el audio.",
        };
        return json({ error: errors[reservation.data] ?? "La voz no está disponible." }, reservation.data === "FORBIDDEN" ? 403 : 429);
      }
      const controller = new AbortController(), abort = () => controller.abort();
      request.signal.addEventListener("abort", abort, { once: true });
      if (request.signal.aborted) controller.abort();
      const timer = setTimeout(abort, 35000);
      try {
        const response = await provider(`https://api.cloudflare.com/client/v4/accounts/${config.account}/ai/run/@cf/openai/whisper-large-v3-turbo`, {
          method: "POST", signal: controller.signal,
          headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ audio: base64(audio), task: "transcribe", language: "es", vad_filter: true, condition_on_previous_text: false }),
        });
        if (!response.ok) throw Error("Whisper no pudo transcribir esta frase. Podés escribirla para continuar.");
        const result = await response.json() as { success?: boolean; result?: { text?: unknown } };
        if (result.success === false || typeof result.result?.text !== "string") throw Error("No pudimos obtener la transcripción.");
        const text = result.result.text.trim().slice(0, 4000);
        if (controller.signal.aborted) throw Error("La intervención se canceló.");
        if (!await voicePermission(db, env, userId)) throw Error("El permiso de micrófono fue revocado.");
        const done = await db.from("voice_requests").update({ status: "DONE", finished_at: new Date().toISOString() }).eq("operation_id", operation).eq("user_id", userId);
        if (done.error) throw Error("No pudimos confirmar esta intervención. Continuá por texto.");
        return json({ text, seconds });
      } catch (failure) {
        await db.from("voice_requests").update({ status: "FAILED", finished_at: new Date().toISOString() }).eq("operation_id", operation).eq("user_id", userId);
        return json({ error: controller.signal.aborted ? "La intervención se canceló o agotó su tiempo. Continuá por texto." : failure instanceof Error ? failure.message : "La voz no está disponible." }, 503);
      } finally { clearTimeout(timer); request.signal.removeEventListener("abort", abort); }
    } catch (failure) {
      return json({ error: failure instanceof Error ? failure.message : "No pudimos procesar la intervención." }, 400);
    }
  };
}
