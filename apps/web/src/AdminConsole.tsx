"use client";

import { useCallback, useEffect, useState } from "react";
import { createBackend } from "@compa/client";
import type { FamilyPermissions } from "@compa/domain";
import styles from "./admin.module.css";
import { MaterialOperations } from "./MaterialOperations";
import { VoiceOperations } from "./VoiceOperations";
import { ChatOperations } from "./ChatOperations";
import { SupportOperations } from "./SupportOperations";
import { OperationalHealth } from "./OperationalHealth";

type Request = {
  id: string;
  user_id: string;
  student_email: string;
  student_name: string;
  age: number | null;
  guardian_name: string;
  created_at: string;
  verified_at: string | null;
  revoked_at: string | null;
  permissions: FamilyPermissions;
};
type Audit = {
  id: string;
  action: string;
  target_user_id: string;
  method: string | null;
  evidence_reference: string | null;
  reason: string | null;
  created_at: string;
};
type Overview = { requests: Request[]; audit: Audit[] };
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const backend = url && key ? createBackend(url, key) : null;

export default function AdminConsole() {
  const [signedIn, setSignedIn] = useState(false);
  const [mfaReady, setMfaReady] = useState(false);
  const [factorId, setFactorId] = useState("");
  const [enrollment, setEnrollment] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [method, setMethod] = useState("independent-call");
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [attested, setAttested] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [familyLink, setFamilyLink] = useState<{ url: string; expires_at: string } | null>(null);

  const readAssurance = useCallback(async () => {
    if (!backend) return;
    const session = await backend.auth.getSession();
    setSignedIn(Boolean(session.data.session));
    if (!session.data.session) {
      setMfaReady(false);
      setOverview(null);
      setFamilyLink(null);
      return;
    }
    const level = await backend.auth.mfa.getAuthenticatorAssuranceLevel();
    if (level.error) throw level.error;
    const ready = level.data.currentLevel === "aal2";
    setMfaReady(ready);
    if (!ready) {
      setOverview(null);
      setFamilyLink(null);
      const factors = await backend.auth.mfa.listFactors();
      if (factors.error) throw factors.error;
      setFactorId(factors.data.totp.find((factor) => factor.status === "verified")?.id ?? "");
    }
  }, []);

  const call = useCallback(async (type: string, payload: Record<string, unknown> = {}) => {
    if (!backend) throw Error("La conexión del panel no está configurada.");
    const { data, error } = await backend.functions.invoke("api", { body: { type, payload } });
    if (error) {
      let message = "No pudimos completar la operación.";
      const context = (error as { context?: Response }).context;
      if (context?.status === 401 || context?.status === 403) {
        setOverview(null);
        setFamilyLink(null);
      }
      try {
        const response = await context?.json();
        if (typeof response?.error === "string") message = response.error;
      } catch {}
      throw Error(message);
    }
    if (data?.error) throw Error(data.error);
    return data as Overview & { decision?: { status: string }; link?: string; expires_at?: string };
  }, []);

  const refresh = useCallback(async () => {
    const result = await call("operator.overview");
    setOverview({ requests: result.requests, audit: result.audit });
  }, [call]);

  useEffect(() => {
    if (!backend) return;
    void readAssurance().catch((failure) => setError(failure.message));
    const { data } = backend.auth.onAuthStateChange(() => {
      void readAssurance().catch((failure) => setError(failure.message));
    });
    return () => data.subscription.unsubscribe();
  }, [readAssurance]);
  useEffect(() => {
    if (!mfaReady) return;
    void refresh().catch((failure) => setError(failure.message));
  }, [mfaReady, refresh]);

  const perform = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try { await action(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Operación no confirmada."); }
    finally { setBusy(false); }
  };
  const decision = (request: Request, action: "VERIFY_FAMILY" | "REVOKE_FAMILY") =>
    perform(async () => {
      const result = await call("operator.consentDecision", {
        consent_id: request.id,
        action,
        ...(action === "VERIFY_FAMILY"
          ? { method, evidence_reference: reference.trim() }
          : { reason: reason.trim() }),
      });
      setOverview({ requests: result.requests, audit: result.audit });
      setSelected(null);
      setReference("");
      setReason("");
      setAttested(false);
      setNotice(action === "VERIFY_FAMILY" ? "Familia verificada. Falta que el adulto acepte los permisos mediante su enlace privado." : "Autorización revocada.");
    });
  const pending = overview?.requests.filter((request) => !request.verified_at && !request.revoked_at) ?? [];
  const verified = overview?.requests.filter((request) => request.verified_at && !request.revoked_at) ?? [];

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>KUSIY · OPERACIÓN</p>
            <h1>Autorizaciones familiares</h1>
            <p>Revisá solicitudes y registrá únicamente verificaciones realizadas por un canal independiente.</p>
          </div>
          <a href="/">Volver a Kusiy</a>
        </header>
        {error && <p className={styles.error} role="alert">{error}</p>}
        {notice && <p className={styles.notice} role="status">{notice}</p>}
        {signedIn && backend && <div className={styles.toolbar}><span>Sesión de operación</span>
          <button className={styles.secondary} disabled={busy} onClick={() => void perform(async () => {
            const result = await backend.auth.signOut();
            if (result.error) throw result.error;
            await readAssurance();
          })}>Cerrar sesión</button>
        </div>}
        {familyLink && signedIn && mfaReady && <section className={styles.card}>
          <h2>Enlace privado para el adulto verificado</h2>
          <p>Se muestra una sola vez. Compartilo por el canal que verificaste; no lo envíes al alumno ni a un grupo. Reemplaza cualquier enlace anterior.</p>
          <label>Enlace<textarea readOnly value={familyLink.url} /></label>
          <p>Vence el {new Date(familyLink.expires_at).toLocaleString("es-AR")}.</p>
          <button onClick={() => void perform(async () => { await navigator.clipboard.writeText(familyLink.url); setNotice("Enlace copiado. Compartilo únicamente con el adulto verificado."); })}>Copiar enlace</button>
          <button className={styles.secondary} onClick={() => setFamilyLink(null)}>Ocultar enlace</button>
        </section>}
        {!backend ? <p>Falta configurar la conexión de Kusiy.</p> : !signedIn ? (
          <form className={styles.card} onSubmit={(event) => { event.preventDefault(); void perform(async () => {
            const result = await backend.auth.signInWithPassword({ email, password });
            if (result.error) throw result.error;
            setPassword("");
            await readAssurance();
          }); }}>
            <h2>Ingresar como operador</h2>
            <label>Correo<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            <label>Contraseña<input type="password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
            <button disabled={busy}>Ingresar</button>
          </form>
        ) : !mfaReady ? (
          <section className={styles.card}>
            <h2>Segundo factor requerido</h2>
            <p>La revisión de familias requiere un código de tu aplicación autenticadora.</p>
            {!factorId && !enrollment && <button disabled={busy} onClick={() => void perform(async () => {
              const result = await backend.auth.mfa.enroll({ factorType: "totp", friendlyName: "Kusiy operación" });
              if (result.error) throw result.error;
              setEnrollment({ id: result.data.id, qr: result.data.totp.qr_code, secret: result.data.totp.secret });
            })}>Configurar segundo factor</button>}
            {enrollment && <div className={styles.enrollment}>
              <img alt="Código QR para registrar el segundo factor" src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(enrollment.qr)}`} />
              <p>Clave manual: <code>{enrollment.secret}</code></p>
            </div>}
            {(factorId || enrollment) && <form onSubmit={(event) => { event.preventDefault(); void perform(async () => {
              const result = await backend.auth.mfa.challengeAndVerify({ factorId: enrollment?.id ?? factorId, code: code.trim() });
              if (result.error) throw result.error;
              setCode("");
              setEnrollment(null);
              await readAssurance();
            }); }}>
              <label>Código de seis dígitos<input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value)} /></label>
              <button disabled={busy}>Verificar código</button>
            </form>}
          </section>
        ) : (
          <>
            <div className={styles.toolbar}>
              <span>{pending.length} solicitudes pendientes · {verified.length} autorizaciones vigentes</span>
              <button className={styles.secondary} disabled={busy} onClick={() => void perform(refresh)}>Actualizar</button>
            </div>
            <section>
              <h2>Solicitudes pendientes</h2>
              {pending.length === 0 && <p>No hay solicitudes por revisar.</p>}
              <div className={styles.grid}>{pending.map((request) => (
                <article className={styles.card} key={request.id}>
                  <p className={styles.eyebrow}>PENDIENTE · {new Date(request.created_at).toLocaleDateString("es-AR")}</p>
                  <h3>{request.student_name}</h3>
                  <p>{request.student_email} · {request.age ?? "—"} años</p>
                  <p>Adulto indicado: <strong>{request.guardian_name}</strong></p>
                  {selected === request.id ? <div className={styles.review}>
                    <label>Canal independiente<select value={method} onChange={(event) => setMethod(event.target.value)}>
                      <option value="independent-call">Llamada independiente</option>
                      <option value="in-person">Presencial</option>
                      <option value="video-call">Videollamada</option>
                    </select></label>
                    <label>Referencia del caso, sin documentos personales<input maxLength={120} value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Ej. escuela-curso-entrevista-01" /></label>
                    <label className={styles.check}><input type="checkbox" checked={attested} onChange={(event) => setAttested(event.target.checked)} /> Verifiqué la identidad y la relación familiar fuera de este formulario.</label>
                    <button disabled={busy || !attested || reference.trim().length < 4} onClick={() => void decision(request, "VERIFY_FAMILY")}>Confirmar verificación</button>
                    <label>Motivo si se rechaza o revoca<input maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
                    <button className={styles.danger} disabled={busy || reason.trim().length < 8} onClick={() => void decision(request, "REVOKE_FAMILY")}>Revocar solicitud</button>
                  </div> : <button className={styles.secondary} onClick={() => setSelected(request.id)}>Revisar solicitud</button>}
                </article>
              ))}</div>
            </section>
            <section>
              <h2>Autorizaciones vigentes</h2>
              {verified.length === 0 && <p>No hay autorizaciones verificadas.</p>}
              <div className={styles.grid}>{verified.map((request) => (
                <article className={styles.card} key={request.id}>
                  <h3>{request.student_name}</h3>
                  <p>{request.student_email} · {request.guardian_name}</p>
                  <p>Verificada el {new Date(request.verified_at!).toLocaleDateString("es-AR")}</p>
                  <p>Servicio: {request.permissions.service ? "aceptado" : "pendiente"} · IA: {request.permissions.ai ? "aceptada" : "sin permiso"} · Social: {request.permissions.social ? "aceptado" : "sin permiso"}</p>
                  <button className={styles.secondary} disabled={busy} onClick={() => void perform(async () => {
                    setFamilyLink(null);
                    const result = await call("operator.familyLink", { consent_id: request.id });
                    if (!result.link || !result.expires_at) throw Error("No pudimos confirmar la emisión del enlace.");
                    setFamilyLink({ url: result.link, expires_at: result.expires_at });
                  })}>Crear enlace privado</button>
                  {selected === request.id ? <div className={styles.review}>
                    <label>Motivo de revocación<input maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
                    <button className={styles.danger} disabled={busy || reason.trim().length < 8} onClick={() => void decision(request, "REVOKE_FAMILY")}>Confirmar revocación</button>
                  </div> : <button className={styles.secondary} onClick={() => setSelected(request.id)}>Revocar acceso</button>}
                </article>
              ))}</div>
            </section>
            <OperationalHealth call={call} />
            <MaterialOperations call={call} />
            <VoiceOperations call={call} />
            <ChatOperations call={call} />
            <SupportOperations call={call} />
            <section className={styles.audit}>
              <h2>Acciones recientes</h2>
              {overview?.audit.map((entry) => <p key={entry.id}>
                {new Date(entry.created_at).toLocaleString("es-AR")} · {({ VERIFY_FAMILY: "Verificación", REVOKE_FAMILY: "Revocación", ISSUE_FAMILY_LINK: "Emisión de enlace", FAMILY_ACCEPT: "Aceptación del adulto", FAMILY_REVOKE: "Revocación del adulto" } as Record<string, string>)[entry.action] ?? entry.action} · {entry.target_user_id}
              </p>)}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
