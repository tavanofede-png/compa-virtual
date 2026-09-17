"use client";
import { useEffect, useRef, useState } from "react";
import {
  createSharedRoomSession,
  type CollaborationRepository,
  type SharedRoomConnection,
} from "@compa/client";
import {
  characterById,
  sharedSeats,
  sharedSpacePreview,
  sharedSpaces,
  sharedTimerSeconds,
  type GroupSessionDetail,
  type SharedRoomPresence,
  type SharedSpaceId,
} from "@compa/domain";
import { Box, Hand, Users, Pause, Play, RefreshCw } from "lucide-react";
import "./shared-room.css";

type Runtime = ReturnType<typeof createSharedRoomSession>;
export function SharedSpaceCanvas({
  id,
  people,
  onError,
}: {
  id: SharedSpaceId;
  people: SharedRoomPresence[];
  onError: (error: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    peopleRef = useRef(people),
    errorRef = useRef(onError);
  const worldRef = useRef<Awaited<
    ReturnType<typeof import("@compa/world3d").createSharedSpaceWorld>
  > | null>(null);
  peopleRef.current = people;
  errorRef.current = onError;
  useEffect(() => {
    void worldRef.current
      ?.setParticipants(people)
      .catch((e) => errorRef.current(e.message));
  }, [people]);
  useEffect(() => {
    const abort = new AbortController();
    let cleanup = () => {};
    let alive = true;
    void (async () => {
      const T = await import("three"),
        { OrbitControls } =
          await import("three/addons/controls/OrbitControls.js"),
        { createSharedSpaceWorld } = await import("@compa/world3d");
      if (!host.current || !alive) return;
      const renderer = new T.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: "low-power",
      });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;
      host.current.appendChild(renderer.domElement);
      cleanup = () => {
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
      };
      const world = await createSharedSpaceWorld(id, undefined, abort.signal);
      if (!alive) {
        world.dispose();
        cleanup();
        return;
      }
      worldRef.current = world;
      const controls = new OrbitControls(world.camera, renderer.domElement);
      controls.target.copy(world.target);
      controls.enablePan = false;
      controls.minDistance = 8;
      controls.maxDistance = 22;
      controls.maxPolarAngle = Math.PI * 0.47;
      controls.minPolarAngle = 0.35;
      controls.minAzimuthAngle = -0.45;
      controls.maxAzimuthAngle = 1.35;
      controls.update();
      const resize = new ResizeObserver(() => {
        if (!host.current) return;
        const { width, height } = host.current.getBoundingClientRect();
        renderer.setSize(width, height);
        world.camera.aspect = width / Math.max(height, 1);
        world.camera.updateProjectionMatrix();
      });
      resize.observe(host.current);
      let frame = 0,
        last = 0,
        inView = true;
      const observer = new IntersectionObserver(([e]) => {
        inView = e.isIntersecting;
        last = 0;
      });
      observer.observe(host.current);
      const motion = matchMedia("(prefers-reduced-motion: reduce)");
      const render = (time: number) => {
        if (!alive) return;
        frame = requestAnimationFrame(render);
        if (document.hidden || !inView) {
          last = 0;
          return;
        }
        if (time - last < 1000 / 30) return;
        world.update(last ? (time - last) / 1000 : 0, motion.matches);
        last = time;
        renderer.render(world.scene, world.camera);
      };
      frame = requestAnimationFrame(render);
      cleanup = () => {
        cancelAnimationFrame(frame);
        resize.disconnect();
        observer.disconnect();
        controls.dispose();
        worldRef.current = null;
        world.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
      };
      await world.setParticipants(peopleRef.current);
    })().catch((e) => {
      if (alive) errorRef.current(e.message);
      cleanup();
    });
    return () => {
      alive = false;
      abort.abort();
      cleanup();
    };
  }, [id]);
  return (
    <div
      className="shared-canvas"
      ref={host}
      role="img"
      aria-label="Sala 3D compartida. Los nombres y asientos están disponibles debajo."
    />
  );
}

