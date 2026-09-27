"use client";
import {
  ArrowRight,
  Clock3,
  ChevronRight,
  MessageCircle,
  Shirt,
  House,
  Brain,
  Settings2,
} from "lucide-react";
import {
  homeSummary,
  nextStudyAction,
  methodById,
  localNow,
  isQuiet,
  activePet,
  petDefinition,
  rooms,
  roomById,
} from "@compa/domain";
import { useApp } from "./context";
import { Room, WorldCanvas } from "./Room";

export function HomeScreen() {
  const { env, open, go, run, command, busy, modal } = useApp();
  const s = env.state,
    day = homeSummary(s),
    action = nextStudyAction(s),
    now = localNow(s.profile?.timezone);
  const pet = activePet(s);
  const petState = pet
    ? {
        definitionId: pet.petDefinitionId,
        instanceId: pet.id,
        name: pet.name,
        preferences: s.petPreferences,
        habitatId: s.equippedPetSetup.bedId,
        toyIds: s.equippedPetSetup.toyIds,
        accessoryId: s.equippedPetSetup.accessoryId ?? undefined,
      }
    : undefined;
  const start = () => {
    if (action.kind === "resume-session") open("focus");
    else if (action.kind === "start-session" && action.slot)
      open("focus", action.slot);
    else if (action.kind === "free-study") open("focus");
    else if (action.kind === "review-plan") open("plan");
    else if (action.kind === "practice") {
      const quiz = s.quizzes.find((item) => item.id === action.quizId);
      if (quiz) open("quiz", quiz);
      else open("generate");
    } else if (action.kind === "see-agenda") go("agenda");
    else
      void run(async () => {
        await command("plan.propose", {}, false);
        open("plan");
      });
  };
  return (
    <div className="home-screen">
      <header className="home-greeting">
        <h1>Hola, {s.profile?.nickname || "bienvenido"}</h1>
        <p>Tu mundo. Tu manera de aprender.</p>
      </header>
      <div className="home-composition">
        <section className="home-world" aria-label="Tu habitación">
          <Room
            companion={s.companion}
            onTalk={() => open("chat")}
            active={!modal || modal === "chat"}
            motionContext={{
              talking: modal === "chat",
              studying: modal === "focus",
              celebration: s.xp,
              resting: isQuiet(
                now.hour * 60 + now.minute,
                s.profile?.sleep_start ?? 1320,
                s.profile?.sleep_end ?? 420,
              ),
            }}
            petState={petState}
          />
        </section>
        <section className="home-today" aria-labelledby="home-today-title">
          <div className="home-today-heading">
            <div>
              <h2 id="home-today-title">HOY</h2>
              <p>
                Pequeños pasos.
                <br />
                Grandes logros.
              </p>
            </div>
            <div className="time-bubble">
              <Clock3 aria-hidden="true" />
              <span>
                Tu plan de hoy<strong>{day.minutes} minutos</strong>
              </span>
            </div>
          </div>
          <div className="home-day-snapshot" aria-label="Resumen académico de hoy">
            <p>{day.progressSummary}</p>
            <p>{day.deadlineSummary}</p>
            {day.routineTime && (
              <p>Tu horario habitual de estudio: {day.routineTime}</p>
            )}
          </div>
          <div className="home-next-summary">
            <span>PRÓXIMO PASO</span>
            <strong>{action.cta}</strong>
            <p>{action.detail}</p>
          </div>
          {action.kind === "start-session" && day.next && (
            <p className="next-method">
              Siguiente paso · {methodById(day.next.method_id).name}
            </p>
          )}
          <button
            className="primary home-start"
            disabled={busy}
            onClick={start}
          >
            {action.cta}
            <ArrowRight />
          </button>
          {action.kind !== "see-agenda" && (
            <button className="home-day-link" onClick={() => go("agenda")}>
              Abrir calendario <ChevronRight size={18} />
            </button>
          )}
        </section>
      </div>
      <section className="home-checkin">
        <div>
          <p className="eyebrow">A TU RITMO</p>
          <h2>¿Cómo viene tu día?</h2>
          <p>Si algo cambió, podemos acomodar el plan.</p>
        </div>
        <button className="secondary" onClick={() => open("checkin")}>
          {day.checkedIn ? "Ver mi check-in" : "Hacer check-in"}
          <ArrowRight size={18} />
        </button>
      </section>
    </div>
  );
}

export function CompaScreen() {
  const { env, open, go } = useApp();
  const c = env.state.companion;
  const pet = activePet(env.state);
  const definition = petDefinition(pet?.petDefinitionId);
  const activeRoom = roomById(c.room_style);
  return (
    <div className="compa-screen">
      <header className="page-heading">
        <div>
          <p className="eyebrow">MISMO EQUIPO. A TU MANERA.</p>
          <h1>Tu compa, {c.name}.</h1>
          <p>Un espacio que también habla de vos.</p>
        </div>
      </header>
      <div className="compa-hub">
        <div className="compa-showcase">
          <WorldCanvas companion={c} kind="avatar" />
        </div>
        <div className="compa-hub-actions">
          <button className="primary" onClick={() => open("chat")}>
            <MessageCircle />
            Conversar con {c.name}
          </button>
          {[
            {
              icon: House,
              label: pet ? `Mi mascota: ${pet.name}` : "Elegir mi mascota",
              hint: pet
                ? definition.description
                : "Tu golden inicial es gratuito",
              action: () => open("pet"),
            },
            {
              icon: Shirt,
              label: "Personaje y vestuario",
              hint: "Encontrá tu combinación",
              action: () => open("companion"),
            },
            {
              icon: House,
              label: "Mi habitación",
              hint: `${rooms.length} espacios para hacer tuyos`,
              action: () => open("companion"),
            },
            {
              icon: Brain,
              label: "Memoria académica",
              hint: "Revisá lo que tu compa recuerda",
              action: () => go("memory"),
            },
            {
              icon: Settings2,
              label: "Mi cuenta y preferencias",
              hint: "Descanso, avisos y privacidad",
              action: () => open("settings"),
            },
          ].map(({ icon: Icon, label, hint, action }) => (
            <button className="compa-hub-link" onClick={action} key={label}>
              <Icon />
              <span>
                <strong>{label}</strong>
                <small>{hint}</small>
              </span>
              <ChevronRight />
            </button>
          ))}
        </div>
      </div>
      <section className="personal-room-library">
        <div className="section-heading">
          <div>
            <p className="eyebrow">TU LUGAR TAMBIÉN CUENTA TU HISTORIA</p>
            <h2>Habitaciones personales.</h2>
          </div>
          <span>{rooms.length} ambientes</span>
        </div>
        <div className="personal-room-grid">
          {rooms.map((room) => (
            <button
              key={room.id}
              className={activeRoom.id === room.id ? "active" : ""}
              onClick={() => open("companion")}
            >
              <span className="personal-room-image">
                <img
                  src={`/selection/rooms/${room.id}.webp`}
                  alt={`Vista de ${room.name}`}
                />
                {activeRoom.id === room.id && <small>ACTIVA</small>}
              </span>
              <span>
                <strong>{room.name}</strong>
                <small>{room.description}</small>
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
