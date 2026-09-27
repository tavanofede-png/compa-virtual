import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  studySpaceLayouts,
  type Companion,
  type StudySpaceId,
} from "@compa/domain";
import { createPremiumWorld, type ReadModel } from "./premium";
import { disposeModel } from "./primitives";

const defaultRead: ReadModel = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw Error("No se pudo descargar el espacio de estudio.");
  return response.arrayBuffer();
};

export type StudyObjectAction = "session" | "materials" | "learning" | "chat";

/** Semantic affordances from authored GLB object names, ordered by specificity. */
export function studyObjectAction(names: readonly string[]): StudyObjectAction | null {
  const value = names.join(" ").toLowerCase();
  if (/teen-avatar|compa-humanoid/.test(value)) return "chat";
  if (/laptop|monitor|tablet/.test(value)) return "materials";
  if (/book|notebook|whiteboard|pinboard/.test(value)) return "learning";
  if (/clock|chair|desk|study.table/.test(value)) return "session";
  return null;
}

/** One scene and one seated companion. The authored GLB and StudyZone share Blender's metre scale. */
export async function createPersonalStudyWorld(
  id: StudySpaceId,
  companion: Companion,
  read: ReadModel = defaultRead,
  signal?: AbortSignal,
) {
  const layout = studySpaceLayouts[id];
  if (!layout) throw Error("Este espacio no tiene un mapa de estudio válido.");
  const scene = new T.Scene();
  scene.background = new T.Color("#eee8de");
  const camera = new T.PerspectiveCamera(36, 1, 0.1, 100);
  const target = new T.Vector3(0, 1.1, 0);
  const distance = Math.max(layout.width, layout.depth) * 1.55;
  camera.position.set(distance * 0.66, distance * 0.67, distance);
  camera.lookAt(target);
  scene.add(new T.HemisphereLight(0xfff5e8, 0x687381, 1.6));
  const key = new T.DirectionalLight(0xffe1bc, 2.3);
  key.position.set(-4, 8, 6);
  scene.add(key);
  const fill = new T.DirectionalLight(0xc8dbff, 0.8);
  fill.position.set(5, 4, -3);
  scene.add(fill);
  let disposed = false;
  const check = () => {
    if (disposed || signal?.aborted) throw Error("Escena reemplazada.");
  };
  let avatar: T.Group | undefined;
  let mixer: T.AnimationMixer | undefined;
  try {
    const bytes = await read(`/selection/study-spaces/${id}-mobile.glb?v=${layout.assetRevision}`);
    check();
    if (bytes.byteLength < 12 || new DataView(bytes).getUint32(0, true) !== 0x46546c67)
      throw Error("El espacio 3D está incompleto.");
    const gltf = await new GLTFLoader().parseAsync(bytes, "");
    if (signal?.aborted) {
      disposeModel(gltf.scene);
      check();
    }
    scene.add(gltf.scene);
    gltf.scene.traverse((object) => {
      if (!(object instanceof T.Mesh) || !object.userData.scenic_panel) return;
      const previous = Array.isArray(object.material) ? object.material : [object.material];
      object.material = new T.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
      previous.forEach((material) => material.dispose());
    });
    const world = await createPremiumWorld(companion, "avatar", "/selection/models", read, signal);
    avatar = world.avatar;
    if (!avatar) throw Error("No se pudo cargar el compañero.");
    avatar.removeFromParent();
    disposeModel(world.scene);
    check();
    // Bags are set beside the seat for this posture; the saved outfit is unchanged.
    avatar.traverse((object) => {
      if (object instanceof T.Mesh && ["back", "crossbody", "handheld"].includes(String(object.userData.wearableSlot)))
        object.visible = false;
    });
    const scale = avatar.children.find((object) => object.userData.compa_schema === "compa-humanoid-v2")?.scale.x ?? 0.88;
    avatar.position.set(layout.seat[0], layout.seat[1] + 0.1 - 0.78 * scale, layout.seat[2]);
    avatar.rotation.y = layout.yaw;
    scene.add(avatar);
    const library = await new GLTFLoader().parseAsync(
      await read("/selection/models/rig-animations.glb"), "",
    );
    disposeModel(library.scene);
    check();
    mixer = new T.AnimationMixer(avatar);
    const clip = library.animations.find((item) => item.name === "study") ?? library.animations.find((item) => item.name === "seated");
    if (clip) mixer.clipAction(clip).play();
    mixer.update(0.01);
    return {
      scene,
      camera,
      target,
      studyZone: layout,
      update(delta: number, reduced = false) {
        if (!disposed && !reduced) mixer?.update(Math.min(delta, 0.05));
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        mixer?.stopAllAction();
        if (avatar) mixer?.uncacheRoot(avatar);
        disposeModel(scene);
      },
    };
  } catch (error) {
    mixer?.stopAllAction();
    disposeModel(scene);
    throw error;
  }
}
