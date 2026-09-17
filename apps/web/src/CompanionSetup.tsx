"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import {
  characters,
  characterById,
  rooms,
  roomById,
  selectCharacter,
  wardrobeItems,
  wardrobeItem,
  wardrobeCategories,
  equipWardrobe,
  autonomyOptions,
  onboardingSteps,
  profileSchema,
  companionSchema,
  clock,
  minuteOf,
  today,
  type Companion,
  type Profile,
} from "@compa/domain";
import type { Envelope, Repository } from "@compa/client";
import { WorldCanvas } from "./Room";
import { Field } from "./ui";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type Props = {
  repo: Repository;
  env: Envelope;
  update: (value: Envelope) => void;
  onComplete: () => void;
  onExit: () => void;
  editing?: boolean;
};
const headings = [
  "Encontrá tu compa.",
  "Dale tu estilo.",
  "Un lugar para ustedes.",
  "Ahora, un poco de vos.",
  "Aprender a tu ritmo.",
  "Ya tienen un comienzo.",
];
const descriptions = [
  "Elegí con quién te gustaría compartir el camino. Podés cambiar después.",
  "Probá prendas, combiná colores y mirá cómo le quedan.",
  "Elegí el espacio al que te va a dar ganas de volver.",
  "Estos datos nos ayudan a preparar tu experiencia de estudio.",
  "Un plan tiene que hacer lugar al estudio y al descanso.",
  "Revisá las elecciones antes de entrar a tu espacio.",
];
const labelFor = (path: PropertyKey[]) =>
  ({
    nickname: "Tu nombre",
    birth_date: "Fecha de nacimiento",
    name: "Nombre del compa",
    school_year: "Año escolar",
    sleep_start: "Hora de dormir",
    sleep_end: "Hora de despertar",
  })[String(path[0])] ?? "Tu elección";

