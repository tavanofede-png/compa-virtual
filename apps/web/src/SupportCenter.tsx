"use client";

import { useCallback, useEffect, useState } from "react";
import type { Repository, SupportCategory, SupportTicket } from "@compa/client";

const categories: { id: SupportCategory; label: string }[] = [
  { id: "access", label: "Acceso o cuenta" },
  { id: "study", label: "Estudio y agenda" },
  { id: "materials", label: "Archivos y apuntes" },
  { id: "rooms", label: "Habitaciones y encuentros" },
  { id: "voice", label: "Voz y compañero" },
  { id: "safety", label: "Seguridad o convivencia" },
  { id: "other", label: "Otro problema" },
];
const statusLabel = { open: "Recibida", in_progress: "En revisión",
  waiting_student: "Esperando tu respuesta", resolved: "Resuelta" };
function page(rows: SupportTicket[]) {
  const visible = rows.slice(0, 50);
  const last = visible.at(-1);
  return { visible, next: rows.length > 50 && last ? { updated_at: last.updated_at, id: last.id } : null };
}

export function SupportCenter({ repo }: { repo: Repository }) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [cursor, setCursor] = useState<{ updated_at: string; id: string } | null>(null);
  const [category, setCategory] = useState<SupportCategory>("study");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [reply, setReply] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [operation, setOperation] = useState(crypto.randomUUID());
  const [replyOperation, setReplyOperation] = useState(crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const refresh = useCallback(async () => {
    const result = page(await repo.supportTickets());
    setTickets(result.visible); setCursor(result.next);
  }, [repo]);
  const more = async () => {
    if (!cursor) return;
    const result = page(await repo.supportTickets(cursor));
    setTickets((current) => [...current, ...result.visible]); setCursor(result.next);
  };
  useEffect(() => {
    if (repo.mode !== "live") return;
    void refresh().catch((failure) => setError(failure.message));
  }, [refresh, repo.mode]);
  const perform = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try { await action(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "No pudimos confirmar la operación."); }
    finally { setBusy(false); }
  };
  if (repo.mode !== "live") return <p className="callout">Las consultas de soporte se guardan únicamente en una cuenta conectada.</p>;
  return <div className="support-center">
    <p>Contanos qué ocurrió sin incluir contraseñas ni datos privados de otras personas. Revisamos las consultas desde el panel; no hay atención humana inmediata garantizada.</p>
    {error && <p role="alert" className="error">{error}</p>}
    {notice && <p role="status" className="callout">{notice}</p>}
    <form onSubmit={(event) => { event.preventDefault(); void perform(async () => {
      await repo.createSupportTicket({ category, subject: subject.trim(), body: body.trim() }, operation);
      setOperation(crypto.randomUUID()); setSubject(""); setBody("");
      setNotice("Consulta recibida. Podés seguir su estado acá.");
      try { await refresh(); } catch { setNotice("Consulta recibida. Actualizá la lista para verla."); }
    }); }}>
      <h3>Nueva consulta</h3>
      <label>Categoría<select value={category} onChange={(event) => setCategory(event.target.value as SupportCategory)}>
        {categories.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select></label>
      <label>Asunto<input value={subject} onChange={(event) => setSubject(event.target.value)} minLength={4} maxLength={100} required /></label>
      <label>¿Qué pasó?<textarea value={body} onChange={(event) => setBody(event.target.value)} minLength={4} maxLength={2000} required /></label>
      <button className="primary" disabled={busy || subject.trim().length < 4 || body.trim().length < 4}>Enviar consulta</button>
    </form>
    <h3>Mis consultas</h3>
    <button className="secondary" type="button" disabled={busy} onClick={() => void perform(refresh)}>Actualizar</button>
    {tickets.length === 0 && <p>Todavía no hay consultas.</p>}
    {tickets.map((ticket) => <article key={ticket.id} className="support-ticket">
      <button className="settings-row" type="button" onClick={() => setSelected(selected === ticket.id ? null : ticket.id)}
        aria-expanded={selected === ticket.id}>
        {ticket.subject} · {statusLabel[ticket.status]}
      </button>
      {selected === ticket.id && <div>
        <p>{new Date(ticket.created_at).toLocaleString("es-AR")} · {categories.find((item) => item.id === ticket.category)?.label}</p>
        {ticket.messages.map((message) => <p key={message.id} className="support-message">
          <strong>{message.author_kind === "operator" ? "Equipo de Kusiy" : "Vos"}</strong>
          <span>{message.body}</span>
        </p>)}
        <form onSubmit={(event) => { event.preventDefault(); void perform(async () => {
          await repo.replySupportTicket(ticket.id, reply.trim(), replyOperation);
          setReplyOperation(crypto.randomUUID()); setReply(""); setNotice("Respuesta recibida.");
          try { await refresh(); } catch { setNotice("Respuesta recibida. Actualizá la lista para verla."); }
        }); }}>
          <label>Agregar información<textarea value={reply} onChange={(event) => setReply(event.target.value)} minLength={4} maxLength={2000} required /></label>
          <button className="secondary" disabled={busy || reply.trim().length < 4}>Responder</button>
        </form>
      </div>}
    </article>)}
    {cursor && <button className="secondary" type="button" disabled={busy}
      onClick={() => void perform(more)}>Cargar más consultas</button>}
  </div>;
}
