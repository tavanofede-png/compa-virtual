"use client";
import { useState, useEffect, useRef } from "react";
import {
  Check,
  Plus,
  Trash2,
  Upload,
  Play,
  Pause,
  Sparkles,
} from "lucide-react";
import {
  methods,
  methodById,
  catalog,
  palettes,
  personalities,
  eyeNames,
  mouthNames,
  today,
  dateLabel,
  clock,
  minuteOf,
  addDays,
  type AcademicItem,
  type Companion,
  type StudyMethod,
  type PlanSlot,
  type Quiz,
  type Memory,
} from "@compa/domain";
import { useApp } from "./context";
import { Creature } from "./Room";
import { Field, Empty, Tag, formData, kinds, days } from "./ui";
export const titles: Record<string, string> = {
  item: "Una actividad para tu agenda",
  subjects: "Tus materias",
  week: "Hagamos lugar en tu semana",
  plan: "Un plan para revisar",
  chat: "Conversar con tu compa",
  companion: "Tu compa, a tu manera",
  checkin: "Un minuto para mirar tu día",
  method: "Una herramienta para aprender",
  focus: "Un bloque, una intención",
  generate: "Preparar una práctica",
  quiz: "Practicar y revisar",
  upload: "Sumar material",
  extract: "De un mensaje a tu agenda",
  profile: "Contanos un poco de vos",
  settings: "Tu espacio, tus decisiones",
  memory: "Memoria académica",
  privacy: "Privacidad y tus datos",
  notifications: "Tus avisos",
  "delete-material": "Eliminar material",
  "delete-account": "Eliminar tu cuenta",
};
export function Forms({ name, selected }: { name: string; selected: unknown }) {
  const { repo, env, busy, run, command, open, close, update, notice, go } =
      useApp(),
    s = env.state,
    date = today(s.profile?.timezone);
  const [compa, setCompa] = useState<Companion>(
      (selected as Companion) ?? s.companion,
    ),
    [chat, setChat] = useState(""),
    [answers, setAnswers] = useState<Record<string, string>>({}),
    [proposal, setProposal] = useState<Record<string, unknown>[] | null>(null),
    [running, setRunning] = useState(false),
    [remaining, setRemaining] = useState(
      ((selected as PlanSlot)?.duration_minutes ?? 25) * 60,
    ),
    until = useRef(0);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      const left = Math.max(0, Math.ceil((until.current - Date.now()) / 1000));
      setRemaining(left);
      if (!left) {
        setRunning(false);
        notice("Terminó el bloque. Tomate un descanso antes de seguir.");
      }
    }, 250);
    return () => clearInterval(t);
  }, [running, notice]);
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
    const slot = selected as PlanSlot,
      m = methodById(slot.method_id);
    return (
      <>
        <Tag>{m.name}</Tag>
        <h3>{slot.objective}</h3>
        <ol className="steps">
          {m.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <div className="timer">
          {String(Math.floor(remaining / 60)).padStart(2, "0")}
          <span>:</span>
          {String(remaining % 60).padStart(2, "0")}
        </div>
        <button
          className="secondary"
          onClick={() => {
            until.current = Date.now() + remaining * 1000;
            setRunning(!running);
          }}
        >
          {running ? <Pause size={17} /> : <Play size={17} />}{" "}
          {running ? "Pausar" : "Comenzar / continuar"}
        </button>
        <form
          onSubmit={(e) => {
            const d = formData(e);
            run(async () => {
              await command("session.complete", {
                slot_id: slot.id,
                reflection: d.reflection,
              });
              setRunning(false);
              notice(
                "Sesión registrada: +10 monedas. Ahora podés descansar 5 minutos.",
              );
            });
          }}
        >
          <Field label="¿Qué pudiste explicar o resolver? ¿Qué queda por revisar?">
            <textarea name="reflection" required maxLength={4000} />
          </Field>
          <p className="fine-print">
            El tiempo es orientativo. Registrá la sesión cuando hayas trabajado
            el objetivo.
          </p>
          <button className="primary" disabled={busy}>
            Registrar mi sesión <Check size={17} />
          </button>
        </form>
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
          Un incumplimiento reconocido de bloques pendientes del plan aceptado
          descuenta hasta 5 monedas disponibles, hasta 15 en siete días. Un
          imprevisto o no confirmar no descuenta.
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
          <Creature companion={compa} size={170} />
          <h3>{compa.name}</h3>
        </div>
        <Field label="Nombre">
          <input
            value={compa.name}
            onChange={(e) => setCompa({ ...compa, name: e.target.value })}
            maxLength={30}
          />
        </Field>
        <Field label="Tu criatura">
          <div className="creature-options">
            {[0, 1, 2].map((base) => (
              <button
                key={base}
                aria-label={["Brote", "Bolita", "Orejas"][base]}
                className={compa.base === base ? "selected" : ""}
                onClick={() => setCompa({ ...compa, base })}
              >
                <Creature companion={{ ...compa, base }} size={85} />
              </button>
            ))}
          </div>
        </Field>
        <Field label="Paleta">
          <div className="palette-options">
            {palettes.map((p, i) => (
              <button
                key={p}
                aria-label={p}
                title={p}
                aria-pressed={compa.palette === i}
                className={compa.palette === i ? "selected" : ""}
                style={{ background: `hsl(${90 + i * 36} 28% 65%)` }}
                onClick={() => setCompa({ ...compa, palette: i })}
              >
                {compa.palette === i && <Check size={16} />}
              </button>
            ))}
          </div>
        </Field>
        <div className="form-grid">
          <Field label="Ojos">
            <select
              value={compa.eyes}
              onChange={(e) => setCompa({ ...compa, eyes: +e.target.value })}
            >
              {eyeNames.map((x, i) => (
                <option key={x} value={i}>
                  {x}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Boca">
            <select
              value={compa.mouth}
              onChange={(e) => setCompa({ ...compa, mouth: +e.target.value })}
            >
              {mouthNames.map((x, i) => (
                <option key={x} value={i}>
                  {x}
                </option>
              ))}
            </select>
          </Field>
        </div>
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
        <div className="chat-history">
          {s.messages.length ? (
            s.messages.map((m) => (
              <div key={m.id} className={"message " + m.role}>
                <small>{m.role === "user" ? "Vos" : s.companion.name}</small>
                <p>{m.content}</p>
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
                          window.open(
                            await repo.signedUrl(material.path),
                            "_blank",
                            "noopener,noreferrer",
                          );
                        });
                    }}
                  >
                    {c.label} ↗
                  </button>
                ))}
              </div>
            ))
          ) : (
            <Empty>
              Contame qué estás tratando de entender. Podemos comenzar con una
              pista y tu primer intento.
            </Empty>
          )}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              update(await repo.ai("chat", { message: chat }, env.version));
              setChat("");
            });
          }}
        >
          <Field label="Tu mensaje">
            <textarea
              value={chat}
              onChange={(e) => setChat(e.target.value)}
              required
              maxLength={4000}
              placeholder="No entiendo cómo despejar x…"
            />
          </Field>
          <button className="primary" disabled={busy}>
            Enviar ↗
          </button>
        </form>
        <p className="fine-print">
          Puede equivocarse. Verificá las explicaciones con tu material. El chat
          reciente se guarda 30 días.
        </p>
      </>
    );
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
          Subí materiales que tengas permiso de usar. Si no se pueden leer, la
          app lo indicará.
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
              name="checkin_enabled"
              defaultChecked={s.preferences.checkin_enabled}
            />
            Recordarme el check-in
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
        <button className="settings-row" onClick={() => open("privacy")}>
          Privacidad y datos →
        </button>
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
          antes de incorporar alumnos.
        </p>
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
              a.download = "compa-virtual-datos.json";
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
        {s.notifications.map((n) => (
          <button
            className="settings-row"
            key={n.id}
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
        ))}
      </>
    ) : (
      <Empty>
        No tenés avisos pendientes. Los recordatorios nativos se habilitan en
        Android o iOS.
      </Empty>
    );
  return null;
}
