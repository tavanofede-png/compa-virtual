"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Copy,
  Plus,
  RefreshCw,
  Users,
} from "lucide-react";
import type { CollaborationRepository } from "@compa/client";
import {
  sharedSpaces,
  sessionModes,
  sessionStateLabel,
  sessionLocalStart,
  sessionLocalFields,
  type CollaborationOverview,
  type GroupSessionDetail,
  type CollaborationCommand,
  type StudyGroup,
} from "@compa/domain";
import { Field, Empty, Tag, formData } from "./ui";
import "./collaboration.css";
import { SharedRoom } from "./SharedRoom";
import { sharedSpacePreview } from "@compa/domain";

const inviteStatus: Record<string, string> = {
  pending: "Pendiente",
  accepted: "Aceptada",
  declined: "Rechazada",
  revoked: "Revocada",
  expired: "Vencida",
};
const when = (iso: string, zone: string) =>
  new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: zone,
  }).format(new Date(iso));
export function Together({
  repo,
  back,
}: {
  repo?: CollaborationRepository;
  back: () => void;
}) {
  const [data, setData] = useState<CollaborationOverview | null>(null),
    [detail, setDetail] = useState<GroupSessionDetail | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [editor, setEditor] = useState<"group" | "session" | "edit" | null>(
      null,
    ),
    [selectedGroup, setSelectedGroup] = useState("");
  const editorRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (editor) {
      editorRef.current?.scrollIntoView({ block: "start" });
      editorRef.current
        ?.querySelector<HTMLInputElement>("input")
        ?.focus({ preventScroll: true });
    }
  }, [editor]);
  useEffect(() => {
    let alive = true;
    setData(null);
    setDetail(null);
    setError("");
    if (repo) {
      setBusy(true);
      repo
        .overview()
        .then((d) => {
          if (alive) setData(d);
        })
        .catch((e) => {
          if (alive) setError(e.message);
        })
        .finally(() => {
          if (alive) setBusy(false);
        });
    }
    return () => {
      alive = false;
    };
  }, [repo]);
  async function refresh(id = detail?.session.id) {
    if (!repo) return;
    // Clear private details if current membership can no longer be verified.
    try {
      const next = await repo.overview();
      setData(next);
      setDetail(id && next.enabled ? await repo.session(id) : null);
    } catch (e) {
      setData(null);
      setDetail(null);
      throw e;
    }
  }
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function send(command: CollaborationCommand, close = false) {
    if (!repo) return;
    const receipt = await repo.command(command);
    const left =
      command.action === "session.leave" || command.action === "group.leave";
    await refresh(left ? "" : (receipt.session_id ?? detail?.session.id));
    if (close) setEditor(null);
    setNotice("Cambio guardado.");
  }
  const inviteForm = (scope: "group" | "session", target: string) => (
    <form
      className="together-invite"
      onSubmit={(e) => {
        const f = formData(e);
        void run(() =>
          send({
            action: "invite.create",
            scope,
            target_id: target,
            contact_code: f.code,
          }),
        );
      }}
    >
      <Field label="Código de compañero">
        <input
          name="code"
          required
          minLength={64}
          maxLength={64}
          autoComplete="off"
          placeholder="Pedile su código a quien querés invitar"
        />
      </Field>
      <button className="secondary" disabled={busy}>
        Invitar
      </button>
    </form>
  );
  function groupCard(group: StudyGroup) {
    const owner = group.owner_id === data?.user_id;
    return (
      <details className="together-group" key={group.id}>
        <summary>
          <span>
            <strong>{group.name}</strong>
            <small>
              {group.members.length} integrantes ·{" "}
              {group.status === "active" ? "Privado" : "Archivado"}
            </small>
          </span>
        </summary>
        <ul className="together-people">
          {group.members.map((p) => (
            <li key={p.user_id}>
              <span>
                {p.nickname}
                {p.user_id === data?.user_id ? " (vos)" : ""}
                <small>
                  {p.role === "owner" ? "Organiza el grupo" : "Integrante"}
                </small>
              </span>
              {owner &&
                p.user_id !== data?.user_id &&
                group.status === "active" && (
                  <div className="together-actions">
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            `¿Dejar la organización del grupo a ${p.nickname}?`,
                          )
                        )
                          void run(() =>
                            send({
                              action: "group.transfer",
                              group_id: group.id,
                              user_id: p.user_id,
                              revision: group.revision,
                            }),
                          );
                      }}
                    >
                      Dar organización
                    </button>
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            `¿Quitar a ${p.nickname} del grupo y de sus sesiones?`,
                          )
                        )
                          void run(() =>
                            send({
                              action: "group.remove",
                              group_id: group.id,
                              user_id: p.user_id,
                              revision: group.revision,
                            }),
                          );
                      }}
                    >
                      Quitar
                    </button>
                  </div>
                )}
            </li>
          ))}
        </ul>
        {owner && group.status === "active" && inviteForm("group", group.id)}
        {group.status === "active" && (
          <div className="together-actions">
            <button
              className="primary"
              disabled={busy}
              onClick={() => {
                setSelectedGroup(group.id);
                setEditor("session");
              }}
            >
              Programar sesión
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    owner
                      ? "¿Archivar este grupo? Primero deben estar cerradas sus sesiones."
                      : "¿Salir del grupo? Perderás acceso a sus sesiones.",
                  )
                )
                  void run(() =>
                    send({
                      action: owner ? "group.archive" : "group.leave",
                      group_id: group.id,
                      revision: group.revision,
                    }),
                  );
              }}
            >
              {owner ? "Archivar grupo" : "Salir del grupo"}
            </button>
          </div>
        )}
      </details>
    );
  }
  function submitSession(e: FormEvent<HTMLFormElement>) {
    const f = formData(e);
    void run(async () => {
      const fields = {
        title: f.title,
        objective: f.objective,
        session_type: f.mode as "silent" | "review" | "project",
        space_template_id: f.space as (typeof sharedSpaces)[number]["id"],
        planned_duration: Number(f.duration),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        scheduled_start_at: sessionLocalStart(f.date, f.time),
        meeting_url: f.meeting,
      };
      await send(
        editor === "edit" && detail
          ? {
              action: "session.update",
              session_id: detail.session.id,
              revision: detail.session.revision,
              ...fields,
            }
          : { action: "session.create", group_id: f.group || null, ...fields },
        true,
      );
    });
  }
  const editing = editor === "edit" ? detail?.session : undefined;
  const local = sessionLocalFields(
    editing ? new Date(editing.scheduled_start_at) : undefined,
  );
  return (
    <div className="together">
      <button
        className="together-back"
        onClick={() => (detail ? setDetail(null) : back())}
      >
        <ArrowLeft size={17} />
        {detail ? "Todas las sesiones" : "Volver a Estudiar"}
      </button>
      <div className="page-heading">
        <div>
          <p className="eyebrow">UN OBJETIVO. BUENA COMPAÑÍA.</p>
          <h1>{detail ? detail.session.title : "Estudiar juntos."}</h1>
          <p>
            {detail
              ? detail.session.objective
              : "Invitá a personas que conocés y hagan lugar para aprender."}
          </p>
        </div>
        {repo && (
          <button
            className="secondary"
            disabled={busy}
            onClick={() => void run(() => refresh())}
          >
            <RefreshCw size={16} />
            Actualizar
          </button>
        )}
      </div>
      {error && (
        <div role="alert" className="together-message error">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="together-message">
          <Check size={16} />
          {notice}
        </div>
      )}
      {!repo ? (
        <section className="surface">
          <Users size={32} />
          <h2>Tu próximo encuentro empieza acá.</h2>
          <p>
            Las sesiones privadas requieren una cuenta conectada. Iniciá sesión
            para consultar su disponibilidad.
          </p>
        </section>
      ) : !data ? (
        <section className="surface" aria-busy={busy}>
          <p>
            {busy
              ? "Cargando tus encuentros…"
              : "Actualizá para volver a consultar tus encuentros."}
          </p>
        </section>
      ) : !data.enabled ? (
        <section className="surface">
          <Users size={32} />
          <h2>Un lugar para encontrarse.</h2>
          <p>{data.reason}</p>
        </section>
      ) : (
        <>
          {!detail && (
            <section className="together-welcome">
              <div>
                <Tag>GRUPOS PRIVADOS · HASTA 6 POR SESIÓN</Tag>
                <h2>
                  Reservá un momento.
                  <br />
                  Compartí un objetivo.
                </h2>
                <p>
                  Elegí quién se suma. Cada persona confirma su propia
                  invitación.
                </p>
                <div className="together-actions">
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() => {
                      setSelectedGroup("");
                      setEditor("session");
                    }}
                  >
                    <Plus size={17} />
                    Nueva sesión
                  </button>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => setEditor("group")}
                  >
                    Crear grupo
                  </button>
                </div>
              </div>
              <div className="together-code">
                <strong>Tu código de compañero</strong>
                <p>Compartilo directamente con quien quieras que te invite.</p>
                <code>{data.contact_code}</code>
                <button
                  className="secondary"
                  onClick={() =>
                    void run(async () => {
                      await navigator.clipboard.writeText(data.contact_code);
                      setNotice("Código copiado.");
                    })
                  }
                >
                  <Copy size={15} />
                  Copiar código
                </button>
              </div>
            </section>
          )}
          {editor && (
            <section ref={editorRef} className="surface together-editor">
              <div className="section-heading">
                <h2>
                  {editor === "group"
                    ? "Un grupo para volver a encontrarse"
                    : editor === "edit"
                      ? "Editar sesión"
                      : "Preparar una sesión"}
                </h2>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => setEditor(null)}
                >
                  Cerrar
                </button>
              </div>
              {editor === "group" ? (
                <form
                  onSubmit={(e) => {
                    const f = formData(e);
                    void run(() =>
                      send({ action: "group.create", name: f.name }, true),
                    );
                  }}
                >
                  <Field label="Nombre del grupo">
                    <input
                      name="name"
                      required
                      maxLength={100}
                      placeholder="Por ejemplo, Repaso de Biología"
                    />
                  </Field>
                  <button className="primary" disabled={busy}>
                    Crear grupo privado
                  </button>
                </form>
              ) : (
                <form key={editing?.id ?? "new"} onSubmit={submitSession}>
                  <fieldset disabled={busy}>
                    <div className="together-fields">
                      <Field label="Nombre de la sesión">
                        <input
                          name="title"
                          required
                          maxLength={100}
                          defaultValue={editing?.title}
                        />
                      </Field>
                      {!editing && (
                        <Field label="Grupo">
                          <select name="group" defaultValue={selectedGroup}>
                            <option value="">Encuentro independiente</option>
                            {data.groups
                              .filter((g) => g.status === "active")
                              .map((g) => (
                                <option key={g.id} value={g.id}>
                                  {g.name}
                                </option>
                              ))}
                          </select>
                        </Field>
                      )}
                    </div>
                    <Field label="¿Qué quieren lograr?">
                      <textarea
                        name="objective"
                        required
                        maxLength={500}
                        rows={2}
                        defaultValue={editing?.objective}
                        placeholder="Un objetivo concreto para este encuentro"
                      />
                    </Field>
                    <div className="together-fields">
                      <Field label="Día">
                        <input
                          type="date"
                          name="date"
                          required
                          defaultValue={local.date}
                        />
                      </Field>
                      <Field label="Hora">
                        <input
                          type="time"
                          name="time"
                          required
                          defaultValue={local.time}
                        />
                      </Field>
                      <Field label="Minutos">
                        <input
                          type="number"
                          name="duration"
                          min={15}
                          max={180}
                          required
                          defaultValue={editing?.planned_duration ?? 45}
                        />
                      </Field>
                    </div>
                    <p className="together-hint">
                      Horario en{" "}
                      {Intl.DateTimeFormat().resolvedOptions().timeZone}.
                    </p>
                    <Field label="Tipo de sesión">
                      <select
                        name="mode"
                        defaultValue={editing?.session_type ?? "silent"}
                      >
                        {sessionModes.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <fieldset className="together-spaces">
                      <legend>Ambiente</legend>
                      {sharedSpaces.map((space) => (
                        <label key={space.id}>
                          <input
                            type="radio"
                            name="space"
                            value={space.id}
                            defaultChecked={
                              space.id ===
                              (editing?.space_template_id ?? "study")
                            }
                          />
                          <span style={{ borderLeftColor: space.color }}>
                            <img src={sharedSpacePreview(space.id)} alt={space.name} loading="lazy" />
                            <strong>{space.name}</strong>
                            <small>{space.description}</small>
                          </span>
                        </label>
                      ))}
                    </fieldset>
                    <Field label="Enlace de Google Meet (opcional)">
                      <input
                        name="meeting"
                        type="url"
                        maxLength={300}
                        defaultValue={
                          editor === "edit" ? (detail?.meeting_url ?? "") : ""
                        }
                        placeholder="https://meet.google.com/abc-defg-hij"
                      />
                    </Field>
                    <p className="together-hint">
                      Creá la reunión en Google Meet y pegá su enlace. Solo lo
                      ven quienes aceptaron participar.
                    </p>
                    <button className="primary" type="submit">
                      {editing ? "Guardar cambios" : "Crear sesión privada"}
                    </button>
                  </fieldset>
                </form>
              )}
            </section>
          )}
          {detail ? (
            <>
              {repo && <SharedRoom repo={repo} initial={detail} userId={data.user_id} onDetail={setDetail} />}
              <section className="surface">
                <div className="section-heading">
                  <h2>
                    {
                      sharedSpaces.find(
                        (x) => x.id === detail.session.space_template_id,
                      )?.name
                    }
                  </h2>
                  <Tag>{sessionStateLabel(detail.session.status)}</Tag>
                </div>
                <p>
                  {when(
                    detail.session.scheduled_start_at,
                    detail.session.timezone,
                  )}{" "}
                  · {detail.session.planned_duration} min
                </p>
                <p className="together-hint">
                  {detail.session.timezone} ·{" "}
                  {
                    sessionModes.find(
                      (x) => x.id === detail.session.session_type,
                    )?.name
                  }
                </p>
                <div className="together-actions">
                  {detail.meeting_url &&
                    ["scheduled", "active"].includes(detail.session.status) && (
                      <a
                        className="primary"
                        href={detail.meeting_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Abrir Google Meet
                        <ArrowUpRight size={17} />
                      </a>
                    )}
                  {detail.session.host_id === data.user_id ? (
                    <>
                      {detail.session.status === "scheduled" && (
                        <>
                          <button
                            className="secondary"
                            disabled={busy}
                            onClick={() => setEditor("edit")}
                          >
                            Editar
                          </button>
                          <button
                            className="primary"
                            disabled={busy}
                            onClick={() =>
                              void run(() =>
                                send({
                                  action: "session.start",
                                  session_id: detail.session.id,
                                  revision: detail.session.revision,
                                }),
                              )
                            }
                          >
                            Iniciar sesión
                          </button>
                        </>
                      )}
                      {detail.session.status === "active" && (
                        <button
                          className="primary"
                          disabled={busy}
                          onClick={() =>
                            void run(() =>
                              send({
                                action: "session.complete",
                                session_id: detail.session.id,
                                revision: detail.session.revision,
                              }),
                            )
                          }
                        >
                          Finalizar sesión
                        </button>
                      )}
                      {["scheduled", "active"].includes(
                        detail.session.status,
                      ) && (
                        <button
                          className="secondary"
                          disabled={busy}
                          onClick={() => {
                            if (
                              window.confirm(
                                "¿Cancelar esta sesión y revocar sus invitaciones pendientes?",
                              )
                            )
                              void run(() =>
                                send({
                                  action: "session.cancel",
                                  session_id: detail.session.id,
                                  revision: detail.session.revision,
                                }),
                              );
                          }}
                        >
                          Cancelar sesión
                        </button>
                      )}
                    </>
                  ) : (
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            "¿Salir de la sesión? Perderás el acceso.",
                          )
                        )
                          void run(() =>
                            send({
                              action: "session.leave",
                              session_id: detail.session.id,
                              revision: detail.session.revision,
                            }),
                          );
                      }}
                    >
                      Salir de la sesión
                    </button>
                  )}
                </div>
                {detail.meeting_url && (
                  <p className="together-hint">
                    Meet se abre en otra pestaña. Finalizar esta sesión no
                    cierra la llamada de Meet.
                  </p>
                )}
              </section>
              <section className="surface">
                <h2>Participantes · {detail.participants.length}/6</h2>
                <p>Personas que aceptaron participar en este encuentro.</p>
                <ul className="together-people">
                  {detail.participants.map((p) => (
                    <li key={p.user_id}>
                      <span>
                        {p.nickname}
                        {p.user_id === data.user_id ? " (vos)" : ""}
                        <small>
                          {p.role === "host"
                            ? "Organiza la sesión"
                            : "Participante"}
                        </small>
                      </span>
                      {detail.session.host_id === data.user_id &&
                        p.user_id !== data.user_id && (
                          <div className="together-actions">
                            <button
                              className="secondary"
                              disabled={busy}
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `¿Dejar la organización a ${p.nickname}?`,
                                  )
                                )
                                  void run(() =>
                                    send({
                                      action: "session.transfer",
                                      session_id: detail.session.id,
                                      user_id: p.user_id,
                                      revision: detail.session.revision,
                                    }),
                                  );
                              }}
                            >
                              Dar organización
                            </button>
                            <button
                              className="secondary"
                              disabled={busy}
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `¿Quitar a ${p.nickname} de esta sesión?`,
                                  )
                                )
                                  void run(() =>
                                    send({
                                      action: "session.remove",
                                      session_id: detail.session.id,
                                      user_id: p.user_id,
                                      revision: detail.session.revision,
                                    }),
                                  );
                              }}
                            >
                              Quitar
                            </button>
                          </div>
                        )}
                    </li>
                  ))}
                </ul>
                {detail.session.host_id === data.user_id &&
                  ["scheduled", "active"].includes(detail.session.status) &&
                  inviteForm("session", detail.session.id)}
              </section>
            </>
          ) : (
            <div className="together-columns">
              <section className="surface">
                <div className="section-heading">
                  <h2>Tus sesiones</h2>
                  <span>{data.sessions.length}</span>
                </div>
                {data.sessions.length ? (
                  data.sessions.map((s) => (
                    <button
                      className="together-session"
                      key={s.id}
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          setDetail(await repo.session(s.id));
                          setEditor(null);
                        })
                      }
                    >
                      <span>
                        <Tag>{sessionStateLabel(s.status)}</Tag>
                        <strong>{s.title}</strong>
                        <small>
                          {when(s.scheduled_start_at, s.timezone)} ·{" "}
                          {s.participant_count}/6
                        </small>
                      </span>
                      <ArrowUpRight size={18} />
                    </button>
                  ))
                ) : (
                  <Empty>
                    Todavía no tenés sesiones. Elegí un objetivo y prepará la
                    primera.
                  </Empty>
                )}
              </section>
              <section className="surface">
                <h2>Tus grupos</h2>
                {data.groups.length ? (
                  data.groups.map(groupCard)
                ) : (
                  <Empty>
                    Un grupo guarda a tu equipo para próximos encuentros.
                  </Empty>
                )}
              </section>
            </div>
          )}
          <section className="surface">
            <h2>Invitaciones</h2>
            <p className="together-hint">
              Vencen a las 24 horas. Actualizá para ver las respuestas más
              recientes.
            </p>
            {data.invitations.length ? (
              data.invitations.map((i) => (
                <div className="together-invitation" key={i.id}>
                  <div>
                    <strong>{i.title}</strong>
                    <p>
                      {i.direction === "received"
                        ? `De ${i.inviter}`
                        : `Para ${i.recipient}`}{" "}
                      · {i.scope === "group" ? "Grupo" : "Sesión"} ·{" "}
                      {inviteStatus[i.status]}
                    </p>
                  </div>
                  {i.status === "pending" && (
                    <div className="together-actions">
                      {i.direction === "received" ? (
                        <>
                          <button
                            className="primary"
                            disabled={busy}
                            onClick={() =>
                              void run(() =>
                                send({
                                  action: "invite.respond",
                                  invite_id: i.id,
                                  accept: true,
                                }),
                              )
                            }
                          >
                            Aceptar
                          </button>
                          <button
                            className="secondary"
                            disabled={busy}
                            onClick={() =>
                              void run(() =>
                                send({
                                  action: "invite.respond",
                                  invite_id: i.id,
                                  accept: false,
                                }),
                              )
                            }
                          >
                            Rechazar
                          </button>
                        </>
                      ) : (
                        <button
                          className="secondary"
                          disabled={busy}
                          onClick={() =>
                            void run(() =>
                              send({
                                action: "invite.revoke",
                                invite_id: i.id,
                              }),
                            )
                          }
                        >
                          Revocar
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <Empty>No hay invitaciones por ahora.</Empty>
            )}
          </section>
        </>
      )}
    </div>
  );
}
