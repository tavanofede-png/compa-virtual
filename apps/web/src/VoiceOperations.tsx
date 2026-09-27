"use client";
import { useEffect, useRef, useState } from "react";
import styles from "./admin.module.css";
type Budget = { configured: boolean; account?: string; pool: null | {
  day: string; remaining_neurons: number; valid_until: string; verified_at: string;
} };
export function VoiceOperations({ call }: { call: (type: string, payload?: Record<string, unknown>) => Promise<unknown> }) {
  const [budget, setBudget] = useState<Budget | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [remaining, setRemaining] = useState(""), [reason, setReason] = useState(""), [confirmed, setConfirmed] = useState(false);
  const receipt = useRef<Record<string, unknown> | null>(null);
  useEffect(() => {
    let alive = true;
    void call("operator.voiceBudget").then((data) => { if (alive) setBudget(data as Budget); })
      .catch((failure) => { if (alive) setError(failure.message); });
    return () => { alive = false; };
  }, [call]);
  const run = async (verify = false) => {
    setBusy(true); setError("");
    try {
      if (verify) receipt.current ??= { operation_id: crypto.randomUUID(), free_account_confirmed: true,
        remaining_neurons: Number(remaining), reason: reason.trim() };
      setBudget(await call(verify ? "operator.verifyVoiceBudget" : "operator.voiceBudget", verify ? receipt.current! : {}) as Budget);
      if (verify) { receipt.current = null; setConfirmed(false); }
    } catch (failure) { setError(failure instanceof Error ? failure.message : "No pudimos consultar la cuota."); }
    finally { setBusy(false); }
  };
  const valid = confirmed && remaining.trim() !== "" && Number.isInteger(Number(remaining)) && Number(remaining) >= 0 && Number(remaining) <= 10000 && reason.trim().length >= 10;
  return <section className={styles.audit} aria-label="Cuota de conversación por voz">
    <h2>Whisper y cuota gratuita</h2>
    <p>Control de pruebas: verificá en Cloudflare que la cuenta sea Free y revisá el consumo de toda la cuenta, incluidos otros servicios de Workers AI. Esta pantalla no consulta el saldo remoto ni cambia la facturación.</p>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <button disabled={busy} onClick={() => void run()}>Actualizar estado</button>
    {budget && !budget.configured && <p>Whisper permanece desactivado. Texto y voz del dispositivo siguen disponibles.</p>}
    {budget?.configured && <>
      <p>Cuenta terminada en {budget.account}. {budget.pool ? `Reserva local: ${budget.pool.remaining_neurons} neuronas. Verificación hasta ${new Date(budget.pool.valid_until).toLocaleString("es-AR")}.` : "Sin cuota verificada."}</p>
      <p>La reserva dura cinco minutos, descuenta un margen del 20% y nunca aumenta el saldo local del mismo día. Si vence o se agota, se detiene el envío de audio.</p>
      <label>Saldo gratuito disponible observado<input type="number" min={0} max={10000} value={remaining} disabled={Boolean(receipt.current)} onChange={(event) => setRemaining(event.target.value)} /></label>
      <label>Origen de la comprobación y motivo<input maxLength={500} value={reason} disabled={Boolean(receipt.current)} onChange={(event) => setReason(event.target.value)} /></label>
      <label><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> Comprobé que esta cuenta es Free y que el saldo incluye todo su consumo.</label>
      <button disabled={busy || !valid} onClick={() => void run(true)}>Verificar reserva para pruebas</button>
    </>}
  </section>;
}
