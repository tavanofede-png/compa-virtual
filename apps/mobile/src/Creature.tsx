import { Text } from "./ui";
import {
  Component,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  View,
  Image,
  Pressable,
  PanResponder,
  ActivityIndicator,
  AppState,
} from "react-native";
import { useMotionPreference } from "./MotionPreference";
import { Asset } from "expo-asset";
import { File } from "expo-file-system";
import { selectionImages } from "./selection-images";
import { selectionModels } from "./selection-models";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber/native";
import * as T from "three";
import {
  createWorld,
  createPremiumWorld,
  disposeModel,
  appearanceKey,
  type ViewKind,
  type MotionContext,
  type CompanionAction,
  type PetAction,
  type PetSceneSetup,
  roomInteractions,
} from "@compa/world3d";
import { defaultCompanion, type Companion } from "@compa/domain";
type World = ReturnType<typeof createWorld>;
class SceneBoundary extends Component<
  { children: ReactNode; small: boolean },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: 12,
        }}
      >
        <Text style={{ color: "#65718a", textAlign: "center" }}>
          {this.props.small
            ? "—"
            : "No se pudo abrir la vista 3D en este dispositivo."}
        </Text>
      </View>
    ) : (
      this.props.children
    );
  }
}
function Scene({
  world,
  invalidateRef,
  onTalk,
  ambient,
  active,
  motionContext,
  onFurniture,
  onPet,
}: {
  world: World;
  invalidateRef: { current: () => void };
  onTalk?: () => void;
  ambient: boolean;
  active: boolean;
  motionContext: MotionContext;
  onFurniture: () => void;
  onPet: () => void;
}) {
  const invalidate = useThree((s) => s.invalidate);
  const gl = useThree((s) => s.gl),
    context = useRef(motionContext);
  context.current = motionContext;
  useEffect(() => {
    let foreground = AppState.currentState === "active",
      last = Date.now();
    const sub = AppState.addEventListener("change", (state) => {
      foreground = state === "active";
      last = Date.now();
      world.controller?.pause(!foreground || !active || !ambient);
      world.petController?.pause(!foreground || !active || !ambient);
    });
    const timer = setInterval(() => {
      const now = Date.now(),
        delta = Math.min((now - last) / 1000, 0.067);
      last = now;
      world.controller?.pause(!foreground || !active || !ambient);
      world.controller?.context(context.current);
      world.petController?.pause(!foreground || !active || !ambient);
      world.petController?.context({
        visible: active,
        studying: context.current.studying,
        talking: context.current.talking,
        celebration: context.current.celebration,
        companionPosition: world.avatar?.position.toArray() as [number, number, number] | undefined,
      });
      if (world.controller?.update(delta)) {
        gl.shadowMap.needsUpdate = true;
        invalidate();
      }
      if (world.petController?.update(delta)) {
        gl.shadowMap.needsUpdate = true;
        invalidate();
      }
    }, 1000 / 30);
    return () => {
      clearInterval(timer);
      sub.remove();
      world.controller?.pause(true);
      world.petController?.pause(true);
    };
  }, [world, active, ambient, gl, invalidate]);
  useEffect(() => {
    invalidateRef.current = invalidate;
    invalidate();
    return () => {
      invalidateRef.current = () => {};
    };
  }, [invalidate, world]);
  const click = (event: ThreeEvent<MouseEvent>) => {
    if (event.delta > 7) return;
    if (event.object.userData.roomAction) {
      event.stopPropagation();
      const target = String(event.object.userData.roomAction);
      if (target === "pet") {
        world.petController?.request("react");
        onPet();
      } else if (target === "floor") world.controller?.walkTo(event.point.toArray());
      else if (target === "pouf") world.controller?.request("pouf");
      else if (target.startsWith("object:")) world.controller?.inspect(target.slice(7));
      else onFurniture();
      return;
    }
    let object: T.Object3D | null = event.object;
    while (object) {
      if (object.name === "teen-avatar") {
        onTalk?.();
        break;
      }
      object = object.parent;
    }
  };
  return <primitive object={world.scene} dispose={null} onClick={click} />;
}
export function NativeWorld({
  companion,
  kind = "avatar",
  item,
  interactive = true,
  onTalk,
  ambient = false,
  active = true,
  motionContext = {},
  petState,
}: {
  companion: Companion;
  kind?: ViewKind;
  item?: string;
  interactive?: boolean;
  onTalk?: () => void;
  ambient?: boolean;
  active?: boolean;
  motionContext?: MotionContext;
  petState?: PetSceneSetup;
}) {
  const fingerprint = appearanceKey(companion, kind, item) + JSON.stringify(petState ?? null);
  const [world, setWorld] = useState<World | null>(null),
    [error, setError] = useState(false),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true,
      loaded: World | null = null;
    const cancellation = new AbortController();
    setWorld(null);
    setError(false);
    const load = async () => {
      try {
        loaded =
          companion.character_id && (kind === "avatar" || kind === "room")
            ? await createPremiumWorld(
                companion,
                kind,
                "models",
                async (url) => {
                  const module = selectionModels[url.split("/").pop()!.split("?")[0]!];
                  if (!module)
                    throw Error("Modelo no incluido en esta versión.");
                  const asset = await Asset.fromModule(module).downloadAsync();
                  if (!asset.localUri)
                    throw Error("Modelo no disponible sin conexión.");
                  return new File(asset.localUri).arrayBuffer();
                },
                cancellation.signal,
                petState,
              )
            : createWorld(companion, kind, item);
        if (alive) setWorld(loaded);
        else disposeModel(loaded.scene);
      } catch {
        if (alive) setError(true);
      }
    };
    void load();
    return () => {
      alive = false;
      cancellation.abort();
      loaded?.controller?.dispose();
      loaded?.petController?.dispose();
      if (loaded) disposeModel(loaded.scene);
    };
  }, [fingerprint, retry]);
  if (!world)
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        {companion.character_id && (
          <Image
            source={
              selectionImages[
                kind === "room"
                  ? `rooms/${companion.room_style ?? "cozy"}`
                  : `characters/${companion.character_id}`
              ]
            }
            style={{
              position: "absolute",
              width: "100%",
              height: "100%",
              opacity: 0.48,
              resizeMode: "contain",
            }}
          />
        )}
        <View
          style={{
            padding: 16,
            backgroundColor: "#faf9f3",
            borderRadius: 12,
            maxWidth: "85%",
            gap: 10,
          }}
        >
          {!error && <ActivityIndicator color="#435840" />}
          <Text style={{ color: "#435840", textAlign: "center" }}>
            {error
              ? "No pudimos cargar la vista 3D. Revisá la conexión."
              : "Preparando tu vista 3D…"}
          </Text>
          {error && (
            <Pressable
              accessibilityRole="button"
              onPress={() => setRetry((r) => r + 1)}
              style={{ padding: 12 }}
            >
              <Text
                style={{
                  textAlign: "center",
                  color: "#435840",
                  fontWeight: "600",
                }}
              >
                Reintentar
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  return (
    <WorldView
      key={fingerprint}
      world={world}
      kind={kind}
      interactive={interactive}
      onTalk={onTalk}
      ambient={ambient}
      active={active}
      motionContext={motionContext}
      companion={companion}
      petState={petState}
    />
  );
}
function WorldView({
  world,
  kind = "avatar",
  interactive = true,
  onTalk,
  ambient,
  active,
  motionContext,
  companion,
  petState,
}: {
  world: World;
  kind?: ViewKind;
  interactive?: boolean;
  onTalk?: () => void;
  ambient: boolean;
  active: boolean;
  motionContext: MotionContext;
  companion: Companion;
  petState?: PetSceneSetup;
}) {
  const preference = useMotionPreference(),
    [furniture, setFurniture] = useState(false),
    [petMenu, setPetMenu] = useState(false);
  const invalidate = useRef(() => {}),
    origin = useRef(0);
  const original = useMemo(() => world.camera.position.clone(), [world]);
  const turn = (amount: number, absolute = false) => {
    const offset = world.camera.position.clone().sub(world.target),
      sphere = new T.Spherical().setFromVector3(offset);
    sphere.theta = absolute ? amount : sphere.theta + amount;
    if (kind === "room")
      sphere.theta = T.MathUtils.clamp(sphere.theta, 0.28, 1.28);
    world.camera.position
      .copy(world.target)
      .add(new T.Vector3().setFromSpherical(sphere));
    world.camera.lookAt(world.target);
    invalidate.current();
  };
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          interactive &&
          Math.abs(g.dx) > 10 &&
          Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
        onPanResponderGrant: () => {
          const off = world.camera.position.clone().sub(world.target);
          origin.current = Math.atan2(off.x, off.z);
        },
        onPanResponderMove: (_, g) => turn(origin.current - g.dx * 0.006, true),
      }),
    [world, interactive],
  );
  const cameraButtons = [
    { label: "Girar a la izquierda", text: "‹", action: () => turn(-0.18) },
    { label: "Girar a la derecha", text: "›", action: () => turn(0.18) },
    {
      label: "Restablecer cámara",
      text: "↺",
      action: () => {
        world.camera.position.copy(original);
        world.camera.lookAt(world.target);
        invalidate.current();
      },
    },
  ];
  return (
    <View style={{ flex: 1 }} {...pan.panHandlers}>
      <SceneBoundary small={!interactive}>
        <Canvas
          camera={world.camera}
          frameloop="demand"
          shadows="soft"
          gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
          onCreated={({ gl }) => {
            gl.setClearColor(0x000000, 0);
            gl.toneMapping = T.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.1;
            gl.shadowMap.autoUpdate = false;
            gl.shadowMap.needsUpdate = true;
          }}
        >
          <Scene
            world={world}
            invalidateRef={invalidate}
            onTalk={onTalk}
            ambient={ambient}
            active={active}
            motionContext={{ ...motionContext, ...preference }}
            onFurniture={() => setFurniture(true)}
            onPet={() => setPetMenu(true)}
          />
        </Canvas>
      </SceneBoundary>
      {interactive && (
        <View
          style={{
            position: "absolute",
            right: 10,
            bottom: 10,
            flexDirection: "row",
            backgroundColor: "#faf9f3",
            borderRadius: 10,
            padding: 3,
          }}
        >
          {cameraButtons.map((button) => (
            <Pressable
              key={button.label}
              accessibilityRole="button"
              accessibilityLabel={button.label}
              onPress={button.action}
              style={{
                width: 38,
                height: 38,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 23, color: "#53617b" }}>
                {button.text}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      {ambient && (
        <View style={{ position: "absolute", left: 12, top: 12, gap: 5 }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setFurniture(!furniture)}
            style={{
              backgroundColor: "#fffaf3",
              borderRadius: 14,
              padding: 13,
              minHeight: 48,
            }}
          >
            <Text>Acciones</Text>
          </Pressable>
          {furniture && (
            <View
              style={{
                backgroundColor: "#fffaf7",
                padding: 8,
                borderRadius: 16,
              }}
            >
              {(
                [
                  ["sit", "Sentarse"],
                  ["study", "Ir al escritorio"],
                  ["rest", "Descansar"],
                  ["walk", "Caminar por la habitación"],
                  ...(roomInteractions[companion.room_style ?? "cozy"]?.pouf ? [["pouf", "Sentarse en el puff"]] : []),
                  ...(roomInteractions[companion.room_style ?? "cozy"]?.objects ?? []).map(o => ["object:" + o.id, o.label]),
                  ["stand", "Levantarse"],
                ] as const
              ).map(([action, label]) => (
                <Pressable
                  key={action}
                  accessibilityRole="button"
                  onPress={() => {
                    if (action.startsWith("object:")) world.controller?.inspect(action.slice(7));
                    else world.controller?.request(action as CompanionAction);
                    setFurniture(false);
                  }}
                  style={{ minHeight: 48, padding: 12 }}
                >
                  <Text>{label}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}
      {ambient && petState && (
        <View style={{ position: "absolute", right: 12, top: 12, gap: 5 }}>
          <Pressable accessibilityRole="button" onPress={() => setPetMenu(!petMenu)} style={{ backgroundColor: "#fffaf3", borderRadius: 14, padding: 13, minHeight: 48 }}>
            <Text>{petState.name}</Text>
          </Pressable>
          {petMenu && (
            <View style={{ backgroundColor: "#fffaf7", padding: 8, borderRadius: 16 }}>
              {([['come','Venir'],['play','Jugar'],['rest','Descansar'],['returnHome','Volver a su camita']] as [PetAction,string][]).map(([petAction, label]) => (
                <Pressable key={petAction} accessibilityRole="button" onPress={() => { world.petController?.request(petAction); setPetMenu(false); }} style={{ minHeight: 48, padding: 12 }}>
                  <Text>{label}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}
export function Creature({
  companion,
  size = 160,
}: {
  companion: Companion;
  size?: number;
}) {
  if (size <= 90 && companion.character_id)
    return (
      <Image
        accessibilityLabel={companion.name}
        source={
          selectionImages[`characters/${companion.character_id}-portrait`]
        }
        style={{ width: size, height: size, borderRadius: size * 0.2 }}
      />
    );
  return (
    <View
      accessibilityLabel={companion.name}
      style={{ width: size, height: size <= 90 ? size : size * 1.5 }}
    >
      <NativeWorld
        companion={companion}
        kind={size <= 90 ? "icon" : "avatar"}
        interactive={size > 90}
      />
    </View>
  );
}
export function Equipment({ id, width = 50 }: { id: string; width?: number }) {
  return (
    <View style={{ width, height: width }}>
      <NativeWorld
        companion={defaultCompanion}
        kind="equipment"
        item={id}
        interactive={false}
      />
    </View>
  );
}
export function NativeRoom({
  companion,
  onTalk,
  height = 380,
  active = true,
  motionContext,
  petState,
}: {
  companion: Companion;
  onTalk: () => void;
  height?: number;
  active?: boolean;
  motionContext?: MotionContext;
  petState?: PetSceneSetup;
}) {
  return (
    <View
      style={{
        height,
        borderRadius: 0,
        overflow: "hidden",
        backgroundColor:
          companion.room_theme === "night" ? "#263241" : "#f8f4f0",
        borderWidth: 0,
        borderColor: "#d3d7e0",
      }}
    >
      <NativeWorld
        companion={companion}
        kind="room"
        onTalk={onTalk}
        ambient
        active={active}
        motionContext={motionContext}
        petState={petState}
      />
      <Text
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 15,
          left: 15,
          color: companion.room_theme === "night" ? "#f3e9d5" : "#5c6780",
          fontSize: 12,
          letterSpacing: 1.2,
          fontWeight: "700",
        }}
      >
        {" "}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={"Conversar con " + companion.name}
        onPress={onTalk}
        style={{
          position: "absolute",
          left: 12,
          bottom: 14,
          backgroundColor: "#faf9f3",
          borderRadius: 9,
          paddingHorizontal: 11,
          paddingVertical: 12,
          maxWidth: "55%",
        }}
      >
        <Text numberOfLines={1} style={{ color: "#4a5972", fontSize: 14 }}>
          Conversar con {companion.name} ↗
        </Text>
      </Pressable>
    </View>
  );
}
