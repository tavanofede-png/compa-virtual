import { Text } from "./ui";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  View,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  BackHandler,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
import { NativeWorld } from "./Creature";
import { selectionImages } from "./selection-images";
import { Button, Field, colors, styles as ui } from "./ui";

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
  const [sleepStart, setSleepStart] = useState(clock(profile.sleep_start)),
    [sleepEnd, setSleepEnd] = useState(clock(profile.sleep_end));
  const [category, setCategory] = useState("top"),
    [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [petName, setPetName] = useState("Miel");
  const pending = useRef(false),
    scroll = useRef<ScrollView>(null);
  const character = characterById(companion.character_id),
    room = roomById(companion.room_style);
  const selected = companion.wardrobe ?? character.outfit;
  const steps = editing ? onboardingSteps.slice(0, 3) : onboardingSteps;
  const categoryItems = wardrobeCategories.find((c) => c.id === category)!;
  const shown = wardrobeItems.filter(
    (i) =>
      categoryItems.slots.includes(i.slot) &&
      `${i.label} ${i.design}`
        .toLocaleLowerCase("es")
        .includes(query.toLocaleLowerCase("es")),
  );
  const change = (patch: Partial<Companion>) => {
    setError("");
    setCompanion((c) => ({ ...c, ...patch }));
  };
  const changeProfile = (patch: Partial<typeof profile>) => {
    setError("");
    setProfile((p) => ({ ...p, ...patch }));
  };
  const back = () => {
    if (pending.current) return;
    setError("");
    if (step > 0) setStep(step - 1);
    else onExit();
  };
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [step]);
  useEffect(() => {
    const listener = BackHandler.addEventListener("hardwareBackPress", () => {
      back();
      return true;
    });
    return () => listener.remove();
  }, [step, onExit]);
  const perform = async (action: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      if (e && typeof e === "object" && "issues" in e) {
        const issues = (e as { issues: { path: PropertyKey[] }[] }).issues;
        const field = String(issues[0]?.path[0]);
        setError(
          field === "birth_date"
            ? "Ingresá una fecha válida con el formato AAAA-MM-DD."
            : field === "nickname"
              ? "Ingresá tu nombre o apodo."
              : field === "name"
                ? "Poné un nombre de hasta 30 caracteres a tu compa."
                : "Revisá los datos antes de continuar.",
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
      let savedProfile = profile;
      if (step >= 4) {
        const validTime = /^([01]\d|2[0-3]):[0-5]\d$/;
        if (!validTime.test(sleepStart) || !validTime.test(sleepEnd))
          throw Error(
            "Ingresá los horarios con formato HH:MM, por ejemplo 22:00.",
          );
        if (sleepStart === sleepEnd)
          throw Error("Elegí dos horarios distintos para dormir y despertar.");
        savedProfile = {
          ...profile,
          sleep_start: minuteOf(sleepStart),
          sleep_end: minuteOf(sleepEnd),
        };
        setProfile(savedProfile);
      }
      if (step >= 3) {
        profileSchema.parse(savedProfile);
        if (profile.birth_date > today() || profile.birth_date < "1926-01-01")
          throw Error("Revisá tu fecha de nacimiento.");
      }
      const complete = step === 5;
      const result = await repo.command(
        {
          type: complete ? "onboarding.complete" : "onboarding.save",
          payload: {
            step: Math.min(5, step + 1),
            companion,
            ...(step >= 3 ? { profile: savedProfile } : {}),
            petName,
          },
        },
        env.version,
      );
      update(result);
      if (complete) onComplete();
      else setStep(step + 1);
    });
  const choice = (
    key: string,
    checked: boolean,
    action: () => void,
    children: ReactNode,
    wide = false,
  ) => (
    <Pressable
      key={key}
      accessibilityRole="radio"
      accessibilityState={{ checked, disabled: busy }}
      disabled={busy}
      onPress={action}
      style={[css.choice, wide && css.wide, checked && css.chosen]}
    >
      {children}
      {checked && <Text style={css.check}>✓</Text>}
    </Pressable>
  );
  return (
    <SafeAreaView style={css.root}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={css.header}>
          <Text style={css.brand}>
            c. <Text style={{ fontSize: 16 }}>compa virtual</Text>
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={onExit}
            hitSlop={12}
          >
            <Text style={css.exit}>{editing ? "Cancelar" : "Salir"} ×</Text>
          </Pressable>
        </View>
        <View style={css.progress}>
          <Text style={css.subtitle}>{steps[step]}</Text>
          <Text style={css.subtitle}>
            {step + 1} de {steps.length}
          </Text>
        </View>
        <View style={css.track}>
          <View
            style={[
              css.fill,
              { width: `${((step + 1) / steps.length) * 100}%` },
            ]}
          />
        </View>
        <ScrollView
          ref={scroll}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 22 }}
        >
          <View style={css.stage}>
            <NativeWorld
              companion={companion}
              kind={step === 2 ? "room" : "avatar"}
            />
            <View pointerEvents="none" style={css.caption}>
              <Text style={css.captionName}>
                {step === 2 ? room.name : companion.name || character.name}
              </Text>
              <Text style={css.subtitle}>
                {step === 2 ? "SU HABITACIÓN" : character.trait}
              </Text>
            </View>
          </View>
          <View style={css.panel} pointerEvents={busy ? "none" : "auto"}>
            <Text accessibilityRole="header" style={css.title}>
              {headings[step]}
            </Text>
            {step === 0 && (
              <>
                <Text style={css.body}>
                  Elegí con quién compartir el camino. Podés cambiar después.
                </Text>
                <View style={css.grid}>
                  {characters.map((c) =>
                    choice(
                      c.id,
                      c.id === character.id,
                      () => setCompanion(selectCharacter(c.id, companion)),
                      <>
                        <Image
                          source={
                            selectionImages[`characters/${c.id}-portrait`]
                          }
                          style={css.portrait}
                        />
                        <Text style={css.itemTitle}>{c.name}</Text>
                        <Text style={css.itemMeta}>{c.trait}</Text>
                      </>,
                    ),
                  )}
                </View>
                <Text style={css.body}>{character.description}</Text>
                <Field
                  label="¿Cómo se va a llamar?"
                  value={companion.name}
                  onChangeText={(name) => change({ name })}
                  maxLength={30}
                />
              </>
            )}
            {step === 1 && (
              <>
                <Text style={css.body}>
                  Probá prendas y mirá cómo le quedan.
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={css.chips}
                >
                  {wardrobeCategories.map((c) => (
                    <Pressable
                      key={c.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: category === c.id }}
                      onPress={() => {
                        setCategory(c.id);
                        setQuery("");
                      }}
                      style={[css.chip, category === c.id && css.activeChip]}
                    >
                      <Text
                        style={[
                          css.chipText,
                          category === c.id && { color: "#fff" },
                        ]}
                      >
                        {c.name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <Field
                  label="Buscar prendas"
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Color o prenda"
                />
                <Button
                  secondary
                  onPress={() => change({ wardrobe: [...character.outfit] })}
                >
                  Volver al conjunto inicial
                </Button>
                <View style={css.grid}>
                  {shown.map((item) => (
                    <Pressable
                      key={item.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${item.label}, ${item.design}`}
                      accessibilityState={{
                        selected: selected.includes(item.id),
                      }}
                      onPress={() =>
                        change({ wardrobe: equipWardrobe(selected, item.id) })
                      }
                      style={[
                        css.choice,
                        selected.includes(item.id) && css.chosen,
                      ]}
                    >
                      <Image
                        source={selectionImages[`wardrobe/${item.id}`]}
                        style={css.garment}
                      />
                      <Text style={css.itemTitle}>{item.label}</Text>
                      {selected.includes(item.id) && (
                        <Text style={css.check}>✓</Text>
                      )}
                    </Pressable>
                  ))}
                </View>
                {!shown.length && (
                  <Text style={css.body}>No hay prendas con esa búsqueda.</Text>
                )}
                <Text style={css.sectionTitle}>Tu conjunto</Text>
                <View style={css.equipped}>
                  {selected.map((id) => {
                    const item = wardrobeItem(id)!;
                    const removable = ![
                      "top",
                      "outerwear",
                      "bottom",
                      "shoes",
                    ].includes(item.slot);
                    return (
                      <Pressable
                        key={id}
                        accessibilityRole={removable ? "button" : "text"}
                        accessibilityLabel={
                          removable ? `Quitar ${item.label}` : item.label
                        }
                        disabled={!removable}
                        onPress={() =>
                          change({ wardrobe: selected.filter((v) => v !== id) })
                        }
                        style={css.chip}
                      >
                        <Text style={css.chipText}>
                          {item.label}
                          {removable ? " ×" : ""}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}
            {step === 2 && (
              <>
                <Text style={css.body}>
                  Un espacio para estudiar, descansar y hacerlo tuyo.
                </Text>
                <View style={css.grid}>
                  {rooms.map((r) =>
                    choice(
                      r.id,
                      r.id === room.id,
                      () => change({ room_style: r.id, room_theme: r.theme }),
                      <>
                        <Image
                          source={selectionImages[`rooms/${r.id}`]}
                          style={css.room}
                        />
                        <Text style={css.itemTitle}>{r.name}</Text>
                      </>,
                      true,
                    ),
                  )}
                </View>
              </>
            )}
            {step === 3 && (
              <>
                <Text style={css.body}>
                  Estos datos nos ayudan a preparar tu experiencia.
                </Text>
                <Field
                  label="Tu nombre o apodo"
                  value={profile.nickname}
                  onChangeText={(nickname) => changeProfile({ nickname })}
                  autoComplete="nickname"
                  maxLength={40}
                />
                <Field
                  label="Fecha de nacimiento (AAAA-MM-DD)"
                  value={profile.birth_date}
                  onChangeText={(birth_date) => changeProfile({ birth_date })}
                  placeholder="2000-01-15"
                  keyboardType="numbers-and-punctuation"
                  maxLength={10}
                />
                <Text style={css.sectionTitle}>Año de secundaria</Text>
                <View style={css.equipped}>
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <Pressable
                      key={n}
                      accessibilityRole="radio"
                      accessibilityState={{
                        checked: n === profile.school_year,
                      }}
                      style={[
                        css.chip,
                        n === profile.school_year && css.chosen,
                      ]}
                      onPress={() => changeProfile({ school_year: n })}
                    >
                      <Text style={css.chipText}>{n}.º</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={css.body}>
                  Tu fecha de nacimiento no se muestra en el personaje. Se usa
                  para aplicar las condiciones de acceso de tu cuenta.
                </Text>
                {repo.mode === "demo" && (
                  <Text style={css.body}>
                    Esta es una demostración local. Usá datos ficticios.
                  </Text>
                )}
              </>
            )}
            {step === 4 && (
              <>
                <Text style={css.body}>
                  Elegí cuánta ayuda querés para organizarte.
                </Text>
                {autonomyOptions.map((a) =>
                  choice(
                    String(a.value),
                    profile.autonomy_level === a.value,
                    () => changeProfile({ autonomy_level: a.value }),
                    <>
                      <Text style={css.itemTitle}>{a.name}</Text>
                      <Text style={css.body}>{a.description}</Text>
                    </>,
                    true,
                  ),
                )}
                <Text style={css.sectionTitle}>El descanso también cuenta</Text>
                <View style={css.columns}>
                  <View style={css.column}>
                    <Field
                      label="Me duermo (HH:MM)"
                      value={sleepStart}
                      onChangeText={setSleepStart}
                      maxLength={5}
                      keyboardType="numbers-and-punctuation"
                    />
                  </View>
                  <View style={css.column}>
                    <Field
                      label="Me despierto (HH:MM)"
                      value={sleepEnd}
                      onChangeText={setSleepEnd}
                      maxLength={5}
                      keyboardType="numbers-and-punctuation"
                    />
                  </View>
                </View>
                <Field
                  label="Estudio en día escolar (10–180 minutos)"
                  value={String(profile.school_day_limit)}
                  keyboardType="number-pad"
                  onChangeText={(v) => changeProfile({ school_day_limit: +v })}
                />
                <Field
                  label="Estudio en día libre (10–240 minutos)"
                  value={String(profile.free_day_limit)}
                  keyboardType="number-pad"
                  onChangeText={(v) => changeProfile({ free_day_limit: +v })}
                />
                <Text style={css.body}>
                  Podés ajustar estos límites después según tu semana.
                </Text>
              </>
            )}
            {step === 5 && (
              <>
                <Image source={require("../../web/public/selection/pets/golden-retriever.webp")} style={{ width: "100%", height: 260, borderRadius: 24, resizeMode: "contain", backgroundColor: "#f2ebe4" }} />
                <Text style={css.sectionTitle}>Tu primera mascota es gratuita</Text>
                <Text style={css.body}>Un golden tranquilo durante el estudio y listo para jugar.</Text>
                <Field label="¿Cómo se va a llamar?" value={petName} onChangeText={setPetName} maxLength={30} />
                <Text style={css.body}>
                  Revisá las elecciones antes de entrar.
                </Text>
                {[
                  { title: "Tu compa", value: companion.name, edit: 0 },
                  {
                    title: "Su estilo",
                    value: `${selected.length} prendas y accesorios`,
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
                  <Pressable
                    key={row.title}
                    accessibilityRole="button"
                    accessibilityLabel={`Editar ${row.title}`}
                    style={css.summary}
                    onPress={() => setStep(row.edit)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={css.subtitle}>{row.title}</Text>
                      <Text style={css.sectionTitle}>{row.value}</Text>
                    </View>
                    <Text style={css.exit}>Editar ›</Text>
                  </Pressable>
                ))}
                <Text style={css.body}>
                  Después podemos sumar tus materias y organizar tu semana. Un
                  paso a la vez.
                </Text>
              </>
            )}
          </View>
        </ScrollView>
        <View style={css.footer}>
          {error ? (
            <>
              <Text accessibilityRole="alert" style={ui.error}>
                {error}
              </Text>
              <Button
                secondary
                disabled={busy}
                onPress={() =>
                  void perform(async () => update(await repo.load()))
                }
              >
                Actualizar datos de la cuenta
              </Button>
            </>
          ) : null}
          {env.offline && (
            <Text style={ui.error}>
              Necesitás conexión para guardar tus elecciones.
            </Text>
          )}
          <View style={css.columns}>
            {step > 0 && (
              <Button secondary disabled={busy} onPress={back}>
                ‹ Atrás
              </Button>
            )}
            <View style={{ flex: 1 }}>
              <Button
                disabled={busy || env.offline}
                onPress={() => void next()}
              >
                {busy
                  ? "Guardando…"
                  : editing && step === 2
                    ? "Guardar mi compa"
                    : step === 5
                      ? "Entrar a mi espacio"
                      : "Continuar →"}
              </Button>
            </View>
          </View>
          <Text style={css.footnote}>
            {editing
              ? "Los cambios se aplican al guardar."
              : repo.mode === "demo"
                ? "Se guarda en este dispositivo al continuar."
                : "Se guarda en tu cuenta al continuar."}
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const css = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  brand: { fontSize: 27, fontWeight: "600", color: colors.ink },
  exit: { color: colors.green, fontSize: 14, paddingVertical: 10 },
  progress: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    marginBottom: 10,
  },
  subtitle: { fontSize: 13, color: "#65705d" },
  track: { height: 3, backgroundColor: colors.line },
  fill: { height: 3, backgroundColor: colors.green },
  stage: { height: 340, backgroundColor: "#e9e4dd" },
  caption: { position: "absolute", left: 22, bottom: 20, gap: 4 },
  captionName: { color: colors.ink, fontSize: 25, fontWeight: "600" },
  panel: { padding: 22, gap: 14 },
  title: {
    fontSize: 30,
    lineHeight: 35,
    letterSpacing: -0.8,
    fontWeight: "600",
    color: colors.ink,
  },
  body: { fontSize: 15, lineHeight: 23, color: "#65705d" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  choice: {
    width: "48%",
    padding: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    backgroundColor: "#fffefa",
    gap: 5,
    overflow: "hidden",
  },
  wide: { width: "100%", padding: 14 },
  chosen: { borderColor: colors.green, backgroundColor: "#edf0e5" },
  portrait: {
    width: "100%",
    aspectRatio: 240 / 216,
    resizeMode: "contain",
    borderRadius: 6,
  },
  garment: {
    width: "100%",
    aspectRatio: 240 / 234,
    resizeMode: "contain",
    borderRadius: 6,
  },
  room: {
    width: "100%",
    aspectRatio: 4 / 3,
    resizeMode: "cover",
    borderRadius: 7,
  },
  itemTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "600",
    paddingRight: 12,
  },
  itemMeta: { fontSize: 13, color: "#65705d" },
  check: {
    position: "absolute",
    right: 7,
    top: 7,
    color: "white",
    backgroundColor: colors.green,
    borderRadius: 12,
    width: 23,
    height: 23,
    textAlign: "center",
    lineHeight: 23,
  },
  chips: { gap: 7, paddingVertical: 4 },
  chip: {
    borderColor: colors.line,
    borderWidth: 1,
    padding: 12,
    minHeight: 44,
    borderRadius: 8,
    justifyContent: "center",
    backgroundColor: "#fffefa",
  },
  activeChip: { backgroundColor: colors.green },
  chipText: { fontSize: 14, color: colors.ink },
  equipped: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  sectionTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "600",
    marginTop: 4,
  },
  columns: { flexDirection: "row", gap: 12 },
  column: { flex: 1 },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 5,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.bg,
  },
  footnote: {
    fontSize: 12,
    color: "#65705d",
    textAlign: "center",
    paddingVertical: 5,
  },
});
