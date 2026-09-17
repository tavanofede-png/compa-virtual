"use client";
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Trophy,
  Upload,
} from "lucide-react";
import {
  catalog,
  methods,
  methodById,
  today,
  dateLabel,
  clock,
  addDays,
  type AcademicItem,
} from "@compa/domain";
import { useApp } from "./context";
import { Equipment } from "./Room";
import { Empty, Tag, kinds } from "./ui";
import { HomeScreen, CompaScreen } from "./HomeScreen";
import { Together } from "./Together";
export function ItemRows({ items }: { items: AcademicItem[] }) {
  const { env, open, run, command, busy, notice } = useApp(),
    s = env.state;
  return items.length ? (
    <>
      {items.map((item) => (
        <div className="item-row" key={item.id}>
          <button
            className={
              "check-circle " + (item.status === "DONE" ? "checked" : "")
            }
            disabled={busy || item.status === "DONE"}
            onClick={() =>
              run(async () => {
                await command("item.complete", { id: item.id }, false);
                notice(
                  "Actividad registrada. Completar una tarea no acredita dominio del tema.",
                );
              })
            }
            aria-label={"Completar " + item.title}
          >
            {item.status === "DONE" && <Check size={14} />}
          </button>
          <button className="item-info" onClick={() => open("item", item)}>
            <strong>{item.title}</strong>
            <span>
              <i
                style={{
                  background: s.subjects.find((x) => x.id === item.subject_id)
                    ?.color,
                }}
              />
              {s.subjects.find((x) => x.id === item.subject_id)?.name} <b>·</b>{" "}
              {kinds[item.kind]}
            </span>
          </button>
          <span className="due">
            {dateLabel(item.due_date)}
            {item.due_time && <small>{item.due_time}</small>}
          </span>
          <ChevronRight size={16} />
        </div>
      ))}
    </>
  ) : (
    <Empty>
      Tu agenda tiene espacio. Agregá una tarea o un examen para empezar.
    </Empty>
  );
}
export function Pages({ view }: { view: string }) {
  const { env, repo, busy, open, run, command, update, go } = useApp(),
    s = env.state,
    date = today(s.profile?.timezone);
  const active = s.plans.find((x) => x.status === "ACCEPTED"),
    proposed = s.plans.find((x) => x.status === "PROPOSED"),
    pending = s.items
      .filter((x) => x.status === "PENDING")
      .sort((a, b) => a.due_date.localeCompare(b.due_date)),
    slots = active?.slots.filter((x) => x.date === date) ?? [];
  const plan = () =>
    run(async () => {
      await command("plan.propose", {}, false);
      open("plan");
    });
  if (view === "room") return <HomeScreen />;
  if (view === "compa") return <CompaScreen />;
  if (view === "together") return <Together key={s.profile?.id ?? "demo"} repo={repo.collaboration} back={() => go("study")} />;
  if (view === "today")
    return (
      <>
        <div className="page-heading">
          <div>
            <p className="eyebrow">UN PASO POSIBLE</p>
            <h1>Hoy, con calma.</h1>
            <p>{dateLabel(date)} · El progreso empieza con una acción.</p>
          </div>
          <button className="secondary" onClick={() => open("checkin")}>
            Mi check-in <ArrowUpRight size={16} />
          </button>
        </div>
        <section className="surface">
          {slots.length ? (
            slots.map((slot) => (
              <div className="session-row" key={slot.id}>
                <span className="session-time">
                  {clock(slot.start_minute)}
                  <small>{slot.duration_minutes} min</small>
                </span>
                <div>
                  <Tag>{methodById(slot.method_id).name}</Tag>
                  <h3>
                    {s.items.find((x) => x.id === slot.academic_item_id)?.title}
                  </h3>
                  <p>{slot.objective}</p>
                </div>
                {slot.status === "PENDING" ? (
                  <button
                    className="primary"
                    onClick={() => open("focus", slot)}
                  >
                    Estudiar →
                  </button>
                ) : (
                  <Tag>
                    {slot.status === "COMPLETE"
                      ? "Completada"
                      : slot.status === "EXCUSED"
                        ? "Con excepción"
                        : "Revisada"}
                  </Tag>
                )}
              </div>
            ))
          ) : (
            <Empty>
              No hay sesiones aceptadas para hoy. Revisá tus horarios y prepará
              un plan desde la agenda.
            </Empty>
          )}
        </section>
        <section className="upcoming">
          <h2>Obligaciones para hoy</h2>
          <ItemRows items={pending.filter((x) => x.due_date <= date)} />
        </section>
      </>
    );
  if (view === "agenda")
    return (
      <>
        <div className="page-heading">
          <div>
            <p className="eyebrow">HACER LUGAR</p>
            <h1>Tu semana, en orden.</h1>
            <p>Las fechas que importan y el tiempo que realmente tenés.</p>
          </div>
          <button className="primary" onClick={() => open("item")}>
            <Plus size={18} />
            Nueva actividad
          </button>
        </div>
        <div className="action-strip">
          <button className="secondary" onClick={() => open("week")}>
            <CalendarDays size={17} />
            Mis horarios
          </button>
          <button className="secondary" onClick={() => open("subjects")}>
            <BookOpen size={17} />
            Materias
          </button>
          <button className="secondary" onClick={() => open("extract")}>
            <Sparkles size={17} />
            Agregar desde texto
          </button>
          <button
            className="primary"
            disabled={busy || !pending.length}
            onClick={plan}
          >
            <RefreshCw size={16} />
            {active ? "Replanificar" : "Preparar plan"}
          </button>
        </div>
        {(active || proposed) && (
          <div className="plan-summary">
            <div>
              <Tag>{proposed ? "PROPUESTA PARA REVISAR" : "PLAN ACEPTADO"}</Tag>
              <h3>
                {(proposed ?? active)?.slots.length} bloques de estudio, con
                descansos.
              </h3>
              <p>
                {(proposed ?? active)?.unscheduled.length ?? 0} actividades con
                tiempo pendiente de ubicar.
              </p>
            </div>
            <button className="secondary" onClick={() => open("plan")}>
              Revisar plan <ArrowUpRight size={16} />
            </button>
          </div>
        )}
        <section className="surface">
          <div className="section-heading">
            <h2>Tareas y exámenes</h2>
            <span>{pending.length} pendientes</span>
          </div>
          <ItemRows
            items={[...pending, ...s.items.filter((x) => x.status === "DONE")]}
          />
        </section>
        {active && (
          <section className="surface">
            <h2>Próximas sesiones</h2>
            {active.slots
              .filter((x) => x.date >= date)
              .map((slot) => (
                <div className="list-row" key={slot.id}>
                  <div>
                    <strong>
                      {dateLabel(slot.date)} · {clock(slot.start_minute)}
                    </strong>
                    <p>
                      {
                        s.items.find((x) => x.id === slot.academic_item_id)
                          ?.title
                      }{" "}
                      · {slot.duration_minutes} min
                    </p>
                  </div>
                  <Tag>
                    {slot.status === "COMPLETE"
                      ? "Completada"
                      : methodById(slot.method_id).name}
                  </Tag>
                </div>
              ))}
          </section>
        )}
      </>
    );
  if (view === "study")
    return (
      <>
        <div className="page-heading">
          <div>
            <p className="eyebrow">ENTENDER. PROBAR. VOLVER A INTENTAR.</p>
            <h1>Aprender se practica.</h1>
            <p>Elegí una herramienta para el tema que tenés entre manos.</p>
          </div>
          <button className="primary" onClick={() => open("generate")}>
            <Plus size={18} />
            Crear práctica
          </button>
        </div>
        <div className="study-intro">
          <div><h2>Estudiar juntos.</h2><p>Grupos privados y sesiones con las personas que conocés.</p></div>
          <button className="secondary" onClick={() => go("together")}>Preparar un encuentro <ArrowUpRight size={17} /></button>
        </div>
        <div className="study-intro">
          <BookOpen size={32} />
          <div>
            <h2>De tu material a una idea clara.</h2>
            <p>
              Subí apuntes, un PDF o una foto para trabajar con referencias.
            </p>
          </div>
          <button className="secondary" onClick={() => open("upload")}>
            <Upload size={17} />
            Subir material
          </button>
        </div>
        <section className="surface">
          <div className="section-heading">
            <h2>Mis materiales</h2>
            <button
              className="icon-button"
              aria-label="Actualizar materiales"
              onClick={() => run(async () => update(await repo.load()))}
            >
              <RefreshCw size={16} />
            </button>
          </div>
          {s.materials.length ? (
            s.materials.map((m) => (
              <div className="list-row" key={m.id}>
                <div>
                  <strong>{m.title}</strong>
                  <p>
                    {m.status === "READY"
                      ? "Listo para estudiar"
                      : m.status === "FAILED"
                        ? m.error_message
                        : "Procesamiento pendiente"}
                  </p>
                </div>
                <button
                  className="text-button"
                  onClick={() =>
                    run(async () => {
                      window.open(
                        await repo.signedUrl(m.path),
                        "_blank",
                        "noopener,noreferrer",
                      );
                    })
                  }
                >
                  Abrir ↗
                </button>
                {m.status === "FAILED" && (
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() =>
                      run(() =>
                        command("material.enqueue", { id: m.id }, false),
                      )
                    }
                  >
                    Reintentar
                  </button>
                )}
                <button
                  className="icon-button"
                  aria-label={"Eliminar " + m.title}
                  onClick={() => open("delete-material", m.id)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          ) : (
            <Empty>
              PDF, DOCX, TXT o imágenes, hasta 25 MB. Tus materiales son
              privados.
            </Empty>
          )}
        </section>
        <section className="surface">
          <h2>Mis prácticas</h2>
          {s.quizzes.length ? (
            s.quizzes.map((q) => (
              <button
                className="practice-row"
                key={q.id}
                onClick={() => open("quiz", q)}
              >
                <span className="practice-icon">
                  <BookOpen size={20} />
                </span>
                <div>
                  <strong>{q.title}</strong>
                  <p>
                    {q.kind === "MOCK"
                      ? "Simulacro"
                      : q.kind === "FLASHCARDS"
                        ? "Tarjetas"
                        : "Quiz"}{" "}
                    · {q.questions.length} preguntas ·{" "}
                    {q.basis === "MATERIAL"
                      ? "Tu material"
                      : "Práctica general"}
                  </p>
                </div>
                <ArrowUpRight size={19} />
              </button>
            ))
          ) : (
            <Empty>
              Creá un quiz, tarjetas o un simulacro individual para practicar.
            </Empty>
          )}
        </section>
        <div className="section-heading">
          <div>
            <p className="eyebrow">TU CAJA DE HERRAMIENTAS</p>
            <h2>17 maneras de estudiar</h2>
          </div>
          <Tag>REVISIÓN PEDAGÓGICA PENDIENTE</Tag>
        </div>
        <div className="method-grid">
          {methods.map((m, index) => (
            <button
              className="method-card"
              key={m.id}
              onClick={() => open("method", m)}
            >
              <span className="method-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span>
                <h3>{m.name}</h3>
                <p>{m.description}</p>
                <small>
                  {m.duration} min ·{" "}
                  {m.evidence === "ORGANIZACIÓN"
                    ? "Organización"
                    : "Evidencia " + m.evidence.toLowerCase()}
                </small>
              </span>
              <ArrowUpRight size={17} />
            </button>
          ))}
        </div>
      </>
    );
  if (view === "progress")
    return (
      <>
        <div className="page-heading">
          <div>
            <p className="eyebrow">LO QUE VAS CONSTRUYENDO</p>
            <h1>Cada intento cuenta.</h1>
            <p>Medimos acciones de aprendizaje, no tiempo dentro de la app.</p>
          </div>
        </div>
        <div className="stats-grid">
          {[
            [
              s.sessions.filter(
                (x) =>
                  today(s.profile?.timezone, x.completed_at) >=
                  addDays(date, -6),
              ).length,
              "Sesiones completadas esta semana",
            ],
            [s.attempts.length, "Intentos de práctica"],
            [s.coins, "Monedas disponibles"],
            [s.xp, "Experiencia histórica"],
          ].map(([value, label]) => (
            <div className="stat-card" key={label}>
              <strong>{value}</strong>
              <p>{label}</p>
            </div>
          ))}
        </div>
        <section className="surface">
          <h2>Pequeños grandes logros</h2>
          {[
            [
              s.sessions.length >= 1,
              "Primer paso",
              "Completá tu primera sesión.",
            ],
            [
              s.sessions.length >= 5,
              "Hábito en marcha",
              "Completá cinco sesiones.",
            ],
            [
              s.attempts.some((a, i) =>
                s.attempts
                  .slice(0, i)
                  .some((p) => p.quiz_id === a.quiz_id && a.score > p.score),
              ),
              "Volver a intentar",
              "Mejorá una práctica después de revisar.",
            ],
            [
              new Set(s.sessions.map((x) => x.method_id)).size >= 3,
              "Explorador de métodos",
              "Probá tres métodos en sesiones.",
            ],
          ].map(([done, title, desc]) => (
            <div className="list-row" key={title as string}>
              <span className={"trophy " + (done ? "earned" : "")}>
                <Trophy size={24} />
              </span>
              <div>
                <strong>{title as string}</strong>
                <p>{desc as string}</p>
              </div>
              <Tag>{done ? "Conseguido" : "Por descubrir"}</Tag>
            </div>
          ))}
        </section>
        <div className="section-heading">
          <h2>Un detalle para tu mundo</h2>
          <span>{s.coins} monedas</span>
        </div>
        <div className="shop-grid">
          {catalog.map((item) => (
            <div className="shop-item" key={item.id}>
              <Equipment id={item.id} width={65} />
              <h3>{item.name}</h3>
              <button
                className="secondary"
                disabled={
                  busy || s.inventory.includes(item.id) || s.coins < item.price
                }
                onClick={() =>
                  run(() => command("inventory.buy", { id: item.id }, false))
                }
              >
                {s.inventory.includes(item.id)
                  ? "En tu colección"
                  : item.price + " monedas"}
              </button>
            </div>
          ))}
        </div>
      </>
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">VOS TENÉS EL CONTROL</p>
          <h1>Lo que tu compa recuerda.</h1>
          <p>
            Información académica que podés corregir o borrar cuando quieras.
          </p>
        </div>
        <button className="primary" onClick={() => open("memory")}>
          <Plus size={17} />
          Agregar recuerdo
        </button>
      </div>
      <section className="surface">
        {s.memories.length ? (
          s.memories.map((m) => (
            <div className="list-row" key={m.id}>
              <div>
                <Tag>{m.category}</Tag>
                <p>{m.content}</p>
              </div>
              <button className="text-button" onClick={() => open("memory", m)}>
                Editar
              </button>
              <button
                className="icon-button"
                aria-label="Eliminar recuerdo"
                onClick={() =>
                  run(() => command("memory.delete", { id: m.id }, false))
                }
              >
                <Trash2 size={17} />
              </button>
            </div>
          ))
        ) : (
          <Empty>
            No hay recuerdos guardados. El chat se conserva durante 30 días; la
            memoria académica se gestiona por separado.
          </Empty>
        )}
      </section>
    </>
  );
}
