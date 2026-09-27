import { createClient } from "@supabase/supabase-js";
import { ageAt, materialCanRetry, type Snapshot } from "@compa/domain";
import { hasFamilyCapability } from "./family-permissions";

type Env = Record<string, string | undefined>;

const json = (value: unknown, status: number, origin: string) =>
  new Response(status === 204 ? null : JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "authorization, apikey, content-type",
      Vary: "Origin",
    },
  });

// Previous clients call this Edge Function after material.enqueue. Keep the
// endpoint, but let the durable worker be the only document processor.
export function createMaterialProcessHandler(env: Env) {
  const service = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const allowedOrigins = (env.ALLOWED_ORIGINS ?? "http://localhost:3000").split(",");
  return async (request: Request): Promise<Response> => {
    const requestOrigin = request.headers.get("Origin") ?? "";
    const origin = allowedOrigins.includes(requestOrigin)
      ? requestOrigin
      : allowedOrigins[0];
    if (request.method === "OPTIONS") return json({}, 204, origin);
    if (request.method !== "POST")
      return json({ error: "Método inválido." }, 405, origin);
    const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Iniciá sesión." }, 401, origin);
    const { data: auth, error: authError } = await service.auth.getUser(token);
    if (authError || !auth.user)
      return json({ error: "Tu sesión venció. Volvé a ingresar." }, 401, origin);
    let materialId: string;
    try {
      const body = (await request.json()) as { material_id?: unknown };
      if (typeof body.material_id !== "string" ||
          !/^[0-9a-f-]{36}$/i.test(body.material_id))
        return json({ error: "Material inválido." }, 400, origin);
      materialId = body.material_id;
    } catch {
      return json({ error: "Solicitud inválida." }, 400, origin);
    }
    const userId = auth.user.id;
    const { data: control, error: controlError } = await service
      .from("account_controls")
      .select("deleting")
      .eq("user_id", userId)
      .maybeSingle();
    if (controlError)
      return json({ error: "No pudimos comprobar la cuenta." }, 503, origin);
    if (control?.deleting)
      return json({ error: "La eliminación de esta cuenta está en curso." }, 403, origin);
    const { data: row, error: stateError } = await service
      .from("student_states")
      .select("state")
      .eq("user_id", userId)
      .maybeSingle();
    if (stateError || !row)
      return json({ error: "Cuenta no encontrada." }, 404, origin);
    const state = row.state as Snapshot;
    const material = state.materials.find((item) => item.id === materialId);
    if (!material)
      return json({ error: "Material no encontrado." }, 404, origin);
    if (!state.profile)
      return json({ error: "Completá tu perfil." }, 403, origin);
    const age = ageAt(state.profile.birth_date);
    if (age < 18) {
      if (env.MINOR_BETA_APPROVED !== "true")
        return json({ error: "Falta habilitar el procesamiento para esta cuenta." }, 403, origin);
      try {
        if (!await hasFamilyCapability(service, userId, "service"))
          return json({ error: "Falta la aceptación familiar del servicio." }, 403, origin);
      } catch { return json({ error: "No pudimos comprobar los permisos." }, 503, origin); }
    }
    if (material.status === "READY" && !materialCanRetry(material))
      return json({ status: "READY" }, 200, origin);
    const { data: file, error: fileError } = await service.storage
      .from("materials")
      .info(material.path);
    if (fileError || !file || Number(file.size) !== material.size)
      return json({ error: "El archivo todavía no terminó de subirse." }, 409, origin);
    const queued = await service.rpc("enqueue_material", {
      p_user: userId,
      p_material: material.id,
    });
    if (queued.error)
      return json({ error: "No pudimos encolar el material. Reintentá." }, 503, origin);
    return json({ status: "QUEUED" }, 200, origin);
  };
}
