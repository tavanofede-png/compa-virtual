import { MotionPreference } from "../src/MotionPreference";
import { SceneQualityPreference } from "../src/SceneQuality";
import { NativeMaterialText } from "../src/MaterialText";
import { NativeVoiceCall } from "../src/NativeVoiceCall";
import { NativeSupportCenter } from "../src/SupportCenter";
import { NativeHome, NativeCompa, TabIcon } from "../src/HomeScreen";
import { Text } from "../src/ui";
import { NativeTogether } from "../src/Together";
import { NativeAgendaCalendar } from "../src/AgendaCalendar";
import {
  NativeStudyHubNav,
  NativeStudySpaces,
  NativeStudyView,
} from "../src/StudySpaces";
import { Creature, Equipment, NativeRoom, NativeWorld } from "../src/Creature";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { CompanionSetup } from "../src/CompanionSetup";
import {
  View,
  ScrollView,
  Pressable,
  Modal,
  Alert,
  Platform,
  Linking,
  KeyboardAvoidingView,
  AppState,
  BackHandler,
  Image,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import * as Notifications from "expo-notifications";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Speech from "expo-speech";
import {
  createBackend,
  createDemo,
  createRepository,
  StateConflictError,
  type Repository,
  type Envelope,
} from "@compa/client";
import {
  destinations,
  emptySnapshot,
  selectCharacter,
  methods,
  methodById,
  prepareDailyStudy,
  freeStudyDurations,
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
  type Quiz,
  type PlanSlot,
  type Companion,
  activePet,
  petDefinition,
  petDefinitions,
  companionVoiceProfile,
  studySpaceById,
  resolveNotificationLaunch,
  memoryOriginLabel,
  materialIsProcessing,
  materialCanRetry,
  materialStatusLabel,
} from "@compa/domain";
import { cache, secureStorage } from "../src/storage";
import { registerPush } from "../src/push";
import { Button, Field, Choices, Card, styles as st, colors } from "../src/ui";

const petPortraits: Record<string, number> = {
  "golden-retriever": require("../../web/public/selection/pets/golden-retriever.webp"),
  "border-collie": require("../../web/public/selection/pets/border-collie.webp"),
  corgi: require("../../web/public/selection/pets/corgi.webp"),
  dachshund: require("../../web/public/selection/pets/dachshund.webp"),
  "french-bulldog": require("../../web/public/selection/pets/french-bulldog.webp"),
  "shiba-inu": require("../../web/public/selection/pets/shiba-inu.webp"),
  poodle: require("../../web/public/selection/pets/poodle.webp"),
  husky: require("../../web/public/selection/pets/husky.webp"),
  "orange-tabby": require("../../web/public/selection/pets/orange-tabby.webp"),
  "black-cat": require("../../web/public/selection/pets/black-cat.webp"),
  siamese: require("../../web/public/selection/pets/siamese.webp"),
  ragdoll: require("../../web/public/selection/pets/ragdoll.webp"),
  "british-shorthair": require("../../web/public/selection/pets/british-shorthair.webp"),
  "maine-coon": require("../../web/public/selection/pets/maine-coon.webp"),
  calico: require("../../web/public/selection/pets/calico.webp"),
  sphynx: require("../../web/public/selection/pets/sphynx.webp"),
  rabbit: require("../../web/public/selection/pets/rabbit.webp"),
  hamster: require("../../web/public/selection/pets/hamster.webp"),
  "guinea-pig": require("../../web/public/selection/pets/guinea-pig.webp"),
  ferret: require("../../web/public/selection/pets/ferret.webp"),
  hedgehog: require("../../web/public/selection/pets/hedgehog.webp"),
  turtle: require("../../web/public/selection/pets/turtle.webp"),
  gecko: require("../../web/public/selection/pets/gecko.webp"),
  budgie: require("../../web/public/selection/pets/budgie.webp"),
};
const url = process.env.EXPO_PUBLIC_SUPABASE_URL,
  key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const backend =
  process.env.EXPO_PUBLIC_DEMO_MODE !== "1" && url && key
    ? createBackend(url, key, secureStorage)
    : null;
const welcomeCompanion = {
  ...selectCharacter("harper"),
  room_theme: "evening" as const,
};
const tabs = destinations.map((d) => [d.id, d.label]);
const days = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
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
    [authMode, setAuthMode] = useState("register"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [voiceEnabled, setVoiceEnabled] = useState(true),
    [speaking, setSpeaking] = useState(false),
    [callActive, setCallActive] = useState(false),
    [pendingChat, setPendingChat] = useState(""),
    [sessionClock, setSessionClock] = useState(Date.now());
  const [loaded, setLoaded] = useState(false),
    [authReady, setAuthReady] = useState(!backend);
  const account = useRef<string | undefined>(undefined);
  const pageScroll = useRef<ScrollView>(null);
  useEffect(() => {
    pageScroll.current?.scrollTo({ y: 0, animated: false });
  }, [view]);
  const latestEnvelope = useRef(env);
  latestEnvelope.current = env;
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (modal) {
          if (!busy) setModal(null);
          return true;
        }
        if (view !== "room") {
          setView("room");
          return true;
        }
        return false;
      },
    );
    return () => subscription.remove();
  }, [modal, busy, view]);
  const s = env.state,
    date = today(s.profile?.timezone),
    active = s.plans.find((p) => p.status === "ACCEPTED"),
    proposed = s.plans.find((p) => p.status === "PROPOSED");
  const spokenAgentReply = (message: (typeof s.messages)[number]) =>
    [message.content, ...(message.actions?.map((action) => action.label) ?? [])]
      .filter(Boolean)
      .join(" ");
  useEffect(() => {
    cache.getItem("kusiy:companion-voice").then((value) => {
      if (value !== null) setVoiceEnabled(value === "1");
    });
    return () => {
      void Speech.stop();
    };
  }, []);
  useEffect(() => {
    if (params.view) setView(params.view);
  }, [params.view]);
  useEffect(() => {
    if (!backend) return;
    let alive = true;
    const apply = (id?: string) => {
      if (!alive) return;
      setAuthReady(true);
      if (account.current === id) return;
      account.current = id;
      setLoaded(false);
      setEnv({ state: emptySnapshot(), version: 0 });
      setModal(null);
      setRepo(id ? createRepository(backend, cache, id) : null);
    };
    backend.auth
      .getSession()
      .then(({ data }) => apply(data.session?.user.id))
      .catch(() => {
        if (alive) {
          setAuthReady(true);
          setError("No pudimos recuperar tu sesión. Intentá entrar de nuevo.");
        }
      });
    const { data } = backend.auth.onAuthStateChange((event, session) => {
      apply(session?.user.id);
      if (event === "PASSWORD_RECOVERY") setModal("password");
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (!backend) return;
    const handle = async (url: string) => {
      if (!url.startsWith("compavirtual://") && !url.startsWith("kusiy://"))
        return;
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
    let alive = true;
    setLoaded(false);
    repo
      .load()
      .then((result) => {
        if (!alive) return;
        setEnv(result);
        setLoaded(true);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [repo]);
  useEffect(() => {
    if (repo?.mode !== "live") return;
    let alive = true;
    let previous = AppState.currentState;
    const listener = AppState.addEventListener("change", (state) => {
      if (previous !== "active" && state === "active" && !busy) {
        void repo
          .load()
          .then((latest) => {
            if (alive)
              setEnv((current) =>
                latest.version >= current.version ? latest : current,
              );
          })
          .catch(() => {});
      }
      previous = state;
    });
    return () => {
      alive = false;
      listener.remove();
    };
  }, [repo, busy]);
  useEffect(() => {
    if (repo?.mode !== "live" || modal !== "focus" || !env.state.activeSession)
      return;
    let alive = true;
    const timer = setInterval(() => {
      if (AppState.currentState !== "active" || busy) return;
      void repo
        .load()
        .then((latest) => {
          if (alive)
            setEnv((current) =>
              latest.version > current.version ? latest : current,
            );
        })
        .catch(() => {});
    }, 15000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [repo, busy, modal, env.state.activeSession?.id]);
  useEffect(() => {
    if (
      !repo ||
      repo.mode !== "live" ||
      view !== "study" ||
      busy ||
      !env.state.materials.some(materialIsProcessing)
    )
      return;
    const timer = setInterval(() => {
      if (AppState.currentState === "active")
        void repo
          .load()
          .then(setEnv)
          .catch(() => {});
    }, 10000);
    return () => clearInterval(timer);
  }, [repo, view, busy, env.state.materials]);
  useEffect(() => {
    if (!backend || !repo || repo.mode !== "live") return;
    let alive = true;
    const receive = async (response: Notifications.NotificationResponse) => {
      if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER)
        return;
      const payload = response.notification.request.content.data;
      const url = payload?.url;
      const notificationId = payload?.notificationId;
      if (
        typeof url !== "string" ||
        (!url.startsWith("compavirtual://?view=") &&
          !url.startsWith("kusiy://?view=")) ||
        typeof notificationId !== "string"
      )
        return;
      try {
        const { data, error: authError } = await backend.auth.getUser();
        if (authError || !data.user || data.user.id !== account.current) {
          if (alive) setError("Ingresá con tu cuenta para abrir este aviso.");
          return;
        }
        const latest = await repo.load();
        if (latest.offline) {
          if (alive)
            setError("Conectate para comprobar si este aviso sigue vigente.");
          return;
        }
        if (
          latest.consent?.required &&
          (!latest.consent.recorded ||
            !latest.consent.minor_beta ||
            !latest.consent.capabilities?.service)
        ) {
          if (alive)
            setError(
              "Falta la autorización familiar verificada para abrir este aviso.",
            );
          return;
        }
        const launch = resolveNotificationLaunch(
          latest.state,
          notificationId,
          new URL(url).searchParams.get("view") ?? "",
          new Date().toISOString(),
        );
        if (!launch) {
          if (alive)
            setError("Este aviso ya no está vigente. Revisá tu agenda.");
          return;
        }
        if (
          launch.target === "together" &&
          !(await repo.collaboration?.overview())?.enabled
        ) {
          if (alive) setError("El encuentro ya no está disponible.");
          return;
        }
        if (alive) {
          setEnv(latest);
          setView(launch.target);
          if (launch.focus) {
            setSelected(launch.slot);
            setModal("focus");
          }
        }
      } catch {
        if (alive)
          setError("No pudimos comprobar el aviso. Reintentá desde tu agenda.");
      } finally {
        await Notifications.clearLastNotificationResponseAsync().catch(
          () => {},
        );
      }
    };
    const listener = Notifications.addNotificationResponseReceivedListener(
      (response) => void receive(response),
    );
    Notifications.getLastNotificationResponseAsync()
      .then((r) => {
        if (r) void receive(r);
      })
      .catch(() => {});
    return () => {
      alive = false;
      listener.remove();
    };
  }, [repo]);
  useEffect(() => {
    if (modal !== "focus" || !env.state.activeSession?.running_since) return;
    const timer = setInterval(() => setSessionClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [modal, env.state.activeSession?.running_since]);
  useEffect(() => {
    const activeSession = env.state.activeSession;
    if (
      !repo ||
      !activeSession?.running_since ||
      env.pendingSessionFinish ||
      (activeSession.controller_device_id &&
        activeSession.controller_device_id !== env.deviceId)
    )
      return;
    let pauseRequested = false;
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active" || pauseRequested) return;
      pauseRequested = true;
      void repo
        .command(
          { type: "session.pause", payload: { id: activeSession.id } },
          env.version,
        )
        .then(setEnv)
        .catch((error) => {
          if (error instanceof StateConflictError && error.latest)
            setEnv(error.latest);
          // A failed pause remains visible on the next load; do not claim it was saved.
        });
    });
    return () => listener.remove();
  }, [
    repo,
    env.version,
    env.state.activeSession?.id,
    env.state.activeSession?.running_since,
    env.state.activeSession?.controller_device_id,
    env.deviceId,
    env.pendingSessionFinish,
  ]);
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
      if (e instanceof StateConflictError && e.latest) setEnv(e.latest);
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
  };
  const change = (key: string, value: string) =>
    setValues((v) => ({
      ...v,
      [key]: value,
      ...(key === "clothing_style" ? { outfit: "none" } : {}),
    }));
  const setVoice = (value: boolean) => {
    setVoiceEnabled(value);
    void cache.setItem("kusiy:companion-voice", value ? "1" : "0");
    if (!value) {
      void Speech.stop();
      setSpeaking(false);
    }
  };
  const speakCompanion = async (text: string, force = false) => {
    if ((!voiceEnabled && !force) || !text.trim()) return;
    const profile = companionVoiceProfile(s.companion.character_id);
    const voices = (await Speech.getAvailableVoicesAsync())
      .filter((voice) => voice.language.toLowerCase().startsWith("es"))
      .sort(
        (a, b) =>
          Number(b.quality === "Enhanced") - Number(a.quality === "Enhanced") ||
          a.name.localeCompare(b.name),
      );
    const voice = voices[profile.voiceOffset % Math.max(voices.length, 1)];
    await Speech.stop();
    Speech.speak(text.slice(0, Speech.maxSpeechInputLength), {
      language: voice?.language ?? profile.language,
      voice: voice?.identifier,
      rate: profile.rate,
      pitch: profile.pitch,
      onStart: () => setSpeaking(true),
      onDone: () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
      onError: () => {
        setSpeaking(false);
        setError("La voz del dispositivo no pudo reproducirse.");
      },
    });
  };
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
      spaces: "Tus espacios de estudio.",
      more: "Tu progreso y tus decisiones",
      progress: "Cada intento cuenta.",
      compa: "Tu compa",
      memory: "Memoria académica",
      notifications: "Tus avisos",
    }[view] ?? "Kusiy";
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
  if (!authReady || (repo && !loaded))
    return (
      <SafeAreaView
        style={{
          flex: 1,
          padding: 24,
          justifyContent: "center",
          backgroundColor: colors.bg,
        }}
      >
        <Text style={st.p}>{error || "Recuperando tu espacio…"}</Text>
        {error && (
          <Button
            onPress={() =>
              void run(async () => {
                if (repo) {
                  setEnv(await repo.load());
                  setLoaded(true);
                }
              })
            }
          >
            Reintentar
          </Button>
        )}
      </SafeAreaView>
    );
  if (
    repo &&
    loaded &&
    modal !== "password" &&
    (!s.profile?.onboarding_complete ||
      !s.companion.character_id ||
      modal === "companion")
  )
    return (
      <CompanionSetup
        key={modal === "companion" ? "editor" : "welcome"}
        repo={repo}
        env={env}
        update={setEnv}
        editing={
          modal === "companion" &&
          !!s.profile?.onboarding_complete &&
          !!s.companion.character_id
        }
        onExit={() => {
          if (modal === "companion") setModal(null);
          else
            void run(async () => {
              await repo.signOut();
              setRepo(null);
              setEnv({ state: emptySnapshot(), version: 0 });
            });
        }}
        onComplete={() => {
          setModal(null);
          setView("room");
        }}
      />
    );
  if (!repo)
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScrollView
          contentContainerStyle={{ padding: 25, gap: 20 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
            <Image
              source={require("../assets/kusiy-logo.png")}
              style={{ width: 54, height: 54, resizeMode: "contain" }}
              accessibilityIgnoresInvertColors
            />
            <View>
              <Text style={st.h3}>Kusiy</Text>
              <Text style={st.eyebrow}>UN PASO A LA VEZ</Text>
            </View>
          </View>
          <Text style={[st.h1, { fontSize: 43, lineHeight: 48 }]}>
            Tu mundo.{"\n"}Tu manera de aprender.
          </Text>
          <NativeRoom
            companion={welcomeCompanion}
            onTalk={() => setRepo(createDemo(cache, { onboarding: true }))}
            height={330}
          />
          <Text style={st.p}>
            Organizá tu semana, practicá y celebrá cada paso.
          </Text>
          <Button
            secondary
            onPress={() => setRepo(createDemo(cache, { onboarding: true }))}
          >
            Probar la bienvenida sin cuenta
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
                      const { data, error } = await backend.auth.signUp({
                        email,
                        password,
                        options: { emailRedirectTo: "compavirtual://" },
                      });
                      if (error) throw error;
                      if (!data.session)
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
    if (modal === "pet") {
      const pet = activePet(s),
        definition = petDefinition(pet?.petDefinitionId);
      return (
        <>
          <View style={{ alignItems: "center", gap: 8 }}>
            <Image
              source={petPortraits[definition.id]}
              style={{ width: 210, height: 210, borderRadius: 28 }}
            />
            <Text style={st.eyebrow}>
              TU MASCOTA · {definition.breed.toUpperCase()}
            </Text>
            <Text style={st.p}>{definition.description}</Text>
          </View>
          {input(
            "pet_name",
            "¿Cómo se va a llamar?",
            pet?.name ?? definition.name,
          )}
          {!pet ? (
            <Button
              disabled={busy}
              onPress={() =>
                run(() =>
                  command("pet.chooseFirst", {
                    name: v("pet_name", definition.name),
                  }),
                )
              }
            >
              Conocer a {v("pet_name", definition.name)}
            </Button>
          ) : (
            <>
              <Text style={st.h3}>Tu colección</Text>
              {choices(
                "pet_family",
                "Familia",
                [
                  { value: "dogs", label: "Perros" },
                  { value: "cats", label: "Gatos" },
                  { value: "others", label: "Otros amigos" },
                ],
                definition.species === "dog"
                  ? "dogs"
                  : definition.species === "cat"
                    ? "cats"
                    : "others",
              )}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {petDefinitions
                  .filter((candidate) => {
                    const family = v(
                      "pet_family",
                      definition.species === "dog"
                        ? "dogs"
                        : definition.species === "cat"
                          ? "cats"
                          : "others",
                    );
                    return family === "dogs"
                      ? candidate.species === "dog"
                      : family === "cats"
                        ? candidate.species === "cat"
                        : !["dog", "cat"].includes(candidate.species);
                  })
                  .map((candidate) => {
                    const owned = s.ownedPets.find(
                      (entry) => entry.petDefinitionId === candidate.id,
                    );
                    const selected = owned?.id === pet.id;
                    const price =
                      candidate.unlock.kind === "coins"
                        ? Number(candidate.unlock.value)
                        : 0;
                    return (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{
                          selected,
                          disabled: busy || selected,
                        }}
                        key={candidate.id}
                        disabled={busy || selected}
                        onPress={() =>
                          run(() =>
                            owned
                              ? command("pet.setActive", { id: owned.id })
                              : command("pet.unlock", {
                                  definitionId: candidate.id,
                                }),
                          )
                        }
                        style={{
                          width: "48%",
                          padding: 10,
                          borderRadius: 18,
                          borderWidth: selected ? 2 : 1,
                          borderColor: selected ? "#d9a62e" : colors.line,
                          backgroundColor: selected ? "#fff2c9" : "#fffaf2",
                          gap: 5,
                        }}
                      >
                        <Image
                          source={petPortraits[candidate.id]}
                          style={{
                            width: "100%",
                            aspectRatio: 1,
                            borderRadius: 14,
                          }}
                        />
                        <Text style={[st.p, { fontWeight: "700" }]}>
                          {candidate.breed}
                        </Text>
                        <Text style={{ color: colors.muted, fontSize: 12 }}>
                          {selected
                            ? "Está con vos"
                            : owned
                              ? "Elegir"
                              : `${price} monedas`}
                        </Text>
                      </Pressable>
                    );
                  })}
              </View>
              {choices(
                "pet_activity",
                "Nivel de actividad",
                [
                  { value: "calm", label: "Tranquilo" },
                  { value: "normal", label: "Normal" },
                  { value: "active", label: "Activo" },
                ],
                s.petPreferences.activityLevel,
              )}
              {choices(
                "pet_visible",
                "Mostrar en la habitación",
                [
                  { value: "true", label: "Sí" },
                  { value: "false", label: "No" },
                ],
                String(s.petPreferences.visible),
              )}
              {choices(
                "pet_auto",
                "Movimiento automático",
                [
                  { value: "true", label: "Activado" },
                  { value: "false", label: "Desactivado" },
                ],
                String(s.petPreferences.automaticMovement),
              )}
              {choices(
                "pet_reduced",
                "Movimiento reducido",
                [
                  { value: "false", label: "No" },
                  { value: "true", label: "Sí" },
                ],
                String(s.petPreferences.reducedMotion),
              )}
              <Text style={st.p}>
                Su lugar de descanso y sus objetos compatibles quedan preparados
                dentro del cuarto.
              </Text>
              <Button
                disabled={busy}
                onPress={() =>
                  run(() =>
                    command("pet.configure", {
                      id: pet.id,
                      name: v("pet_name", pet.name),
                      visible:
                        v("pet_visible", String(s.petPreferences.visible)) ===
                        "true",
                      automaticMovement:
                        v(
                          "pet_auto",
                          String(s.petPreferences.automaticMovement),
                        ) === "true",
                      activityLevel: v(
                        "pet_activity",
                        s.petPreferences.activityLevel,
                      ),
                      reducedMotion:
                        v(
                          "pet_reduced",
                          String(s.petPreferences.reducedMotion),
                        ) === "true",
                    }),
                  )
                }
              >
                Guardar mascota
              </Button>
            </>
          )}
        </>
      );
    }
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
      const slot = selected as PlanSlot | undefined;
      const activeSession = s.activeSession;
      const pendingFinish =
        env.pendingSessionFinish?.sessionId === activeSession?.id
          ? env.pendingSessionFinish
          : undefined;
      const remoteControl = Boolean(
        activeSession?.controller_device_id &&
        activeSession.controller_device_id !== env.deviceId,
      );
      const prepared = prepareDailyStudy(s);
      const method = methodById(
        activeSession?.method_id ?? slot?.method_id ?? "retrieval",
      );
      const item = s.items.find(
        (entry) =>
          entry.id ===
          (activeSession?.academic_item_id ?? slot?.academic_item_id),
      );
      const subjectId = activeSession?.subject_id ?? item?.subject_id;
      const subject = s.subjects.find((entry) => entry.id === subjectId);
      const practice = s.quizzes.find((quiz) => quiz.subject_id === subjectId);
      const elapsed = activeSession
        ? activeSession.elapsed_seconds +
          (activeSession.running_since
            ? Math.max(
                0,
                Math.floor(
                  ((pendingFinish
                    ? Date.parse(pendingFinish.finishedAt)
                    : sessionClock) -
                    Date.parse(activeSession.running_since)) /
                    1000,
                ),
              )
            : 0)
        : 0;
      return (
        <>
          <Text style={st.tag}>
            {activeSession
              ? pendingFinish
                ? "CIERRE PENDIENTE"
                : "SESIÓN EN CURSO"
              : slot
                ? "BLOQUE DEL PLAN"
                : "ESTUDIO LIBRE"}
          </Text>
          {activeSession ? (
            <>
              <NativeStudyView
                id={studySpaceById(s.activeStudySpaceId).id}
                companion={s.companion}
              />
              <Text style={st.h3}>{activeSession.objective}</Text>
              <Text style={st.p}>
                {subject?.name ? `${subject.name} · ` : ""}
                {method.name} · objetivo de {activeSession.planned_minutes}{" "}
                minutos
              </Text>
              {remoteControl && (
                <View style={{ gap: 10 }} accessibilityRole="summary">
                  <Text style={st.h3}>
                    Esta sesión está abierta en otro dispositivo.
                  </Text>
                  <Text style={st.p}>
                    Podés verla acá. Si tomás el control, el tiempo se pausará
                    hasta que elijas Continuar.
                  </Text>
                  <Button
                    disabled={busy || env.offline}
                    onPress={() =>
                      run(() =>
                        command(
                          "session.takeControl",
                          { id: activeSession.id },
                          false,
                        ),
                      )
                    }
                  >
                    Tomar control
                  </Button>
                </View>
              )}
              {pendingFinish && (
                <View style={{ gap: 10 }} accessibilityRole="summary">
                  <Text style={st.h3}>
                    {pendingFinish.status === "conflict"
                      ? "Revisá este cierre"
                      : "Cierre pendiente de sincronizar"}
                  </Text>
                  <Text style={st.p}>
                    {pendingFinish.status === "conflict"
                      ? "La sesión cambió en otro dispositivo. No confirmamos el cierre ni las monedas."
                      : "Detuvimos el tiempo acá. El historial y las monedas se actualizarán cuando el servidor confirme el cierre."}
                  </Text>
                  <Button
                    secondary
                    disabled={
                      busy ||
                      (!!env.offline && pendingFinish.status !== "conflict")
                    }
                    onPress={() =>
                      run(async () => {
                        const latest =
                          pendingFinish.status === "conflict"
                            ? await repo?.dismissPendingSessionFinish()
                            : await repo?.syncPendingSessionFinish();
                        if (latest) setEnv(latest);
                      })
                    }
                  >
                    {pendingFinish.status === "conflict"
                      ? "Revisar sesión actual"
                      : "Reintentar ahora"}
                  </Button>
                </View>
              )}
              <Text
                style={[
                  st.h1,
                  { fontSize: 58, textAlign: "center", margin: 25 },
                ]}
                accessibilityLabel={`${Math.floor(elapsed / 60)} minutos y ${elapsed % 60} segundos ${pendingFinish ? "pendientes de confirmar" : "registrados"}`}
              >
                {String(Math.floor(elapsed / 60)).padStart(2, "0")}:
                {String(elapsed % 60).padStart(2, "0")}
              </Text>
              <Button
                secondary
                disabled={busy || remoteControl || !!pendingFinish}
                onPress={() =>
                  run(() =>
                    command(
                      activeSession.running_since
                        ? "session.pause"
                        : "session.resume",
                      { id: activeSession.id },
                      false,
                    ),
                  )
                }
              >
                {activeSession.running_since ? "Pausar" : "Continuar"}
              </Button>
              {method.steps.map((step, index) => (
                <Text style={st.p} key={step}>
                  {index + 1}. {step}
                </Text>
              ))}
            </>
          ) : slot ? (
            <>
              <Text style={st.h3}>{slot.objective}</Text>
              <Text style={st.p}>
                {method.name} · {slot.duration_minutes} minutos orientativos
              </Text>
              <Button
                disabled={busy}
                onPress={() =>
                  run(() =>
                    command("session.start", { slot_id: slot.id }, false),
                  )
                }
              >
                Empezar sesión
              </Button>
            </>
          ) : (
            <>
              <Text style={st.h3}>¿Qué querés estudiar?</Text>
              {prepared.origin === "ACTIVITY" ? (
                <Text style={st.p}>
                  Sugerimos una actividad cercana de tu agenda. Podés cambiarla;
                  estudiar no la marca como hecha.
                </Text>
              ) : prepared.remembered ? (
                <Text style={st.p}>
                  Preparamos tus últimas preferencias. Podés cambiarlas antes de
                  empezar.
                </Text>
              ) : null}
              {input(
                "objective",
                "Objetivo, por ejemplo repasar Biología",
                prepared.objective,
              )}
              {choices(
                "subject_id",
                "Materia, si corresponde",
                [{ value: "", label: "Sin materia" }, ...subjectOptions],
                prepared.subjectId,
              )}
              {choices(
                "method_id",
                "Método",
                methods.map((entry) => ({
                  value: entry.id,
                  label: entry.name,
                })),
                prepared.methodId,
              )}
              {choices(
                "planned_minutes",
                "Duración orientativa",
                freeStudyDurations.map((minutes) => ({
                  value: String(minutes),
                  label: `${minutes} minutos`,
                })),
                String(prepared.plannedMinutes),
              )}
              <Button
                disabled={busy || !v("objective", prepared.objective).trim()}
                onPress={() =>
                  run(() =>
                    command(
                      "session.start",
                      {
                        objective: v("objective", prepared.objective),
                        subject_id:
                          v("subject_id", prepared.subjectId) || undefined,
                        method_id: v("method_id", prepared.methodId),
                        planned_minutes: Number(
                          v("planned_minutes", String(prepared.plannedMinutes)),
                        ),
                        ...(prepared.academicItemId &&
                        v("objective", prepared.objective).trim() ===
                          prepared.objective &&
                        v("subject_id", prepared.subjectId) ===
                          prepared.subjectId
                          ? { academic_item_id: prepared.academicItemId }
                          : {}),
                      },
                      false,
                    ),
                  )
                }
              >
                Empezar a estudiar
              </Button>
            </>
          )}
          {practice && (
            <Button secondary onPress={() => open("quiz", practice)}>
              Abrir una práctica de esta materia
            </Button>
          )}
          {activeSession && !remoteControl && !pendingFinish && (
            <>
              {choices(
                "feedback",
                "¿Cómo te fue? (opcional)",
                [
                  { value: "", label: "Prefiero omitirlo" },
                  { value: "EASY", label: "Fácil" },
                  { value: "GOOD", label: "Bien" },
                  { value: "HARD", label: "Me costó" },
                  { value: "VERY_HARD", label: "Muy difícil" },
                ],
                "",
              )}
              {input("reflection", "Comentario (opcional)", "", true)}
              <Text style={st.p}>
                Podés cerrar sin responder. Las monedas se acreditan después de
                cinco minutos reales, sin depender de esta valoración.
              </Text>
              <Button
                disabled={busy}
                onPress={() =>
                  run(async () => {
                    if (!repo) return;
                    const result = await repo.finishSession(
                      {
                        id: activeSession.id,
                        feedback: v("feedback") || undefined,
                        reflection: v("reflection") || undefined,
                      },
                      env.version,
                    );
                    setEnv(result);
                    if (!result.pendingSessionFinish) setModal(null);
                  })
                }
              >
                Cerrar sesión
              </Button>
              <Button
                secondary
                disabled={busy}
                onPress={() =>
                  Alert.alert(
                    "Descartar sesión",
                    "Esta sesión no aparecerá en tu historial.",
                    [
                      { text: "Seguir estudiando", style: "cancel" },
                      {
                        text: "Descartar",
                        style: "destructive",
                        onPress: () =>
                          void run(() =>
                            command("session.discard", {
                              id: activeSession.id,
                            }),
                          ),
                      },
                    ],
                  )
                }
              >
                Descartar sesión
              </Button>
            </>
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
            El check-in no descuenta monedas. Si algo cambió, se conserva el
            resultado para ayudarte a reorganizar el plan sin penalizaciones.
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
          <View
            style={{
              height: 220,
              borderRadius: 24,
              overflow: "hidden",
              backgroundColor: "#f0e8df",
            }}
          >
            <NativeWorld
              companion={s.companion}
              kind="avatar"
              active
              motionContext={{ talking: true, speaking }}
            />
          </View>
          <Text style={st.p}>
            {speaking
              ? `${s.companion.name} está hablando.`
              : "La voz usa gratis las voces instaladas en este dispositivo."}
          </Text>
          <NativeVoiceCall
            key={s.profile?.id ?? "demo"}
            repo={repo}
            characterId={s.companion.character_id}
            disabled={busy}
            onActiveChange={setCallActive}
            onSpeakingChange={setSpeaking}
            onUnsent={(text) => change("message", text)}
            onTurn={async (message) => {
              const userId = account.current;
              setPendingChat(message);
              setBusy(true);
              try {
                const next = await repo.ai(
                  "chat",
                  { message },
                  latestEnvelope.current.version,
                );
                if (account.current !== userId)
                  throw Error("La cuenta cambió. La llamada se cerró.");
                latestEnvelope.current = next;
                setEnv(next);
                const answer = [...next.state.messages]
                  .reverse()
                  .find((item) => item.role === "assistant");
                const navigation = answer?.effects?.find(
                  (effect) => effect.type === "NAVIGATE",
                );
                return {
                  text: answer ? spokenAgentReply(answer) : "",
                  afterSpeech: navigation
                    ? () => {
                        setModal(null);
                        setView(navigation.target);
                      }
                    : undefined,
                };
              } finally {
                if (account.current === userId) {
                  setPendingChat("");
                  setBusy(false);
                }
              }
            }}
          />
          {s.messages.map((m) => (
            <Card key={m.id}>
              <Text style={st.tag}>
                {m.role === "user" ? "Vos" : s.companion.name}
              </Text>
              <Text style={st.p}>{m.content}</Text>
              {m.actions?.map((action) => (
                <Text
                  key={action.id}
                  style={[
                    st.p,
                    {
                      color:
                        action.status === "COMPLETED" ? "#245a43" : "#7b431e",
                      backgroundColor:
                        action.status === "COMPLETED" ? "#e9f5ec" : "#fff2df",
                      padding: 10,
                      borderRadius: 12,
                    },
                  ]}
                >
                  {action.status === "COMPLETED" ? "✓" : "!"} {action.label}
                </Text>
              ))}
              {m.role === "assistant" && (
                <Button
                  secondary
                  disabled={callActive}
                  onPress={() => void speakCompanion(spokenAgentReply(m), true)}
                >
                  Escuchar respuesta
                </Button>
              )}
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
          {!!pendingChat && (
            <>
              <Card>
                <Text style={st.tag}>Vos</Text>
                <Text style={st.p}>{pendingChat}</Text>
              </Card>
              <Card>
                <Text style={st.tag}>{s.companion.name}</Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                  accessibilityLiveRegion="polite"
                >
                  <ActivityIndicator color="#315f55" />
                  <Text style={st.p}>Está pensando…</Text>
                </View>
              </Card>
            </>
          )}
          {input("message", "Tu pregunta o intento", "", true)}
          <Button
            disabled={busy || callActive || !v("message").trim()}
            onPress={() => {
              const message = v("message").trim();
              if (!message || busy) return;
              setPendingChat(message);
              change("message", "");
              void run(async () => {
                try {
                  const next = await repo.ai("chat", { message }, env.version);
                  setEnv(next);
                  const answer = [...next.state.messages]
                    .reverse()
                    .find((messageItem) => messageItem.role === "assistant");
                  if (answer) {
                    await speakCompanion(spokenAgentReply(answer));
                    const navigation = answer.effects?.find(
                      (effect) => effect.type === "NAVIGATE",
                    );
                    if (navigation) {
                      setModal(null);
                      setView(navigation.target);
                    }
                  }
                } finally {
                  setPendingChat("");
                }
              });
            }}
          >
            Enviar
          </Button>
          <Button
            secondary
            disabled={callActive}
            onPress={() => setVoice(!voiceEnabled)}
          >
            {voiceEnabled
              ? "Desactivar lectura automática"
              : "Activar lectura automática"}
          </Button>
          {speaking && !callActive && (
            <Button
              secondary
              onPress={() => {
                void Speech.stop();
                setSpeaking(false);
              }}
            >
              Detener voz
            </Button>
          )}
          <Text style={st.label}>
            Puede equivocarse. El chat reciente se guarda 30 días. La voz es
            sintética y puede variar según el dispositivo.
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
    if (modal === "material-text")
      return (
        <NativeMaterialText
          key={String(selected)}
          id={String(selected)}
          repo={repo}
        />
      );
    if (modal === "upload")
      return (
        <>
          {choices("subject_id", "Materia", subjectOptions)}
          <Text style={st.p}>
            PDF, DOCX, texto o fotografía, hasta 25 MB; PDF de hasta 100
            páginas. Los archivos son privados y el original se conserva si
            falla la lectura.
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
          <MotionPreference />
          <SceneQualityPreference />
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
            "daily_study_minute",
            "Horario habitual de estudio (HH:MM)",
            clock(s.preferences.daily_study_minute ?? 1020),
          )}
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
            "daily_study_enabled",
            "Recordatorio diario de estudio",
            [
              { value: "false", label: "Desactivado" },
              { value: "true", label: "Activado" },
            ],
            String(s.preferences.daily_study_enabled ?? false),
          )}
          {choices(
            "checkin_enabled",
            "Check-in si no uso el aviso diario",
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
            daily_study_enabled:
              v(
                "daily_study_enabled",
                String(s.preferences.daily_study_enabled ?? false),
              ) === "true",
            daily_study_minute: minuteOf(
              v(
                "daily_study_minute",
                clock(s.preferences.daily_study_minute ?? 1020),
              ),
            ),
            weekends: v("weekends", String(s.preferences.weekends)) === "true",
            checkin_minute: minuteOf(
              v("checkin_minute", clock(s.preferences.checkin_minute)),
            ),
            quiet_start: minuteOf(
              v("quiet_start", clock(s.preferences.quiet_start)),
            ),
            quiet_end: minuteOf(v("quiet_end", clock(s.preferences.quiet_end))),
          })}
          {!!(s.studyReminders ?? []).length && (
            <>
              <Text style={st.h3}>Recordatorios creados con tu compa</Text>
              {(s.studyReminders ?? []).map((reminder) => (
                <Card key={reminder.id}>
                  <Text style={st.h3}>{reminder.title}</Text>
                  <Text style={st.p}>
                    {reminder.date
                      ? `${reminder.date} · ${clock(reminder.minute)}`
                      : `${days[reminder.day_of_week ?? 0]} · ${clock(reminder.minute)}`}
                    {!reminder.enabled ? " · desactivado" : ""}
                  </Text>
                  {reminder.enabled && (
                    <Button
                      secondary
                      disabled={busy}
                      onPress={() =>
                        run(async () => {
                          setEnv(
                            await repo.command(
                              {
                                type: "reminder.disable",
                                payload: { id: reminder.id },
                              },
                              env.version,
                            ),
                          );
                        })
                      }
                    >
                      Desactivar
                    </Button>
                  )}
                </Card>
              ))}
            </>
          )}
          <Button secondary onPress={shareExport}>
            Exportar mis datos
          </Button>
          <Button secondary onPress={() => open("support")}>
            Ayuda y soporte
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
    if (modal === "support") return <NativeSupportCenter repo={repo} />;
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
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Image
            source={require("../assets/kusiy-logo.png")}
            style={{ width: 34, height: 34, resizeMode: "contain" }}
            accessibilityIgnoresInvertColors
          />
          <Text style={st.h3}>Kusiy</Text>
        </View>
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
        <Text style={st.tag}>
          Sin conexión o servidor no disponible · El cierre de sesión puede
          quedar pendiente
        </Text>
      )}
      <ScrollView
        ref={pageScroll}
        contentContainerStyle={{ padding: 20, paddingBottom: 35 }}
        keyboardShouldPersistTaps="handled"
      >
        {view !== "room" &&
          view !== "compa" &&
          view !== "together" &&
          view !== "spaces" && (
            <>
              <Text style={st.eyebrow}>{dateLabel(date).toUpperCase()}</Text>
              <Text style={st.h1}>{title}</Text>
            </>
          )}
        {error && !modal && (
          <Text accessibilityRole="alert" style={st.error}>
            {error}
          </Text>
        )}
        {view === "room" && (
          <NativeHome
            s={s}
            busy={busy}
            open={open}
            go={setView}
            plan={showPlan}
            visible={!modal}
          />
        )}
        {view === "compa" && <NativeCompa s={s} open={open} go={setView} />}
        {view === "today" && (
          <NativeAgendaCalendar
            state={s}
            open={open}
            initialDate={date}
            collaboration={repo.collaboration}
            go={setView}
          />
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
            <NativeAgendaCalendar
              state={s}
              open={open}
              collaboration={repo.collaboration}
              go={setView}
            />
          </>
        )}
        {view === "together" && (
          <>
            <NativeStudyHubNav active="together" go={setView} />
            <NativeTogether
              key={s.profile?.id ?? "demo"}
              repo={repo.collaboration}
            />
          </>
        )}
        {view === "spaces" && (
          <NativeStudySpaces
            go={setView}
            open={open}
            activeId={studySpaceById(s.activeStudySpaceId).id}
            companion={s.companion}
            busy={busy}
            selectSpace={(id) =>
              run(() => command("studySpace.select", { id }, false))
            }
          />
        )}
        {view === "study" && (
          <>
            <NativeStudyHubNav active="study" go={setView} />
            <Button onPress={() => open("focus")}>
              {s.activeSession ? "Continuar sesión" : "Estudiar libre"}
            </Button>
            {active?.slots
              .filter((slot) => slot.status === "PENDING" && slot.date <= date)
              .map((slot) => (
                <Button
                  secondary
                  key={slot.id}
                  onPress={() => open("focus", slot)}
                >
                  {slot.objective} · {slot.duration_minutes} min
                </Button>
              ))}
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
                <Text style={st.p}>{materialStatusLabel(m)}</Text>
                {!!m.error_message && (
                  <Text style={st.p}>{m.error_message}</Text>
                )}
                <Button
                  secondary
                  onPress={() =>
                    run(async () => {
                      await Linking.openURL(await repo.signedUrl(m.path));
                    })
                  }
                >
                  Abrir original
                </Button>
                {(m.text_ready || m.status === "READY") && (
                  <Button secondary onPress={() => open("material-text", m.id)}>
                    Leer texto
                  </Button>
                )}
                {materialIsProcessing(m) && (
                  <Button
                    secondary
                    disabled={busy}
                    onPress={() =>
                      run(() => command("material.cancel", { id: m.id }, false))
                    }
                  >
                    Cancelar lectura
                  </Button>
                )}
                {materialCanRetry(m) && (
                  <Button
                    secondary
                    disabled={busy}
                    onPress={() =>
                      run(async () => {
                        setEnv(await repo.processMaterial(m.id));
                      })
                    }
                  >
                    Reintentar
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
        {(view === "progress" || view === "more") && (
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
            <Text style={[st.h2, st.section]}>Mis sesiones</Text>
            {s.sessions.length ? (
              [...s.sessions]
                .reverse()
                .slice(0, 20)
                .map((session) => {
                  const item = s.items.find(
                    (entry) => entry.id === session.academic_item_id,
                  );
                  const subject = s.subjects.find(
                    (entry) =>
                      entry.id === (session.subject_id ?? item?.subject_id),
                  );
                  return (
                    <Card key={session.id}>
                      <Text style={st.h3}>
                        {session.objective ||
                          item?.title ||
                          "Sesión de estudio"}
                      </Text>
                      <Text style={st.p}>
                        {dateLabel(
                          today(s.profile?.timezone, session.completed_at),
                        )}{" "}
                        · {subject?.name ?? "Estudio general"} ·{" "}
                        {methodById(session.method_id).name}
                      </Text>
                      <Text style={st.tag}>
                        {session.actual_seconds !== undefined
                          ? session.actual_seconds < 60
                            ? `${session.actual_seconds} s registrados`
                            : `${Math.floor(session.actual_seconds / 60)} min registrados`
                          : `${session.duration_minutes} min planificados (historial anterior)`}
                      </Text>
                    </Card>
                  );
                })
            ) : (
              <Text style={st.p}>
                Tu primera sesión aparecerá acá cuando la cierres.
              </Text>
            )}
            <Button secondary onPress={() => open("settings")}>
              Privacidad y ajustes
            </Button>
            <Button secondary onPress={() => open("chat")}>
              Conversar con mi compa
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
        {view === "notifications" && (
          <>
            {" "}
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
                        if (!repo)
                          throw Error("Ingresá para abrir este aviso.");
                        const latest =
                          repo.mode === "live" ? await repo.load() : env;
                        if (latest.offline)
                          throw Error(
                            "Conectate para comprobar si este aviso sigue vigente.",
                          );
                        const launch = resolveNotificationLaunch(
                          latest.state,
                          n.id,
                          n.route,
                          new Date().toISOString(),
                        );
                        if (!launch)
                          throw Error(
                            "Este aviso ya no está vigente. Revisá tu agenda.",
                          );
                        if (
                          launch.target === "together" &&
                          !(await repo.collaboration?.overview())?.enabled
                        )
                          throw Error("El encuentro ya no está disponible.");
                        const updated = await repo.command(
                          { type: "notification.read", payload: { id: n.id } },
                          latest.version,
                        );
                        setEnv(updated);
                        setView(launch.target);
                        if (launch.focus) {
                          setSelected(launch.slot);
                          setModal("focus");
                        }
                      })
                    }
                  >
                    Abrir aviso
                  </Button>
                  {(() => {
                    const snoozed = s.studyReminders.find(
                      (r) => r.snoozed_from === n.id && r.enabled,
                    );
                    return snoozed ? (
                      <Text style={st.p}>
                        Pospuesto para {snoozed.date} a las{" "}
                        {clock(snoozed.minute)}.
                      </Text>
                    ) : null;
                  })()}
                  <Text style={st.p}>Posponer este aviso</Text>
                  <View
                    style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
                  >
                    {!n.read_at && (
                      <Button
                        secondary
                        disabled={busy}
                        onPress={() =>
                          run(() =>
                            command("notification.read", { id: n.id }, false),
                          )
                        }
                      >
                        Ignorar
                      </Button>
                    )}
                    {([15, 30, 60] as const).map((minutes) => (
                      <Button
                        key={minutes}
                        secondary
                        disabled={busy}
                        onPress={() =>
                          run(() =>
                            command(
                              "notification.snooze",
                              { id: n.id, minutes },
                              false,
                            ),
                          )
                        }
                      >
                        {minutes} min
                      </Button>
                    ))}
                  </View>
                </Card>
              ))}
          </>
        )}
        {view === "memory" && (
          <>
            {" "}
            <Text style={[st.h2, st.section]}>Memoria académica</Text>
            <Text style={st.p}>
              Podés editar y borrar estos recuerdos. El historial reciente de
              conversación se conserva por separado durante 30 días.
            </Text>
            {s.memories.map((m) => (
              <Card key={m.id}>
                <Text style={st.p}>{m.content}</Text>
                <Text style={st.p}>{memoryOriginLabel(m)}</Text>
                {m.source_message_id &&
                  s.messages.some(
                    (message) =>
                      message.id === m.source_message_id &&
                      message.role === "user",
                  ) && (
                    <Text style={st.p}>
                      Tu pedido:{" "}
                      {
                        s.messages.find(
                          (message) =>
                            message.id === m.source_message_id &&
                            message.role === "user",
                        )?.content
                      }
                    </Text>
                  )}
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
          </>
        )}
      </ScrollView>
      <View
        style={{
          flexDirection: "row",
          borderTopWidth: 1,
          borderColor: colors.line,
          backgroundColor: "#fffaf7",
          paddingVertical: 10,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
        }}
      >
        {tabs.map(([id, label]) => (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{
              selected:
                view === id ||
                (id === "study" && ["together", "spaces"].includes(view)),
            }}
            key={id}
            onPress={() => setView(id)}
            style={{
              flex: 1,
              alignItems: "center",
              paddingVertical: 8,
              gap: 5,
              minHeight: 60,
            }}
          >
            <TabIcon
              id={id}
              active={
                view === id ||
                (id === "study" && ["together", "spaces"].includes(view))
              }
            />
            <Text
              style={{
                fontSize: 12,
                color:
                  view === id ||
                  (id === "study" && ["together", "spaces"].includes(view))
                    ? colors.ink
                    : colors.muted,
                fontWeight:
                  view === id ||
                  (id === "study" && ["together", "spaces"].includes(view))
                    ? "700"
                    : "400",
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
        presentationStyle="fullScreen"
        onRequestClose={() => {
          if (!busy) setModal(null);
        }}
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
