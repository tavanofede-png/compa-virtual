"use client";
import {
  ArrowRight,
  ChevronRight,
  Clock3,
  Plus,
  CalendarDays,
  BookOpen,
  MessageCircle,
  Shirt,
  House,
  Brain,
  Settings2,
} from "lucide-react";
import {
  homeSummary,
  dateLabel,
  methodById,
  localNow,
  isQuiet,
  activePet,
  petDefinition,
} from "@compa/domain";
import { useApp } from "./context";
import { Room, WorldCanvas } from "./Room";

export function HomeScreen() {
  const { env, open, go, run, command, busy, modal } = useApp();
  const s = env.state,
    day = homeSummary(s),
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
    if (day.next) open("focus", day.next);
    else if (!day.pending.length) open(s.subjects.length ? "item" : "subjects");
    else if (day.plan) go("agenda");
    else
      void run(async () => {
        await command("plan.propose", {}, false);
        open("plan");
      });
  };
  return (
    <div className="home-screen">
      <header className="home-greeting">
        <h1>
          Hola, {s.profile?.nickname || "bienvenido"}{" "}
          <span aria-hidden="true">👋</span>
        </h1>
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
          <div className="home-activities">
            {day.pending.slice(0, 2).map((item, i) => (
              <button
                key={item.id}
                className="home-activity"
                onClick={() => open("item", item)}
              >
                <span className={"subject-tile tone-" + i}>
                  {item.kind === "EXAM" ? <BookOpen /> : <CalendarDays />}
                </span>
                <span>
                  <strong>
                    {s.subjects.find((x) => x.id === item.subject_id)?.name ||
                      item.title}
                  </strong>
                  <small>{item.title}</small>
                  <span>{dateLabel(item.due_date)}</span>
                </span>
                <ChevronRight aria-hidden="true" />
              </button>
            ))}
            {!day.pending.length && (
              <div className="home-empty">
                <span className="subject-tile tone-0">
                  <Plus />
                </span>
                <h3>Hagamos lugar a tu primer paso.</h3>
                <p>
                  Sumá una materia y lo que tenés que hacer. Tu compa te ayuda a
                  organizarlo.
                </p>
              </div>
            )}
          </div>
          {day.next && (
            <p className="next-method">
              Siguiente paso · {methodById(day.next.method_id).name}
            </p>
          )}
          <button
            className="primary home-start"
            disabled={busy}
            onClick={start}
          >
            {day.next
              ? "Empezar sesión"
              : !day.pending.length
                ? "Agregar mi primera actividad"
                : day.plan
                  ? "Ver mi agenda"
                  : "Preparar mi plan"}
            <ArrowRight />
          </button>
          <button className="home-day-link" onClick={() => go("today")}>
            Ver mi día completo <ChevronRight size={18} />
          </button>
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
              hint: pet ? definition.description : "Tu golden inicial es gratuito",
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
              hint: "Seis espacios para hacer tuyos",
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
    </div>
  );
}
