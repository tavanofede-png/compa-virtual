"use client";
import { useState, type ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Sparkles,
  Check,
  Trophy,
} from "lucide-react";
import { characterIds, selectCharacter } from "@compa/domain";
import { WorldCanvas } from "./Room";
const people = characterIds;
const rooms = [
  ["cozy", "Cozy moderno"],
  ["minimalista", "Minimalista"],
  ["tecnologia", "Tecnología"],
  ["naturaleza", "Naturaleza"],
  ["urbano", "Urbano"],
  ["biblioteca-moderna", "Biblioteca moderna"],
];
export function Landing({
  register,
  login,
  demo,
  onboarding,
  children,
}: {
  register: () => void;
  login: () => void;
  demo: () => void;
  onboarding: () => void;
  children: ReactNode;
}) {
  const [person, setPerson] = useState("milo"),
    [room, setRoom] = useState("cozy"),
    [interactive, setInteractive] = useState(false);
  const c = {
    ...selectCharacter(person as Parameters<typeof selectCharacter>[0]),
    room_style: room as "cozy",
  };
  return (
    <main className="landing">
      <header className="landing-nav">
        <a href="#welcome" className="brand">
          <span className="brand-mark">c.</span>compa virtual
        </a>
        <button className="text-button" onClick={login}>
          Ingresar <ArrowUpRight size={18} />
        </button>
      </header>
      <section className="landing-hero" id="welcome">
        <div className="landing-intro">
          <p className="eyebrow">UN PASO A LA VEZ</p>
          <h1>
            Tu mundo.
            <br />
            Tu manera
            <br />
            de aprender.
          </h1>
          <p>
            Un compa para organizar la semana, entender lo difícil y celebrar lo
            que vas aprendiendo.
          </p>
          <button className="primary" onClick={register}>
            Crear mi espacio <ArrowRight />
          </button>
          <button className="text-button" onClick={demo}>
            Explorar la demo <ArrowUpRight size={18} />
          </button>
          <small>
            Demostración con datos ficticios, guardados en este dispositivo.
          </small>
        </div>
        <div className="landing-hero-art">
          <img
            src="/selection/rooms/cozy.webp"
            width="1200"
            height="900"
            alt="Habitación Cozy con cama, plantas y un escritorio de estudio"
          />
          <img
            className="landing-milo"
            src="/selection/characters/milo.webp"
            width="500"
            height="600"
            alt="Milo, uno de tus posibles compañeros"
          />
          <span className="landing-art-caption">
            Hacé lugar para tu próximo paso.
          </span>
        </div>
      </section>
      <section className="landing-section" id="companions">
        <header>
          <p className="eyebrow">SIEMPRE EN TU EQUIPO</p>
          <h2>Encontrá tu compa.</h2>
          <p>Dieciséis formas de acompañarte. Elegí con quién querés empezar.</p>
        </header>
        <div className="landing-people">
          {people.map((id) => (
            <button
              key={id}
              aria-pressed={person === id}
              onClick={() => setPerson(id)}
            >
              <img
                src={"/selection/characters/" + id + "-portrait.webp"}
                alt={id}
                width="240"
                height="216"
                loading="lazy"
              />
              <span>{id}</span>
            </button>
          ))}
        </div>
        <div className="landing-person-note">
          <strong>{person.charAt(0).toUpperCase() + person.slice(1)}</strong>
          <span>
            Podés cambiar de personaje y personalizar su estilo cuando quieras.
          </span>
          <button className="text-button" onClick={onboarding}>
            Conocerlo en la demo <ArrowRight size={18} />
          </button>
        </div>
      </section>
      <section className="landing-section landing-style">
        <div>
          <p className="eyebrow">HECHO A TU MANERA</p>
          <h2>
            Un estilo.
            <br />
            Mil posibilidades.
          </h2>
          <p>
            Remeras, buzos, camperas, zapatillas y accesorios. Combiná las 144
            prendas de la colección y mirá cómo quedan en tu compa.
          </p>
          <button className="secondary" onClick={onboarding}>
            Probar el vestuario <ArrowRight size={18} />
          </button>
        </div>
        <div className="landing-outfits">
          {["nova", "milo", "sky"].map((id) => (
            <img
              key={id}
              src={"/selection/characters/" + id + ".webp"}
              width="500"
              height="600"
              loading="lazy"
              alt={"Conjunto de " + id}
            />
          ))}
        </div>
      </section>
      <section className="landing-section landing-rooms">
        <header>
          <p className="eyebrow">TU RINCÓN DEL MUNDO</p>
          <h2>Un espacio para ser vos.</h2>
          <p>
            De las plantas y la luz cálida a tu propia biblioteca. Encontrá el
            cuarto que te representa.
          </p>
        </header>
        <div
          className="room-picker"
          role="group"
          aria-label="Estilo de habitación"
        >
          {rooms.map(([id, label]) => (
            <button
              key={id}
              aria-pressed={room === id}
              onClick={() => setRoom(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="landing-room-preview">
          {interactive ? (
            <WorldCanvas companion={c} kind="room" />
          ) : (
            <img
              src={"/selection/rooms/" + room + ".webp"}
              width="1200"
              height="900"
              loading="lazy"
              alt={"Habitación " + rooms.find((r) => r[0] === room)?.[1]}
            />
          )}
        </div>
        <button
          className="secondary"
          onClick={() => setInteractive(!interactive)}
        >
          {interactive ? "Volver a la imagen" : "Explorar en 3D"}
          <ArrowUpRight size={18} />
        </button>
      </section>
      <section className="landing-section landing-day">
        <div>
          <p className="eyebrow">LO GRANDE EMPIEZA CHIQUITO</p>
          <h2>
            Tu día, con un poco
            <br />
            más de claridad.
          </h2>
          <p>
            Sumá tus tareas, exámenes y horarios. Revisá una propuesta que deje
            espacio para estudiar y también para vivir.
          </p>
          <button className="text-button" onClick={demo}>
            Explorar la agenda de ejemplo <ArrowRight size={18} />
          </button>
        </div>
        <ol className="landing-steps">
          <li>
            <CalendarDays />
            <div>
              <strong>Organizá tu semana</strong>
              <p>Materias, fechas y ratos disponibles.</p>
            </div>
          </li>
          <li>
            <Check />
            <div>
              <strong>Elegí tu próximo paso</strong>
              <p>El plan cambia cuando vos lo aceptás.</p>
            </div>
          </li>
          <li>
            <BookOpen />
            <div>
              <strong>Una sesión a la vez</strong>
              <p>Comprendé, practicá y revisá tu intento.</p>
            </div>
          </li>
        </ol>
      </section>
      <section className="landing-section landing-learning">
        <header>
          <p className="eyebrow">ENTENDER. PROBAR. VOLVER A INTENTAR.</p>
          <h2>Estudiar de verdad.</h2>
          <p>
            Tu compa te ayuda a pensar, con pistas y explicaciones. Las
            prácticas te permiten descubrir qué entendiste y qué conviene
            repasar.
          </p>
        </header>
        <div className="learning-features">
          <article>
            <span>01</span>
            <h3>Tus materiales</h3>
            <p>
              PDF, documentos, texto y fotos como punto de partida, con
              referencias al contenido.
            </p>
          </article>
          <article>
            <span>02</span>
            <h3>Distintas maneras</h3>
            <p>
              17 métodos de estudio para encontrar una estrategia según lo que
              estás aprendiendo.
            </p>
          </article>
          <article>
            <span>03</span>
            <h3>Práctica con sentido</h3>
            <p>
              Flashcards, quizzes y simulacros con intentos, correcciones y
              explicaciones.
            </p>
          </article>
        </div>
        <small>
          La IA y el procesamiento de archivos requieren una cuenta conectada y
          los servicios habilitados.
        </small>
      </section>
      <section className="landing-section landing-replan">
        <Sparkles size={38} />
        <p className="eyebrow">LA VIDA TAMBIÉN PASA</p>
        <h2>
          Si cambia tu día,
          <br />
          acomodamos el plan.
        </h2>
        <p>
          Un check-in para registrar lo que aprendiste, contar lo que cambió y
          elegir cómo seguir. Sin mensajes de culpa por ausentarte.
        </p>
        <button className="secondary" onClick={demo}>
          Ver cómo funciona <ArrowRight size={18} />
        </button>
      </section>
      <section className="landing-section landing-rewards">
        <div>
          <p className="eyebrow">CADA PASO CUENTA</p>
          <h2>
            Que se note
            <br />
            lo que vas logrando.
          </h2>
          <p>
            Sesiones, práctica y correcciones se convierten en progreso. Guardá
            tus trofeos y descubrí objetos para tu colección.
          </p>
        </div>
        <div className="reward-visual">
          <Trophy size={64} />
          <h3>Tu colección de avances</h3>
          <p>Completá una acción académica y volvé a ver lo que construiste.</p>
          <button className="text-button" onClick={demo}>
            Explorar los logros <ArrowRight size={18} />
          </button>
        </div>
      </section>
      <section className="landing-section">
        <header>
          <p className="eyebrow">UN MUNDO QUE CRECE CON VOS</p>
          <h2>Distintos espacios. Mismas ganas.</h2>
        </header>
        <div className="landing-universe">
          {rooms.slice(2).map(([id, name]) => (
            <figure key={id}>
              <img
                src={"/selection/rooms/" + id + ".webp"}
                width="1200"
                height="900"
                loading="lazy"
                alt={name}
              />
              <figcaption>{name}</figcaption>
            </figure>
          ))}
        </div>
      </section>
      <section className="landing-final">
        <p className="eyebrow">TU PRÓXIMO PASO EMPIEZA ACÁ</p>
        <h2>
          Hagamos lugar
          <br />a lo que viene.
        </h2>
        <button className="primary" onClick={register}>
          Crear mi cuenta <ArrowRight />
        </button>
        <button className="text-button" onClick={login}>
          Ya tengo una cuenta
        </button>
      </section>
      <footer className="landing-footer">
        <strong>compa virtual</strong>
        <p>
          Beta en desarrollo. Validación pedagógica y revisión jurídica
          pendientes antes de la entrega a alumnos.
        </p>
        <button className="text-button" onClick={login}>
          Acceder a mi cuenta y mis datos
        </button>
      </footer>
      {children}
    </main>
  );
}
