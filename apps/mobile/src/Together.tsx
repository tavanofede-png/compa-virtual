import { useEffect, useState } from "react";
import { View, Alert, Linking } from "react-native";
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
import { Text, Button, Field, Choices, Card, styles as st } from "./ui";
import { NativeSharedRoom } from "./SharedRoom";

const when = (iso: string, zone: string) =>
  new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: zone,
  }).format(new Date(iso));
const inviteStatus: Record<string, string> = {
  pending: "Pendiente",
  accepted: "Aceptada",
  declined: "Rechazada",
  revoked: "Revocada",
  expired: "Vencida",
};
const confirm = (message: string, action: () => void) =>
  Alert.alert("Estudiar juntos", message, [
    { text: "Volver", style: "cancel" },
    { text: "Confirmar", onPress: action },
  ]);
export function NativeTogether({
  repo,
  back,
}: {
  repo?: CollaborationRepository;
  back: () => void;
}) {
  const [data, setData] = useState<CollaborationOverview | null>(null),
    [detail, setDetail] = useState<GroupSessionDetail | null>(null),
    [group, setGroup] = useState<string | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [editor, setEditor] = useState<"group" | "session" | "edit" | null>(
      null,
    ),
    [name, setName] = useState("");
  const [inviteTarget, setInviteTarget] = useState<{
      scope: "group" | "session";
      id: string;
    } | null>(null),
    [code, setCode] = useState("");
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
  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function send(command: CollaborationCommand, close = false) {
    if (!repo) return;
    const r = await repo.command(command);
    await refresh(
      command.action === "session.leave" || command.action === "group.leave"
        ? ""
        : (r.session_id ?? detail?.session.id),
    );
    if (close) {
      setEditor(null);
      setInviteTarget(null);
      setCode("");
    }
    setNotice("Cambio guardado.");
  }
  function groupView(g: StudyGroup) {
    const owner = g.owner_id === data?.user_id;
    return (
      <Card key={g.id}>
        <Text style={st.h3}>{g.name}</Text>
        <Text style={st.p}>
          {g.members.length} integrantes ·{" "}
          {g.status === "active" ? "Privado" : "Archivado"}
        </Text>
        {g.members.map((p) => (
          <View key={p.user_id} style={{ paddingVertical: 10 }}>
            <Text>
              {p.nickname}
              {p.user_id === data?.user_id ? " (vos)" : ""} ·{" "}
              {p.role === "owner" ? "Organiza" : "Integrante"}
            </Text>
            {owner && p.user_id !== data?.user_id && g.status === "active" && (
              <>
                <Button
                  secondary
                  disabled={busy}
                  onPress={() =>
                    confirm(
                      `¿Dejar la organización a ${p.nickname}?`,
                      () =>
                        void run(() =>
                          send({
                            action: "group.transfer",
                            group_id: g.id,
                            user_id: p.user_id,
                            revision: g.revision,
                          }),
                        ),
                    )
                  }
                >
                  Dar organización
                </Button>
                <Button
                  secondary
                  disabled={busy}
                  onPress={() =>
                    confirm(
                      `¿Quitar a ${p.nickname} del grupo y sus sesiones?`,
                      () =>
                        void run(() =>
                          send({
                            action: "group.remove",
                            group_id: g.id,
                            user_id: p.user_id,
                            revision: g.revision,
                          }),
                        ),
                    )
                  }
                >
                  Quitar del grupo
                </Button>
              </>
            )}
          </View>
        ))}
        {g.status === "active" && (
          <>
            <Button
              onPress={() => {
                setGroup(g.id);
                setEditor("session");
              }}
            >
              Programar sesión
            </Button>
            {owner && (
              <Button
                secondary
                onPress={() => {
                  setInviteTarget({ scope: "group", id: g.id });
                  setCode("");
                }}
              >
                Invitar al grupo
              </Button>
            )}
            <Button
              secondary
              disabled={busy}
              onPress={() =>
                confirm(
                  owner
                    ? "¿Archivar el grupo? Primero deben estar cerradas sus sesiones."
                    : "¿Salir del grupo y perder acceso a sus sesiones?",
                  () =>
                    void run(() =>
                      send({
                        action: owner ? "group.archive" : "group.leave",
                        group_id: g.id,
                        revision: g.revision,
                      }),
                    ),
                )
              }
            >
              {owner ? "Archivar grupo" : "Salir del grupo"}
            </Button>
          </>
        )}
      </Card>
    );
  }
  return (
    <View style={{ gap: 16 }}>
      <Button
        secondary
        onPress={() => {
          if (detail) {
            setDetail(null);
            setEditor(null);
          } else back();
        }}
      >
        {detail ? "Todas las sesiones" : "Volver a Estudiar"}
      </Button>
      <Text style={st.h1}>{detail?.session.title ?? "Estudiar juntos."}</Text>
      <Text style={st.p}>
        {detail?.session.objective ??
          "Invitá a personas que conocés y compartan un objetivo."}
      </Text>
      {repo && (
        <Button
          secondary
          disabled={busy}
          onPress={() => void run(() => refresh())}
        >
          Actualizar encuentros
        </Button>
      )}
      {!!error && (
        <Text
          accessibilityRole="alert"
          style={{ color: "#873b29", padding: 12 }}
        >
          {error}
        </Text>
      )}
      {!!notice && <Text accessibilityLiveRegion="polite">{notice}</Text>}
      {!repo ? (
        <Card>
          <Text style={st.h3}>Tu próximo encuentro empieza acá.</Text>
          <Text style={st.p}>
            Las sesiones privadas requieren una cuenta conectada. Iniciá sesión
            para consultar su disponibilidad.
          </Text>
        </Card>
      ) : !data ? (
        <Text>
          {busy
            ? "Cargando tus encuentros…"
            : "Actualizá para consultar tus encuentros."}
        </Text>
      ) : !data.enabled ? (
        <Card>
          <Text style={st.p}>{data.reason}</Text>
        </Card>
      ) : (
        <>
          {editor === "group" ? (
            <Card>
              <Text style={st.h3}>Crear grupo privado</Text>
              <Field
                label="Nombre del grupo"
                value={name}
                onChangeText={setName}
                maxLength={100}
                editable={!busy}
              />
              <Button
                disabled={busy || !name.trim()}
                onPress={() =>
                  void run(() => send({ action: "group.create", name }, true))
                }
              >
                Crear grupo
              </Button>
              <Button secondary disabled={busy} onPress={() => setEditor(null)}>
                Cerrar
              </Button>
            </Card>
          ) : (
            editor && (
              <SessionForm
                key={editor === "edit" ? detail?.session.id : "new"}
                groups={data.groups}
                group={group}
                detail={editor === "edit" ? detail : null}
                busy={busy}
                close={() => setEditor(null)}
                submit={(c) => void run(() => send(c, true))}
              />
            )
          )}
          {inviteTarget && (
            <Card>
              <Text style={st.h3}>Invitación privada</Text>
              <Field
                label="Código de compañero"
                value={code}
                onChangeText={setCode}
                maxLength={64}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!busy}
              />
              <Text style={st.p}>
                Pedile el código a quien querés invitar. Vence a las 24 horas.
              </Text>
              <Button
                disabled={busy || code.length !== 64}
                onPress={() =>
                  void run(() =>
                    send(
                      {
                        action: "invite.create",
                        scope: inviteTarget.scope,
                        target_id: inviteTarget.id,
                        contact_code: code,
                      },
                      true,
                    ),
                  )
                }
              >
                Enviar invitación
              </Button>
              <Button
                secondary
                disabled={busy}
                onPress={() => setInviteTarget(null)}
              >
                Cerrar
              </Button>
            </Card>
          )}
          {detail ? (
            <>
              {repo && <NativeSharedRoom repo={repo} initial={detail} userId={data.user_id} onDetail={setDetail}/>}
              <Card>
                <Text style={st.tag}>
                  {sessionStateLabel(detail.session.status)}
                </Text>
                <Text style={st.h3}>
                  {
                    sharedSpaces.find(
                      (s) => s.id === detail.session.space_template_id,
                    )?.name
                  }
                </Text>
                <Text style={st.p}>
                  {when(
                    detail.session.scheduled_start_at,
                    detail.session.timezone,
                  )}{" "}
                  · {detail.session.planned_duration} min
                </Text>
                <Text style={st.label}>{detail.session.timezone}</Text>
                {detail.meeting_url &&
                  ["scheduled", "active"].includes(detail.session.status) && (
                    <>
                      <Button
                        onPress={() =>
                          void run(async () => {
                            await Linking.openURL(detail.meeting_url!);
                          })
                        }
                      >
                        Abrir Google Meet
                      </Button>
                      <Text style={st.p}>
                        Finalizar esta sesión no cierra la llamada de Meet.
                      </Text>
                    </>
                  )}
                {detail.session.host_id === data.user_id ? (
                  <>
                    {detail.session.status === "scheduled" && (
                      <>
                        <Button
                          secondary
                          disabled={busy}
                          onPress={() => setEditor("edit")}
                        >
                          Editar sesión
                        </Button>
                        <Button
                          disabled={busy}
                          onPress={() =>
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
                        </Button>
                      </>
                    )}
                    {detail.session.status === "active" && (
                      <Button
                        disabled={busy}
                        onPress={() =>
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
                      </Button>
                    )}
                    {["scheduled", "active"].includes(
                      detail.session.status,
                    ) && (
                      <>
                        <Button
                          secondary
                          onPress={() => {
                            setInviteTarget({
                              scope: "session",
                              id: detail.session.id,
                            });
                            setCode("");
                          }}
                        >
                          Invitar a la sesión
                        </Button>
                        <Button
                          secondary
                          disabled={busy}
                          onPress={() =>
                            confirm(
                              "¿Cancelar la sesión y sus invitaciones pendientes?",
                              () =>
                                void run(() =>
                                  send({
                                    action: "session.cancel",
                                    session_id: detail.session.id,
                                    revision: detail.session.revision,
                                  }),
                                ),
                            )
                          }
                        >
                          Cancelar sesión
                        </Button>
                      </>
                    )}
                  </>
                ) : (
                  <Button
                    secondary
                    disabled={busy}
                    onPress={() =>
                      confirm(
                        "¿Salir de esta sesión y perder el acceso?",
                        () =>
                          void run(() =>
                            send({
                              action: "session.leave",
                              session_id: detail.session.id,
                              revision: detail.session.revision,
                            }),
                          ),
                      )
                    }
                  >
                    Salir de la sesión
                  </Button>
                )}
              </Card>
              <Card>
                <Text style={st.h3}>
                  Participantes · {detail.participants.length}/6
                </Text>
                <Text style={st.p}>Personas que aceptaron participar.</Text>
                {detail.participants.map((p) => (
                  <View key={p.user_id} style={{ paddingVertical: 12 }}>
                    <Text>
                      {p.nickname}
                      {p.user_id === data.user_id ? " (vos)" : ""} ·{" "}
                      {p.role === "host" ? "Organiza" : "Participante"}
                    </Text>
                    {detail.session.host_id === data.user_id &&
                      p.user_id !== data.user_id && (
                        <>
                          <Button
                            secondary
                            disabled={busy}
                            onPress={() =>
                              confirm(
                                `¿Dejar la organización a ${p.nickname}?`,
                                () =>
                                  void run(() =>
                                    send({
                                      action: "session.transfer",
                                      session_id: detail.session.id,
                                      user_id: p.user_id,
                                      revision: detail.session.revision,
                                    }),
                                  ),
                              )
                            }
                          >
                            Dar organización
                          </Button>
                          <Button
                            secondary
                            disabled={busy}
                            onPress={() =>
                              confirm(
                                `¿Quitar a ${p.nickname}?`,
                                () =>
                                  void run(() =>
                                    send({
                                      action: "session.remove",
                                      session_id: detail.session.id,
                                      user_id: p.user_id,
                                      revision: detail.session.revision,
                                    }),
                                  ),
                              )
                            }
                          >
                            Quitar participante
                          </Button>
                        </>
                      )}
                  </View>
                ))}
              </Card>
            </>
          ) : (
            <>
              <Card>
                <Text style={st.h3}>Reservá un momento.</Text>
                <Text style={st.p}>
                  Grupos privados. Hasta 6 personas por sesión.
                </Text>
                <Button
                  onPress={() => {
                    setGroup(null);
                    setEditor("session");
                  }}
                >
                  Nueva sesión
                </Button>
                <Button
                  secondary
                  onPress={() => {
                    setName("");
                    setEditor("group");
                  }}
                >
                  Crear grupo
                </Button>
                <Text style={st.label}>Tu código de compañero</Text>
                <Text
                  selectable
                  style={{ fontSize: 13, lineHeight: 22, marginTop: 8 }}
                >
                  {data.contact_code}
                </Text>
                <Text style={st.p}>
                  Mantené presionado para copiarlo y compartilo directamente con
                  quien quieras que te invite.
                </Text>
              </Card>
              <Text style={st.h2}>Tus sesiones</Text>
              {data.sessions.length ? (
                data.sessions.map((s) => (
                  <Card key={s.id}>
                    <Text style={st.tag}>{sessionStateLabel(s.status)}</Text>
                    <Text style={st.h3}>{s.title}</Text>
                    <Text style={st.p}>
                      {when(s.scheduled_start_at, s.timezone)} ·{" "}
                      {s.participant_count}/6
                    </Text>
                    <Button
                      secondary
                      disabled={busy}
                      onPress={() =>
                        void run(async () => {
                          setDetail(await repo.session(s.id));
                          setEditor(null);
                          setInviteTarget(null);
                        })
                      }
                    >
                      Ver sesión
                    </Button>
                  </Card>
                ))
              ) : (
                <Text style={st.p}>
                  Elegí un objetivo y prepará tu primera sesión.
                </Text>
              )}
              <Text style={st.h2}>Tus grupos</Text>
              {data.groups.length ? (
                data.groups.map(groupView)
              ) : (
                <Text style={st.p}>
                  Un grupo guarda a tu equipo para próximos encuentros.
                </Text>
              )}
            </>
          )}
          <Text style={st.h2}>Invitaciones</Text>
          <Text style={st.p}>
            Vencen a las 24 horas. Actualizá para ver las respuestas.
          </Text>
          {data.invitations.length ? (
            data.invitations.map((i) => (
              <Card key={i.id}>
                <Text style={st.h3}>{i.title}</Text>
                <Text style={st.p}>
                  {i.direction === "received"
                    ? `De ${i.inviter}`
                    : `Para ${i.recipient}`}{" "}
                  · {inviteStatus[i.status]}
                </Text>
                {i.status === "pending" &&
                  (i.direction === "received" ? (
                    <>
                      <Button
                        disabled={busy}
                        onPress={() =>
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
                      </Button>
                      <Button
                        secondary
                        disabled={busy}
                        onPress={() =>
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
                      </Button>
                    </>
                  ) : (
                    <Button
                      secondary
                      disabled={busy}
                      onPress={() =>
                        void run(() =>
                          send({ action: "invite.revoke", invite_id: i.id }),
                        )
                      }
                    >
                      Revocar
                    </Button>
                  ))}
              </Card>
            ))
          ) : (
            <Text style={st.p}>No hay invitaciones por ahora.</Text>
          )}
        </>
      )}
    </View>
  );
}
function SessionForm({
  groups,
  group,
  detail,
  busy,
  submit,
  close,
}: {
  groups: StudyGroup[];
  group: string | null;
  detail: GroupSessionDetail | null;
  busy: boolean;
  submit: (c: CollaborationCommand) => void;
  close: () => void;
}) {
  const session = detail?.session,
    local = sessionLocalFields(
      session ? new Date(session.scheduled_start_at) : undefined,
    );
  const [title, setTitle] = useState(session?.title ?? ""),
    [objective, setObjective] = useState(session?.objective ?? "");
  const [date, setDate] = useState(local.date),
    [time, setTime] = useState(local.time),
    [duration, setDuration] = useState(String(session?.planned_duration ?? 45));
  const [mode, setMode] = useState<string>(session?.session_type ?? "silent"),
    [space, setSpace] = useState<string>(session?.space_template_id ?? "study"),
    [meeting, setMeeting] = useState(detail?.meeting_url ?? "");
  const [groupId, setGroupId] = useState(group ?? ""),
    [error, setError] = useState("");
  function save() {
    try {
      setError("");
      const fields = {
        title,
        objective,
        session_type: mode as "silent" | "review" | "project",
        space_template_id: space as (typeof sharedSpaces)[number]["id"],
        scheduled_start_at: sessionLocalStart(date, time),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        planned_duration: Number(duration),
        meeting_url: meeting,
      };
      submit(
        session
          ? {
              action: "session.update",
              session_id: session.id,
              revision: session.revision,
              ...fields,
            }
          : { action: "session.create", group_id: groupId || null, ...fields },
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Card>
      <Text style={st.h3}>
        {session ? "Editar sesión" : "Preparar una sesión"}
      </Text>
      <Field
        label="Nombre"
        value={title}
        onChangeText={setTitle}
        maxLength={100}
        editable={!busy}
      />
      <Field
        label="¿Qué quieren lograr?"
        value={objective}
        onChangeText={setObjective}
        multiline
        maxLength={500}
        editable={!busy}
      />
      {!session && (
        <Choices
          label="Grupo"
          value={groupId}
          onChange={setGroupId}
          options={[
            { value: "", label: "Encuentro independiente" },
            ...groups
              .filter((g) => g.status === "active")
              .map((g) => ({ value: g.id, label: g.name })),
          ]}
        />
      )}
      <Field
        label="Día (AAAA-MM-DD)"
        value={date}
        onChangeText={setDate}
        maxLength={10}
        editable={!busy}
      />
      <Field
        label="Hora (HH:mm)"
        value={time}
        onChangeText={setTime}
        maxLength={5}
        editable={!busy}
      />
      <Text style={st.label}>
        Horario en {Intl.DateTimeFormat().resolvedOptions().timeZone}
      </Text>
      <Field
        label="Duración en minutos (15 a 180)"
        value={duration}
        onChangeText={setDuration}
        keyboardType="number-pad"
        maxLength={3}
        editable={!busy}
      />
      <Choices
        label="Tipo de sesión"
        value={mode}
        onChange={setMode}
        options={sessionModes.map((s) => ({ value: s.id, label: s.name }))}
      />
      <Choices
        label="Ambiente"
        value={space}
        onChange={setSpace}
        options={sharedSpaces.map((s) => ({ value: s.id, label: s.name }))}
      />
      <Field
        label="Enlace de Google Meet (opcional)"
        value={meeting}
        onChangeText={setMeeting}
        maxLength={300}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        editable={!busy}
      />
      <Text style={st.p}>
        Creá la reunión en Google Meet y pegá su enlace. Solo lo ven quienes
        aceptaron participar.
      </Text>
      {!!error && <Text accessibilityRole="alert">{error}</Text>}
      <Button disabled={busy} onPress={save}>
        {session ? "Guardar cambios" : "Crear sesión privada"}
      </Button>
      <Button secondary disabled={busy} onPress={close}>
        Cerrar
      </Button>
    </Card>
  );
}
