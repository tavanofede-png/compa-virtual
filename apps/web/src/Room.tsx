"use client";
import { useEffect, useRef, useState } from "react";
import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import {
  createWorld,
  disposeModel,
  appearanceKey,
  type ViewKind,
} from "@compa/world3d";
import { defaultCompanion, type Companion } from "@compa/domain";
import {
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Plus,
  Minus,
  MessageCircle,
} from "lucide-react";

let thumbnailRenderer: T.WebGLRenderer | undefined;
const thumbnails = new Map<string, string>();
function thumbnail(c: Companion, kind: ViewKind, item?: string) {
  const key = appearanceKey(c, kind, item);
  if (thumbnails.has(key)) return thumbnails.get(key)!;
  thumbnailRenderer ??= new T.WebGLRenderer({
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
  });
  thumbnailRenderer.setSize(180, 180, false);
  thumbnailRenderer.setClearColor(0x000000, 0);
  thumbnailRenderer.outputColorSpace = T.SRGBColorSpace;
  thumbnailRenderer.toneMapping = T.ACESFilmicToneMapping;
  thumbnailRenderer.toneMappingExposure = 1.12;
  const world = createWorld(c, kind, item);
  thumbnailRenderer.render(world.scene, world.camera);
  const result = thumbnailRenderer.domElement.toDataURL("image/png");
  disposeModel(world.scene);
  if (thumbnails.size > 90) thumbnails.delete(thumbnails.keys().next().value!);
  thumbnails.set(key, result);
  return result;
}
function Thumbnail({
  companion = defaultCompanion,
  kind = "icon",
  item,
  size,
  label,
}: {
  companion?: Companion;
  kind?: ViewKind;
  item?: string;
  size: number;
  label: string;
}) {
  const [src, setSrc] = useState(""),
    key = appearanceKey(companion, kind, item);
  useEffect(() => {
    try {
      setSrc(thumbnail(companion, kind, item));
    } catch {
      setSrc("");
    }
  }, [key]);
  return src ? (
    <img
      className="model-thumbnail"
      src={src}
      width={size}
      height={size}
      alt={label}
    />
  ) : (
    <span
      className="model-initial"
      style={{ width: size, height: size }}
      aria-label={label}
    >
      {label.slice(0, 1)}
    </span>
  );
}
export function Equipment({ id, width = 55 }: { id: string; width?: number }) {
  return (
    <Thumbnail
      kind="equipment"
      item={id}
      size={width}
      label="Objeto de tu colección"
    />
  );
}
export function Creature({
  companion,
  size = 160,
}: {
  companion: Companion;
  size?: number;
}) {
  if (size <= 90)
    return (
      <Thumbnail companion={companion} size={size} label={companion.name} />
    );
  return (
    <div
      className="avatar-view"
      style={{ width: Math.max(size, 200), height: size * 1.5 }}
    >
      <WorldCanvas companion={companion} kind="avatar" />
    </div>
  );
}
function WorldCanvas({
  companion,
  kind,
  onTalk,
}: {
  companion: Companion;
  kind: "room" | "avatar";
  onTalk?: () => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    action = useRef<(type: string) => void>(() => {}),
    talk = useRef(onTalk);
  const [failed, setFailed] = useState(false),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0);
  const fingerprint = appearanceKey(companion, kind);
  talk.current = onTalk;
  useEffect(() => {
    const node = host.current;
    if (!node) return;
    let renderer: T.WebGLRenderer | undefined,
      world: ReturnType<typeof createWorld> | undefined,
      controls: OrbitControls | undefined,
      composer: EffectComposer | undefined,
      frame = 0;
    let resize: ResizeObserver | undefined,
      intersection: IntersectionObserver | undefined;
    let visible = true,
      disposed = false,
      dirty = true,
      last = 0;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cleanups: (() => void)[] = [];
    setFailed(false);
    setLoading(true);
    try {
      world = createWorld(companion, kind);
      renderer = new T.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.02;
      renderer.shadowMap.enabled = kind === "room";
      renderer.shadowMap.type = T.PCFSoftShadowMap;
      renderer.shadowMap.autoUpdate = false;
      renderer.shadowMap.needsUpdate = true;
      const studio = new RoomEnvironment(),
        pmrem = new T.PMREMGenerator(renderer);
      const environment = pmrem.fromScene(studio, 0.04);
      world.scene.environment = environment.texture;
      world.scene.environmentIntensity = kind === "room" ? 0.3 : 0.55;
      studio.dispose();
      pmrem.dispose();
      cleanups.push(() => environment.dispose());
      if (kind === "room") {
        world.scene.background = new T.Color(
          companion.room_theme === "night" ? "#263241" : "#dadde0",
        );
        composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(world.scene, world.camera));
        const ao = new GTAOPass(world.scene, world.camera, 512, 512);
        ao.updateGtaoMaterial({
          radius: 0.28,
          thickness: 1,
          distanceExponent: 1.5,
          samples: 8,
        });
        ao.blendIntensity = 0.55;
        composer.addPass(ao);
        composer.addPass(new OutputPass());
        cleanups.push(() => composer?.passes.forEach((pass) => pass.dispose()));
      }
      const canvas = renderer.domElement;
      canvas.setAttribute(
        "aria-label",
        kind === "room"
          ? "Habitación tridimensional. Arrastrá para girar la cámara."
          : "Vista tridimensional de " + companion.name,
      );
      canvas.setAttribute("role", "img");
      node.appendChild(canvas);
      controls = new OrbitControls(world.camera, canvas);
      controls.target.copy(world.target);
      controls.enablePan = false;
      controls.enableDamping = true;
      controls.dampingFactor = 0.12;
      controls.minDistance = kind === "room" ? 8.5 : 2.8;
      controls.maxDistance = kind === "room" ? 18 : 6;
      controls.minPolarAngle = kind === "room" ? 0.68 : 0.9;
      controls.maxPolarAngle = kind === "room" ? 1.18 : 1.7;
      if (kind === "room") {
        controls.minAzimuthAngle = 0.28;
        controls.maxAzimuthAngle = 1.28;
      }
      const original = world.camera.position.clone(),
        target = world.target.clone();
      const drawSize = () => {
        if (!renderer || !world) return;
        const rect = node.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        renderer.setSize(rect.width, rect.height);
        composer?.setSize(rect.width, rect.height);
        world.camera.aspect = rect.width / rect.height;
        world.camera.updateProjectionMatrix();
        dirty = true;
      };
      resize = new ResizeObserver(drawSize);
      resize.observe(node);
      drawSize();
      intersection = new IntersectionObserver((entries) => {
        visible = entries[0].isIntersecting;
        dirty = true;
      });
      intersection.observe(node);
      const lost = (event: Event) => {
        event.preventDefault();
        setFailed(true);
        cancelAnimationFrame(frame);
      };
      canvas.addEventListener("webglcontextlost", lost);
      cleanups.push(() => canvas.removeEventListener("webglcontextlost", lost));
      let start: [number, number] = [0, 0];
      const down = (event: PointerEvent) => {
        start = [event.clientX, event.clientY];
      };
      const up = (event: PointerEvent) => {
        if (
          !world?.avatar ||
          !talk.current ||
          Math.hypot(start[0] - event.clientX, start[1] - event.clientY) > 7
        )
          return;
        const rect = canvas.getBoundingClientRect(),
          ray = new T.Raycaster();
        ray.setFromCamera(
          new T.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            (-(event.clientY - rect.top) / rect.height) * 2 + 1,
          ),
          world.camera,
        );
        if (ray.intersectObject(world.avatar, true).length) talk.current();
      };
      canvas.addEventListener("pointerdown", down);
      canvas.addEventListener("pointerup", up);
      cleanups.push(() => {
        canvas.removeEventListener("pointerdown", down);
        canvas.removeEventListener("pointerup", up);
      });
      action.current = (type) => {
        if (!world || !controls) return;
        if (type === "reset") {
          world.camera.position.copy(original);
          controls.target.copy(target);
        } else {
          const offset = world.camera.position.clone().sub(controls.target),
            spherical = new T.Spherical().setFromVector3(offset);
          if (type === "left") spherical.theta -= 0.18;
          if (type === "right") spherical.theta += 0.18;
          if (type === "in") spherical.radius *= 0.87;
          if (type === "out") spherical.radius *= 1.13;
          spherical.theta = T.MathUtils.clamp(
            spherical.theta,
            controls.minAzimuthAngle,
            controls.maxAzimuthAngle,
          );
          spherical.radius = T.MathUtils.clamp(
            spherical.radius,
            controls.minDistance,
            controls.maxDistance,
          );
          world.camera.position
            .copy(controls.target)
            .add(new T.Vector3().setFromSpherical(spherical));
        }
        controls.update();
        dirty = true;
      };
      const tick = (time: number) => {
        if (disposed) return;
        frame = requestAnimationFrame(tick);
        if (!visible || document.hidden || time - last < 32) return;
        const changed = controls!.update();
        if (!reduced && world?.avatar) {
          const head = world.avatar.getObjectByName("head");
          if (head) head.rotation.y = Math.sin(time * 0.0007) * 0.035;
          dirty = true;
        }
        if (changed || dirty) {
          if (composer) composer.render();
          else renderer!.render(world!.scene, world!.camera);
          dirty = false;
          last = time;
          setLoading(false);
        }
      };
      frame = requestAnimationFrame(tick);
    } catch {
      setFailed(true);
      setLoading(false);
    }
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resize?.disconnect();
      intersection?.disconnect();
      cleanups.forEach((fn) => fn());
      controls?.dispose();
      composer?.dispose();
      if (world) disposeModel(world.scene);
      if (renderer) {
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
      }
      action.current = () => {};
    };
  }, [fingerprint, kind, revision]);
  return (
    <div className={"world-canvas world-" + kind}>
      <div className="world-renderer" ref={host} />
      {loading && !failed && (
        <span className="world-loading">Preparando tu espacio…</span>
      )}
      {failed && (
        <div className="world-error">
          <p>No se pudo abrir la vista 3D en este dispositivo.</p>
          <button
            className="secondary"
            onClick={() => setRevision((n) => n + 1)}
          >
            Reintentar
          </button>
        </div>
      )}
      {!failed && (
        <div className="world-controls" aria-label="Cámara">
          <button
            aria-label="Girar a la izquierda"
            onClick={() => action.current("left")}
          >
            <ChevronLeft size={17} />
          </button>
          <button
            aria-label="Girar a la derecha"
            onClick={() => action.current("right")}
          >
            <ChevronRight size={17} />
          </button>
          {kind === "room" && (
            <>
              <button
                aria-label="Acercar habitación"
                onClick={() => action.current("in")}
              >
                <Plus size={16} />
              </button>
              <button
                aria-label="Alejar habitación"
                onClick={() => action.current("out")}
              >
                <Minus size={16} />
              </button>
            </>
          )}
          <button
            aria-label="Restablecer cámara"
            onClick={() => action.current("reset")}
          >
            <RotateCcw size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
export function Room({
  companion,
  onTalk,
}: {
  companion: Companion;
  onTalk: () => void;
}) {
  return (
    <div className={"room room-three " + companion.room_theme}>
      <WorldCanvas companion={companion} kind="room" onTalk={onTalk} />
      <div className="room-three-label">
        <span className="live-dot" />
        MI HABITACIÓN
      </div>
      <button className="room-talk" onClick={onTalk}>
        <MessageCircle size={17} />
        <span>Conversar con {companion.name}</span>
      </button>
      <span className="room-three-hint">Arrastrá para mirar alrededor</span>
    </div>
  );
}
