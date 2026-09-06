import { Creature, Equipment, NativeRoom } from "../src/Creature";
import { useEffect, useState, type ReactNode } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  Alert,
  Platform,
  Linking,
  KeyboardAvoidingView,
  AppState,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import * as Notifications from "expo-notifications";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import {
  createBackend,
  createDemo,
  createRepository,
  type Repository,
  type Envelope,
} from "@compa/client";
import {
  emptySnapshot,
  methods,
  methodById,
  today,
  dateLabel,
  clock,
  minuteOf,
  addDays,
  catalog,
  avatarAppearance,
  avatarPresets,
  skinTones,
  hairStyles,
  hairColors,
  clothingStyles,
  clothingColors,
  personalities,
  type AcademicItem,
  type Quiz,
  type PlanSlot,
  type Companion,
} from "@compa/domain";
import { cache, secureStorage } from "../src/storage";
import { registerPush } from "../src/push";
import { Button, Field, Choices, Card, styles as st, colors } from "../src/ui";
const url = process.env.EXPO_PUBLIC_SUPABASE_URL,
  key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const backend =
  process.env.EXPO_PUBLIC_DEMO_MODE !== "1" && url && key
    ? createBackend(url, key, secureStorage)
    : null;
const tabs = [
  ["room", "Mi cuarto"],
  ["today", "Hoy"],
  ["agenda", "Agenda"],
  ["study", "Estudiar"],
  ["more", "Más"],
];
const kindOptions = [
  { value: "TASK", label: "Tarea" },
  { value: "EXAM", label: "Examen" },
  { value: "PROJECT", label: "Proyecto" },
  { value: "READING", label: "Lectura" },
  { value: "PRESENTATION", label: "Presentación" },
];
export default function App() {
  const params = useLocalSearchParams<{ view?: string }>(),
    [repo, setRepo] = useState<Repository | null>(null),
    [env, setEnv] = useState<Envelope>({ state: emptySnapshot(), version: 0 }),
    [view, setView] = useState(params.view ?? "room"),
    [modal, setModal] = useState<string | null>(null),
    [selected, setSelected] = useState<unknown>(),
    [values, setValues] = useState<Record<string, string>>({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [authMode, setAuthMode] = useState("login"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [seconds, setSeconds] = useState(1500),
    [end, setEnd] = useState<number | null>(null);
  const s = env.state,
    date = today(s.profile?.timezone),
    active = s.plans.find((p) => p.status === "ACCEPTED"),
    proposed = s.plans.find((p) => p.status === "PROPOSED"),
    pending = s.items.filter((i) => i.status === "PENDING"),
    todaySlots = active?.slots.filter((x) => x.date === date) ?? [];
  useEffect(() => {
    if (params.view) setView(params.view);
  }, [params.view]);
  useEffect(() => {
    if (!backend) return;
    backend.auth.getSession().then(({ data }) => {
      if (data.session)
        setRepo(createRepository(backend, cache, data.session.user.id));
    });
    const { data } = backend.auth.onAuthStateChange((event, session) => {
      setRepo(
        session ? createRepository(backend, cache, session.user.id) : null,
      );
      if (event === "PASSWORD_RECOVERY") setModal("password");
    });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!backend) return;
    const handle = async (url: string) => {
      if (!url.startsWith("compavirtual://")) return;
      const parsed = new URL(url),
        code = parsed.searchParams.get("code");
      if (code) {
        const { error } = await backend.auth.exchangeCodeForSession(code);
        if (error)
          setError(
            "No se pudo abrir este enlace de acceso. Solicitá uno nuevo.",
          );
      }
    };
    Linking.getInitialURL().then((url) => {
      if (url) void handle(url);
    });
    const listener = Linking.addEventListener("url", (event) => {
      void handle(event.url);
    });
    return () => listener.remove();
  }, []);
  useEffect(() => {
    if (!repo) return;
    repo
      .load()
      .then((result) => {
        setEnv(result);
        if (!result.state.profile) open("profile");
      })
      .catch((e) => setError(e.message));
  }, [repo]);
  useEffect(() => {
    const receive = (response: Notifications.NotificationResponse) => {
      const url = response.notification.request.content.data?.url;
      if (typeof url === "string" && url.startsWith("compavirtual://"))
        setView(new URL(url).searchParams.get("view") ?? "today");
    };
    const listener =
      Notifications.addNotificationResponseReceivedListener(receive);
    Notifications.getLastNotificationResponseAsync().then((r) => {
      if (r) receive(r);
    });
    return () => listener.remove();
  }, []);
  useEffect(() => {
    if (!end) return;
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setSeconds(remaining);
      if (!remaining) {
        setEnd(null);
        Alert.alert("Terminó el bloque", "Tomate un descanso antes de seguir.");
      }
    }, 300);
    return () => clearInterval(timer);
  }, [end]);
  useEffect(() => {
    if (!repo || repo.mode !== "live") return;
    const refresh = () => {
      void registerPush(repo, false).catch(() => {});
    };
    refresh();
    const token = Notifications.addPushTokenListener(refresh);
    const foreground = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => {
      token.remove();
      foreground.remove();
    };
  }, [repo]);
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo completar la acción.",
      );
    } finally {
      setBusy(false);
    }
  };
  const open = (name: string, value?: unknown) => {
    setError("");
    setSelected(value);
    setModal(name);
    const data = value as Record<string, unknown> | undefined;
    setValues(
      Object.fromEntries(
        Object.entries(data ?? {}).map(([k, v]) => [
          k,
          Array.isArray(v) ? v.join(", ") : String(v ?? ""),
        ]),
      ),
    );
    if (name === "focus") {
      setSeconds((value as PlanSlot).duration_minutes * 60);
      setEnd(null);
    }
  };
  const change = (key: string, value: string) =>
    setValues((v) => ({
      ...v,
      [key]: value,
      ...(key === "clothing_style" ? { outfit: "none" } : {}),
    }));
  const command = async (type: string, payload: unknown, close = true) => {
    if (!repo) return;
    setEnv(await repo.command({ type, payload }, env.version));
    if (close) setModal(null);
  };
  const input = (
    key: string,
    label: string,
    initial = "",
    multiline = false,
  ) => (
    <Field
      key={key}
      label={label}
      value={values[key] ?? initial}
      onChangeText={(v) => change(key, v)}
      multiline={multiline}
      secureTextEntry={key === "password"}
      autoCapitalize={
        key.includes("date") || key === "password" ? "none" : "sentences"
      }
    />
  );
  const choices = (
    key: string,
    label: string,
    options: { value: string; label: string }[],
    initial?: string,
  ) => (
    <Choices
      key={key}
      label={label}
      value={values[key] ?? initial ?? options[0]?.value ?? ""}
      options={options}
      onChange={(v) => change(key, v)}
    />
  );
  const v = (key: string, initial = "") => values[key] ?? initial;
  const save = (type: string, payload: unknown, label = "Guardar") => (
    <Button disabled={busy} onPress={() => run(() => command(type, payload))}>
      {busy ? "Guardando…" : label}
    </Button>
  );
  const subjectOptions = s.subjects.map((x) => ({
    value: x.id,
    label: x.name,
  }));
  const itemList = (items: AcademicItem[]) =>
    items.length ? (
      items.map((i) => (
        <View style={st.row} key={i.id}>
          <Pressable onPress={() => open("item", i)}>
            <Text style={st.h3}>{i.title}</Text>
            <Text style={st.p}>
              {s.subjects.find((x) => x.id === i.subject_id)?.name} ·{" "}
              {dateLabel(i.due_date)}
              {i.due_time ? " · " + i.due_time : ""}
            </Text>
          </Pressable>
          {i.status === "PENDING" && (
            <Button
              secondary
              disabled={busy}
              onPress={() =>
                run(() => command("item.complete", { id: i.id }, false))
              }
            >
              Confirmar que la completé
            </Button>
          )}
        </View>
      ))
    ) : (
      <Text style={st.p}>Agregá una materia y una actividad para empezar.</Text>
    );
  const showPlan = () =>
    run(async () => {
      await command("plan.propose", {}, false);
      open("plan");
    });
  const title =
    {
      room: "Tu pequeño gran lugar",
      today: "Hoy, con calma.",
      agenda: "Tu semana, en orden.",
      study: "Aprender se practica.",
      more: "Tu progreso y tus decisiones",
    }[view] ?? "Compa Virtual";
  const upload = () =>
    run(async () => {
      if (!repo) return;
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/pdf",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "text/plain",
          "image/*",
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const asset = result.assets[0],
        file = new File(asset.uri);
      setEnv(
        await repo.upload(
          new Blob([await file.arrayBuffer()], {
            type: asset.mimeType ?? "application/octet-stream",
          }),
          asset.name,
          v("subject_id", s.subjects[0]?.id),
          env.version,
        ),
      );
      setModal(null);
    });
  const shareExport = () =>
    run(async () => {
      if (!repo) return;
      const result = await repo.exportData(),
        file = new File(Paths.cache, "compa-virtual-datos.json");
      file.write(JSON.stringify(result, null, 2));
      await Sharing.shareAsync(file.uri, { mimeType: "application/json" });
      file.delete();
    });
  if (!repo)
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScrollView
          contentContainerStyle={{ padding: 25, gap: 20 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={st.eyebrow}>COMPA VIRTUAL · BETA</Text>
          <Text style={[st.h1, { fontSize: 43, lineHeight: 48 }]}>
            Tu mundo.{"\n"}Tu manera de aprender.
          </Text>
          <NativeRoom
            companion={s.companion}
            onTalk={() => setRepo(createDemo(cache))}
            height={330}
          />
          <Text style={st.p}>
            Organizá tu semana, practicá y celebrá cada paso.
          </Text>
          <Button onPress={() => setRepo(createDemo(cache))}>
            Explorar con datos ficticios
          </Button>
          <Text style={st.label}>
            Demostración local. La IA y los materiales requieren una cuenta
            conectada.
          </Text>
          {backend ? (
            <>
              <Field
                label="Correo"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
              <Field
                label="Contraseña"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete={
                  authMode === "register" ? "new-password" : "current-password"
                }
              />
              <Button
                disabled={busy}
                onPress={() =>
                  run(async () => {
                    if (authMode === "register") {
                      if (password.length < 12)
                        throw Error(
                          "Usá una contraseña de al menos 12 caracteres.",
                        );
                      const { error } = await backend.auth.signUp({
                        email,
                        password,
                        options: { emailRedirectTo: "compavirtual://" },
                      });
                      if (error) throw error;
                      Alert.alert(
                        "Revisá tu correo",
                        "Confirmá la cuenta para ingresar.",
                      );
                    } else {
                      const { error } = await backend.auth.signInWithPassword({
                        email,
                        password,
                      });
                      if (error) throw error;
                    }
                  })
                }
              >
                {authMode === "register" ? "Crear cuenta" : "Entrar"}
              </Button>
              <Button
                secondary
                onPress={() =>
                  setAuthMode(authMode === "register" ? "login" : "register")
                }
              >
                {authMode === "register" ? "Ya tengo cuenta" : "Registrarme"}
              </Button>
              <Button
                secondary
                onPress={() =>
                  run(async () => {
                    const { error } = await backend.auth.resetPasswordForEmail(
                      email,
                      { redirectTo: "compavirtual://" },
                    );
                    if (error) throw error;
                    Alert.alert(
                      "Revisá tu correo",
                      "Te enviamos un enlace para recuperar el acceso.",
                    );
                  })
                }
              >
                Olvidé mi contraseña
              </Button>
            </>
          ) : (
            <Text style={st.p}>
              El registro se habilita al configurar el backend.
            </Text>
          )}
          {error && (
            <Text accessibilityRole="alert" style={st.error}>
              {error}
            </Text>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  const renderModal = (): ReactNode => {
    if (modal === "password")
      return (
        <>
          {input("password", "Nueva contraseña (12 caracteres o más)")}
          <Button
            disabled={busy}
            onPress={() =>
              run(async () => {
                if (v("password").length < 12)
                  throw Error("Usá al menos 12 caracteres.");
                const { error } = await backend!.auth.updateUser({
                  password: v("password"),
                });
                if (error) throw error;
                setModal(null);
              })
            }
          >
            Guardar contraseña
          </Button>
        </>
      );
    if (modal === "profile")
      return (
        <>
          {input(
            "nickname",
            "¿Cómo querés que te llamemos?",
            s.profile?.nickname,
          )}
          {input(
            "birth_date",
            "Fecha de nacimiento (AAAA-MM-DD)",
            s.profile?.birth_date,
          )}
          {choices(
            "school_year",
            "Año",
            [1, 2, 3, 4, 5, 6, 7].map((i) => ({
              value: String(i),
              label: i + ".º",
            })),
            String(s.profile?.school_year ?? 1),
          )}
          {input(
            "sleep_start",
            "Me duermo (HH:MM)",
            clock(s.profile?.sleep_start ?? 1320),
          )}
          {input(
            "sleep_end",
            "Me despierto (HH:MM)",
            clock(s.profile?.sleep_end ?? 420),
          )}
          {input(
            "school_day_limit",
            "Máximo por día escolar (min)",
            String(s.profile?.school_day_limit ?? 60),
          )}
          {input(
            "free_day_limit",
            "Máximo por día libre (min)",
            String(s.profile?.free_day_limit ?? 90),
          )}
          {choices(
            "autonomy_level",
            "Ayuda organizativa",
            [
              { value: "1", label: "Paso a paso" },
              { value: "2", label: "Propuestas" },
              { value: "3", label: "Revisión" },
              { value: "4", label: "Yo organizo" },
            ],
            String(s.profile?.autonomy_level ?? 2),
          )}
          <Text style={st.p}>
            Esta etapa usa adultos y datos ficticios hasta completar la
            habilitación de la beta para alumnos.
          </Text>
          {save("profile.save", {
            nickname: v("nickname", s.profile?.nickname),
            birth_date: v("birth_date", s.profile?.birth_date),
            school_year: +v("school_year", String(s.profile?.school_year ?? 1)),
            sleep_start: minuteOf(
              v("sleep_start", clock(s.profile?.sleep_start ?? 1320)),
            ),
            sleep_end: minuteOf(
              v("sleep_end", clock(s.profile?.sleep_end ?? 420)),
            ),
            school_day_limit: +v(
              "school_day_limit",
              String(s.profile?.school_day_limit ?? 60),
            ),
            free_day_limit: +v(
              "free_day_limit",
              String(s.profile?.free_day_limit ?? 90),
            ),
            autonomy_level: +v(
              "autonomy_level",
              String(s.profile?.autonomy_level ?? 2),
            ),
            country: "AR",
            timezone: "America/Argentina/Buenos_Aires",
            onboarding_complete: true,
          })}
        </>
      );
    if (modal === "subjects")
      return (
        <>
          {s.subjects.map((x) => (
            <Text style={st.p} key={x.id}>
              {x.name}
            </Text>
          ))}
          {input("name", "Nueva materia")}
          {choices(
            "color",
            "Color",
            ["#638665", "#bd663f", "#728fa0", "#9880a8"].map((c) => ({
              value: c,
              label: c,
            })),
          )}
          {save(
            "subject.save",
            { name: v("name"), color: v("color", "#638665") },
            "Agregar materia",
          )}
        </>
      );
    if (modal === "item")
      return (
        <>
          {input("title", "¿Qué hay que preparar?")}
          {choices("subject_id", "Materia", subjectOptions)}
          {choices("kind", "Tipo", kindOptions)}
          {input("due_date", "Fecha (AAAA-MM-DD)", addDays(date, 1))}
          {input("due_time", "Hora opcional (HH:MM)")}
          {input("topics", "Temas separados por comas")}
          {input("description", "Notas", "", true)}
          {input("effort_minutes", "Esfuerzo en minutos", "50")}
          {choices(
            "priority",
            "Prioridad",
            [
              { value: "1", label: "Normal" },
              { value: "2", label: "Importante" },
              { value: "3", label: "Alta" },
            ],
            "2",
          )}
          {choices(
            "difficulty",
            "Dificultad",
            [1, 2, 3, 4, 5].map((i) => ({
              value: String(i),
              label: String(i),
            })),
            "3",
          )}
          {save(
            "item.save",
            {
              ...(selected as object),
              title: v("title"),
              subject_id: v("subject_id", s.subjects[0]?.id),
              kind: v("kind", "TASK"),
              due_date: v("due_date", addDays(date, 1)),
              due_time: v("due_time") || null,
              topics: v("topics")
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean),
              description: v("description"),
              effort_minutes: +v("effort_minutes", "50"),
              priority: +v("priority", "2"),
              difficulty: +v("difficulty", "3"),
            },
            "Confirmar actividad",
          )}
        </>
      );
    if (modal === "week")
      return (
        <>
          {s.blocks.map((b) => (
            <View style={st.row} key={b.id}>
              <Text style={st.h3}>{b.label}</Text>
              <Text style={st.p}>
                {b.exception_date ??
                  ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][
                    b.day_of_week
                  ]}{" "}
                · {clock(b.start_minute)}–{clock(b.end_minute)}
              </Text>
              <Button
                secondary
                onPress={() =>
                  run(() => command("block.delete", { id: b.id }, false))
                }
              >
                Quitar horario
              </Button>
            </View>
          ))}
          {input("label", "Nombre del bloque")}
          {choices(
            "day_of_week",
            "Día",
            ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((d, i) => ({
              value: String(i),
              label: d,
            })),
            "1",
          )}
          {choices("kind", "Tipo", [
            { value: "AVAILABLE", label: "Disponible" },
            { value: "SCHOOL", label: "Colegio" },
            { value: "BUSY", label: "Compromiso" },
            { value: "REST", label: "Descanso" },
          ])}
          {input("start", "Desde (HH:MM)", "17:00")}
          {input("end", "Hasta (HH:MM)", "19:00")}
          {input("exception_date", "Solo esta fecha, opcional (AAAA-MM-DD)")}
          {save("block.save", {
            label: v("label"),
            day_of_week: +v("day_of_week", "1"),
            kind: v("kind", "AVAILABLE"),
            start_minute: minuteOf(v("start", "17:00")),
            end_minute: minuteOf(v("end", "19:00")),
            exception_date: v("exception_date") || null,
          })}
        </>
      );
    if (modal === "plan") {
      const plan = proposed ?? active;
      return plan ? (
        <>
          <Text style={st.p}>
            Revisá la propuesta. No cambia tu plan hasta que la aceptes.
          </Text>
          {plan.slots.map((slot) => (
            <View key={slot.id} style={st.row}>
              <Text style={st.h3}>
                {dateLabel(slot.date)} · {clock(slot.start_minute)}
              </Text>
              <Text style={st.p}>
                {s.items.find((x) => x.id === slot.academic_item_id)?.title} ·{" "}
                {slot.duration_minutes} min
              </Text>
              <Text style={st.tag}>{methodById(slot.method_id).name}</Text>
            </View>
          ))}
          {plan.unscheduled.map((x) => (
            <Text style={st.error} key={x.academic_item_id}>
              {s.items.find((i) => i.id === x.academic_item_id)?.title}: faltan{" "}
              {x.minutes} min. {x.reason}
            </Text>
          ))}
          {proposed &&
            save(
              "plan.accept",
              { id: plan.id, version: plan.version },
              "Aceptar este plan",
            )}
        </>
      ) : (
        <Text style={st.p}>Agregá actividades y disponibilidad.</Text>
      );
    }
    if (modal === "focus") {
      const slot = selected as PlanSlot,
        m = methodById(slot.method_id);
      return (
        <>
          <Text style={st.h3}>{slot.objective}</Text>
          <Text style={st.tag}>{m.name}</Text>
          {m.steps.map((x, i) => (
            <Text style={st.p} key={x}>
              {i + 1}. {x}
            </Text>
          ))}
          <Text
            style={[st.h1, { fontSize: 58, textAlign: "center", margin: 25 }]}
          >
            {clock(Math.floor(seconds / 60)).slice(-2)}:
            {String(seconds % 60).padStart(2, "0")}
          </Text>
          <Button
            secondary
            onPress={() => setEnd(end ? null : Date.now() + seconds * 1000)}
          >
            {end ? "Pausar" : "Comenzar / continuar"}
          </Button>
          {input(
            "reflection",
            "¿Qué pudiste explicar y qué queda por revisar?",
            "",
            true,
          )}
          <Text style={st.p}>
            El tiempo es orientativo. Registrá la sesión cuando hayas trabajado
            el objetivo.
          </Text>
          {save(
            "session.complete",
            { slot_id: slot.id, reflection: v("reflection") },
            "Registrar sesión",
          )}
        </>
      );
    }
    if (modal === "checkin") {
      const done = s.checkins.find((x) => x.date === date);
      return done && done.outcome !== "UNCONFIRMED" ? (
        <>
          <Text style={st.tag}>CHECK-IN REGISTRADO</Text>
          <Text style={st.p}>{done.learned}</Text>
          <Text style={st.p}>{done.news}</Text>
        </>
      ) : (
        <>
          {input("learned", "¿Qué aprendiste hoy?", "", true)}
          {input("news", "¿Apareció alguna tarea o cambió algo?", "", true)}
          {choices("outcome", "Respecto del plan", [
            { value: "UNCONFIRMED", label: "No confirmar aún" },
            { value: "DONE", label: "Pude cumplir" },
            { value: "PENDING", label: "No cumplí, sin excepción" },
            { value: "EXCUSED", label: "Hubo un imprevisto" },
          ])}
          {input("exception_reason", "Si hubo un imprevisto, ¿qué cambió?")}
          <Text style={st.p}>
            El incumplimiento reconocido de un plan aceptado puede descontar 5
            monedas disponibles, hasta 15 en siete días. Las excepciones y no
            confirmar no descuentan.
          </Text>
          {save("checkin.save", {
            learned: v("learned"),
            news: v("news"),
            outcome: v("outcome", "UNCONFIRMED"),
            exception_reason: v("exception_reason"),
          })}
        </>
      );
    }
    if (modal === "companion") {
      const appearance = avatarAppearance(s.companion);
      const compa: Companion = {
        ...s.companion,
        ...appearance,
        ...values,
        avatar_style: v(
          "avatar_style",
          appearance.avatar_style,
        ) as Companion["avatar_style"],
        skin_tone: +v("skin_tone", String(appearance.skin_tone)),
        hair_style: v(
          "hair_style",
          appearance.hair_style,
        ) as Companion["hair_style"],
        hair_color: +v("hair_color", String(appearance.hair_color)),
        clothing_style: v(
          "clothing_style",
          appearance.clothing_style,
        ) as Companion["clothing_style"],
        clothing_color: +v("clothing_color", String(appearance.clothing_color)),
        base: +v("base", String(s.companion.base)),
        palette: +v("palette", String(s.companion.palette)),
        eyes: +v("eyes", String(s.companion.eyes)),
        mouth: +v("mouth", String(s.companion.mouth)),
      };
      return (
        <>
          <View
            style={{
              alignItems: "center",
              backgroundColor: colors.panel,
              borderRadius: 10,
            }}
          >
            <Creature companion={compa} size={185} />
          </View>
          {input("name", "Nombre", s.companion.name)}
          <Text style={st.label}>Un punto de partida</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {avatarPresets.map((preset) => (
              <Pressable
                key={preset.name}
                accessibilityRole="button"
                accessibilityLabel={"Elegir a " + preset.name}
                onPress={() =>
                  setValues(
                    Object.fromEntries(
                      Object.entries(preset).map(([key, value]) => [
                        key,
                        String(value),
                      ]),
                    ),
                  )
                }
                style={{
                  paddingHorizontal: 18,
                  paddingVertical: 12,
                  borderRadius: 10,
                  backgroundColor: "#e4e7f0",
                }}
              >
                <Text style={{ color: "#4b5974" }}>{preset.name}</Text>
              </Pressable>
            ))}
          </View>
          {choices(
            "avatar_style",
            "Presentación",
            [
              { value: "boy", label: "Chico" },
              { value: "girl", label: "Chica" },
              { value: "neutral", label: "Neutra" },
            ],
            appearance.avatar_style,
          )}
          {choices(
            "skin_tone",
            "Tono de piel",
            skinTones.map((tone, i) => ({
              value: String(i),
              label: tone.name,
            })),
            String(appearance.skin_tone),
          )}
          {choices(
            "hair_style",
            "Peinado",
            hairStyles.map((style) => ({ value: style.id, label: style.name })),
            appearance.hair_style,
          )}
          {choices(
            "hair_color",
            "Color de cabello",
            hairColors.map((color, i) => ({
              value: String(i),
              label: color.name,
            })),
            String(appearance.hair_color),
          )}
          {choices(
            "clothing_style",
            "Ropa de todos los días",
            clothingStyles.map((style) => ({
              value: style.id,
              label: style.name,
            })),
            appearance.clothing_style,
          )}
          {choices(
            "clothing_color",
            "Color de la ropa",
            clothingColors.map((color, i) => ({
              value: String(i),
              label: color.name,
            })),
            String(appearance.clothing_color),
          )}
          {choices(
            "personality",
            "Personalidad",
            personalities.map((p) => ({ value: p, label: p })),
            s.companion.personality,
          )}
          {(["accessory", "outfit", "decoration"] as const).map((category, i) =>
            choices(
              category,
              ["Accesorio", "Ropa", "Decoración"][i],
              [
                { value: "none", label: "Sin objeto" },
                ...catalog
                  .filter(
                    (x) =>
                      x.category === category && s.inventory.includes(x.id),
                  )
                  .map((x) => ({ value: x.id, label: x.name })),
              ],
              s.companion[category],
            ),
          )}
          {choices(
            "room_theme",
            "Luz de la habitación",
            [
              { value: "day", label: "Día" },
              { value: "evening", label: "Atardecer" },
              { value: "night", label: "Noche" },
            ],
            s.companion.room_theme,
          )}
          {save("companion.save", compa, "Guardar mi compa")}
        </>
      );
    }
    if (modal === "chat")
      return (
        <>
          {s.messages.map((m) => (
            <Card key={m.id}>
              <Text style={st.tag}>
                {m.role === "user" ? "Vos" : s.companion.name}
              </Text>
              <Text style={st.p}>{m.content}</Text>
              {m.citations?.map((c) => (
                <Button
                  key={c.chunk_id}
                  secondary
                  onPress={() =>
                    run(async () => {
                      const mat = s.materials.find(
                        (x) => x.id === c.material_id,
                      );
                      if (mat)
                        await Linking.openURL(await repo.signedUrl(mat.path));
                    })
                  }
                >
                  {c.label} ↗
                </Button>
              ))}
            </Card>
          ))}
          {input("message", "Tu pregunta o intento", "", true)}
          <Button
            disabled={busy}
            onPress={() =>
              run(async () => {
                setEnv(
                  await repo.ai("chat", { message: v("message") }, env.version),
                );
                change("message", "");
              })
            }
          >
            Enviar
          </Button>
          <Text style={st.label}>
            Puede equivocarse. El chat reciente se guarda 30 días.
          </Text>
        </>
      );
    if (modal === "method") {
      const method = selected as (typeof methods)[number];
      return (
        <>
          <Text style={st.h2}>{method.name}</Text>
          <Text style={st.tag}>{method.evidence}</Text>
          <Text style={st.p}>{method.description}</Text>
          {method.steps.map((x, i) => (
            <Text style={st.p} key={x}>
              {i + 1}. {x}
            </Text>
          ))}
          <Text style={st.p}>{method.example}</Text>
          <Text style={st.label}>{method.evidence_note}</Text>
        </>
      );
    }
    if (modal === "upload")
      return (
        <>
          {choices("subject_id", "Materia", subjectOptions)}
          <Text style={st.p}>
            PDF, DOCX, texto o fotografía, hasta 25 MB. Los archivos son
            privados.
          </Text>
          <Button disabled={busy || !s.subjects.length} onPress={upload}>
            Elegir archivo y subir
          </Button>
        </>
      );
    if (modal === "generate")
      return (
        <>
          {input("topic", "Tema")}
          {choices("subject_id", "Materia", subjectOptions)}
          {choices("kind", "Práctica", [
            { value: "QUIZ", label: "Quiz" },
            { value: "FLASHCARDS", label: "Tarjetas" },
            { value: "MOCK", label: "Simulacro" },
          ])}
          {choices("material_id", "Material", [
            { value: "", label: "Práctica general" },
            ...s.materials
              .filter((x) => x.status === "READY")
              .map((x) => ({ value: x.id, label: x.title })),
          ])}
          <Button
            disabled={busy}
            onPress={() =>
              run(async () => {
                setEnv(
                  await repo.ai(
                    "quiz",
                    {
                      topic: v("topic"),
                      subject_id: v("subject_id", s.subjects[0]?.id),
                      kind: v("kind", "QUIZ"),
                      material_id: v("material_id") || null,
                    },
                    env.version,
                  ),
                );
                setModal(null);
              })
            }
          >
            Crear práctica
          </Button>
        </>
      );
    if (modal === "quiz") {
      const quiz = selected as Quiz,
        attempt = s.attempts.filter((x) => x.quiz_id === quiz.id).at(-1);
      return (
        <>
          <Text style={st.h2}>{quiz.title}</Text>
          <Text style={st.tag}>
            {quiz.basis === "MATERIAL" ? "Tu material" : "Práctica general"}
          </Text>
          {quiz.questions.map((q, i) => (
            <Card key={q.id}>
              <Text style={st.h3}>
                {i + 1}. {q.prompt}
              </Text>
              {q.options.length
                ? choices(
                    q.id,
                    "Tu respuesta",
                    q.options.map((x) => ({ value: x, label: x })),
                    "",
                  )
                : input(q.id, "Tu intento")}
              {attempt?.results
                .filter((x) => x.question_id === q.id)
                .map((x) => (
                  <View key={x.question_id}>
                    <Text style={st.h3}>
                      {x.correct ? "Bien resuelto" : "Revisemos este paso"}
                    </Text>
                    <Text style={st.p}>{x.explanation}</Text>
                    <Text style={st.p}>Respuesta: {x.answer}</Text>
                    {quiz.kind === "FLASHCARDS" && (
                      <>
                        <Text style={st.label}>
                          Compará tu intento con el reverso. La coincidencia de
                          texto no evalúa significado.
                        </Text>
                        <Button
                          secondary
                          onPress={() =>
                            run(() =>
                              command(
                                "flashcard.rate",
                                {
                                  quiz_id: quiz.id,
                                  question_id: q.id,
                                  remembered: true,
                                },
                                false,
                              ),
                            )
                          }
                        >
                          La recordé
                        </Button>
                        <Button
                          secondary
                          onPress={() =>
                            run(() =>
                              command(
                                "flashcard.rate",
                                {
                                  quiz_id: quiz.id,
                                  question_id: q.id,
                                  remembered: false,
                                },
                                false,
                              ),
                            )
                          }
                        >
                          Quiero repasarla
                        </Button>
                        <Text style={st.p}>
                          Próximo repaso:{" "}
                          {s.flashcard_reviews?.find(
                            (r) =>
                              r.quiz_id === quiz.id && r.question_id === q.id,
                          )?.due_date ?? "Elegí cómo te fue"}
                        </Text>
                      </>
                    )}
                  </View>
                ))}
            </Card>
          ))}
          <Button
            disabled={busy}
            onPress={() =>
              run(() =>
                command("quiz.submit", { id: quiz.id, answers: values }, false),
              )
            }
          >
            Revisar mi intento
          </Button>
        </>
      );
    }
    if (modal === "memory")
      return (
        <>
          {input("content", "Información académica", "", true)}
          {choices("category", "Tipo", [
            { value: "PREFERENCE", label: "Preferencia" },
            { value: "TOPIC", label: "Tema" },
            { value: "PROGRESS", label: "Progreso" },
          ])}
          {save("memory.save", {
            ...(selected as object),
            content: v("content"),
            category: v("category", "PREFERENCE"),
          })}
        </>
      );
    if (modal === "extract")
      return (
        <>
          {input("text", "Contá qué te pidieron", "", true)}
          <Button
            disabled={busy}
            onPress={() =>
              run(async () => {
                const response = await repo.ai(
                  "extract",
                  { text: v("text") },
                  env.version,
                );
                setSelected(response.proposal);
              })
            }
          >
            Proponer actividades
          </Button>
          {(
            (selected as { items?: Record<string, unknown>[] })?.items ?? []
          ).map((item, i) => (
            <Card key={i}>
              <Text style={st.h3}>{String(item.title)}</Text>
              <Text style={st.p}>
                {String(item.due_date ?? "Fecha por confirmar")}
              </Text>
              <Button
                secondary
                onPress={() =>
                  open("item", { ...item, source: "AI_EXTRACTED" })
                }
              >
                Revisar y confirmar
              </Button>
            </Card>
          ))}
        </>
      );
    if (modal === "settings")
      return (
        <>
          <Button secondary onPress={() => open("profile")}>
            Perfil, descanso y autonomía
          </Button>
          <Button
            secondary
            onPress={() =>
              run(async () => {
                const result = await registerPush(repo);
                Alert.alert(
                  "Recordatorios",
                  result.enabled
                    ? "Notificaciones habilitadas."
                    : "No diste permiso. Podés cambiarlo en los ajustes del teléfono.",
                );
              })
            }
          >
            Habilitar notificaciones
          </Button>
          {input(
            "checkin_minute",
            "Horario del check-in (HH:MM)",
            clock(s.preferences.checkin_minute),
          )}
          {input(
            "quiet_start",
            "No molestar desde (HH:MM)",
            clock(s.preferences.quiet_start),
          )}
          {input("quiet_end", "Hasta (HH:MM)", clock(s.preferences.quiet_end))}
          {choices(
            "checkin_enabled",
            "Check-in",
            [
              { value: "true", label: "Activado" },
              { value: "false", label: "Desactivado" },
            ],
            String(s.preferences.checkin_enabled),
          )}
          {choices(
            "weekends",
            "Fines de semana",
            [
              { value: "false", label: "Sin avisos" },
              { value: "true", label: "Con avisos" },
            ],
            String(s.preferences.weekends),
          )}
          {save("preferences.save", {
            checkin_enabled:
              v("checkin_enabled", String(s.preferences.checkin_enabled)) ===
              "true",
            weekends: v("weekends", String(s.preferences.weekends)) === "true",
            checkin_minute: minuteOf(
              v("checkin_minute", clock(s.preferences.checkin_minute)),
            ),
            quiet_start: minuteOf(
              v("quiet_start", clock(s.preferences.quiet_start)),
            ),
            quiet_end: minuteOf(v("quiet_end", clock(s.preferences.quiet_end))),
          })}
          <Button secondary onPress={shareExport}>
            Exportar mis datos
          </Button>
          <Text style={st.p}>
            El chat se conserva 30 días. La memoria académica es editable. La
            documentación legal requiere revisión antes de la beta para alumnos.
          </Text>
          <Button secondary onPress={() => open("delete-account")}>
            Eliminar mi cuenta
          </Button>
          <Button
            secondary
            onPress={() =>
              run(async () => {
                await repo.signOut();
                setRepo(null);
                setModal(null);
                setEnv({ state: emptySnapshot(), version: 0 });
              })
            }
          >
            Cerrar sesión
          </Button>
        </>
      );
    if (modal === "delete-account")
      return (
        <>
          <Text style={st.p}>
            Se eliminarán datos, archivos y progreso. Esta acción no se puede
            deshacer.
          </Text>
          {input("confirmation", "Escribí ELIMINAR")}
          <Button
            onPress={() =>
              run(async () => {
                if (v("confirmation") !== "ELIMINAR")
                  throw Error("Escribí ELIMINAR para confirmar.");
                await repo.deleteAccount();
                setRepo(null);
                setModal(null);
                setEnv({ state: emptySnapshot(), version: 0 });
              })
            }
          >
            Eliminar definitivamente
          </Button>
        </>
      );
    return null;
  };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          paddingHorizontal: 22,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderColor: colors.line,
        }}
      >
        <Text style={st.h3}>compa virtual</Text>
        <Pressable accessibilityRole="button" onPress={() => open("settings")}>
          <Text style={st.p}>{s.coins} monedas · Ajustes</Text>
        </Pressable>
      </View>
      {repo.mode === "demo" && (
        <Text
          style={{
            backgroundColor: colors.panel,
            padding: 8,
            textAlign: "center",
            fontSize: 10,
            color: colors.muted,
          }}
        >
          Datos ficticios · Sin IA conectada
        </Text>
      )}
      {env.offline && (
        <Text style={st.tag}>Sin conexión · Copia para consulta</Text>
      )}
      <ScrollView
        contentContainerStyle={{ padding: 22, paddingBottom: 35 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={st.eyebrow}>{dateLabel(date).toUpperCase()}</Text>
        <Text style={st.h1}>
          {view === "room"
            ? "Hola, " + (s.profile?.nickname ?? "bienvenido") + "."
            : title}
        </Text>
        {error && !modal && (
          <Text accessibilityRole="alert" style={st.error}>
            {error}
          </Text>
        )}
        {view === "room" && (
          <>
            <Text style={[st.p, { marginVertical: 12 }]}>
              Hagamos algo bueno con este ratito.
            </Text>
            <NativeRoom companion={s.companion} onTalk={() => open("chat")} />
            <Button secondary onPress={() => open("companion", s.companion)}>
              Personalizar mi compa
            </Button>
            <Card>
              <Text style={st.h2}>Tu próximo paso</Text>
              <Text style={st.p}>
                Un plan que entre en tu día, con margen para lo inesperado.
              </Text>
              <Button
                disabled={busy}
                onPress={() =>
                  todaySlots.find((x) => x.status === "PENDING")
                    ? open(
                        "focus",
                        todaySlots.find((x) => x.status === "PENDING"),
                      )
                    : showPlan()
                }
              >
                {todaySlots.some((x) => x.status === "PENDING")
                  ? "Empezar sesión"
                  : "Preparar mi plan"}
              </Button>
            </Card>
            <Button secondary onPress={() => open("checkin")}>
              ¿Cómo viene el día? · Check-in
            </Button>
            <Text style={[st.h2, st.section]}>Lo que se viene</Text>
            {itemList(pending.slice(0, 3))}
          </>
        )}
        {view === "today" && (
          <>
            {todaySlots.length ? (
              todaySlots.map((slot) => (
                <Card key={slot.id}>
                  <Text style={st.tag}>
                    {clock(slot.start_minute)} · {slot.duration_minutes} min
                  </Text>
                  <Text style={st.h3}>
                    {s.items.find((x) => x.id === slot.academic_item_id)?.title}
                  </Text>
                  <Text style={st.p}>{methodById(slot.method_id).name}</Text>
                  {slot.status === "PENDING" ? (
                    <Button onPress={() => open("focus", slot)}>
                      Estudiar
                    </Button>
                  ) : (
                    <Text style={st.tag}>
                      {slot.status === "COMPLETE" ? "Completada" : "Revisada"}
                    </Text>
                  )}
                </Card>
              ))
            ) : (
              <Card>
                <Text style={st.p}>
                  No hay sesiones aceptadas para hoy. Prepará un plan en Agenda.
                </Text>
              </Card>
            )}
            <Button secondary onPress={() => open("checkin")}>
              Registrar check-in
            </Button>
            {itemList(pending.filter((x) => x.due_date <= date))}
          </>
        )}
        {view === "agenda" && (
          <>
            <Button onPress={() => open("item")}>Nueva actividad</Button>
            <View style={{ flexDirection: "row", gap: 9 }}>
              <View style={{ flex: 1 }}>
                <Button secondary onPress={() => open("subjects")}>
                  Materias
                </Button>
              </View>
              <View style={{ flex: 1 }}>
                <Button secondary onPress={() => open("week")}>
                  Mis horarios
                </Button>
              </View>
            </View>
            <Button secondary onPress={() => open("extract")}>
              Agregar desde texto
            </Button>
            <Button disabled={busy} onPress={showPlan}>
              {active ? "Replanificar" : "Preparar plan"}
            </Button>
            {(active || proposed) && (
              <Button secondary onPress={() => open("plan")}>
                Revisar plan
              </Button>
            )}
            {itemList([
              ...pending,
              ...s.items.filter((x) => x.status === "DONE"),
            ])}
          </>
        )}
        {view === "study" && (
          <>
            <Button onPress={() => open("generate")}>Crear práctica</Button>
            <Button secondary onPress={() => open("upload")}>
              Subir material
            </Button>
            <Button
              secondary
              onPress={() => run(async () => setEnv(await repo.load()))}
            >
              Actualizar procesamiento
            </Button>
            {s.materials.map((m) => (
              <Card key={m.id}>
                <Text style={st.h3}>{m.title}</Text>
                <Text style={st.p}>
                  {m.status === "READY"
                    ? "Listo para estudiar"
                    : (m.error_message ?? "Procesamiento pendiente")}
                </Text>
                <Button
                  secondary
                  onPress={() =>
                    run(async () => {
                      await Linking.openURL(await repo.signedUrl(m.path));
                    })
                  }
                >
                  Abrir archivo
                </Button>
                {m.status === "FAILED" && (
                  <Button
                    secondary
                    disabled={busy}
                    onPress={() =>
                      run(() =>
                        command("material.enqueue", { id: m.id }, false),
                      )
                    }
                  >
                    Reintentar procesamiento
                  </Button>
                )}
                <Button
                  secondary
                  onPress={() =>
                    Alert.alert(
                      "Eliminar material",
                      "Se borran el archivo, los fragmentos y las prácticas derivadas.",
                      [
                        { text: "Cancelar" },
                        {
                          text: "Eliminar",
                          style: "destructive",
                          onPress: () =>
                            run(() =>
                              command("material.delete", { id: m.id }, false),
                            ),
                        },
                      ],
                    )
                  }
                >
                  Eliminar material
                </Button>
              </Card>
            ))}
            <Text style={[st.h2, st.section]}>Mis prácticas</Text>
            {s.quizzes.map((q) => (
              <Button secondary key={q.id} onPress={() => open("quiz", q)}>
                {q.title} →
              </Button>
            ))}
            <Text style={[st.h2, st.section]}>17 maneras de estudiar</Text>
            <Text style={st.label}>Revisión pedagógica pendiente</Text>
            {methods.map((m) => (
              <Pressable
                style={st.row}
                key={m.id}
                onPress={() => open("method", m)}
              >
                <Text style={st.h3}>{m.name} ↗</Text>
                <Text style={st.p}>{m.description}</Text>
              </Pressable>
            ))}
          </>
        )}
        {view === "more" && (
          <>
            <Card>
              <Text style={st.h2}>Cada intento cuenta.</Text>
              <Text style={st.p}>
                {s.sessions.length} sesiones · {s.attempts.length} intentos ·{" "}
                {s.streak} días de práctica reciente
              </Text>
              <Text style={st.p}>
                {s.coins} monedas disponibles · {s.xp} experiencia histórica
              </Text>
              {s.sessions.length > 0 && (
                <Text style={st.tag}>🏆 Primer paso</Text>
              )}
              {s.sessions.length >= 5 && (
                <Text style={st.tag}>🏆 Hábito en marcha</Text>
              )}
            </Card>
            <Button secondary onPress={() => open("settings")}>
              Privacidad y ajustes
            </Button>
            <Button secondary onPress={() => open("chat")}>
              Conversar con mi compa
            </Button>
            <Text style={[st.h2, st.section]}>Tus avisos</Text>
            {!s.notifications.length && (
              <Text style={st.p}>
                Los recordatorios de tu agenda aparecerán acá.
              </Text>
            )}
            {s.notifications
              .slice(-20)
              .reverse()
              .map((n) => (
                <Card key={n.id}>
                  <Text style={st.h3}>
                    {n.title}
                    {n.read_at ? "" : " · Nuevo"}
                  </Text>
                  <Text style={st.p}>{n.body}</Text>
                  <Button
                    secondary
                    onPress={() =>
                      run(async () => {
                        await command("notification.read", { id: n.id }, false);
                        setView(n.route);
                      })
                    }
                  >
                    Ver en mi agenda
                  </Button>
                </Card>
              ))}
            <Text style={[st.h2, st.section]}>Memoria académica</Text>
            {s.memories.map((m) => (
              <Card key={m.id}>
                <Text style={st.p}>{m.content}</Text>
                <Button secondary onPress={() => open("memory", m)}>
                  Editar
                </Button>
                <Button
                  secondary
                  onPress={() =>
                    run(() => command("memory.delete", { id: m.id }, false))
                  }
                >
                  Eliminar recuerdo
                </Button>
              </Card>
            ))}
            <Button secondary onPress={() => open("memory")}>
              Agregar recuerdo
            </Button>
            <Text style={[st.h2, st.section]}>Un detalle para tu mundo</Text>
            {catalog.map((item) => (
              <Card key={item.id}>
                <Equipment id={item.id} width={58} />
                <Text style={st.h3}>{item.name}</Text>
                <Button
                  secondary
                  disabled={
                    busy ||
                    s.inventory.includes(item.id) ||
                    s.coins < item.price
                  }
                  onPress={() =>
                    run(() => command("inventory.buy", { id: item.id }, false))
                  }
                >
                  {s.inventory.includes(item.id)
                    ? "En tu colección"
                    : item.price + " monedas"}
                </Button>
              </Card>
            ))}
          </>
        )}
      </ScrollView>
      <View
        style={{
          flexDirection: "row",
          borderTopWidth: 1,
          borderColor: colors.line,
          backgroundColor: "#efefe7",
          paddingVertical: 10,
        }}
      >
        {tabs.map(([id, label]) => (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: view === id }}
            key={id}
            onPress={() => setView(id)}
            style={{ flex: 1, alignItems: "center", paddingVertical: 12 }}
          >
            <Text
              style={{
                fontSize: 12,
                color: view === id ? colors.green : "#99a189",
                fontWeight: view === id ? "700" : "400",
              }}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      <Modal
        visible={!!modal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModal(null)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              padding: 20,
              borderBottomWidth: 1,
              borderColor: colors.line,
            }}
          >
            <Text style={st.h3}>Un paso a la vez</Text>
            <Button
              secondary
              disabled={busy}
              onPress={() => {
                setModal(null);
                setEnd(null);
              }}
            >
              Cerrar
            </Button>
          </View>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                padding: 24,
                gap: 13,
                paddingBottom: 50,
              }}
            >
              {error && (
                <Text accessibilityRole="alert" style={st.error}>
                  {error}
                </Text>
              )}
              {renderModal()}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
