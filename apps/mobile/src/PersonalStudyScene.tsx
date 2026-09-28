import { Component, useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, AppState, View } from "react-native";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber/native";
import type { Object3D } from "three";
import { Asset } from "expo-asset";
import { File } from "expo-file-system";
import {
  createPersonalStudyWorld,
  studyObjectAction,
  type StudyObjectAction,
} from "@compa/world3d";
import type { Companion, StudySpaceId } from "@compa/domain";
import manifest from "../../web/public/selection/study-spaces/runtime-manifest.json";
import { selectionModels } from "./selection-models";
import { useMotionPreference } from "./MotionPreference";
import { ScenePixelRatio, useSceneQuality } from "./SceneQuality";
import { Text, Button } from "./ui";
import { readCachedScene } from "./scene-cache";

type World = Awaited<ReturnType<typeof createPersonalStudyWorld>>;

async function readStudyModel(
  url: string,
  signal?: AbortSignal,
  onProgress?: (fraction: number) => void,
): Promise<ArrayBuffer> {
  const name = url.split("/").pop()?.split("?")[0] ?? "";
  if (!url.includes("/study-spaces/")) {
    const module = selectionModels[name];
    if (!module) throw Error("Falta un recurso del compañero.");
    const asset = await Asset.fromModule(module).downloadAsync();
    if (!asset.localUri) throw Error("No se pudo cargar el compañero.");
    return new File(asset.localUri).arrayBuffer();
  }
  const entry = manifest.spaces.find(
    (space) => `${space.id}-mobile.glb` === name,
  );
  if (!entry) throw Error("No se encontró el espacio solicitado.");
  return readCachedScene(entry, signal, onProgress);
}

class SceneBoundary extends Component<
  { children: ReactNode; onRetry: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <View style={{ padding: 18, gap: 12 }}>
        <Text>
          No se pudo mostrar el 3D. La sesión de estudio sigue disponible.
        </Text>
        <Button secondary onPress={this.props.onRetry}>
          Reintentar 3D
        </Button>
      </View>
    ) : (
      this.props.children
    );
  }
}

function Scene({
  world,
  onInteract,
}: {
  world: World;
  onInteract?: (action: StudyObjectAction) => void;
}) {
  const { invalidate } = useThree();
  const { reduced, enabled } = useMotionPreference();
  useEffect(() => {
    let foreground = AppState.currentState === "active";
    const animated = enabled && !reduced;
    invalidate();
    const sub = AppState.addEventListener("change", (state) => {
      foreground = state === "active";
      if (foreground) invalidate();
    });
    const timer = animated
      ? setInterval(() => {
          if (!foreground) return;
          world.update(1 / 30);
          invalidate();
        }, 1000 / 30)
      : null;
    return () => {
      if (timer) clearInterval(timer);
      sub.remove();
    };
  }, [world, invalidate, reduced, enabled]);
  return (
    <primitive
      object={world.scene}
      dispose={null}
      onClick={
        onInteract
          ? (event: ThreeEvent<MouseEvent>) => {
              const names: string[] = [];
              for (
                let object: Object3D | null = event.object;
                object && object !== world.scene;
                object = object.parent
              )
                names.push(object.name);
              const action = studyObjectAction(names);
              if (action) {
                event.stopPropagation();
                onInteract(action);
              }
            }
          : undefined
      }
    />
  );
}

export function NativePersonalStudyScene({
  id,
  companion,
  onInteract,
}: {
  id: StudySpaceId;
  companion: Companion;
  onInteract?: (action: StudyObjectAction) => void;
}) {
  const { pixelRatio } = useSceneQuality();
  const [world, setWorld] = useState<World | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    let alive = true;
    let loaded: World | undefined;
    setWorld(null);
    setError("");
    setProgress(0);
    void createPersonalStudyWorld(
      id,
      companion,
      (url) =>
        readStudyModel(url, abort.signal, (fraction) => {
          if (alive) setProgress(Math.round(fraction * 100));
        }),
      abort.signal,
    )
      .then((next) => {
        loaded = next;
        if (alive) setWorld(next);
        else next.dispose();
      })
      .catch((cause) => {
        if (alive)
          setError(
            cause instanceof Error
              ? cause.message
              : "No se pudo abrir el espacio 3D.",
          );
      });
    return () => {
      alive = false;
      abort.abort();
      loaded?.dispose();
    };
  }, [id, companion, retry]);
  return (
    <View
      style={{
        height: 340,
        borderRadius: 18,
        overflow: "hidden",
        backgroundColor: "#eee8de",
        justifyContent: "center",
      }}
    >
      {world ? (
        <SceneBoundary
          key={`${id}-${retry}`}
          onRetry={() => setRetry((value) => value + 1)}
        >
          <Canvas camera={world.camera} frameloop="demand">
            <ScenePixelRatio ratio={pixelRatio} />
            <Scene world={world} onInteract={onInteract} />
          </Canvas>
        </SceneBoundary>
      ) : error ? (
        <View style={{ padding: 18, gap: 12 }}>
          <Text>{error} Podés seguir estudiando en modo foco.</Text>
          <Button secondary onPress={() => setRetry((value) => value + 1)}>
            Reintentar 3D
          </Button>
        </View>
      ) : (
        <View style={{ alignItems: "center", gap: 10, padding: 18 }}>
          <ActivityIndicator />
          <Text>
            {progress > 0 && progress < 100
              ? `Descargando el espacio de estudio · ${progress}%`
              : "Preparando el espacio de estudio…"}
          </Text>
        </View>
      )}
    </View>
  );
}
