"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./admin.module.css";

type Alert = { code: string; severity: "warning" | "critical"; observed_count: number;
  opened_at: string; last_seen_at: string };
type Event = { id: number; code: string; event: "opened" | "resolved"; created_at: string };
type Health = { checked_at: string; worker: { state: string; pipeline_version: number;
  started_at: string; last_seen_at: string } | null; alerts: Alert[]; recent_events: Event[] };
const names: Record<string, string> = {
  worker_stale: "El worker de materiales dejó de latir",
  material_stalled: "Materiales sin avance por más de 15 minutos",
  material_failed: "Materiales con procesamiento fallido",
  storage_cleanup_stale: "Archivos pendientes de borrar por más de una hora",
  push_failures: "Cinco o más envíos push fallaron en una hora",
  urgent_support: "Consultas prioritarias de soporte abiertas",
  chat_reports: "Reportes del chat pendientes de revisión",
};

export function OperationalHealth({ call }: {
  call: (type: string, payload?: Record<string, unknown>) => Promise<unknown>;
}) {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    setBusy(true); setError("");
    try { setHealth(await call("operator.health") as Health); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "No pudimos consultar el estado."); }
    finally { setBusy(false); }
  }, [call]);
  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 60000);
    return () => window.clearInterval(timer);
  }, [refresh]);
  return <section className={styles.audit} aria-label="Estado operativo">
    <h2>Estado operativo</h2>
    <p>Señales internas de la base y del worker. No incluyen contenido académico ni conversaciones. Esta vista no envía alertas externas; requiere supervisión del operador.</p>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.toolbar}>
      <span>{health ? `Comprobado ${new Date(health.checked_at).toLocaleString("es-AR")}` : "Sin comprobación reciente"}</span>
      <button className={styles.secondary} disabled={busy} onClick={() => void refresh()}>Actualizar estado</button>
    </div>
    <div className={styles.card}>
      <h3>Worker de materiales</h3>
      {health?.worker ? <p>{health.worker.state === "processing" ? "Procesando" : health.worker.state === "idle" ? "En espera" : "Deteniéndose"} · pipeline {health.worker.pipeline_version} · último latido {new Date(health.worker.last_seen_at).toLocaleString("es-AR")}</p>
        : <p>Todavía no hay un latido registrado. Confirmá la publicación y el inicio del worker antes de procesar materiales.</p>}
    </div>
    {health && <>
      <h3>Señales activas</h3>
      {health.alerts.length === 0 ? <p>No hay señales activas en esta comprobación.</p> : <div className={styles.grid}>
        {health.alerts.map((alert) => <article key={alert.code} className={styles.card}>
          <h3>{alert.severity === "critical" ? "● Atención prioritaria" : "● Revisar"}</h3>
          <p>{names[alert.code] ?? alert.code}</p>
          <p>Casos: {alert.observed_count} · desde {new Date(alert.opened_at).toLocaleString("es-AR")}</p>
        </article>)}
      </div>}
      <details><summary>Historial reciente de señales</summary>
        {health.recent_events.map((event) => <p key={event.id}>
          {new Date(event.created_at).toLocaleString("es-AR")} · {event.event === "opened" ? "Apareció" : "Se resolvió"} · {names[event.code] ?? event.code}
        </p>)}
      </details>
    </>}
  </section>;
}
