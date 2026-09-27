"use client";
import { useCallback, useEffect, useState } from "react";
import styles from "./admin.module.css";

type Report = { id: string; session_id: string; reporter_id: string | null;
  target_author_id: string | null; category: string; detail: string | null;
  evidence: string; created_at: string; };
type Decision = "approve" | "hide" | "dismiss";
type Control = { writable: boolean; configured: boolean; reason: string; updated_at: string;
  audit: { writable: boolean; reason: string; created_at: string }[] };
export function ChatOperations({ call }: {
  call: (type: string, payload?: Record<string, unknown>) => Promise<unknown>;
}) {
  const [reports, setReports] = useState<Report[]>([]);
  const [control, setControl] = useState<Control | null>(null);
  const [controlReason, setControlReason] = useState("");
  const [reason, setReason] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const refresh = useCallback(async () => {
    const [data, state] = await Promise.all([
      call("operator.chatReports") as Promise<{ reports: Report[] }>,
      call("operator.chatControl") as Promise<Control>,
    ]);
    setReports(data.reports); setControl(state);
  }, [call]);
  useEffect(() => { void refresh().catch((failure) => setError(failure.message)); }, [refresh]);
  const decide = async (report: Report, action: Decision) => {
    if (busy || reason.trim().length < 8) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await call("operator.chatDecision", { report_id: report.id, action, reason: reason.trim() });
      setSelected(null); setReason(""); setNotice("Decisión registrada."); await refresh();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "No pudimos confirmar la decisión."); }
    finally { setBusy(false); }
  };
  const setWritable = async (writable: boolean) => {
    if (busy || controlReason.trim().length < 8) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const next = await call("operator.setChatControl", { writable,
        reason: controlReason.trim() }) as Control;
      setControl(next); setControlReason("");
      setNotice(writable ? "El envío de mensajes quedó habilitado." : "El chat quedó en solo lectura.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "No pudimos confirmar el estado del chat."); }
    finally { setBusy(false); }
  };
  return <section className={styles.audit}>
    <h2>Reportes del chat</h2>
    <p>Los mensajes retenidos permanecen ocultos hasta una revisión. El chat debe quedar en solo lectura si no hay moderación disponible.</p>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {notice && <p role="status" className={styles.notice}>{notice}</p>}
    {control && <div className={styles.card}>
      <h3>Estado operativo</h3>
      <p>{control.writable ? "Envío habilitado" : "Solo lectura"} · {control.configured ? "Servidor configurado" : "Servidor todavía no habilitado"}</p>
      <p>Último motivo: {control.reason}</p>
      <label>Motivo del cambio<input value={controlReason} maxLength={300}
        onChange={(event) => setControlReason(event.target.value)} /></label>
      <button className={control.writable ? styles.danger : styles.secondary}
        disabled={busy || controlReason.trim().length < 8 || (!control.writable && !control.configured)}
        onClick={() => void setWritable(!control.writable)}>
        {control.writable ? "Poner en solo lectura" : "Habilitar envío"}
      </button>
      <details><summary>Historial de cambios</summary>{control.audit.map((entry, index) =>
        <p key={entry.created_at + index}>{new Date(entry.created_at).toLocaleString("es-AR")} · {entry.writable ? "Habilitado" : "Solo lectura"} · {entry.reason}</p>)}</details>
    </div>}
    <button className={styles.secondary} disabled={busy} onClick={() => void refresh().catch((failure) => setError(failure.message))}>Actualizar reportes</button>
    {reports.length === 0 && <p>No hay reportes abiertos.</p>}
    <div className={styles.grid}>{reports.map((report) => <article key={report.id} className={styles.card}>
      <h3>{report.category}</h3>
      <p>{new Date(report.created_at).toLocaleString("es-AR")}</p>
      <p>Encuentro {report.session_id}</p>
      <p>Autor {report.target_author_id ?? "Cuenta eliminada"}</p>
      <blockquote>{report.evidence}</blockquote>
      {report.detail && <p>Detalle: {report.detail}</p>}
      {selected === report.id ? <div className={styles.review}>
        <label>Motivo de la decisión<input value={reason} maxLength={300}
          onChange={(event) => setReason(event.target.value)} /></label>
        <button disabled={busy || reason.trim().length < 8} onClick={() => void decide(report, "hide")}>Ocultar mensaje</button>
        <button className={styles.secondary} disabled={busy || reason.trim().length < 8} onClick={() => void decide(report, "approve")}>Aprobar mensaje</button>
        <button className={styles.secondary} disabled={busy || reason.trim().length < 8} onClick={() => void decide(report, "dismiss")}>Cerrar sin cambios</button>
        <button className={styles.secondary} onClick={() => setSelected(null)}>Cancelar</button>
      </div> : <button className={styles.secondary} onClick={() => setSelected(report.id)}>Revisar</button>}
    </article>)}</div>
  </section>;
}
