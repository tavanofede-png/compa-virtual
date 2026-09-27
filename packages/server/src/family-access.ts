import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { capabilityNames, familyAcceptanceSchema } from "@compa/domain";
import { familyPortalConfiguration, hashFamilyToken } from "./family-permissions";

const requestSchema = z.object({
  token: z.string().regex(/^[0-9a-f]{64}$/),
  action: z.enum(["VIEW", "ACCEPT", "REVOKE"]),
  operationId: z.uuid().optional(),
  acceptance: familyAcceptanceSchema.optional(),
  capabilities: z.array(z.enum(capabilityNames)).min(1).max(3).optional(),
}).strict();

// This endpoint uses a restricted, random family link instead of a student's JWT.
// It never returns academic data and never sends token/body content to logs.
export function createFamilyAccessHandler(env: Record<string, string | undefined>) {
  const db = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const origins = (env.ALLOWED_ORIGINS ?? "http://localhost:3000").split(",").map((origin) => origin.trim());
  return async (req: Request): Promise<Response> => {
    const origin = req.headers.get("Origin");
    const json = (value: unknown, status = 200) => new Response(status === 204 ? null : JSON.stringify(value), {
      status,
      headers: {
        "Content-Type": "application/json", "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": origin && origins.includes(origin) ? origin : origins[0],
        "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-client-info",
        "Access-Control-Allow-Methods": "POST,OPTIONS", "Referrer-Policy": "no-referrer", Vary: "Origin",
      },
    });
    if (origin && !origins.includes(origin)) return json({ error: "Origen no permitido." }, 403);
    if (req.method === "OPTIONS") return json(null, 204);
    if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);
    const config = familyPortalConfiguration(env);
    if (!config) return json({ error: "El acceso familiar todavía no está habilitado. Contactá al responsable de Kusiy." }, 503);
    try {
      const text = await req.text();
      if (text.length > 5000) return json({ error: "Solicitud demasiado grande." }, 413);
      const body = requestSchema.parse(JSON.parse(text));
      if (body.action !== "VIEW" && !body.operationId) return json({ error: "Falta identificar la operación." }, 400);
      if (body.action === "ACCEPT" && !body.acceptance) return json({ error: "Revisá y aceptá los permisos por separado." }, 400);
      if (body.action === "REVOKE" && !body.capabilities?.length) return json({ error: "Elegí el permiso que querés revocar." }, 400);
      const { data, error } = await db.rpc("family_access", {
        p_hash: await hashFamilyToken(body.token), p_action: body.action,
        p_operation: body.operationId ?? null,
        p_permissions: body.action === "ACCEPT" ? body.acceptance!.permissions : null,
        p_revoke: body.action === "REVOKE" ? body.capabilities : null,
      });
      if (error) {
        if (["FAMILY_LINK_INVALID", "FAMILY_LINK_USED"].includes(error.message))
          return json({ error: "Este enlace venció, fue reemplazado o ya no permite esta acción. Pedí uno nuevo por el canal verificado." }, 410);
        if (error.message === "FAMILY_PERMISSIONS_INVALID") return json({ error: "Revisá los permisos antes de continuar." }, 400);
        if (error.message === "FAMILY_LINK_RATE_LIMIT") return json({ error: "Esperá un minuto antes de volver a intentar." }, 429);
        throw error;
      }
      return json(data);
    } catch (error) {
      if (error instanceof z.ZodError || error instanceof SyntaxError) return json({ error: "Solicitud inválida." }, 400);
      return json({ error: "No pudimos confirmar el resultado. Reintentá con la misma operación." }, 503);
    }
  };
}
