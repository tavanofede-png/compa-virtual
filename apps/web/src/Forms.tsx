"use client";
import { MotionPreference } from "./MotionPreference";
import { MaterialText } from "./MaterialText";
import { openMaterialOriginal } from "./openMaterialOriginal";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Check,
  Plus,
  Trash2,
  Upload,
  Play,
  Pause,
  Sparkles,
  Mic,
  Volume2,
  VolumeX,
  Square,
  PhoneCall,
  PhoneOff,
} from "lucide-react";
import {
  methods,
  methodById,
  prepareDailyStudy,
  freeStudyDurations,
  catalog,
  avatarPresets,
  avatarAppearance,
  skinTones,
  hairStyles,
  hairColors,
  clothingStyles,
  clothingColors,
  personalities,
  today,
  dateLabel,
  clock,
  minuteOf,
  addDays,
  consentRequirement,
  type AcademicItem,
  type Companion,
  type StudyMethod,
  type PlanSlot,
  type Quiz,
  type Memory,
  activePet,
  petDefinition,
  petDefinitions,
  defaultPetPreferences,
} from "@compa/domain";
import { useApp } from "./context";
import { StateConflictError } from "@compa/client";
import { Creature } from "./Room";
import { PersonalStudyCanvas } from "./PersonalStudyCanvas";
import { studySpaceById } from "@compa/domain";
import { useCompanionVoice } from "./useCompanionVoice";
import { Field, Empty, Tag, formData, kinds, days } from "./ui";
function SignOutButton() {
  const { leave, busy } = useApp();
  return (
    <button className="settings-row" disabled={busy} onClick={leave}>
      Cerrar sesión
    </button>
  );
}
export const titles: Record<string, string> = {
  item: "Una actividad para tu agenda",
  subjects: "Tus materias",
  week: "Hagamos lugar en tu semana",
  plan: "Un plan para revisar",
  chat: "Conversar con tu compa",
  companion: "Tu compa, a tu manera",
  pet: "Mi mascota",
  checkin: "Un minuto para mirar tu día",
  method: "Una herramienta para aprender",
  focus: "Sesión de estudio",
  generate: "Preparar una práctica",
  quiz: "Practicar y revisar",
  upload: "Sumar material",
  "material-text": "Leer mi material",
  extract: "De un mensaje a tu agenda",
  profile: "Contanos un poco de vos",
  settings: "Tu espacio, tus decisiones",
  support: "Ayuda y soporte",
  memory: "Memoria académica",
  privacy: "Privacidad y tus datos",
  notifications: "Tus avisos",
  "delete-material": "Eliminar material",
  "delete-account": "Eliminar tu cuenta",
};

