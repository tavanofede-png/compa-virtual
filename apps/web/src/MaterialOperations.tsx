"use client";
import { useEffect, useRef, useState } from "react";
import styles from "./admin.module.css";

type Job = {
  id: string; user_id: string; material_id: string; phase: string; status: string;
  attempts: number; completed_units: number; total_units: number | null;
  indexing_status: string; updated_at: string; lease_expires_at: string | null; error_code: string | null;
};
type Cursor = { id: string; updated_at: string };
type Page = { jobs: Job[]; cleanup_pending: number; nextCursor: Cursor | null };
export function MaterialOperations({ call }: { call: (type: string, payload?: Record<string, unknown>) => Promise<unknown> }) {
  const [page, setPage] = useState<Page | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reason, setReason] = useState("");
  const [attentionOnly, setAttentionOnly] = useState(true);
  const receipt = useRef<{ operation_id: string; user_id: string; material_id: string; reason: string } | null>(null);
  useEffect(() => {
    let alive = true;
    void call("operator.materialJobs").then((data) => { if (alive) setPage(data as Page); })
      .catch((failure) => { if (alive) setError(failure.message); });
    return () => { alive = false; };
  }, [call]);
  const refresh = async (older = false) => {
    setBusy(true); setError("");
    try {
      const data = await call("operator.materialJobs", older && page?.nextCursor ? { before: page.nextCursor } : {}) as Page;
      setPage((previous) => ({ ...data, jobs: older ? [...(previous?.jobs ?? []), ...data.jobs] : data.jobs }));
    } catch (failure) { setError(failure instanceof Error ? failure.message : "No pudimos consultar los trabajos."); }
    finally { setBusy(false); }
  };
  const retry = async (job: Job) => {
    setBusy(true); setError(""); setNotice("");
    const operation = receipt.current ?? { operation_id: crypto.randomUUID(), user_id: job.user_id, material_id: job.material_id, reason: reason.trim() };
    receipt.current = operation;
    try {
      await call("operator.retryMaterial", operation);
      receipt.current = null;
      setNotice("Operación confirmada. La cola conserva una sola ejecución por material; revisá su fase actual.");
      setPage(await call("operator.materialJobs") as Page);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Reintento sin confirmar."); }
    finally { setBusy(false); }
  };
  const needsAttention = (job: Job) => job.phase === "FAILED" || job.phase === "CANCELLED" ||
    (["WAITING", "EXTRACTING", "OCR", "INDEXING"].includes(job.phase) && Date.now() - Date.parse(job.updated_at) > 15 * 60000);
  const jobs = page?.jobs.filter((job) => !attentionOnly || needsAttention(job)) ?? [];
  return <section className={styles.audit} aria-label="Procesamiento de materiales">
    <h2>Materiales y recuperación</h2>
    <p>Estado técnico sin mostrar apuntes ni archivos de los alumnos. Los trabajos interrumpidos conservan sus avances.</p>
    <div className={styles.toolbar}><label><input type="checkbox" checked={attentionOnly} onChange={(event) => setAttentionOnly(event.target.checked)} /> Solo trabajos que requieren atención</label><button disabled={busy} onClick={() => void refresh()}>Actualizar trabajos</button></div>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {notice && <p role="status" className={styles.notice}>{notice}</p>}
    {page && <p>Originales pendientes de eliminación en Storage: {page.cleanup_pending}.</p>}
    <label>Motivo del reintento<input maxLength={300} value={reason} disabled={Boolean(receipt.current)} onChange={(event) => setReason(event.target.value)} placeholder="Ej. recuperación después de una caída del worker" /></label>
    {page && jobs.length === 0 && <p>No hay trabajos en este filtro de la página consultada.</p>}
    <div className={styles.grid}>{jobs.map((job) => <article key={job.id} className={styles.card}>
      <h3>{job.phase} · intento {job.attempts}/3</h3>
      <p>Cuenta: {job.user_id}<br />Material: {job.material_id}</p>
      <p>{job.completed_units}{job.total_units !== null ? `/${job.total_units}` : ""} · búsqueda {job.indexing_status}</p>
      <p>Última actualización: {new Date(job.updated_at).toLocaleString("es-AR")}</p>
      {job.error_code && <p>{job.error_code}</p>}
      {needsAttention(job) && <button disabled={busy || reason.trim().length < 8 || Boolean(receipt.current && receipt.current.material_id !== job.material_id)} onClick={() => void retry(job)}>Reintentar este trabajo</button>}
    </article>)}</div>
    {page?.nextCursor && <div className={styles.toolbar}><button className={styles.secondary} disabled={busy} onClick={() => void refresh(true)}>Consultar trabajos anteriores</button></div>}
  </section>;
}
