"use client";

import { useCallback, useEffect, useState } from "react";
import type { SupportTicket } from "@compa/client";
import styles from "./admin.module.css";

type OperatorTicket = SupportTicket & { user_id: string };
type TicketStatus = OperatorTicket["status"];
const statusLabel: Record<TicketStatus, string> = {
  open: "Recibida", in_progress: "En revisión", waiting_student: "Esperando al alumno", resolved: "Resuelta",
};
function page(rows: OperatorTicket[]) {
  const visible = rows.slice(0, 50);
  const last = visible.at(-1);
  return { visible, next: rows.length > 50 && last ?
    { priority: last.priority, updated_at: last.updated_at, id: last.id } : null };
}

export function SupportOperations({ call }: {
  call: (type: string, payload?: Record<string, unknown>) => Promise<unknown>;
}) {
  const [tickets, setTickets] = useState<OperatorTicket[]>([]);
  const [cursor, setCursor] = useState<{ priority: string; updated_at: string; id: string } | null>(null);
  const [filter, setFilter] = useState<TicketStatus | "all">("open");
  const [selected, setSelected] = useState<string | null>(null);
  const [response, setResponse] = useState("");
  const [status, setStatus] = useState<TicketStatus>("in_progress");
  const [pending, setPending] = useState<{ fingerprint: string; id: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const refresh = useCallback(async () => {
    const data = await call("operator.supportQueue", { status: filter === "all" ? null : filter }) as { tickets: OperatorTicket[] };
    const result = page(data.tickets);
    setTickets(result.visible); setCursor(result.next);
  }, [call, filter]);
  useEffect(() => { void refresh().catch((failure) => setError(failure.message)); }, [refresh]);
  const choose = (ticket: OperatorTicket) => {
    setSelected(ticket.id); setStatus(ticket.status === "open" ? "in_progress" : ticket.status);
    setResponse(""); setPending(null);
  };
  const save = async (ticket: OperatorTicket) => {
    if (busy || ((status === "waiting_student" || status === "resolved") && response.trim().length < 4)) return;
    setBusy(true); setError(""); setNotice("");
    const fingerprint = JSON.stringify({ ticket: ticket.id, status, response: response.trim() });
    const operation = pending?.fingerprint === fingerprint ? pending.id : crypto.randomUUID();
    setPending({ fingerprint, id: operation });
    try {
      await call("operator.supportUpdate", { ticket_id: ticket.id, status, response: response.trim() || undefined,
        operation_id: operation });
      setPending(null); setResponse(""); setSelected(null); setNotice("Cambio confirmado.");
      try { await refresh(); } catch { setNotice("Cambio confirmado. Actualizá la lista para ver el estado."); }
    } catch (failure) { setError(failure instanceof Error ? failure.message : "No pudimos confirmar el cambio."); }
    finally { setBusy(false); }
  };
  const more = async () => {
    if (busy || !cursor) return;
    setBusy(true); setError("");
    try {
      const data = await call("operator.supportQueue", { status: filter === "all" ? null : filter,
        before: cursor }) as { tickets: OperatorTicket[] };
      const result = page(data.tickets);
      setTickets((current) => [...current, ...result.visible]); setCursor(result.next);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "No pudimos cargar más consultas."); }
    finally { setBusy(false); }
  };
  return <section className={styles.audit}>
    <h2>Ayuda y soporte</h2>
    <p>Consultas de cuentas conectadas. Revisá la cola con regularidad; esta interfaz no promete atención inmediata ni reemplaza el procedimiento de seguridad.</p>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {notice && <p role="status" className={styles.notice}>{notice}</p>}
    <div className={styles.toolbar}>
      <label>Estado<select value={filter} onChange={(event) => setFilter(event.target.value as TicketStatus | "all")}>
        <option value="open">Recibidas</option><option value="in_progress">En revisión</option>
        <option value="waiting_student">Esperando al alumno</option><option value="resolved">Resueltas</option>
        <option value="all">Todas</option>
      </select></label>
      <button className={styles.secondary} disabled={busy} onClick={() => void refresh().catch((failure) => setError(failure.message))}>Actualizar</button>
    </div>
    {tickets.length === 0 && <p>No hay consultas en este estado.</p>}
    <div className={styles.grid}>{tickets.map((ticket) => <article key={ticket.id} className={styles.card}>
      <h3>{ticket.priority === "urgent" ? "Prioritaria · " : ""}{ticket.subject}</h3>
      <p>{statusLabel[ticket.status]} · {ticket.category} · {new Date(ticket.updated_at).toLocaleString("es-AR")}</p>
      <p>Cuenta: {ticket.user_id}</p>
      {selected === ticket.id ? <div className={styles.review}>
        {ticket.messages.map((message) => <p key={message.id} style={{ whiteSpace: "pre-wrap" }}>
          <strong>{message.author_kind === "operator" ? "Equipo" : "Alumno"}:</strong> {message.body}
        </p>)}
        <label>Estado<select value={status} onChange={(event) => setStatus(event.target.value as TicketStatus)}>
          {Object.entries(statusLabel).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select></label>
        <label>Respuesta para el alumno<textarea value={response} maxLength={2000}
          onChange={(event) => setResponse(event.target.value)} /></label>
        <button disabled={busy || ((status === "waiting_student" || status === "resolved") && response.trim().length < 4)}
          onClick={() => void save(ticket)}>Confirmar</button>
        <button className={styles.secondary} onClick={() => setSelected(null)}>Cerrar vista</button>
      </div> : <button className={styles.secondary} onClick={() => choose(ticket)}>Abrir consulta</button>}
    </article>)}</div>
    {cursor && <button className={styles.secondary} disabled={busy} onClick={() => void more()}>Cargar más consultas</button>}
  </section>;
}
