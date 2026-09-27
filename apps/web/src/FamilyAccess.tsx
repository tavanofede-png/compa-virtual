"use client";

import { useEffect, useRef, useState } from "react";
import { CONSENT_POLICY_VERSION, type FamilyCapability, type FamilyPermissions } from "@compa/domain";
import styles from "./admin.module.css";

type FamilyView = {
  student_name: string;
  policy_version: string;
  permissions: FamilyPermissions;
  accepted_at: string | null;
  expires_at: string;
  status: "view" | "accepted" | "revoked";
  documents: { terms_url: string; privacy_url: string };
};
type Decision = {
  action: "ACCEPT" | "REVOKE";
  operationId: string;
  acceptance?: { policy_version: string; attestation: true; permissions: FamilyPermissions };
  capabilities?: FamilyCapability[];
};
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const labels: Record<FamilyCapability, string> = { service: "Servicio Kusiy", ai: "Inteligencia artificial", social: "Encuentros grupales" };

export default function FamilyAccess() {
  const initialized = useRef(false);
  const token = useRef("");
  const [view, setView] = useState<FamilyView | null>(null);
  const [permissions, setPermissions] = useState<FamilyPermissions>({ service: false, ai: false, social: false });
  const [attested, setAttested] = useState(false);
  const [pending, setPending] = useState<Decision | null>(null);
  const [revoke, setRevoke] = useState<FamilyCapability | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const request = async (body: { action: "VIEW" } | Decision): Promise<FamilyView> => {
    if (!url || !key) throw Error("La conexión del acceso familiar no está configurada.");
    const response = await fetch(url + "/functions/v1/family-consent", {
      method: "POST", headers: { "Content-Type": "application/json", apikey: key },
      body: JSON.stringify({ token: token.current, ...body }),
      cache: "no-store", referrerPolicy: "no-referrer", signal: AbortSignal.timeout(20000),
    });
    const data = await response.json();
    if (!response.ok || data.error) throw Error(data.error ?? "No pudimos confirmar el resultado.");
    return data as FamilyView;
  };
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    token.current = window.location.hash.slice(1);
    // Keep the secret out of referrers, browser history and persistent storage.
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    if (!/^[0-9a-f]{64}$/.test(token.current)) {
      setError("Abrí el enlace privado que recibiste por el canal verificado. No necesitás la cuenta del alumno.");
      setBusy(false);
      return;
    }
    void request({ action: "VIEW" }).then(setView)
      .catch((failure) => setError(failure.message)).finally(() => setBusy(false));
  }, []);

  const decide = async (decision: Decision) => {
    if (busy) return;
    setBusy(true); setError(""); setNotice(""); setPending(decision);
    try {
      const result = await request(decision);
      setView(result); setPending(null); setRevoke(null);
      setNotice(decision.action === "ACCEPT" ? "La decisión quedó guardada. Solo se autorizaron las opciones que elegiste." : "La revocación quedó guardada.");
    } catch (failure) {
      setError((failure instanceof Error ? failure.message : "Resultado no confirmado.") + " No asumimos que se guardó; podés reintentar la misma operación.");
    } finally { setBusy(false); }
  };
  return <main className={styles.page}><div className={`${styles.shell} ${styles.familyShell}`}>
    <header className={styles.header}><div>
      <p className={styles.eyebrow}>KUSIY · FAMILIAS</p><h1>Una decisión por cada permiso</h1>
      <p>Este acceso privado permite gestionar autorizaciones. No da acceso a apuntes, tareas ni conversaciones del alumno.</p>
    </div></header>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {notice && <p className={styles.notice} role="status">{notice}</p>}
    {busy && <p role="status">{view ? "Confirmando la decisión…" : "Verificando el enlace…"}</p>}
    {pending && !busy && <section className={styles.card}><h2>Confirmación pendiente</h2>
      <p>Para evitar decisiones duplicadas, este botón consulta o repite exactamente la operación anterior.</p>
      <button onClick={() => void decide(pending)}>Reintentar confirmación</button>
    </section>}
    {view && <section className={styles.card}>
      <p className={styles.eyebrow}>ALUMNO · {view.student_name}</p>
      <p>Versión de autorización: {view.policy_version}. El enlace vence el {new Date(view.expires_at).toLocaleString("es-AR")}.</p>
      <p><a href={view.documents.terms_url} target="_blank" rel="noopener noreferrer">Condiciones del servicio</a> · <a href={view.documents.privacy_url} target="_blank" rel="noopener noreferrer">Privacidad y uso de datos</a></p>
      {!view.accepted_at && view.status !== "revoked" ? <form onSubmit={(event) => {
        event.preventDefault();
        void decide({ action: "ACCEPT", operationId: crypto.randomUUID(), acceptance: {
          policy_version: CONSENT_POLICY_VERSION, attestation: true, permissions,
        } });
      }}><fieldset disabled={busy || Boolean(pending)} className={styles.permissions}>
        <legend>Elegí qué autorizás</legend>
        <label className={styles.check}><input type="checkbox" checked={permissions.service} onChange={(event) => setPermissions({ ...permissions, service: event.target.checked })} />
          <span><strong>Usar Kusiy</strong><br />Organización, materiales, espacios y registro del estudio. Es necesario para habilitar el servicio.</span></label>
        <label className={styles.check}><input type="checkbox" checked={permissions.ai} onChange={(event) => setPermissions({ ...permissions, ai: event.target.checked })} />
          <span><strong>Usar inteligencia artificial · opcional</strong><br />Conversación académica y procesamiento con los proveedores informados en los documentos. Podés rechazarlo y mantener las funciones sin IA.</span></label>
        <label className={styles.check}><input type="checkbox" checked={permissions.social} onChange={(event) => setPermissions({ ...permissions, social: event.target.checked })} />
          <span><strong>Participar en encuentros grupales · opcional</strong><br />Espacios privados con otros alumnos, presencia y chat del encuentro cuando estas funciones estén habilitadas.</span></label>
        <label className={styles.check}><input type="checkbox" checked={attested} onChange={(event) => setAttested(event.target.checked)} />
          <span>Soy el adulto verificado de esta cuenta, revisé los documentos y confirmo las opciones que marqué.</span></label>
        <button disabled={!permissions.service || !attested || view.policy_version !== CONSENT_POLICY_VERSION}>Guardar mis permisos</button>
      </fieldset>
        <button type="button" className={styles.danger} disabled={busy || Boolean(pending)} onClick={() => setRevoke("service")}>No autorizo el servicio</button>
      </form> : <>
        <h2>Permisos guardados</h2>
        <ul>{(["service", "ai", "social"] as const).map((capability) => <li key={capability}>
          {labels[capability]}: <strong>{view.permissions[capability] ? "autorizado" : "sin autorización"}</strong>
        </li>)}</ul>
        <p>Autorizar una finalidad no habilita funciones cuya revisión o disponibilidad todavía está pendiente.</p>
        {view.permissions.service && <div className={styles.permissionActions}>
          {(["ai", "social", "service"] as const).filter((capability) => view.permissions[capability]).map((capability) =>
            <button key={capability} className={styles.secondary} disabled={busy || Boolean(pending)} onClick={() => setRevoke(capability)}>
              Revocar {labels[capability].toLowerCase()}
            </button>)}
        </div>}
      </>}
        {revoke && !pending && <div className={styles.review}>
          <p>{revoke === "service" ? "Revocar el servicio también revoca IA y encuentros. Conserva los datos, pero impide nuevas operaciones de la cuenta." : `Se desactivará ${labels[revoke].toLowerCase()}. El servicio seguirá autorizado.`}</p>
          <button className={styles.danger} disabled={busy} onClick={() => void decide({ action: "REVOKE", operationId: crypto.randomUUID(), capabilities: [revoke] })}>Confirmar revocación</button>
          <button className={styles.secondary} disabled={busy} onClick={() => setRevoke(null)}>Cancelar</button>
        </div>}
      <p>Guardá este enlace de forma privada. Si vence o necesitás conceder nuevamente un permiso, pedí otro enlace al responsable por el canal verificado.</p>
    </section>}
  </div></main>;
}
