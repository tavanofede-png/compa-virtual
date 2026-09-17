import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { View, Image, AppState, Pressable, StyleSheet } from "react-native";
import { Canvas, useThree } from "@react-three/fiber/native";
import { Asset } from "expo-asset";
import { File } from "expo-file-system";
import { createSharedSpaceWorld } from "@compa/world3d";
import {
  createSharedRoomSession,
  type CollaborationRepository,
  type SharedRoomConnection,
} from "@compa/client";
import {
  sharedSeats,
  sharedSpaces,
  sharedTimerSeconds,
  type GroupSessionDetail,
  type SharedRoomPresence,
  type SharedSpaceId,
} from "@compa/domain";
import { Text, Button, Field, styles as st } from "./ui";
import { selectionImages } from "./selection-images";
import { selectionModels } from "./selection-models";
import { sharedSpaceModels } from "./shared-space-models";
import { useMotionPreference } from "./MotionPreference";
type World = Awaited<ReturnType<typeof createSharedSpaceWorld>>;
class RoomBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <Text>
        No pudimos abrir el 3D. Los controles de la sala siguen disponibles.
      </Text>
    ) : (
      this.props.children
    );
  }
}
function Scene({ world }: { world: World }) {
  const { invalidate } = useThree(),
    { reduced, enabled } = useMotionPreference();
  useEffect(() => {
    let active = AppState.currentState === "active";
    const sub = AppState.addEventListener(
      "change",
      (s) => (active = s === "active"),
    );
    const timer = setInterval(() => {
      if (active) {
        world.update(1 / 30, reduced || !enabled);
        invalidate();
      }
    }, 1000 / 30);
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [world, invalidate, reduced, enabled]);
  return <primitive object={world.scene} dispose={null} />;
}
function NativeSpace({
  id,
  people,
}: {
  id: SharedSpaceId;
  people: SharedRoomPresence[];
}) {
  const [world, setWorld] = useState<World | null>(null),
    [error, setError] = useState("");
  const latest = useRef(people);
  latest.current = people;
  useEffect(() => {
    const abort = new AbortController();
    let alive = true,
      loaded: World | undefined;
    setWorld(null);
    setError("");
    void createSharedSpaceWorld(
      id,
      async (url) => {
        const name = url.split("/").pop()!.split("?")[0],
          module = url.includes("/shared-spaces/")
            ? sharedSpaceModels[name]
            : selectionModels[name];
        if (!module) throw Error("Asset no disponible.");
        const asset = await Asset.fromModule(module).downloadAsync();
        if (!asset.localUri) throw Error("No se pudo cargar la sala.");
        return new File(asset.localUri).arrayBuffer();
      },
      abort.signal,
    )
      .then(async (value) => {
        loaded = value;
        if (!alive) {
          value.dispose();
          return;
        }
        setWorld(value);
        await value.setParticipants(latest.current);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
      abort.abort();
      loaded?.dispose();
    };
  }, [id]);
  useEffect(() => {
    void world?.setParticipants(people).catch((e) => setError(e.message));
  }, [world, people]);
  return (
    <View style={{ height: 340, borderRadius: 22, overflow: "hidden" }}>
      {error ? (
        <Text>
          La vista 3D no pudo cargarse. Podés seguir con los controles de abajo.
        </Text>
      ) : world ? (
        <RoomBoundary>
          <Canvas camera={world.camera} frameloop="demand">
            <Scene world={world} />
          </Canvas>
        </RoomBoundary>
      ) : (
        <Text>Preparando la sala…</Text>
      )}
    </View>
  );
}
export function NativeSharedRoom({
  repo,
  initial,
  userId,
  onDetail,
}: {
  repo: CollaborationRepository;
  initial: GroupSessionDetail;
  userId: string;
  onDetail: (d: GroupSessionDetail | null) => void;
}) {
  const [state, setState] = useState<SharedRoomConnection>({
    detail: initial,
    entered: false,
    busy: false,
    error: "",
    connected: false,
    serverOffset: Date.parse(initial.server_time) - Date.now(),
  });
  const [now, setNow] = useState(Date.now()),
    [three, setThree] = useState(false),
    [goal, setGoal] = useState("");
  const runtime = useRef<ReturnType<typeof createSharedRoomSession> | null>(
      null,
    ),
    callback = useRef(onDetail);
  callback.current = onDetail;
  useEffect(() => {
    const session = createSharedRoomSession(repo, initial, (next) => {
      setState(next);
      if (next.detail) callback.current(next.detail);
      else if (next.accessRevoked) callback.current(null);
    });
    runtime.current = session;
    const sub = AppState.addEventListener("change", (s) =>
      session.visible(s === "active"),
    );
    session.visible(AppState.currentState === "active");
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(timer);
      sub.remove();
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
      detail && !["scheduled", "active"].includes(detail.session.status),
    early =
      detail?.session.status === "scheduled" &&
      Date.parse(detail.session.scheduled_start_at) > serverNow + 900000;
  const disabled = state.busy || !state.connected,
    seconds = sharedTimerSeconds(room?.timer ?? null, serverNow),
    timer = room?.timer;
  const timerCommand = (operation: "focus" | "break" | "pause" | "resume") =>
    void runtime.current?.command({
      action: "room.timer",
      session_id: id,
      revision: timer?.revision ?? 0,
      operation,
    });
  return (
    <View style={{ gap: 16, marginVertical: 20 }}>
      <Text style={st.tag}>UN LUGAR PARA HACER EQUIPO</Text>
      <Text style={st.h2}>{space.name}</Text>
      {three && state.connected ? (
        <NativeSpace id={space.id} people={people} />
      ) : (
        <Image
          source={selectionImages["shared-spaces/" + space.id]}
          accessibilityLabel={space.name}
          style={{ width: "100%", aspectRatio: 11 / 9, borderRadius: 22 }}
        />
      )}
      <Button secondary onPress={() => setThree(!three)}>
        {three ? "Vista liviana" : "Explorar en 3D"}
      </Button>
      <Text style={st.h3}>{people.length}/6 en la sala</Text>
      <Text>
        {closed
          ? "Encuentro finalizado."
          : early
            ? "La sala abre 15 minutos antes del encuentro."
            : state.entered
              ? "Ya estás en la sala. Elegí tu lugar."
              : "Solo aparecen quienes entraron a este encuentro."}
      </Text>
      {!state.connected && <Text>Comprobando conexión y acceso…</Text>}
      {!closed && !early && (
        <Button
          disabled={disabled}
          onPress={() =>
            void (state.entered
              ? runtime.current?.leave()
              : runtime.current?.enter())
          }
        >
          {state.entered ? "Salir de la sala" : "Entrar en la sala"}
        </Button>
      )}
      {!!state.error && (
        <View accessibilityRole="alert">
          <Text>{state.error}</Text>
          <Button secondary onPress={() => void runtime.current?.refresh()}>
            Reintentar
          </Button>
          {!state.entered && !closed && (
            <Button secondary onPress={() => void runtime.current?.enter(true)}>
              Usar esta pantalla
            </Button>
          )}
        </View>
      )}
      <View style={styles.seats}>
        {sharedSeats(space.id).map((seat, i) => {
          const p = people.find((p) => p.seat_id === seat.id),
            own = p?.user_id === userId,
            name = detail?.participants.find(
              (x) => x.user_id === p?.user_id,
            )?.nickname;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{
                selected: own,
                disabled: disabled || !state.entered || (!!p && !own),
              }}
              disabled={disabled || !state.entered || (!!p && !own)}
              key={seat.id}
              onPress={() => void runtime.current?.seat(seat.id)}
              style={[
                styles.seat,
                own && { backgroundColor: "#e7eedc", borderColor: "#65804f" },
              ]}
            >
              {p?.appearance.character_id && (
                <Image
                  source={
                    selectionImages["characters/" + p.appearance.character_id]
                  }
                  style={{ height: 64, width: 54, borderRadius: 12 }}
                />
              )}
              <Text style={{ fontWeight: "600" }}>
                {name ?? "Lugar " + (i + 1)}
              </Text>
              <Text>
                {own ? "Vos" : p ? "En la sala" : "Libre"}
                {p?.hand_raised ? " · Mano levantada" : ""}
              </Text>
              {p?.reaction &&
                p.reaction_at &&
                serverNow - Date.parse(p.reaction_at) < 5000 && (
                  <Text>
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
                      )[p.reaction]
                    }
                  </Text>
                )}
            </Pressable>
          );
        })}
      </View>
      {state.entered && (
        <View>
          <Text style={st.h3}>Tu estado</Text>
          {(["available", "focused", "break"] as const).map((a, i) => (
            <Button
              key={a}
              secondary
              disabled={disabled || me?.activity === a}
              onPress={() => void runtime.current?.activity(a)}
            >
              {["Disponible", "Concentrado", "En pausa"][i]}
            </Button>
          ))}
          <Button
            secondary
            disabled={disabled}
            onPress={() => void runtime.current?.hand(!me?.hand_raised)}
          >
            {me?.hand_raised ? "Bajar la mano" : "Levantar la mano"}
          </Button>
          <View style={styles.reactions}>
            {(
              [
                ["hello", "👋", "Saludar"],
                ["thanks", "💛", "Gracias"],
                ["idea", "💡", "Idea"],
                ["agree", "👍", "De acuerdo"],
                ["celebrate", "🎉", "Celebrar"],
                ["question", "❔", "Pregunta"],
              ] as const
            ).map(([r, icon, label]) => (
              <Pressable
                key={r}
                accessibilityRole="button"
                accessibilityLabel={label}
                disabled={
                  disabled ||
                  !!(
                    me?.reaction_at &&
                    serverNow - Date.parse(me.reaction_at) < 3000
                  )
                }
                onPress={() => void runtime.current?.react(r)}
                style={styles.reaction}
              >
                <Text style={{ fontSize: 26 }}>{icon}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
      {detail && (
        <>
          <View style={styles.timer}>
            <Text>
              {timer?.phase === "break"
                ? "Una pausa juntos"
                : "Tiempo para concentrarse"}
            </Text>
            <Text
              style={{
                fontSize: 54,
                fontVariant: ["tabular-nums"],
                fontWeight: "600",
              }}
            >
              {String(Math.floor(seconds / 60)).padStart(2, "0")}:
              {String(seconds % 60).padStart(2, "0")}
            </Text>
            <Text>
              {detail.session.status !== "active"
                ? "Quien organiza inicia el encuentro."
                : seconds === 0
                  ? "Bloque terminado."
                  : timer?.running
                    ? "El mismo tiempo para todo el grupo."
                    : "En pausa."}
            </Text>
            {detail.session.host_id === userId &&
              detail.session.status === "active" && (
                <>
                  <Button
                    secondary
                    disabled={disabled || seconds === 0}
                    onPress={() =>
                      timerCommand(timer?.running ? "pause" : "resume")
                    }
                  >
                    {timer?.running ? "Pausar" : "Continuar"}
                  </Button>
                  <Button
                    secondary
                    disabled={disabled}
                    onPress={() => timerCommand("focus")}
                  >
                    Enfoque · 25 min
                  </Button>
                  <Button
                    secondary
                    disabled={disabled}
                    onPress={() => timerCommand("break")}
                  >
                    Descanso · 5 min
                  </Button>
                </>
              )}
          </View>
          <Text style={st.h3}>Lo que queremos lograr</Text>
          <Text>{detail.session.objective}</Text>
          {(room?.goals ?? []).map((g) => (
            <Pressable
              key={g.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: g.done }}
              disabled={disabled || !!closed}
              onPress={() =>
                void runtime.current?.command({
                  action: "room.goal.toggle",
                  session_id: id,
                  goal_id: g.id,
                  revision: g.revision,
                  done: !g.done,
                })
              }
              style={{
                minHeight: 52,
                padding: 12,
                borderBottomWidth: 1,
                borderBottomColor: "#e1dfd2",
              }}
            >
              <Text>
                {g.done ? "✓ " : "○ "}
                {g.title}
              </Text>
            </Pressable>
          ))}
          {!closed && (
            <>
              <Field
                label="Nuevo objetivo compartido"
                value={goal}
                onChangeText={setGoal}
                maxLength={160}
              />
              <Button
                secondary
                disabled={
                  disabled || !goal.trim() || (room?.goals.length ?? 0) >= 20
                }
                onPress={async () => {
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
                Agregar objetivo
              </Button>
            </>
          )}
        </>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  seats: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  seat: {
    width: "48%",
    minHeight: 94,
    padding: 12,
    borderWidth: 1,
    borderColor: "#deded0",
    borderRadius: 18,
    gap: 6,
    backgroundColor: "#fffdf5",
  },
  reactions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  reaction: {
    minWidth: 48,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#fff4d7",
  },
  timer: { padding: 24, borderRadius: 24, backgroundColor: "#eaf0df", gap: 10 },
});