function PetForm() {
  const { env, busy, run, command } = useApp();
  const pet = activePet(env.state);
  const definition = petDefinition(pet?.petDefinitionId);
  const initial = env.state.petPreferences ?? defaultPetPreferences;
  const [name, setName] = useState(pet?.name ?? definition.name);
  const [visible, setVisible] = useState(initial.visible);
  const [automaticMovement, setAutomaticMovement] = useState(
    initial.automaticMovement,
  );
  const [activityLevel, setActivityLevel] = useState(initial.activityLevel);
  const [reducedMotion, setReducedMotion] = useState(initial.reducedMotion);
  const [petFamily, setPetFamily] = useState<"dogs" | "cats" | "others">(
    definition.species === "dog"
      ? "dogs"
      : definition.species === "cat"
        ? "cats"
        : "others",
  );
  const visiblePetDefinitions = petDefinitions.filter((candidate) =>
    petFamily === "dogs"
      ? candidate.species === "dog"
      : petFamily === "cats"
        ? candidate.species === "cat"
        : !["dog", "cat"].includes(candidate.species),
  );
  useEffect(
    () => setName(pet?.name ?? definition.name),
    [pet?.id, pet?.name, definition.name],
  );
  if (!pet)
    return (
      <div className="pet-config">
        <img src={definition.variant.portrait} alt="Golden retriever 3D" />
        <p className="eyebrow">TU PRIMERA MASCOTA · GRATIS</p>
        <h3>{definition.breed}</h3>
        <p>{definition.description}</p>
        <Field label="¿Cómo se va a llamar?">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={30}
          />
        </Field>
        <button
          className="primary"
          disabled={busy || !name.trim()}
          onClick={() => run(() => command("pet.chooseFirst", { name }))}
        >
          Conocer a {name.trim() || definition.name}
        </button>
      </div>
    );
  return (
    <form
      className="pet-config"
      onSubmit={(event) => {
        event.preventDefault();
        void run(() =>
          command("pet.configure", {
            id: pet.id,
            name,
            visible,
            automaticMovement,
            activityLevel,
            reducedMotion,
          }),
        );
      }}
    >
      <img
        src={definition.variant.portrait}
        alt={`${pet.name}, ${definition.breed} 3D`}
      />
      <p className="eyebrow">MASCOTA ACTIVA</p>
      <div className="pet-family-tabs" aria-label="Familias de mascotas">
        {(
          [
            ["dogs", "Perros"],
            ["cats", "Gatos"],
            ["others", "Otros amigos"],
          ] as const
        ).map(([id, label]) => (
          <button
            type="button"
            key={id}
            aria-pressed={petFamily === id}
            onClick={() => setPetFamily(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="pet-collection" aria-label="Colección de mascotas">
        {visiblePetDefinitions.map((candidate) => {
          const owned = env.state.ownedPets.find(
            (entry) => entry.petDefinitionId === candidate.id,
          );
          const selected = owned?.id === pet.id;
          const price =
            candidate.unlock.kind === "coins"
              ? Number(candidate.unlock.value)
              : 0;
          return (
            <button
              type="button"
              className={selected ? "pet-card selected" : "pet-card"}
              key={candidate.id}
              disabled={busy || selected}
              onClick={() =>
                void run(() =>
                  owned
                    ? command("pet.setActive", { id: owned.id })
                    : command("pet.unlock", { definitionId: candidate.id }),
                )
              }
            >
              <img src={candidate.variant.portrait} alt={candidate.breed} />
              <strong>{candidate.breed}</strong>
              <small>
                {selected
                  ? "Está con vos"
                  : owned
                    ? "Elegir"
                    : `${price} monedas`}
              </small>
            </button>
          );
        })}
      </div>
      <Field label="Nombre">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
          required
        />
      </Field>
      <Field label="Nivel de actividad">
        <select
          value={activityLevel}
          onChange={(e) =>
            setActivityLevel(e.target.value as typeof activityLevel)
          }
        >
          <option value="calm">Tranquilo</option>
          <option value="normal">Normal</option>
          <option value="active">Activo</option>
        </select>
      </Field>
      <label className="settings-check">
        <input
          type="checkbox"
          checked={visible}
          onChange={(e) => setVisible(e.target.checked)}
        />{" "}
        Mostrar mascota en la habitación
      </label>
      <label className="settings-check">
        <input
          type="checkbox"
          checked={automaticMovement}
          onChange={(e) => setAutomaticMovement(e.target.checked)}
        />{" "}
        Movimiento automático
      </label>
      <label className="settings-check">
        <input
          type="checkbox"
          checked={reducedMotion}
          onChange={(e) => setReducedMotion(e.target.checked)}
        />{" "}
        Reducir movimiento
      </label>
      <p className="callout">
        Su lugar de descanso y sus objetos compatibles quedan preparados dentro
        de la habitación.
      </p>
      <button className="primary" disabled={busy}>
        Guardar mascota
      </button>
    </form>
  );
}
export function Forms({ name, selected }: { name: string; selected: unknown }) {
  const { repo, env, busy, run, command, open, close, update, notice, go } =
      useApp(),
    s = env.state,
    date = today(s.profile?.timezone);
  const [compa, setCompa] = useState<Companion>(
      (selected as Companion) ?? s.companion,
    ),
    [chat, setChat] = useState(""),
    [pendingChat, setPendingChat] = useState<{
      id: string;
      content: string;
    } | null>(null),
    [answers, setAnswers] = useState<Record<string, string>>({}),
    [proposal, setProposal] = useState<Record<string, unknown>[] | null>(null),
    [sessionClock, setSessionClock] = useState(Date.now()),
    [roomVisible, setRoomVisible] = useState(false);
  useEffect(() => {
    if (name === "focus")
      setRoomVisible(localStorage.getItem("kusiy:study-view") === "room");
  }, [name]);
  const voice = useCompanionVoice(s.companion.character_id);
  const [liveCall, setLiveCall] = useState(false);
  const [liveCallPhase, setLiveCallPhase] = useState<
    "idle" | "listening" | "thinking" | "speaking" | "error"
  >("idle");
  const [liveTranscript, setLiveTranscript] = useState("");
  const chatHistoryRef = useRef<HTMLDivElement>(null);
  const liveCallRef = useRef(false);
  const liveCallTimerRef = useRef<number | null>(null);
  const liveListenRef = useRef<() => void>(() => undefined);
  const liveSendRef = useRef<(message: string) => Promise<void>>(
    async () => undefined,
  );
  const applyAgentEffects = (message?: (typeof s.messages)[number]) => {
    const navigation = message?.effects?.find(
      (effect) => effect.type === "NAVIGATE",
    );
    if (!navigation) return;
    close();
    go(navigation.target);
    notice("Tu compa abrió la sección que pediste.");
  };
  const spokenAgentReply = (message: (typeof s.messages)[number]) =>
    [message.content, ...(message.actions?.map((action) => action.label) ?? [])]
      .filter(Boolean)
      .join(" ");
  const clearLiveCallTimer = useCallback(() => {
    if (liveCallTimerRef.current !== null) {
      window.clearTimeout(liveCallTimerRef.current);
      liveCallTimerRef.current = null;
    }
  }, []);
  const queueLiveListen = useCallback(
    (delay = 350) => {
      clearLiveCallTimer();
      liveCallTimerRef.current = window.setTimeout(() => {
        liveCallTimerRef.current = null;
        liveListenRef.current();
      }, delay);
    },
    [clearLiveCallTimer],
  );

  useEffect(() => {
    if (name !== "chat") return;
    const frame = window.requestAnimationFrame(() => {
      chatHistoryRef.current?.scrollTo({
        top: chatHistoryRef.current.scrollHeight,
        behavior: "smooth",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [name, s.messages.length, pendingChat?.id]);

  liveSendRef.current = async (message: string) => {
    const cleanMessage = message.trim();
    if (!liveCallRef.current || !cleanMessage) return;
    setPendingChat({ id: crypto.randomUUID(), content: cleanMessage });
    setChat("");
    setLiveTranscript(cleanMessage);
    setLiveCallPhase("thinking");
    let response = "";
    await run(async () => {
      const next = await repo.ai(
        "chat",
        { message: cleanMessage },
        env.version,
      );
      update(next);
      const answer = [...next.state.messages]
        .reverse()
        .find((messageItem) => messageItem.role === "assistant");
      response = answer ? spokenAgentReply(answer) : "";
      applyAgentEffects(answer);
    });
    setPendingChat(null);
    if (!liveCallRef.current) return;
    if (!response) {
      setLiveCallPhase("error");
      queueLiveListen(1400);
      return;
    }
    setLiveCallPhase("speaking");
    const started = voice.speak(response, true, () => {
      if (!liveCallRef.current) return;
      setLiveTranscript("");
      setLiveCallPhase("listening");
      queueLiveListen(260);
    });
    if (!started) {
      setLiveCallPhase("listening");
      queueLiveListen(260);
    }
  };

  liveListenRef.current = () => {
    if (!liveCallRef.current) return;
    if (busy || voice.speaking || voice.listening) {
      queueLiveListen(300);
      return;
    }
    setLiveCallPhase("listening");
    setLiveTranscript("");
    voice.listenTurn({
      onInterim: setLiveTranscript,
      onFinal: (transcript) => void liveSendRef.current(transcript),
      onError: (code) => {
        if (code === "not-allowed" || code === "service-not-allowed") {
          liveCallRef.current = false;
          setLiveCall(false);
          setLiveCallPhase("error");
        }
      },
      onEnd: (delivered) => {
        if (!delivered && liveCallRef.current) queueLiveListen(450);
      },
    });
  };

  const startLiveCall = () => {
    voice.stop();
    clearLiveCallTimer();
    liveCallRef.current = true;
    setLiveCall(true);
    setLiveTranscript("");
    setLiveCallPhase("listening");
    queueLiveListen(80);
  };
  const stopLiveCall = useCallback(() => {
    liveCallRef.current = false;
    clearLiveCallTimer();
    voice.stop();
    setLiveCall(false);
    setLiveTranscript("");
    setLiveCallPhase("idle");
  }, [clearLiveCallTimer, voice.stop]);
  const interruptLiveCall = () => {
    voice.stop();
    setLiveTranscript("");
    setLiveCallPhase("listening");
    queueLiveListen(120);
  };
  useEffect(
    () => () => {
      liveCallRef.current = false;
      clearLiveCallTimer();
      voice.stop();
    },
    [clearLiveCallTimer, voice.stop],
  );
  useEffect(() => {
    if (name !== "chat" && liveCallRef.current) stopLiveCall();
  }, [name, stopLiveCall]);
  useEffect(() => {
    if (name !== "focus" || !s.activeSession?.running_since) return;
    const timer = window.setInterval(() => setSessionClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [name, s.activeSession?.running_since]);
  useEffect(() => {
    if (
      !s.activeSession?.running_since ||
      (s.activeSession.controller_device_id &&
        s.activeSession.controller_device_id !== env.deviceId)
    ) return;
    const activeId = s.activeSession.id;
    let pauseRequested = false;
    const pauseWhenHidden = () => {
      if (document.visibilityState === "hidden" && !pauseRequested) {
        pauseRequested = true;
        void repo
          .command(
            { type: "session.pause", payload: { id: activeId } },
            env.version,
          )
          .then(update)
          .catch((error) => {
            if (error instanceof StateConflictError && error.latest)
              update(error.latest);
            // A failed pause is not shown as saved; the server state wins on refresh.
          });
      }
    };
    document.addEventListener("visibilitychange", pauseWhenHidden);
    return () =>
      document.removeEventListener("visibilitychange", pauseWhenHidden);
  }, [
    s.activeSession?.id,
    s.activeSession?.running_since,
    s.activeSession?.controller_device_id,
    env.deviceId,
    env.version,
    repo,
    update,
  ]);
  if (name === "pet") return <PetForm />;
  const subjectOptions = s.subjects.map((x) => (
    <option value={x.id} key={x.id}>
      {x.name}
    </option>
  ));
  if (name === "item") {
    const old = selected as AcademicItem | undefined;
    return (
      <form
        onSubmit={(e) => {
          const d = formData(e);
          run(() =>
            command("item.save", {
              ...old,
              ...d,
              priority: +d.priority,
              difficulty: +d.difficulty,
              effort_minutes: +d.effort_minutes,
              due_time: d.due_time || null,
              topics: d.topics
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean),
            }),
          );
        }}
      >
        {!s.subjects.length && (
          <p className="callout">
            Primero{" "}
            <button
              type="button"
              className="text-button"
              onClick={() => open("subjects")}
            >
              agregá una materia
            </button>
            .
          </p>
        )}
        <Field label="¿Qué tenés que preparar?">
          <input
            name="title"
            defaultValue={old?.title}
            required
            maxLength={200}
          />
        </Field>
        <div className="form-grid">
          <Field label="Materia">
            <select name="subject_id" defaultValue={old?.subject_id} required>
              {subjectOptions}
            </select>
          </Field>
          <Field label="Tipo">
            <select name="kind" defaultValue={old?.kind ?? "TASK"}>
              {Object.entries(kinds).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Fecha">
            <input
              type="date"
              name="due_date"
              defaultValue={old ? (old.due_date ?? "") : addDays(date, 1)}
              required
            />
          </Field>
          <Field label="Hora, si está definida">
            <input
              type="time"
              name="due_time"
              defaultValue={old?.due_time ?? ""}
            />
          </Field>
        </div>
        <Field label="Temas, separados por comas">
          <input name="topics" defaultValue={old?.topics?.join(", ")} />
        </Field>
        <Field label="Notas">
          <textarea name="description" defaultValue={old?.description ?? ""} />
        </Field>
        <div className="form-grid three">
          <Field label="Esfuerzo (min)">
            <input
              type="number"
              name="effort_minutes"
              min="10"
              max="1200"
              step="5"
              defaultValue={old?.effort_minutes ?? 50}
              required
            />
          </Field>
          <Field label="Prioridad">
            <select name="priority" defaultValue={old?.priority ?? 2}>
              <option value="1">Normal</option>
              <option value="2">Importante</option>
              <option value="3">Alta</option>
            </select>
          </Field>
          <Field label="Dificultad (1–5)">
            <input
              name="difficulty"
              type="number"
              min="1"
              max="5"
              defaultValue={old?.difficulty ?? 3}
            />
          </Field>
        </div>
        <button className="primary" disabled={busy || !s.subjects.length}>
          Confirmar actividad <Check size={17} />
        </button>
      </form>
    );
  }
  if (name === "subjects")
    return (
      <>
        <div>
          {s.subjects.map((x) => (
            <div className="list-row" key={x.id}>
              <i className="subject-dot" style={{ background: x.color }} />
              {x.name}
            </div>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            const d = formData(e);
            run(() => command("subject.save", d, false));
            e.currentTarget.reset();
          }}
        >
          <Field label="Nombre de la materia">
            <input name="name" required maxLength={80} />
          </Field>
          <Field label="Color">
            <input type="color" name="color" defaultValue="#638665" />
          </Field>
          <button className="primary" disabled={busy}>
            Agregar materia <Plus size={16} />
          </button>
        </form>
      </>
    );
  if (name === "week")
    return (
      <>
        <p className="callout">
          Marcá disponibilidad y compromisos. El plan deja descansos y ocupa
          como máximo el 80 % del tiempo libre.
        </p>
        <div className="scroll-list">
          {s.blocks.map((x) => (
            <div className="list-row" key={x.id}>
              <div>
                <strong>{x.label}</strong>
                <p>
                  {x.exception_date
                    ? dateLabel(x.exception_date)
                    : days[x.day_of_week]}{" "}
                  · {clock(x.start_minute)}–{clock(x.end_minute)} ·{" "}
                  {x.kind === "AVAILABLE" ? "Disponible" : "Ocupado"}
                </p>
              </div>
              <button
                className="icon-button"
                aria-label="Eliminar horario"
                onClick={() =>
                  run(() => command("block.delete", { id: x.id }, false))
                }
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            const d = formData(e);
            run(() =>
              command(
                "block.save",
                {
                  ...d,
                  day_of_week: +d.day_of_week,
                  start_minute: minuteOf(d.start),
                  end_minute: minuteOf(d.end),
                  exception_date: d.exception_date || null,
                },
                false,
              ),
            );
          }}
        >
          <Field label="Nombre del bloque">
            <input
              name="label"
              placeholder="Colegio, inglés, tiempo para estudiar…"
              required
            />
          </Field>
          <div className="form-grid">
            <Field label="Día">
              <select name="day_of_week" defaultValue="1">
                {days.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tipo">
              <select name="kind">
                <option value="AVAILABLE">Disponible para estudiar</option>
                <option value="SCHOOL">Colegio</option>
                <option value="BUSY">Compromiso</option>
                <option value="REST">Descanso</option>
              </select>
            </Field>
            <Field label="Desde">
              <input name="start" type="time" defaultValue="17:00" required />
            </Field>
            <Field label="Hasta">
              <input name="end" type="time" defaultValue="19:00" required />
            </Field>
          </div>
          <Field label="Solo en esta fecha (opcional)">
            <input type="date" name="exception_date" />
          </Field>
          <button className="primary" disabled={busy}>
            Guardar horario
          </button>
        </form>
      </>
    );
  if (name === "plan") {
    const plan =
      s.plans.find((x) => x.status === "PROPOSED") ??
      s.plans.find((x) => x.status === "ACCEPTED");
    return plan ? (
      <>
        <div className="scroll-list">
          {plan.slots.map((x) => (
            <div className="list-row" key={x.id}>
              <div>
                <strong>
                  {dateLabel(x.date)} · {clock(x.start_minute)}
                </strong>
                <p>{s.items.find((i) => i.id === x.academic_item_id)?.title}</p>
                <small>
                  {methodById(x.method_id).name} · {x.duration_minutes} minutos
                </small>
              </div>
            </div>
          ))}
        </div>
        {plan.unscheduled.map((x) => (
          <div className="callout" key={x.academic_item_id}>
            <strong>
              {s.items.find((i) => i.id === x.academic_item_id)?.title}: faltan{" "}
              {x.minutes} min
            </strong>
            <p>{x.reason}</p>
          </div>
        ))}
        {plan.status === "PROPOSED" ? (
          <>
            <p className="fine-print">
              Revisá los horarios. Al aceptarlo reemplaza el plan anterior y
              conserva tu historial completado. Los incumplimientos solo se
              revisan en el check-in.
            </p>
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                run(() =>
                  command("plan.accept", {
                    id: plan.id,
                    version: plan.version,
                  }),
                )
              }
            >
              Aceptar este plan <Check size={17} />
            </button>
          </>
        ) : (
          <Tag>Este plan ya está aceptado.</Tag>
        )}
      </>
    ) : (
      <Empty>
        Agregá actividades y disponibilidad para generar una propuesta.
      </Empty>
    );
  }
  if (name === "focus") {
    const slot = selected as PlanSlot | undefined;
    const active = s.activeSession;
    const pendingFinish = env.pendingSessionFinish?.sessionId === active?.id
      ? env.pendingSessionFinish : undefined;
    const remoteControl = Boolean(
      active?.controller_device_id && active.controller_device_id !== env.deviceId,
    );
    const prepared = prepareDailyStudy(s);
    const method = methodById(
      active?.method_id ?? slot?.method_id ?? "retrieval",
    );
    const item = s.items.find(
      (entry) =>
        entry.id === (active?.academic_item_id ?? slot?.academic_item_id),
    );
    const subjectId = active?.subject_id ?? item?.subject_id;
    const subject = s.subjects.find((entry) => entry.id === subjectId);
    const practice = s.quizzes.find((quiz) => quiz.subject_id === subjectId);
    const elapsed = active
      ? active.elapsed_seconds +
        (active.running_since
          ? Math.max(
              0,
              Math.floor(
              ((pendingFinish ? Date.parse(pendingFinish.finishedAt) : sessionClock) -
                Date.parse(active.running_since)) / 1000,
              ),
            )
          : 0)
      : 0;
    return (
      <>
        <Tag>
          {active
            ? pendingFinish ? "CIERRE PENDIENTE" : "SESIÓN EN CURSO"
            : slot
              ? "BLOQUE DEL PLAN"
              : "ESTUDIO LIBRE"}
        </Tag>
        {active ? (
          <>
            <h3>{active.objective}</h3>
            <p className="fine-print">
              {subject?.name ? `${subject.name} · ` : ""}
              {method.name} · objetivo de {active.planned_minutes} minutos
            </p>
            {remoteControl && (
              <div className="callout" role="status">
                <strong>Esta sesión está abierta en otro dispositivo.</strong>
                <p>Podés verla acá. Si tomás el control, el tiempo se pausará hasta que elijas Continuar.</p>
                <button
                  className="primary"
                  type="button"
                  disabled={busy || env.offline}
                  onClick={() => run(() => command("session.takeControl", { id: active.id }, false))}
                >
                  Tomar control
                </button>
              </div>
            )}
            {pendingFinish && (
              <div className="callout" role="status">
                <strong>{pendingFinish.status === "conflict" ? "Revisá este cierre" : "Cierre pendiente de sincronizar"}</strong>
                <p>{pendingFinish.status === "conflict"
                  ? "La sesión cambió en otro dispositivo. No confirmamos el cierre ni las monedas. Revisá el estado actual antes de continuar."
                  : "Detuvimos el tiempo en este dispositivo. La sesión aparecerá en el historial y las monedas se acreditarán solo cuando el servidor confirme el cierre."}</p>
                {pendingFinish.status === "conflict" ? (
                  <button className="secondary" type="button" disabled={busy} onClick={() => run(async () => {
                    const latest = await repo.dismissPendingSessionFinish();
                    if (latest) update(latest);
                  })}>Revisar sesión actual</button>
                ) : (
                  <button className="secondary" type="button" disabled={busy || env.offline} onClick={() => run(async () => {
                    const latest = await repo.syncPendingSessionFinish();
                    if (latest) update(latest);
                  })}>Reintentar ahora</button>
                )}
              </div>
            )}
            <div className="study-view-toggle" aria-label="Vista durante el estudio">
              <button type="button" className={!roomVisible ? "selected" : ""} aria-pressed={!roomVisible} onClick={() => { setRoomVisible(false); localStorage.setItem("kusiy:study-view", "focus"); }}>Modo foco</button>
              <button type="button" className={roomVisible ? "selected" : ""} aria-pressed={roomVisible} onClick={() => { setRoomVisible(true); localStorage.setItem("kusiy:study-view", "room"); }}>Ver habitación</button>
            </div>
            {roomVisible && (
              <PersonalStudyCanvas id={studySpaceById(s.activeStudySpaceId).id} companion={s.companion} />
            )}
            <div
              className="timer"
              role="timer"
              aria-label={pendingFinish ? "Tiempo de estudio pendiente de confirmar" : "Tiempo de estudio registrado"}
            >
              {String(Math.floor(elapsed / 60)).padStart(2, "0")}
              <span>:</span>
              {String(elapsed % 60).padStart(2, "0")}
            </div>
            <button
              className="secondary"
              disabled={busy || remoteControl || !!pendingFinish}
              onClick={() =>
                run(() =>
                  command(
                    active.running_since ? "session.pause" : "session.resume",
                    { id: active.id },
                    false,
                  ),
                )
              }
            >
              {active.running_since ? <Pause size={17} /> : <Play size={17} />}{" "}
              {active.running_since ? "Pausar" : "Continuar"}
            </button>
            <ol className="steps">
              {method.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </>
        ) : slot ? (
          <>
            <h3>{slot.objective}</h3>
            <p className="fine-print">
              {method.name} · {slot.duration_minutes} minutos orientativos
            </p>
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                run(() => command("session.start", { slot_id: slot.id }, false))
              }
            >
              Empezar sesión <Play size={17} />
            </button>
          </>
        ) : (
          <form
            onSubmit={(event) => {
              const data = formData(event);
              run(() =>
                command(
                  "session.start",
                  {
                    objective: data.objective,
                    subject_id: data.subject_id || undefined,
                    method_id: data.method_id,
                    planned_minutes: Number(data.planned_minutes),
                    ...(prepared.academicItemId &&
                    data.objective.trim() === prepared.objective &&
                    data.subject_id === prepared.subjectId
                      ? { academic_item_id: prepared.academicItemId }
                      : {}),
                  },
                  false,
                ),
              );
            }}
          >
            <h3>¿Qué querés estudiar?</h3>
            {prepared.origin === "ACTIVITY" ? (
              <p className="fine-print">
                Sugerimos una actividad cercana de tu agenda. Podés cambiarla;
                estudiar no la marca como hecha.
              </p>
            ) : prepared.remembered ? (
              <p className="fine-print">
                Preparamos tus últimas preferencias. Podés cambiarlas antes de empezar.
              </p>
            ) : null}
            <Field label="Objetivo">
              <input
                name="objective"
                required
                maxLength={240}
                defaultValue={prepared.objective}
                placeholder="Por ejemplo, repasar Biología"
              />
            </Field>
            <Field label="Materia, si corresponde">
              <select name="subject_id" defaultValue={prepared.subjectId}>
                <option value="">Sin materia</option>
                {s.subjects.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Método">
              <select name="method_id" defaultValue={prepared.methodId}>
                {methods.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Duración orientativa">
              <select name="planned_minutes" defaultValue={String(prepared.plannedMinutes)}>
                {freeStudyDurations.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes} minutos
                  </option>
                ))}
              </select>
            </Field>
            <button className="primary" disabled={busy}>
              Empezar a estudiar <Play size={17} />
            </button>
          </form>
        )}
        {practice && (
          <button
            className="text-button"
            type="button"
            onClick={() => open("quiz", practice)}
          >
            Abrir una práctica de esta materia
          </button>
        )}
        {active && !remoteControl && !pendingFinish && (
          <form
            onSubmit={(e) => {
              const d = formData(e);
              run(async () => {
                const result = await repo.finishSession({
                  id: active.id,
                  feedback: d.feedback || undefined,
                  reflection: d.reflection || undefined,
                }, env.version);
                update(result);
                if (result.pendingSessionFinish)
                  notice("El cierre quedó pendiente. Se sincronizará cuando vuelva la conexión.");
                else {
                  close();
                  notice("Sesión registrada en tu historial. Podés seguir estudiando cuando quieras.");
                }
              });
            }}
          >
            <Field label="¿Cómo te fue? (opcional)">
              <select name="feedback" defaultValue="">
                <option value="">Prefiero omitirlo</option>
                <option value="EASY">Fácil</option>
                <option value="GOOD">Bien</option>
                <option value="HARD">Me costó</option>
                <option value="VERY_HARD">Muy difícil</option>
              </select>
            </Field>
            <Field label="Comentario (opcional)">
              <textarea name="reflection" maxLength={4000} />
            </Field>
            <p className="fine-print">
              Podés cerrar sin responder. Las monedas se acreditan después de
              cinco minutos reales de estudio, sin depender de esta valoración.
            </p>
            <button className="primary" disabled={busy}>
              Cerrar sesión <Check size={17} />
            </button>
          </form>
        )}
        {active && !remoteControl && !pendingFinish && (
          <button
            className="text-button"
            type="button"
            disabled={busy}
            onClick={() => {
              if (window.confirm("¿Descartar esta sesión sin registrarla?")) {
                void run(() => command("session.discard", { id: active.id }));
              }
            }}
          >
            Descartar sesión
          </button>
        )}
      </>
    );
  }
  if (name === "method") {
    const m = (selected as StudyMethod) ?? methods[0];
    return (
      <>
        <h3>{m.name}</h3>
        <Tag>
          {m.evidence === "ORGANIZACIÓN"
            ? "Herramienta de organización"
            : "Evidencia " + m.evidence.toLowerCase()}
        </Tag>
        <p>{m.description}</p>
        <ol className="steps">
          {m.steps.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ol>
        <div className="callout">
          <strong>Por ejemplo</strong>
          <p>{m.example}</p>
        </div>
        <p>{m.when}</p>
        <p className="fine-print">{m.evidence_note}</p>
      </>
    );
  }
  if (name === "checkin") {
    const done = s.checkins.find((x) => x.date === date);
    return done && done.outcome !== "UNCONFIRMED" ? (
      <>
        <Tag>CHECK-IN REGISTRADO</Tag>
        <p>{done.learned || "Sin nota de aprendizaje."}</p>
        <p>{done.news}</p>
        <p>La próxima oportunidad es mañana. Tu compa sigue acá.</p>
      </>
    ) : (
      <form
        onSubmit={(e) => {
          const d = formData(e);
          run(() => command("checkin.save", d));
        }}
      >
        <Field label="¿Qué aprendiste o pudiste hacer hoy?">
          <textarea name="learned" maxLength={2000} />
        </Field>
        <Field label="¿Apareció alguna tarea o cambió algo?">
          <textarea name="news" maxLength={2000} />
        </Field>
        <Field label="Respecto del plan de hoy">
          <select name="outcome">
            <option value="UNCONFIRMED">Todavía no quiero confirmar</option>
            <option value="DONE">Pude cumplirlo</option>
            <option value="PENDING">No lo cumplí, sin una excepción</option>
            <option value="EXCUSED">
              Hubo enfermedad, imprevisto u otro cambio
            </option>
          </select>
        </Field>
        <Field label="Si hubo un imprevisto, ¿qué cambió?">
          <input name="exception_reason" maxLength={1000} />
        </Field>
        <p className="fine-print">
          El check-in no descuenta monedas. Si algo cambió, se conserva el
          resultado para ayudarte a reorganizar el plan sin penalizaciones.
        </p>
        <button className="primary" disabled={busy}>
          Guardar check-in
        </button>
      </form>
    );
  }
  if (name === "companion")
    return (
      <>
        <div className="customizer-preview">
          <Creature companion={compa} size={210} />
          <h3>{compa.name}</h3>
        </div>
        <Field label="Nombre">
          <input
            value={compa.name}
            onChange={(e) => setCompa({ ...compa, name: e.target.value })}
            maxLength={30}
          />
        </Field>
        <Field label="Un punto de partida">
          <div className="avatar-presets">
            {avatarPresets.map((preset) => (
              <button
                key={preset.name}
                aria-label={"Elegir a " + preset.name}
                onClick={() => setCompa({ ...compa, ...preset })}
              >
                <Creature companion={{ ...compa, ...preset }} size={76} />
                <span>{preset.name}</span>
              </button>
            ))}
          </div>
        </Field>
        <Field label="Tono de piel">
          <div className="palette-options">
            {skinTones.map((p, i) => (
              <button
                key={p.name}
                aria-label={p.name}
                title={p.name}
                aria-pressed={avatarAppearance(compa).skin_tone === i}
                className={
                  avatarAppearance(compa).skin_tone === i ? "selected" : ""
                }
                style={{
                  background: p.color,
                  color: i > 3 ? "white" : "#302a29",
                }}
                onClick={() => setCompa({ ...compa, skin_tone: i })}
              >
                {avatarAppearance(compa).skin_tone === i && <Check size={16} />}
              </button>
            ))}
          </div>
        </Field>
        <div className="form-grid">
          <Field label="Presentación">
            <select
              value={avatarAppearance(compa).avatar_style}
              onChange={(e) =>
                setCompa({
                  ...compa,
                  avatar_style: e.target.value as Companion["avatar_style"],
                })
              }
            >
              <option value="boy">Chico</option>
              <option value="girl">Chica</option>
              <option value="neutral">Neutra</option>
            </select>
          </Field>
          <Field label="Peinado">
            <select
              value={avatarAppearance(compa).hair_style}
              onChange={(e) =>
                setCompa({
                  ...compa,
                  hair_style: e.target.value as Companion["hair_style"],
                })
              }
            >
              {hairStyles.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Color de cabello">
          <div className="palette-options">
            {hairColors.map((color, i) => (
              <button
                key={color.name}
                title={color.name}
                aria-label={color.name}
                aria-pressed={avatarAppearance(compa).hair_color === i}
                className={
                  avatarAppearance(compa).hair_color === i ? "selected" : ""
                }
                style={{ background: color.color, color: "white" }}
                onClick={() => setCompa({ ...compa, hair_color: i })}
              >
                {avatarAppearance(compa).hair_color === i && (
                  <Check size={16} />
                )}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Ropa de todos los días">
          <select
            value={avatarAppearance(compa).clothing_style}
            onChange={(e) =>
              setCompa({
                ...compa,
                clothing_style: e.target.value as Companion["clothing_style"],
                outfit: "none",
              })
            }
          >
            {clothingStyles.map((style) => (
              <option key={style.id} value={style.id}>
                {style.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Color de la ropa">
          <div className="palette-options">
            {clothingColors.map((color, i) => (
              <button
                key={color.name}
                title={color.name}
                aria-label={color.name}
                aria-pressed={avatarAppearance(compa).clothing_color === i}
                className={
                  avatarAppearance(compa).clothing_color === i ? "selected" : ""
                }
                style={{
                  background: color.color,
                  color: i === 6 ? "#303747" : "white",
                }}
                onClick={() => setCompa({ ...compa, clothing_color: i })}
              >
                {avatarAppearance(compa).clothing_color === i && (
                  <Check size={16} />
                )}
              </button>
            ))}
          </div>
        </Field>
        <div className="form-grid">
          <Field label="Personalidad">
            <select
              value={compa.personality}
              onChange={(e) =>
                setCompa({ ...compa, personality: e.target.value })
              }
            >
              {personalities.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </Field>
          <Field label="Luz del cuarto">
            <select
              value={compa.room_theme}
              onChange={(e) =>
                setCompa({ ...compa, room_theme: e.target.value })
              }
            >
              <option value="evening">Atardecer</option>
              <option value="day">Día</option>
              <option value="night">Noche</option>
            </select>
          </Field>
        </div>
        {(["accessory", "outfit", "decoration"] as const).map((category, i) => (
          <Field key={category} label={["Accesorio", "Ropa", "Decoración"][i]}>
            <select
              value={compa[category]}
              onChange={(e) =>
                setCompa({ ...compa, [category]: e.target.value })
              }
            >
              <option value="none">Sin objeto</option>
              {catalog
                .filter(
                  (x) => x.category === category && s.inventory.includes(x.id),
                )
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
            </select>
          </Field>
        ))}
        <button
          className="primary"
          disabled={busy}
          onClick={() => run(() => command("companion.save", compa))}
        >
          Guardar mi compa
        </button>
      </>
    );
  if (name === "chat")
    return (
      <>
        <div className={`chat-companion${pendingChat ? " thinking" : ""}`}>
          <Creature
            companion={s.companion}
            size={140}
            speaking={voice.speaking}
          />
          <div>
            <strong>
              {voice.speaking
                ? `${s.companion.name} está hablando`
                : `Hablar con ${s.companion.name}`}
            </strong>
            <p>
              La voz se genera gratis con las voces instaladas en tu
              dispositivo.
            </p>
            {voice.voiceName && <small>Voz actual: {voice.voiceName}</small>}
          </div>
        </div>
        {voice.recognitionSupported && (
          <section
            className={`live-call-panel${liveCall ? " active" : ""}`}
            aria-live="polite"
          >
            <div className="live-call-heading">
              <span className="live-call-signal" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <div>
                <strong>
                  {!liveCall
                    ? "Llamada en tiempo real"
                    : liveCallPhase === "listening"
                      ? "Te escucho…"
                      : liveCallPhase === "thinking"
                        ? `${s.companion.name} está pensando…`
                        : liveCallPhase === "speaking"
                          ? `${s.companion.name} está respondiendo`
                          : "Reconectando la llamada…"}
                </strong>
                <p>
                  {liveCall
                    ? "Hablá normalmente. Cuando hagas una pausa, tu mensaje se envía solo."
                    : `Conversá con ${s.companion.name} sin tocar el botón para cada mensaje.`}
                </p>
              </div>
            </div>
            {liveTranscript && (
              <p className="live-call-transcript">“{liveTranscript}”</p>
            )}
            <div className="live-call-actions">
              {!liveCall ? (
                <button
                  className="live-call-start"
                  type="button"
                  onClick={startLiveCall}
                >
                  <PhoneCall size={19} /> Iniciar llamada
                </button>
              ) : (
                <>
                  {liveCallPhase === "speaking" && (
                    <button
                      className="live-call-interrupt"
                      type="button"
                      onClick={interruptLiveCall}
                    >
                      <Mic size={18} /> Interrumpir y hablar
                    </button>
                  )}
                  <button
                    className="live-call-end"
                    type="button"
                    onClick={stopLiveCall}
                  >
                    <PhoneOff size={19} /> Cortar llamada
                  </button>
                </>
              )}
            </div>
          </section>
        )}
        <div className="chat-history" ref={chatHistoryRef}>
          {s.messages.length
            ? s.messages.map((m) => (
                <div key={m.id} className={"message " + m.role}>
                  <small>{m.role === "user" ? "Vos" : s.companion.name}</small>
                  <p>{m.content}</p>
                  {m.role === "assistant" && (
                    <button
                      className="voice-replay"
                      type="button"
                      onClick={() => voice.speak(spokenAgentReply(m), true)}
                      aria-label={`Escuchar la respuesta de ${s.companion.name}`}
                    >
                      <Volume2 size={16} /> Escuchar
                    </button>
                  )}
                  {!!m.actions?.length && (
                    <div
                      className="agent-action-receipts"
                      aria-label="Acciones realizadas"
                    >
                      {m.actions.map((action) => (
                        <span
                          key={action.id}
                          className={
                            action.status === "COMPLETED"
                              ? "agent-action-complete"
                              : "agent-action-needs-input"
                          }
                        >
                          {action.status === "COMPLETED" ? "✓" : "!"}{" "}
                          {action.label}
                        </span>
                      ))}
                    </div>
                  )}
                  {m.citations?.map((c) => (
                    <button
                      className="citation"
                      key={c.chunk_id}
                      onClick={() => {
                        const material = s.materials.find(
                          (x) => x.id === c.material_id,
                        );
                        if (material)
                          run(async () => {
                            await openMaterialOriginal(repo, material.path);
                          });
                      }}
                    >
                      {c.label} ↗
                    </button>
                  ))}
                </div>
              ))
            : !pendingChat && (
                <Empty>
                  Contame qué estás tratando de entender. Podemos comenzar con
                  una pista y tu primer intento.
                </Empty>
              )}
          {pendingChat && (
            <>
              <div className="message user pending-user-message">
                <small>Vos</small>
                <p>{pendingChat.content}</p>
              </div>
              <div
                className="message assistant thinking-message"
                role="status"
                aria-live="polite"
              >
                <small>{s.companion.name}</small>
                <p>
                  Está pensando
                  <span className="thinking-dots" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                </p>
              </div>
            </>
          )}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const message = chat.trim();
            if (!message || busy || liveCall) return;
            setPendingChat({ id: crypto.randomUUID(), content: message });
            setChat("");
            void run(async () => {
              try {
                const next = await repo.ai("chat", { message }, env.version);
                update(next);
                const answer = [...next.state.messages]
                  .reverse()
                  .find((messageItem) => messageItem.role === "assistant");
                if (answer) {
                  voice.speak(spokenAgentReply(answer));
                  applyAgentEffects(answer);
                }
              } finally {
                setPendingChat(null);
              }
            });
          }}
        >
          <Field label="Tu mensaje">
            <textarea
              value={chat}
              onChange={(e) => setChat(e.target.value)}
              disabled={liveCall}
              required
              maxLength={4000}
              placeholder="No entiendo cómo despejar x…"
            />
          </Field>
          <div className="chat-actions">
            {voice.recognitionSupported && (
              <button
                className="secondary"
                type="button"
                disabled={busy || liveCall}
                onClick={() =>
                  voice.listening
                    ? voice.stop()
                    : voice.listen((transcript) => setChat(transcript))
                }
              >
                {voice.listening ? <Square size={17} /> : <Mic size={17} />}
                {voice.listening ? "Detener dictado" : "Dictar mensaje"}
              </button>
            )}
            <button
              className="primary"
              disabled={busy || liveCall || !chat.trim()}
            >
              Enviar ↗
            </button>
          </div>
        </form>
        <label className="settings-check voice-setting">
          <input
            type="checkbox"
            checked={voice.enabled}
            onChange={(event) => voice.setEnabled(event.target.checked)}
          />
          {voice.enabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
          Leer en voz alta las nuevas respuestas
        </label>
        {voice.error && <p className="form-error">{voice.error}</p>}
        <p className="fine-print">
          Puede equivocarse. Verificá las explicaciones con tu material. El chat
          reciente se guarda 30 días. La voz es sintética y puede variar según
          el dispositivo.
        </p>
      </>
    );
  if (name === "material-text") return <MaterialText key={String(selected)} id={String(selected)} />;
  if (name === "upload")
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const d = new FormData(e.currentTarget),
            file = d.get("file") as File;
          run(async () => {
            update(
              await repo.upload(
                file,
                file.name,
                String(d.get("subject_id")),
                env.version,
              ),
            );
            close();
          });
        }}
      >
        <Field label="Materia">
          <select name="subject_id" required>
            {subjectOptions}
          </select>
        </Field>
        <Field label="Archivo privado (hasta 25 MB)">
          <input
            type="file"
            name="file"
            accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp"
            required
          />
        </Field>
        <p className="fine-print">
          PDF de hasta 100 páginas. Subí materiales que tengas permiso de usar.
          El original se conserva aunque falle la lectura o la búsqueda con IA.
        </p>
        <button className="primary" disabled={busy || !s.subjects.length}>
          Subir y procesar <Upload size={16} />
        </button>
      </form>
    );
  if (name === "generate")
    return (
      <form
        onSubmit={(e) => {
          const d = formData(e);
          run(async () => {
            update(
              await repo.ai(
                "quiz",
                { ...d, material_id: d.material_id || null },
                env.version,
              ),
            );
            close();
          });
        }}
      >
        <Field label="Tema">
          <input name="topic" required maxLength={200} />
        </Field>
        <Field label="Materia">
          <select name="subject_id" required>
            {subjectOptions}
          </select>
        </Field>
        <Field label="Formato">
          <select name="kind">
            <option value="QUIZ">Quiz · 5 preguntas</option>
            <option value="FLASHCARDS">Flashcards · 5 tarjetas</option>
            <option value="MOCK">Simulacro · 10 preguntas</option>
          </select>
        </Field>
        <Field label="Basado en">
          <select name="material_id">
            <option value="">
              Conocimiento general, identificado como tal
            </option>
            {s.materials
              .filter((m) => m.status === "READY")
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
          </select>
        </Field>
        <button className="primary" disabled={busy || !s.subjects.length}>
          Crear práctica <Sparkles size={17} />
        </button>
      </form>
    );
  if (name === "quiz") {
    const q = selected as Quiz,
      attempt = s.attempts.filter((a) => a.quiz_id === q.id).at(-1);
    return (
      <>
        <h3>{q.title}</h3>
        <Tag>
          {q.basis === "MATERIAL"
            ? "Basado en tu material"
            : "Práctica general"}
        </Tag>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await command("quiz.submit", { id: q.id, answers }, false);
              notice(
                "Intento registrado. Revisá la devolución y probá de nuevo.",
              );
            });
          }}
        >
          <div className="quiz-questions">
            {q.questions.map((question, i) => (
              <fieldset key={question.id}>
                <legend>
                  <span>{i + 1}.</span> {question.prompt}
                </legend>
                {question.options.length ? (
                  question.options.map((option) => (
                    <label className="answer-option" key={option}>
                      <input
                        type="radio"
                        name={question.id}
                        value={option}
                        checked={answers[question.id] === option}
                        onChange={() =>
                          setAnswers({ ...answers, [question.id]: option })
                        }
                        required
                      />
                      {option}
                    </label>
                  ))
                ) : (
                  <Field label="Tu intento">
                    <input
                      value={answers[question.id] ?? ""}
                      onChange={(e) =>
                        setAnswers({
                          ...answers,
                          [question.id]: e.target.value,
                        })
                      }
                      required
                    />
                  </Field>
                )}
                {attempt?.results
                  .filter((r) => r.question_id === question.id)
                  .map((r) => (
                    <div className="feedback" key={r.question_id}>
                      <strong>
                        {r.correct ? "Bien resuelto." : "Revisemos este paso."}
                      </strong>
                      <p>{r.explanation}</p>
                      <small>Respuesta: {r.answer}</small>
                      {q.kind === "FLASHCARDS" && (
                        <>
                          <p>
                            Compará tu intento con el reverso. La coincidencia
                            de texto no evalúa el significado.
                          </p>
                          <div className="inline">
                            <button
                              type="button"
                              className="secondary"
                              disabled={busy}
                              onClick={() =>
                                run(() =>
                                  command(
                                    "flashcard.rate",
                                    {
                                      quiz_id: q.id,
                                      question_id: question.id,
                                      remembered: true,
                                    },
                                    false,
                                  ),
                                )
                              }
                            >
                              La recordé
                            </button>
                            <button
                              type="button"
                              className="secondary"
                              disabled={busy}
                              onClick={() =>
                                run(() =>
                                  command(
                                    "flashcard.rate",
                                    {
                                      quiz_id: q.id,
                                      question_id: question.id,
                                      remembered: false,
                                    },
                                    false,
                                  ),
                                )
                              }
                            >
                              Quiero repasarla
                            </button>
                          </div>
                          <small>
                            Próximo repaso:{" "}
                            {s.flashcard_reviews?.find(
                              (x) =>
                                x.quiz_id === q.id &&
                                x.question_id === question.id,
                            )?.due_date ?? "Elegí cómo te fue"}
                          </small>
                        </>
                      )}
                    </div>
                  ))}
              </fieldset>
            ))}
          </div>
          <button className="primary" disabled={busy}>
            Revisar mi intento <Check size={16} />
          </button>
        </form>
      </>
    );
  }
  if (name === "extract")
    return (
      <>
        <form
          onSubmit={(e) => {
            const d = formData(e);
            run(async () => {
              const result = await repo.ai(
                "extract",
                { text: d.text },
                env.version,
              );
              setProposal(
                (result.proposal as { items: Record<string, unknown>[] }).items,
              );
            });
          }}
        >
          <Field label="Pegá la consigna o contá qué te pidieron">
            <textarea
              name="text"
              placeholder="El viernes tenemos evaluación de biología…"
              required
              maxLength={5000}
            />
          </Field>
          <button className="primary" disabled={busy}>
            Proponer actividades <Sparkles size={16} />
          </button>
        </form>
        {proposal?.map((item, i) => (
          <div className="list-row" key={i}>
            <div>
              <strong>{String(item.title)}</strong>
              <p>{String(item.due_date ?? "Fecha por confirmar")}</p>
            </div>
            <button
              className="secondary"
              onClick={() =>
                open("item", {
                  ...item,
                  subject_id: s.subjects[0]?.id,
                  effort_minutes: 50,
                  priority: 2,
                  difficulty: 3,
                  topics: [],
                  source: "AI_EXTRACTED",
                })
              }
            >
              Revisar y editar
            </button>
          </div>
        ))}
        <p className="fine-print">
          Siempre confirmás los datos antes de guardar. Una fecha ambigua queda
          pendiente.
        </p>
      </>
    );
  if (name === "profile")
    return (
      <form
        onSubmit={(e) => {
          const d = formData(e);
          run(() =>
            command("profile.save", {
              ...d,
              school_year: +d.school_year,
              school_day_limit: +d.school_day_limit,
              free_day_limit: +d.free_day_limit,
              autonomy_level: +d.autonomy_level,
              sleep_start: minuteOf(d.sleep_start),
              sleep_end: minuteOf(d.sleep_end),
              country: "AR",
              timezone: "America/Argentina/Buenos_Aires",
              onboarding_complete: true,
            }),
          );
        }}
      >
        <Field label="¿Cómo querés que te llamemos?">
          <input
            name="nickname"
            defaultValue={s.profile?.nickname}
            required
            maxLength={40}
          />
        </Field>
        <div className="form-grid">
          <Field label="Fecha de nacimiento">
            <input
              type="date"
              name="birth_date"
              defaultValue={s.profile?.birth_date}
              max={date}
              required
            />
          </Field>
          <Field label="Año de secundaria">
            <select
              name="school_year"
              defaultValue={s.profile?.school_year ?? 1}
            >
              {[1, 2, 3, 4, 5, 6, 7].map((x) => (
                <option key={x} value={x}>
                  {x}.º
                </option>
              ))}
            </select>
          </Field>
          <Field label="Me voy a dormir">
            <input
              type="time"
              name="sleep_start"
              defaultValue={clock(s.profile?.sleep_start ?? 1320)}
              required
            />
          </Field>
          <Field label="Me despierto">
            <input
              type="time"
              name="sleep_end"
              defaultValue={clock(s.profile?.sleep_end ?? 420)}
              required
            />
          </Field>
        </div>
        <div className="form-grid">
          <Field label="Máximo por día escolar (min)">
            <input
              type="number"
              name="school_day_limit"
              min="10"
              max="180"
              defaultValue={s.profile?.school_day_limit ?? 60}
              required
            />
          </Field>
          <Field label="Máximo por día libre (min)">
            <input
              type="number"
              name="free_day_limit"
              min="10"
              max="240"
              defaultValue={s.profile?.free_day_limit ?? 90}
              required
            />
          </Field>
        </div>
        <Field label="Ayuda para organizarme">
          <select
            name="autonomy_level"
            defaultValue={s.profile?.autonomy_level ?? 2}
          >
            <option value="1">1 · Guía paso a paso</option>
            <option value="2">2 · Propuestas para elegir</option>
            <option value="3">3 · Organizo y pido revisión</option>
            <option value="4">4 · Organizo por mi cuenta</option>
          </select>
        </Field>
        <p className="fine-print">
          Las pruebas iniciales usan adultos y datos ficticios hasta completar
          las revisiones acordadas.
        </p>
        <button className="primary" disabled={busy}>
          Guardar perfil
        </button>
      </form>
    );
  if (name === "memory") {
    const m = selected as Memory;
    return (
      <form
        onSubmit={(e) => {
          const d = formData(e);
          run(() => command("memory.save", { ...m, ...d }));
        }}
      >
        <Field label="Información que querés recordar">
          <textarea
            name="content"
            defaultValue={m?.content}
            required
            maxLength={4000}
          />
        </Field>
        <Field label="Tipo">
          <select name="category" defaultValue={m?.category ?? "PREFERENCE"}>
            <option value="PREFERENCE">Preferencia</option>
            <option value="TOPIC">Tema por trabajar</option>
            <option value="PROGRESS">Progreso</option>
          </select>
        </Field>
        <button className="primary" disabled={busy}>
          Guardar recuerdo
        </button>
      </form>
    );
  }
  if (name === "settings")
    return (
      <>
        <MotionPreference />
        <button className="settings-row" onClick={() => open("profile")}>
          Perfil, descanso y autonomía →
        </button>
        <button
          className="settings-row"
          onClick={() => open("companion", s.companion)}
        >
          Mi compañero →
        </button>
        <form
          onSubmit={(e) => {
            const d = formData(e);
            run(() =>
              command("preferences.save", {
                checkin_enabled: d.checkin_enabled === "on",
                daily_study_enabled: d.daily_study_enabled === "on",
                daily_study_minute: minuteOf(d.daily_study_minute),
                weekends: d.weekends === "on",
                checkin_minute: minuteOf(d.checkin_minute),
                quiet_start: minuteOf(d.quiet_start),
                quiet_end: minuteOf(d.quiet_end),
              }),
            );
          }}
        >
          <h3>Recordatorios en las apps móviles</h3>
          <label className="checkbox">
            <input
              type="checkbox"
              name="daily_study_enabled"
              defaultChecked={s.preferences.daily_study_enabled ?? false}
            />
            Un recordatorio diario para estudiar
          </label>
          <Field label="Horario habitual de estudio">
            <input
              type="time"
              name="daily_study_minute"
              defaultValue={clock(s.preferences.daily_study_minute ?? 1020)}
              required
            />
          </Field>
          <label className="checkbox">
            <input
              type="checkbox"
              name="checkin_enabled"
              defaultChecked={s.preferences.checkin_enabled}
            />
            Recordarme el check-in si no uso el aviso diario
          </label>
          <Field label="Horario preferido">
            <input
              type="time"
              name="checkin_minute"
              defaultValue={clock(s.preferences.checkin_minute)}
              required
            />
          </Field>
          <div className="form-grid">
            <Field label="No molestar desde">
              <input
                name="quiet_start"
                type="time"
                defaultValue={clock(s.preferences.quiet_start)}
                required
              />
            </Field>
            <Field label="Hasta">
              <input
                name="quiet_end"
                type="time"
                defaultValue={clock(s.preferences.quiet_end)}
                required
              />
            </Field>
          </div>
          <label className="checkbox">
            <input
              type="checkbox"
              name="weekends"
              defaultChecked={s.preferences.weekends}
            />
            También fines de semana
          </label>
          <button className="secondary" disabled={busy}>
            Guardar preferencias
          </button>
        </form>
        {!!(s.studyReminders ?? []).length && (
          <section
            className="scheduled-reminders"
            aria-label="Recordatorios programados"
          >
            <h3>Recordatorios creados con tu compa</h3>
            {(s.studyReminders ?? []).map((reminder) => (
              <div className="scheduled-reminder" key={reminder.id}>
                <div>
                  <strong>{reminder.title}</strong>
                  <small>
                    {reminder.date
                      ? `${reminder.date} · ${clock(reminder.minute)}`
                      : `${days[reminder.day_of_week ?? 0]} · ${clock(reminder.minute)}`}
                    {!reminder.enabled ? " · desactivado" : ""}
                  </small>
                </div>
                {reminder.enabled && (
                  <button
                    type="button"
                    className="text-button"
                    disabled={busy}
                    onClick={() =>
                      run(() =>
                        command("reminder.disable", { id: reminder.id }, false),
                      )
                    }
                  >
                    Desactivar
                  </button>
                )}
              </div>
            ))}
          </section>
        )}
        <button className="settings-row" onClick={() => open("privacy")}>
          Privacidad y datos →
        </button>
        <button className="settings-row" onClick={() => open("support")}>
          Ayuda y soporte →
        </button>
        <SignOutButton />
      </>
    );
  if (name === "privacy")
    return (
      <>
        <p>
          La cuenta guarda actividades, prácticas, preferencias y archivos
          privados. La IA recibe contexto académico para ayudarte. El chat
          reciente tiene una retención de 30 días.
        </p>
        <p className="callout">
          Entorno de desarrollo. La identificación del responsable, el
          consentimiento y las transferencias internacionales requieren revisión
          jurídica antes de incorporar alumnos.
        </p>
        {consentRequirement(s.profile?.birth_date).required && (
          <div className="callout">
            {env.consent?.recorded ? (
              <p>Familia verificada. Servicio: {env.consent.capabilities?.service ? "aceptado" : "pendiente"}; IA: {env.consent.capabilities?.ai ? "autorizada" : "sin permiso"}; encuentros: {env.consent.capabilities?.social ? "autorizados" : "sin permiso"}.</p>
            ) : env.consent?.pending ? (
              <p>
                La solicitud está pendiente de verificación por un adulto
                responsable mediante un canal independiente.
              </p>
            ) : (
              <p>
                Un adulto responsable tiene que registrar el consentimiento
                desde la bienvenida o acá, cuando la beta para menores esté
                habilitada.
              </p>
            )}
          </div>
        )}
        <button
          className="secondary"
          disabled={busy}
          onClick={() =>
            run(async () => {
              const data = await repo.exportData(),
                blob = new Blob([JSON.stringify(data, null, 2)], {
                  type: "application/json",
                }),
                a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = "kusiy-datos.json";
              a.click();
              URL.revokeObjectURL(a.href);
            })
          }
        >
          Exportar mis datos ↓
        </button>
        <button
          className="text-button danger"
          onClick={() => open("delete-account")}
        >
          Eliminar mi cuenta
        </button>
      </>
    );
  if (name === "delete-account")
    return (
      <form
        onSubmit={(e) => {
          const d = formData(e);
          run(async () => {
            if (d.confirmation !== "ELIMINAR")
              throw Error("Escribí ELIMINAR para confirmar.");
            await repo.deleteAccount();
            location.assign("/");
          });
        }}
      >
        <p>
          Se eliminarán tus datos, archivos y progreso. Esta acción no se puede
          deshacer.
        </p>
        <Field label="Escribí ELIMINAR">
          <input name="confirmation" required autoComplete="off" />
        </Field>
        <button className="primary danger" disabled={busy}>
          Eliminar definitivamente
        </button>
      </form>
    );
  if (name === "delete-material")
    return (
      <>
        <p>
          Se borrará el archivo, sus fragmentos y las prácticas derivadas de ese
          material.
        </p>
        <button
          className="primary danger"
          disabled={busy}
          onClick={() =>
            run(() => command("material.delete", { id: selected }))
          }
        >
          Eliminar archivo y datos derivados
        </button>
      </>
    );
  if (name === "notifications")
    return s.notifications.length ? (
      <>
        {s.notifications.map((n) => {
          const snoozed = s.studyReminders.find((r) => r.snoozed_from === n.id && r.enabled);
          return (
            <div className="notification-entry" key={n.id}>
              <button
                className="settings-row"
                onClick={() =>
                  run(async () => {
                    await command("notification.read", { id: n.id });
                    go(n.route);
                  })
                }
              >
                <div>
                  <strong>{n.title}</strong>
                  <p>{n.body}</p>
                </div>
                ↗
              </button>
              {snoozed && <p role="status">Pospuesto para {snoozed.date} a las {clock(snoozed.minute)}.</p>}
              <div className="notification-snooze" aria-label={`Posponer ${n.title}`}>
                {!n.read_at && (
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => run(() => command("notification.read", { id: n.id }, false))}
                  >
                    Ignorar
                  </button>
                )}
                {[15, 30, 60].map((minutes) => (
                  <button
                    className="secondary"
                    key={minutes}
                    disabled={busy}
                    onClick={() => run(() => command("notification.snooze", { id: n.id, minutes }, false))}
                  >
                    {minutes} min
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </>
    ) : (
      <Empty>
        No tenés avisos pendientes. Los recordatorios nativos se habilitan en
        Android o iOS.
      </Empty>
    );
  return null;
}