export function SharedRoom({
  repo,
  initial,
  userId,
  onDetail,
}: {
  repo: CollaborationRepository;
  initial: GroupSessionDetail;
  userId: string;
  onDetail: (detail: GroupSessionDetail | null) => void;
}) {
  const [state, setState] = useState<SharedRoomConnection>({
    detail: initial,
    entered: false,
    busy: false,
    error: "",
    connected: false,
    serverOffset: Date.parse(initial.server_time) - Date.now(),
  });
  const runtime = useRef<Runtime | null>(null),
    callback = useRef(onDetail);
  callback.current = onDetail;
  const [now, setNow] = useState(Date.now()),
    [three, setThree] = useState(false),
    [assetError, setAssetError] = useState(""),
    [goal, setGoal] = useState("");
  useEffect(() => {
    const session = createSharedRoomSession(repo, initial, (next) => {
      setState(next);
      if (next.detail) callback.current(next.detail);
      else if (next.accessRevoked) callback.current(null);
    });
    runtime.current = session;
    const visible = () => session.visible(!document.hidden);
    document.addEventListener("visibilitychange", visible);
    visible();
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      document.removeEventListener("visibilitychange", visible);
      clearInterval(tick);
      runtime.current = null;
      session.dispose();
    };
  }, [repo, initial.session.id]);
  useEffect(() => {
    void runtime.current?.refresh();
  }, [initial.session.revision]);
  const detail = state.detail,
    room = detail?.room,
    id = initial.session.id,
    space = sharedSpaces.find(
      (s) => s.id === initial.session.space_template_id,
    )!;
  const serverNow = now + state.serverOffset,
    people = (room?.presence ?? []).filter(
      (p) => Date.parse(p.expires_at) > serverNow,
    ),
    me = people.find((p) => p.user_id === userId);
  const closed =
    detail && !["scheduled", "active"].includes(detail.session.status);
  const early =
    detail?.session.status === "scheduled" &&
    Date.parse(detail.session.scheduled_start_at) > serverNow + 15 * 60000;
  const seconds = sharedTimerSeconds(room?.timer ?? null, serverNow),
    timer = room?.timer,
    disabled = state.busy || !state.connected;
  const sendTimer = (operation: "focus" | "break" | "pause" | "resume") =>
    void runtime.current?.command({
      action: "room.timer",
      session_id: id,
      revision: timer?.revision ?? 0,
      operation,
    });
  return (
    <section className="shared-room" aria-label="Sala del encuentro">
      <div className="shared-heading">
        <div>
          <span className="eyebrow">UN LUGAR PARA HACER EQUIPO</span>
          <h2>{space.name}</h2>
        </div>
        <span className="shared-count">
          <Users size={18} />
          {people.length}/6
        </span>
      </div>
      <div className="shared-stage">
        {three && !assetError && state.connected ? (
          <SharedSpaceCanvas
            id={space.id}
            people={people}
            onError={setAssetError}
          />
        ) : (
          <img
            src={sharedSpacePreview(space.id)}
            alt={space.name + " con seis lugares para compartir el estudio"}
          />
        )}
        <button
          className="shared-view"
          onClick={() => {
            setAssetError("");
            setThree(!three);
          }}
          aria-pressed={three}
        >
          <Box size={18} />
          {three ? "Vista liviana" : "Explorar en 3D"}
        </button>
      </div>
      {assetError && (
        <p role="status">
          No pudimos cargar la vista 3D. Podés usar todos los controles desde la
          vista liviana.
        </p>
      )}
      <div className="shared-entry">
        <div>
          <strong>
            {closed
              ? "Encuentro finalizado"
              : state.entered
                ? "Ya estás en la sala"
                : early
                  ? "Tu lugar está reservado"
                  : "¿Nos ponemos a estudiar?"}
          </strong>
          <p>
            {early
              ? "La sala abre 15 minutos antes del encuentro."
              : state.connected
                ? "Solo aparecen quienes entraron a esta sala."
                : "Comprobando conexión y acceso…"}
          </p>
        </div>
        {!closed &&
          !early &&
          (state.entered ? (
            <button
              className="secondary"
              disabled={state.busy}
              onClick={() => void runtime.current?.leave()}
            >
              Salir de la sala
            </button>
          ) : (
            <button
              className="primary"
              disabled={disabled}
              onClick={() => void runtime.current?.enter()}
            >
              Entrar en la sala
            </button>
          ))}
      </div>
      {state.error && (
        <div className="shared-error" role="alert">
          <p>{state.error}</p>
          <button
            className="secondary"
            onClick={() => void runtime.current?.refresh()}
          >
            <RefreshCw size={16} />
            Reintentar
          </button>
          {!state.entered && !closed && (
            <button
              className="secondary"
              onClick={() => void runtime.current?.enter(true)}
            >
              Usar esta pantalla
            </button>
          )}
        </div>
      )}
      <fieldset className="shared-seats" disabled={disabled || !state.entered}>
        <legend>Elegí dónde sentarte</legend>
        {sharedSeats(space.id).map((seat, i) => {
          const occupant = people.find((p) => p.seat_id === seat.id),
            name = detail?.participants.find(
              (p) => p.user_id === occupant?.user_id,
            )?.nickname,
            own = occupant?.user_id === userId;
          return (
            <button
              key={seat.id}
              type="button"
              className={own ? "is-own" : ""}
              disabled={!!occupant && !own}
              aria-pressed={own}
              onClick={() => void runtime.current?.seat(seat.id)}
            >
              {occupant?.appearance.character_id ? (
                <img
                  src={
                    "/selection/characters/" +
                    characterById(occupant.appearance.character_id).id +
                    ".webp"
                  }
                  alt=""
                />
              ) : (
                <span className="shared-seat-number">{i + 1}</span>
              )}
              <span>
                <strong>{name ?? "Lugar libre"}</strong>
                <small>
                  {own ? "Vos" : occupant ? "En la sala" : "Asiento " + (i + 1)}
                  {occupant?.hand_raised ? " · Mano levantada" : ""}
                </small>
              </span>
              {occupant?.reaction &&
                occupant.reaction_at &&
                serverNow - Date.parse(occupant.reaction_at) < 5000 && (
                  <span
                    className="shared-reaction"
                    aria-label={occupant.reaction}
                  >
                    {
                      (
                        {
                          hello: "👋",
                          thanks: "💛",
                          idea: "💡",
                          agree: "👍",
                          celebrate: "🎉",
                          question: "❔",
                        } as Record<string, string>
                      )[occupant.reaction]
                    }
                  </span>
                )}
            </button>
          );
        })}
      </fieldset>
      {state.entered && (
        <div className="shared-social">
          <label>
            Tu estado
            <select
              value={me?.activity ?? "available"}
              disabled={disabled}
              onChange={(e) =>
                void runtime.current?.activity(
                  e.target.value as "available" | "focused" | "break",
                )
              }
            >
              <option value="available">Disponible</option>
              <option value="focused">Concentrado</option>
              <option value="break">En pausa</option>
            </select>
          </label>
          <button
            className="secondary"
            aria-pressed={me?.hand_raised ?? false}
            disabled={disabled}
            onClick={() => void runtime.current?.hand(!me?.hand_raised)}
          >
            <Hand size={18} />
            {me?.hand_raised ? "Bajar la mano" : "Levantar la mano"}
          </button>
          <div className="shared-reactions" aria-label="Reacciones">
            {(
              [
                ["hello", "👋", "Saludar"],
                ["thanks", "💛", "Gracias"],
                ["idea", "💡", "Tengo una idea"],
                ["agree", "👍", "De acuerdo"],
                ["celebrate", "🎉", "Celebrar"],
                ["question", "❔", "Tengo una pregunta"],
              ] as const
            ).map(([r, icon, label]) => (
              <button
                key={r}
                title={label}
                aria-label={label}
                disabled={
                  disabled ||
                  !!(
                    me?.reaction_at &&
                    serverNow - Date.parse(me.reaction_at) < 3000
                  )
                }
                onClick={() => void runtime.current?.react(r)}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>
      )}
      {detail && (
        <div className="shared-work">
          <section className="shared-timer">
            <span>
              {timer?.phase === "break"
                ? "Una pausa juntos"
                : "Tiempo para concentrarse"}
            </span>
            <output aria-label="Tiempo restante">
              {String(Math.floor(seconds / 60)).padStart(2, "0")}
              <span>:</span>
              {String(seconds % 60).padStart(2, "0")}
            </output>
            <p>
              {detail.session.status !== "active"
                ? "Quien organiza inicia el encuentro."
                : seconds === 0
                  ? "Bloque terminado. Pueden elegir el próximo paso."
                  : timer?.running
                    ? "El mismo tiempo para todo el grupo."
                    : "El temporizador está en pausa."}
            </p>
            {detail.session.host_id === userId &&
              detail.session.status === "active" && (
                <div className="shared-timer-actions">
                  <button
                    className="secondary"
                    disabled={disabled || seconds === 0}
                    onClick={() =>
                      sendTimer(timer?.running ? "pause" : "resume")
                    }
                  >
                    {timer?.running ? <Pause size={16} /> : <Play size={16} />}{" "}
                    {timer?.running ? "Pausar" : "Continuar"}
                  </button>
                  <button
                    className="secondary"
                    disabled={disabled}
                    onClick={() => sendTimer("focus")}
                  >
                    Enfoque · 25 min
                  </button>
                  <button
                    className="secondary"
                    disabled={disabled}
                    onClick={() => sendTimer("break")}
                  >
                    Descanso · 5 min
                  </button>
                </div>
              )}
          </section>
          <section className="shared-goals">
            <h3>Lo que queremos lograr</h3>
            <p>{detail.session.objective}</p>
            {(room?.goals ?? []).map((g) => (
              <label key={g.id}>
                <input
                  type="checkbox"
                  checked={g.done}
                  disabled={disabled || !!closed}
                  onChange={() =>
                    void runtime.current?.command({
                      action: "room.goal.toggle",
                      session_id: id,
                      goal_id: g.id,
                      revision: g.revision,
                      done: !g.done,
                    })
                  }
                />
                <span>{g.title}</span>
              </label>
            ))}
            {!closed && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!goal.trim()) return;
                  if (
                    await runtime.current?.command({
                      action: "room.goal.add",
                      session_id: id,
                      title: goal.trim(),
                    })
                  )
                    setGoal("");
                }}
              >
                <input
                  aria-label="Nuevo objetivo compartido"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  maxLength={160}
                  placeholder="Un paso concreto para hoy"
                  required
                />
                <button
                  className="secondary"
                  disabled={disabled || (room?.goals.length ?? 0) >= 20}
                >
                  Agregar
                </button>
              </form>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