export function CompanionSetup({
  repo,
  env,
  update,
  onComplete,
  onExit,
  editing = false,
}: Props) {
  const [step, setStep] = useState(
    editing ? 0 : (env.state.onboarding?.step ?? 0),
  );
  const [companion, setCompanion] = useState<Companion>(() =>
    env.state.companion.character_id
      ? structuredClone(env.state.companion)
      : selectCharacter("milo", env.state.companion),
  );
  const [profile, setProfile] = useState<Omit<Profile, "id">>(() => ({
    nickname: "",
    birth_date: "",
    school_year: 1,
    country: "AR",
    timezone: "America/Argentina/Buenos_Aires",
    sleep_start: 1320,
    sleep_end: 420,
    autonomy_level: 2,
    onboarding_complete: false,
    school_day_limit: 60,
    free_day_limit: 90,
    ...env.state.profile,
  }));
  const [category, setCategory] = useState("top"),
    [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [petName, setPetName] = useState("Miel");
  const pending = useRef(false),
    heading = useRef<HTMLHeadingElement>(null);
  const character = characterById(companion.character_id),
    room = roomById(companion.room_style);
  const steps = editing ? onboardingSteps.slice(0, 3) : onboardingSteps;
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [step]);
  const change = (patch: Partial<Companion>) => {
    setError("");
    setCompanion((c) => ({ ...c, ...patch }));
  };
  const updateProfile = (patch: Partial<typeof profile>) => {
    setError("");
    setProfile((p) => ({ ...p, ...patch }));
  };
  const perform = async (action: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      if (e && typeof e === "object" && "issues" in e) {
        const issues = (
          e as { issues: { path: PropertyKey[]; message: string }[] }
        ).issues;
        setError(
          issues.some((i) => i.path.includes("birth_date"))
            ? "Ingresá una fecha de nacimiento válida."
            : `${labelFor(issues[0]?.path ?? [])}: revisá este dato antes de continuar.`,
        );
      } else
        setError(
          e instanceof Error
            ? e.message
            : "No pudimos guardar. Tus elecciones siguen acá; reintentá.",
        );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const next = () =>
    perform(async () => {
      companionSchema.parse(companion);
      if (editing) {
        if (step < 2) {
          setStep(step + 1);
          return;
        }
        update(
          await repo.command(
            { type: "companion.save", payload: companion },
            env.version,
          ),
        );
        onComplete();
        return;
      }
      if (step >= 3) {
        profileSchema.parse(profile);
        if (profile.birth_date > today() || profile.birth_date < "1926-01-01")
          throw Error("Revisá tu fecha de nacimiento.");
        if (profile.sleep_start === profile.sleep_end)
          throw Error("Elegí dos horarios distintos para dormir y despertar.");
      }
      const complete = step === 5;
      const result = await repo.command(
        {
          type: complete ? "onboarding.complete" : "onboarding.save",
          payload: {
            step: Math.min(5, step + 1),
            companion,
            ...(step >= 3 ? { profile } : {}),
            petName,
          },
        },
        env.version,
      );
      update(result);
      if (complete) onComplete();
      else setStep(step + 1);
    });
  const selected = companion.wardrobe ?? character.outfit;
  const categoryItems = wardrobeCategories.find((c) => c.id === category)!;
  const shown = wardrobeItems.filter(
    (i) =>
      categoryItems.slots.includes(i.slot) &&
      `${i.label} ${i.design}`
        .toLocaleLowerCase("es")
        .includes(query.toLocaleLowerCase("es")),
  );
  return (
    <main className={"companion-setup " + (editing ? "setup-editing" : "")}>
      <header className="setup-header">
        <span className="brand">
          <span className="brand-mark">c.</span> compa virtual
        </span>
        <nav className="setup-steps" aria-label="Pasos de bienvenida">
          {steps.map((label, index) => (
            <button
              key={label}
              type="button"
              disabled={busy || index > step}
              aria-current={index === step ? "step" : undefined}
              onClick={() => {
                setStep(index);
                setError("");
              }}
            >
              <span>
                {index < step ? (
                  <Check size={13} />
                ) : (
                  String(index + 1).padStart(2, "0")
                )}
              </span>
              <b>{label}</b>
            </button>
          ))}
        </nav>
        <button className="setup-exit" disabled={busy} onClick={onExit}>
          {editing ? "Cancelar" : "Salir"}
          <X size={17} />
        </button>
      </header>
      <div className="setup-mobile-progress">
        <span>{steps[step]}</span>
        <span>
          {step + 1} de {steps.length}
        </span>
        <progress
          value={step + 1}
          max={steps.length}
          aria-label="Progreso de bienvenida"
        />
      </div>
      <div className="setup-layout">
        <aside
          className={"setup-stage " + (step === 2 ? "is-room" : "")}
          aria-label="Vista previa de tu elección"
        >
          <div className="setup-stage-caption">
            <span>{step === 2 ? "SU HABITACIÓN" : "TU COMPA"}</span>
            <span>{step === 2 ? room.name : character.trait}</span>
          </div>
          <div className="setup-model">
            <WorldCanvas
              companion={companion}
              kind={step === 2 ? "room" : "avatar"}
            />
          </div>
          <div className="setup-stage-name">
            <strong>
              {step === 2 ? room.name : companion.name || character.name}
            </strong>
            <p>{step === 2 ? room.description : character.greeting}</p>
          </div>
        </aside>
        <section className="setup-panel">
          <div className="setup-title">
            <span className="setup-kicker">
              {editing ? "HACÉLO TUYO" : "BIENVENIDO A TU ESPACIO"}
            </span>
            <h1 ref={heading} tabIndex={-1}>
              {headings[step]}
            </h1>
            <p>{descriptions[step]}</p>
          </div>
          <fieldset disabled={busy} className="setup-fields">
            {step === 0 && (
              <>
                <RadioGroup
                  className="character-options"
                  aria-label="Personaje"
                  value={character.id}
                  onValueChange={(id) =>
                    setCompanion(
                      selectCharacter(id as typeof character.id, companion),
                    )
                  }
                >
                  {characters.map((c) => (
                    <div
                      className={
                        "character-option " +
                        (c.id === character.id ? "chosen" : "")
                      }
                      key={c.id}
                    >
                      <RadioGroupItem
                        className="selection-radio"
                        value={c.id}
                        aria-label={`${c.name}, ${c.trait}`}
                      />
                      <img
                        src={`/selection/characters/${c.id}-portrait.webp`}
                        alt=""
                        width={240}
                        height={216}
                      />
                      <strong>{c.name}</strong>
                      <span>{c.trait}</span>
                      {c.id === character.id && (
                        <Check className="choice-check" size={15} />
                      )}
                    </div>
                  ))}
                </RadioGroup>
                <p className="character-description" aria-live="polite">
                  {character.description}
                </p>
                <Field label="¿Cómo se va a llamar?">
                  <input
                    value={companion.name}
                    onChange={(e) => change({ name: e.target.value })}
                    maxLength={30}
                    required
                    autoComplete="off"
                  />
                </Field>
                <p className="setup-note">
                  El nombre es tuyo. Su forma de acompañarte también se puede
                  cambiar.
                </p>
              </>
            )}
            {step === 1 && (
              <>
                <div
                  className="wardrobe-categories"
                  role="group"
                  aria-label="Categoría de ropa"
                >
                  {wardrobeCategories.map((c) => (
                    <button
                      type="button"
                      aria-pressed={category === c.id}
                      key={c.id}
                      onClick={() => {
                        setCategory(c.id);
                        setQuery("");
                      }}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
                <div className="wardrobe-toolbar">
                  <label className="wardrobe-search">
                    <Search size={17} />
                    <input
                      aria-label="Buscar prendas"
                      placeholder="Buscá un color o una prenda"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => change({ wardrobe: [...character.outfit] })}
                  >
                    <RotateCcw size={14} />
                    Conjunto inicial
                  </button>
                </div>
                <div
                  className="wardrobe-options"
                  aria-label={categoryItems.name}
                >
                  {shown.map((item) => (
                    <button
                      type="button"
                      className={
                        "wardrobe-option " +
                        (selected.includes(item.id) ? "chosen" : "")
                      }
                      aria-pressed={selected.includes(item.id)}
                      aria-label={`${item.label}, ${item.design}`}
                      key={item.id}
                      onClick={() =>
                        change({ wardrobe: equipWardrobe(selected, item.id) })
                      }
                    >
                      <img
                        src={`/selection/wardrobe/${item.id}.webp`}
                        alt=""
                        width={240}
                        height={234}
                        loading="lazy"
                      />
                      <span>{item.label}</span>
                      {selected.includes(item.id) && (
                        <Check className="choice-check" size={14} />
                      )}
                    </button>
                  ))}
                </div>
                {!shown.length && (
                  <p className="setup-empty">
                    No hay prendas con esa búsqueda. Probá con otro color.
                  </p>
                )}
                <div className="equipped-list" aria-label="Tu conjunto">
                  {selected.map((id) => {
                    const item = wardrobeItem(id);
                    if (!item) return null;
                    return (
                      <span key={id}>
                        {item.label}
                        {!["top", "outerwear", "bottom", "shoes"].includes(
                          item.slot,
                        ) && (
                          <button
                            type="button"
                            aria-label={`Quitar ${item.label}`}
                            onClick={() =>
                              change({
                                wardrobe: selected.filter((v) => v !== id),
                              })
                            }
                          >
                            <X size={13} />
                          </button>
                        )}
                      </span>
                    );
                  })}
                </div>
              </>
            )}
            {step === 2 && (
              <RadioGroup
                className="room-options"
                aria-label="Estilo de habitación"
                value={room.id}
                onValueChange={(id) => {
                  const r = roomById(String(id));
                  change({ room_style: r.id, room_theme: r.theme });
                }}
              >
                {rooms.map((r) => (
                  <div
                    key={r.id}
                    className={
                      "room-option " + (r.id === room.id ? "chosen" : "")
                    }
                  >
                    <RadioGroupItem
                      className="selection-radio"
                      value={r.id}
                      aria-label={r.name}
                    />
                    <img
                      src={`/selection/rooms/${r.id}.webp`}
                      alt={`Habitación ${r.name}`}
                      width={1200}
                      height={900}
                    />
                    <strong>{r.name}</strong>
                    {r.id === room.id && (
                      <Check className="choice-check" size={16} />
                    )}
                  </div>
                ))}
              </RadioGroup>
            )}
            {step === 3 && (
              <div className="setup-profile">
                <Field label="¿Cómo querés que te llamemos?">
                  <input
                    autoComplete="nickname"
                    maxLength={40}
                    required
                    value={profile.nickname}
                    onChange={(e) =>
                      updateProfile({ nickname: e.target.value })
                    }
                    placeholder="Tu nombre o apodo"
                  />
                </Field>
                <div className="form-grid">
                  <Field label="Fecha de nacimiento">
                    <input
                      type="date"
                      required
                      max={today()}
                      value={profile.birth_date}
                      onChange={(e) =>
                        updateProfile({ birth_date: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Año de secundaria">
                    <select
                      value={profile.school_year}
                      onChange={(e) =>
                        updateProfile({ school_year: +e.target.value })
                      }
                    >
                      {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                        <option key={n} value={n}>
                          {n}.º año
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <p className="setup-note">
                  Tu fecha de nacimiento no se muestra en el personaje. Se usa
                  para aplicar las condiciones de acceso de tu cuenta.
                </p>
                {repo.mode === "demo" && (
                  <p className="setup-demo-note">
                    Estás probando una demostración local. Usá datos ficticios.
                  </p>
                )}
              </div>
            )}
            {step === 4 && (
              <>
                <RadioGroup
                  className="autonomy-options"
                  aria-label="Ayuda para organizarme"
                  value={profile.autonomy_level}
                  onValueChange={(value) =>
                    updateProfile({ autonomy_level: Number(value) })
                  }
                >
                  {autonomyOptions.map((a) => (
                    <div
                      key={a.value}
                      className={
                        "autonomy-option " +
                        (profile.autonomy_level === a.value ? "chosen" : "")
                      }
                    >
                      <RadioGroupItem
                        className="selection-radio"
                        value={a.value}
                        aria-label={`${a.name}. ${a.description}`}
                      />
                      <span className="autonomy-radio">
                        {profile.autonomy_level === a.value && (
                          <Check size={13} />
                        )}
                      </span>
                      <span>
                        <strong>{a.name}</strong>
                        <small>{a.description}</small>
                      </span>
                    </div>
                  ))}
                </RadioGroup>
                <h2 className="setup-subheading">El descanso también cuenta</h2>
                <div className="form-grid">
                  <Field label="Me voy a dormir">
                    <input
                      type="time"
                      required
                      value={clock(profile.sleep_start)}
                      onChange={(e) =>
                        e.target.value &&
                        updateProfile({ sleep_start: minuteOf(e.target.value) })
                      }
                    />
                  </Field>
                  <Field label="Me despierto">
                    <input
                      type="time"
                      required
                      value={clock(profile.sleep_end)}
                      onChange={(e) =>
                        e.target.value &&
                        updateProfile({ sleep_end: minuteOf(e.target.value) })
                      }
                    />
                  </Field>
                </div>
                <div className="form-grid">
                  <Field label="Estudio en día escolar (min)">
                    <input
                      type="number"
                      min={10}
                      max={180}
                      value={profile.school_day_limit}
                      onChange={(e) =>
                        updateProfile({ school_day_limit: +e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Estudio en día libre (min)">
                    <input
                      type="number"
                      min={10}
                      max={240}
                      value={profile.free_day_limit}
                      onChange={(e) =>
                        updateProfile({ free_day_limit: +e.target.value })
                      }
                    />
                  </Field>
                </div>
                <p className="setup-note">
                  Son límites para las propuestas de estudio. Podés ajustarlos
                  después según tu semana.
                </p>
              </>
            )}
            {step === 5 && (
              <>
                <div className="setup-pet-intro">
                  <img src="/selection/pets/golden-retriever.webp" alt="Golden retriever voxel 3D" />
                  <div>
                    <p className="eyebrow">TU PRIMERA MASCOTA · GRATIS</p>
                    <h2>Una nueva amiga para el cuarto.</h2>
                    <Field label="¿Cómo se va a llamar?">
                      <input value={petName} onChange={(event) => setPetName(event.target.value)} maxLength={30} required />
                    </Field>
                  </div>
                </div>
                <div className="setup-summary">
                  {[
                    {
                      title: "Tu compa",
                      value: `${companion.name} · ${character.trait}`,
                      edit: 0,
                    },
                    {
                      title: "Su estilo",
                      value: `${selected.length} prendas y accesorios elegidos`,
                      edit: 1,
                    },
                    { title: "Su habitación", value: room.name, edit: 2 },
                    {
                      title: "Tu perfil",
                      value: `${profile.nickname} · ${profile.school_year}.º año`,
                      edit: 3,
                    },
                    {
                      title: "Tu ritmo",
                      value: autonomyOptions.find(
                        (a) => a.value === profile.autonomy_level,
                      )?.name,
                      edit: 4,
                    },
                  ].map((row) => (
                    <button
                      type="button"
                      key={row.title}
                      onClick={() => setStep(row.edit)}
                    >
                      <span>
                        <small>{row.title}</small>
                        <strong>{row.value}</strong>
                      </span>
                      <span className="summary-edit">
                        Editar <ChevronRight size={16} />
                      </span>
                    </button>
                  ))}
                </div>
                <p className="setup-next-note">
                  Lo siguiente es sumar tus materias y hacer lugar en tu semana.
                  No tenés que resolver todo ahora.
                </p>
              </>
            )}
          </fieldset>
          {error && (
            <div role="alert" className="setup-error">
              <p>{error}</p>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  perform(async () => {
                    const fresh = await repo.load();
                    update(fresh);
                  })
                }
              >
                Actualizar datos de la cuenta
              </button>
            </div>
          )}
          {env.offline && (
            <p role="status" className="setup-error">
              Necesitás conexión para guardar tus elecciones.
            </p>
          )}
          <footer className="setup-footer">
            <div>
              {step > 0 && (
                <button
                  type="button"
                  className="setup-back"
                  disabled={busy}
                  onClick={() => {
                    setStep(step - 1);
                    setError("");
                  }}
                >
                  <ArrowLeft size={17} />
                  Atrás
                </button>
              )}
              <small>
                {editing
                  ? "Los cambios se aplican al guardar."
                  : repo.mode === "demo"
                    ? "Se guarda en este dispositivo al continuar."
                    : "Se guarda en tu cuenta al continuar."}
              </small>
            </div>
            <button
              type="button"
              className="primary setup-next"
              disabled={busy || env.offline}
              onClick={next}
            >
              {busy
                ? "Guardando…"
                : editing && step === 2
                  ? "Guardar mi compa"
                  : step === 5
                    ? "Entrar a mi espacio"
                    : "Continuar"}
              <ArrowRight size={17} />
            </button>
          </footer>
        </section>
      </div>
    </main>
  );
}
