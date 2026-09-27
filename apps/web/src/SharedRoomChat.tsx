"use client";
import { useCallback, useEffect, useState } from "react";
import type { CollaborationRepository } from "@compa/client";
import type { GroupChatMessage, GroupChatPage, GroupChatReportCategory } from "@compa/domain";

const categories: { value: GroupChatReportCategory; label: string }[] = [
  { value: "harassment", label: "Acoso" },
  { value: "personal-data", label: "Datos personales" },
  { value: "sexual", label: "Contenido sexual" },
  { value: "violence", label: "Violencia" },
  { value: "other", label: "Otro motivo" },
];
export function SharedRoomChat({ repo, sessionId, userId }: {
  repo: CollaborationRepository; sessionId: string; userId: string;
}) {
  const [page, setPage] = useState<GroupChatPage | null>(null);
  const [older, setOlder] = useState<GroupChatMessage[]>([]);
  const [olderCursor, setOlderCursor] = useState<GroupChatPage["next_cursor"] | undefined>(undefined);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reportId, setReportId] = useState<string | null>(null);
  const [category, setCategory] = useState<GroupChatReportCategory>("other");
  const [detail, setDetail] = useState("");
  const refresh = useCallback(async () => {
    const next = await repo.chatPage(sessionId);
    setPage(next);
    // A moderator may hide an older item, or a block may make it private.
    // Drop previously paged copies whenever the authoritative view refreshes.
    setOlder([]);
    setOlderCursor(undefined);
  }, [repo, sessionId]);
  useEffect(() => {
    let active = true;
    void refresh().catch((e) => { if (active) setError(e.message); });
    const off = repo.subscribe?.(() => void refresh().catch(() => {}), () => {});
    const timer = setInterval(() => {
      if (!document.hidden) void refresh().catch(() => {});
    }, 15000);
    return () => { active = false; off?.(); clearInterval(timer); };
  }, [repo, refresh]);
  const act = async (operation: () => Promise<unknown>, success: string) => {
    if (busy) return false;
    setBusy(true); setError(""); setNotice("");
    try { await operation(); setNotice(success); await refresh(); return true; }
    catch (e) { setError(e instanceof Error ? e.message : "No pudimos confirmar la acción."); return false; }
    finally { setBusy(false); }
  };
  const messages = [...older, ...(page?.messages ?? [])]
    .filter((message, index, all) => all.findIndex((item) => item.id === message.id) === index)
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  return <section className="shared-chat" aria-label="Chat del encuentro">
    <header><h3>Chat del encuentro</h3><p>Solo lo ven quienes participan. Podés reportar o bloquear desde cada mensaje.</p></header>
    {error && <p role="alert" className="shared-chat-error">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {(olderCursor === undefined ? page?.next_cursor : olderCursor) && <button className="secondary" disabled={busy} onClick={() => {
      setBusy(true); setError("");
      void repo.chatPage(sessionId, (olderCursor === undefined ? page?.next_cursor : olderCursor)!)
        .then((previous) => { setOlder((items) => [...items, ...previous.messages]); setOlderCursor(previous.next_cursor); })
        .catch((failure) => setError(failure.message))
        .finally(() => setBusy(false));
    }}>Ver mensajes anteriores</button>}
    <ol className="shared-chat-list" aria-live="polite">{messages.map((message) => <li key={message.id}>
      <strong>{message.author_id === userId ? "Vos" : message.author_name}</strong>
      <time dateTime={message.created_at}>{new Date(message.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</time>
      <p>{message.body}</p>
      {message.status === "held" && <small>En revisión. Todavía no lo ven los demás.</small>}
      {message.author_id && message.author_id !== userId && <div className="shared-chat-actions">
        <button className="secondary" onClick={() => setReportId(message.id)}>Reportar</button>
        <button className="secondary" disabled={busy} onClick={() => {
          if (window.confirm(`¿Bloquear a ${message.author_name}? Saldrás de la sala si ambos están dentro.`))
            void act(() => repo.chatBlock(message.author_id!), "Persona bloqueada. Ya no verás sus mensajes.");
        }}>Bloquear</button>
      </div>}
      {reportId === message.id && <form className="shared-chat-report" onSubmit={(event) => {
        event.preventDefault();
        void act(() => repo.chatReport(sessionId, message.id, category, detail.trim()), "Reporte enviado para revisión.")
          .then((confirmed) => { if (confirmed) { setReportId(null); setDetail(""); } });
      }}>
        <label>Motivo<select value={category} onChange={(event) => setCategory(event.target.value as GroupChatReportCategory)}>
          {categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select></label>
        <label>Detalle opcional<textarea value={detail} onChange={(event) => setDetail(event.target.value)} maxLength={500} /></label>
        <button disabled={busy}>Enviar reporte</button>
        <button className="secondary" type="button" onClick={() => setReportId(null)}>Cancelar</button>
      </form>}
    </li>)}</ol>
    {page && (page.enabled ? <form className="shared-chat-compose" onSubmit={(event) => {
      event.preventDefault();
      const content = body.trim();
      if (!content) return;
      void act(() => repo.chatSend(sessionId, content), "Mensaje enviado.").then((confirmed) => { if (confirmed) setBody(""); });
    }}><label htmlFor="shared-message">Tu mensaje</label>
      <textarea id="shared-message" value={body} maxLength={1000} onChange={(event) => setBody(event.target.value)} />
      <button disabled={busy || !body.trim()}>Enviar</button>
    </form> : <p>El chat está en solo lectura mientras se prepara la moderación.</p>)}
  </section>;
}
