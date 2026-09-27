import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const category = z.enum(["access", "study", "materials", "rooms", "voice", "safety", "other"]);
const ticketId = z.uuid();
const message = z.string().trim().min(4).max(2000);

export async function handleSupport(
  db: SupabaseClient,
  userId: string,
  body: { type: string; payload: Record<string, unknown>; operationId?: string },
  json: (value: unknown, status?: number) => Response,
): Promise<Response> {
  if (body.type === "support.list") {
    const input = z.object({ before: z.object({ updated_at: z.iso.datetime({ offset: true }), id: z.uuid() })
      .strict().optional() }).strict().parse(body.payload);
    const result = await db.rpc("support_read", { p_user: userId,
      p_before_updated: input.before?.updated_at ?? null,
      p_before_id: input.before?.id ?? null });
    if (result.error) return json({ error: "No pudimos cargar tus consultas. Reintentá." }, 503);
    return json({ tickets: result.data });
  }
  if (body.type === "support.create") {
    const input = z.object({ category, subject: z.string().trim().min(4).max(100), body: message }).strict().parse(body.payload);
    const operation = ticketId.parse(body.operationId);
    const result = await db.rpc("support_create", {
      p_user: userId, p_operation: operation,
      p_category: input.category, p_subject: input.subject, p_body: input.body,
    });
    if (result.error) return json({ error: result.error.message === "SUPPORT_RATE_LIMIT"
      ? "Llegaste al límite de consultas por hoy. Podés responder en una consulta existente."
      : "No pudimos confirmar tu consulta. Actualizá la lista antes de reintentar." },
      result.error.message === "SUPPORT_RATE_LIMIT" ? 429 : 503);
    return json({ ticket: result.data });
  }
  if (body.type === "support.reply") {
    const input = z.object({ ticket_id: ticketId, body: message }).strict().parse(body.payload);
    const operation = ticketId.parse(body.operationId);
    const result = await db.rpc("support_reply", {
      p_user: userId, p_ticket: input.ticket_id, p_operation: operation, p_body: input.body,
    });
    if (result.error) return json({ error: result.error.message === "SUPPORT_NOT_FOUND"
      ? "No encontramos esta consulta en tu cuenta."
      : result.error.message === "SUPPORT_RATE_LIMIT"
        ? "Llegaste al límite de mensajes por hoy."
        : "No pudimos confirmar tu respuesta. Actualizá la consulta antes de reintentar." },
      result.error.message === "SUPPORT_NOT_FOUND" ? 404 :
        result.error.message === "SUPPORT_RATE_LIMIT" ? 429 : 503);
    return json({ message: result.data });
  }
  return json({ error: "Operación de soporte desconocida." }, 400);
}
