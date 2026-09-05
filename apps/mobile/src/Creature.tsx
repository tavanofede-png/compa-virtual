import { Component, useEffect, useMemo, useRef, type ReactNode } from "react";
import { View, Text, Pressable, PanResponder } from "react-native";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber/native";
import * as T from "three";
import {
  createWorld,
  disposeModel,
  appearanceKey,
  type ViewKind,
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
}: {
  world: World;
  invalidateRef: { current: () => void };
  onTalk?: () => void;
}) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    invalidateRef.current = invalidate;
    invalidate();
    return () => {
      invalidateRef.current = () => {};
    };
  }, [invalidate, world]);
  const click = (event: ThreeEvent<MouseEvent>) => {
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
function NativeWorld({
  companion,
  kind = "avatar",
  item,
  interactive = true,
  onTalk,
}: {
  companion: Companion;
  kind?: ViewKind;
  item?: string;
  interactive?: boolean;
  onTalk?: () => void;
}) {
  const fingerprint = appearanceKey(companion, kind, item);
  const world = useMemo(
    () => createWorld(companion, kind, item),
    [fingerprint, kind, item],
  );
  const invalidate = useRef(() => {}),
    origin = useRef(0);
  useEffect(() => () => disposeModel(world.scene), [world]);
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
          shadows={kind === "room" ? "soft" : false}
          gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
          onCreated={({ gl }) => {
            gl.setClearColor(0x000000, 0);
            gl.toneMapping = T.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.1;
            gl.shadowMap.autoUpdate = false;
            gl.shadowMap.needsUpdate = true;
          }}
        >
          <Scene world={world} invalidateRef={invalidate} onTalk={onTalk} />
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
}: {
  companion: Companion;
  onTalk: () => void;
  height?: number;
}) {
  return (
    <View
      style={{
        height,
        borderRadius: 16,
        overflow: "hidden",
        backgroundColor:
          companion.room_theme === "night" ? "#56617c" : "#e2e4ec",
        borderWidth: 1,
        borderColor: "#d3d7e0",
      }}
    >
      <NativeWorld companion={companion} kind="room" onTalk={onTalk} />
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
        MI HABITACIÓN
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
