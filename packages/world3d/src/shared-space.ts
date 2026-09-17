import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  sharedSeats,
  sharedSpaceRevision,
  selectCharacter,
  characterById,
  type SharedSpaceId,
  type SharedRoomPresence,
} from "@compa/domain";
import { createPremiumWorld, type ReadModel } from "./premium";
import { disposeModel } from "./primitives";

export async function createSharedSpaceWorld(
  id: SharedSpaceId,
  read: ReadModel = async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw Error("No se pudo cargar el ambiente.");
    return response.arrayBuffer();
  },
  signal?: AbortSignal,
) {
  const scene = new T.Scene();
  scene.background = new T.Color("#f1ece4");
  const camera = new T.PerspectiveCamera(36, 1, 0.1, 100);
  camera.position.set(7.8, 7.3, 10.3);
  const target = new T.Vector3(0, 1.15, 0);
  camera.lookAt(target);
  scene.add(new T.HemisphereLight(0xfff4df, 0x697580, 1.65));
  const key = new T.DirectionalLight(0xffdfb4, 2.6);
  key.position.set(-4, 8, 6);
  scene.add(key);
  const fill = new T.DirectionalLight(0xc3d8ff, 1.1);
  fill.position.set(5, 5, -2);
  scene.add(fill);
  let disposed = false;
  const check = () => {
    if (disposed || signal?.aborted) throw Error("Escena reemplazada.");
  };
  const gltf = await new GLTFLoader().parseAsync(
    await read(
      `/selection/shared-spaces/${id}-reduced.glb?v=${sharedSpaceRevision}`,
    ),
    "",
  );
  if (signal?.aborted) {
    disposeModel(gltf.scene);
    throw Error("Escena reemplazada.");
  }
  // The distant image already contains daylight/sunset. Do not light it a
  // second time or it becomes a washed-out white rectangle behind the frame.
  gltf.scene.traverse((object) => {
    if (!(object instanceof T.Mesh) || !object.userData.scenic_panel) return;
    const previous = Array.isArray(object.material)
      ? object.material
      : [object.material];
    object.material = new T.MeshBasicMaterial({
      vertexColors: true,
      color: 0xffffff,
      toneMapped: false,
    });
    previous.forEach((material) => material.dispose());
  });
  scene.add(gltf.scene);
  const actors = new Map<
    string,
    {
      model: T.Group;
      mixer: T.AnimationMixer;
      fingerprint: string;
      activity: string;
    }
  >();
  const seats = sharedSeats(id);
  let desired: SharedRoomPresence[] = [];
  let loading = false;
  async function loadActors() {
    if (loading || disposed) return;
    loading = true;
    try {
      while (!disposed) {
        const row = desired.find(
          (p) => p.appearance.character_id && !actors.has(p.user_id),
        );
        if (!row) break;
        const character = characterById(row.appearance.character_id);
        const companion = {
          ...selectCharacter(character.id),
          wardrobe: row.appearance.wardrobe ?? character.outfit,
        };
        let model: T.Group | undefined;
        try {
          const world = await createPremiumWorld(
            companion,
            "avatar",
            "/selection/models",
            read,
            signal,
          );
          model = world.avatar;
          model.removeFromParent();
          disposeModel(world.scene);
          check();
          if (!desired.some((p) => p.user_id === row.user_id)) {
            disposeModel(model);
            continue;
          }
          // Bulky bags are visually stowed in shared seating; saved clothing is untouched.
          model.traverse((o) => {
            if (
              o instanceof T.Mesh &&
              ["back", "crossbody", "handheld"].includes(
                String(o.userData.wearableSlot),
              )
            )
              o.visible = false;
          });
          const library = await new GLTFLoader().parseAsync(
            await read("/selection/models/rig-animations.glb"),
            "",
          );
          if (disposed || signal?.aborted) disposeModel(library.scene);
          check();
          const mixer = new T.AnimationMixer(model);
          model.animations = library.animations;
          disposeModel(library.scene);
          scene.add(model);
          actors.set(row.user_id, {
            model,
            mixer,
            fingerprint: JSON.stringify(row.appearance),
            activity: "",
          });
          place();
        } catch (error) {
          if (model && !actors.has(row.user_id)) disposeModel(model);
          if (!disposed) throw error;
        }
      }
    } finally {
      loading = false;
    }
  }
  function place() {
    for (const row of desired) {
      const actor = actors.get(row.user_id),
        seat = seats.find((s) => s.id === row.seat_id);
      if (!actor || !seat) continue;
      const scale =
        actor.model.children.find(
          (o) => o.userData.compa_schema === "compa-humanoid-v2",
        )?.scale.x ?? 0.88;
      actor.model.position.set(
        seat.position[0],
        seat.height + 0.1 - 0.78 * scale,
        seat.position[2],
      );
      actor.model.rotation.y = seat.yaw;
      const clipName = row.activity === "focused" ? "study" : "seated";
      if (actor.activity !== clipName) {
        actor.mixer.stopAllAction();
        const clip = actor.model.animations.find((c) => c.name === clipName);
        if (clip) actor.mixer.clipAction(clip).play();
        actor.activity = clipName;
        actor.mixer.update(0.01);
      }
    }
  }
  return {
    scene,
    camera,
    target,
    seats,
    async setParticipants(rows: SharedRoomPresence[]) {
      desired = rows;
      for (const [uid, actor] of actors)
        if (
          !desired.some(
            (p) =>
              p.user_id === uid &&
              JSON.stringify(p.appearance) === actor.fingerprint,
          )
        ) {
          actor.mixer.stopAllAction();
          actor.mixer.uncacheRoot(actor.model);
          actor.model.removeFromParent();
          disposeModel(actor.model);
          actors.delete(uid);
        }
      place();
      await loadActors();
    },
    update(delta: number, reduced = false) {
      if (disposed || reduced) return;
      for (const actor of actors.values())
        actor.mixer.update(Math.min(delta, 0.05));
    },
    dispose() {
      disposed = true;
      for (const actor of actors.values()) {
        actor.mixer.stopAllAction();
        actor.mixer.uncacheRoot(actor.model);
      }
      actors.clear();
      disposeModel(scene);
    },
  };
}
