import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  characterById,
  petDefinition,
  roomById,
  wardrobeItem,
  type Companion,
} from "@compa/domain";
import { disposeModel } from "./primitives";
import { createCompanionController, roomInteractions } from "./motion";
import {
  createPetController,
  roomPetMaps,
  type PetSceneSetup,
} from "./pet";

export type ReadModel = (url: string) => Promise<ArrayBuffer>;
const buffers = new Map<string, ArrayBuffer>();
const requests = new Map<string, Promise<ArrayBuffer>>();
const fetchModel: ReadModel = async (url) => {
  const cached = buffers.get(url);
  if (cached) {
    buffers.delete(url);
    buffers.set(url, cached);
    return cached;
  }
  const pending = requests.get(url);
  if (pending) return pending;
  const work = (async () => {
    const response = await fetch(url);
    if (!response.ok)
      throw Error("No se pudo descargar el modelo. Reintentá con conexión.");
    const bytes = await response.arrayBuffer();
    if (
      bytes.byteLength < 12 ||
      new DataView(bytes).getUint32(0, true) !== 0x46546c67
    )
      throw Error("El archivo 3D está incompleto.");
    buffers.set(url, bytes);
    let total = [...buffers.values()].reduce(
      (sum, value) => sum + value.byteLength,
      0,
    );
    while (total > 32 * 1024 * 1024 && buffers.size > 1) {
      const key = buffers.keys().next().value!;
      total -= buffers.get(key)!.byteLength;
      buffers.delete(key);
    }
    return bytes;
  })();
  requests.set(url, work);
  try {
    return await work;
  } finally {
    requests.delete(url);
  }
};
async function load(name: string, base: string, read: ReadModel) {
  const revision = name.startsWith("pet-") ? "?v=20260912d" : "";
  const data = await read(base.replace(/\/$/, "") + "/" + name + ".glb" + revision);
  if (
    data.byteLength < 12 ||
    new DataView(data).getUint32(0, true) !== 0x46546c67
  )
    throw Error("El archivo 3D está incompleto.");
  const gltf = await new GLTFLoader().parseAsync(data, "");
  gltf.scene.animations = gltf.animations;
  return gltf.scene;
}

export function bindWearable(avatar: T.Group, wearable: T.Group) {
  const rig = avatar.children.find(
    (o) => o.userData.compa_schema === "compa-humanoid-v2",
  );
  if (!rig) throw Error("El personaje no tiene un esqueleto compatible.");
  const bones = new Map<string, T.Bone>();
  rig.traverse((o) => {
    if (o instanceof T.Bone) bones.set(o.name, o);
  });
  const meshes: T.SkinnedMesh[] = [];
  wearable.traverse((o) => {
    if (o instanceof T.SkinnedMesh) meshes.push(o);
  });
  if (!meshes.length) throw Error("La prenda no tiene un ajuste válido.");
  for (const mesh of meshes) {
    const mapped = mesh.skeleton.bones.map((bone) => {
      const target = bones.get(bone.name);
      if (!target) throw Error("Esta prenda usa otro esqueleto.");
      return target;
    });
    const skeleton = new T.Skeleton(
      mapped,
      mesh.skeleton.boneInverses.map((m) => m.clone()),
    );
    const bindMatrix = mesh.bindMatrix.clone();
    mesh.removeFromParent();
    rig.add(mesh);
    mesh.position.set(0, 0, 0);
    mesh.quaternion.identity();
    mesh.scale.set(1, 1, 1);
    mesh.bind(skeleton, bindMatrix);
    mesh.frustumCulled = false;
  }
  avatar.updateMatrixWorld(true);
}
function fitBody(avatar: T.Group, ids: string[]) {
  const items = ids.map(wardrobeItem);
  const tee = items.some((i) => i?.family === "tee");
  const shorts = items.some(
    (i) => i?.family === "shorts" || i?.family === "sportshorts",
  );
  const hat = items.some((i) => i?.slot === "headwear");
  const back = items.some((i) => i?.slot === "back");
  avatar.traverse((o) => {
    if (!(o instanceof T.Mesh)) return;
    const component = String(o.userData.compa_component ?? "");
    if (component.startsWith("arm_")) o.visible = tee;
    if (component.startsWith("leg_")) o.visible = shorts;
    if (component === "hair" && (hat || back)) {
      const positions = o.geometry.getAttribute("position");
      for (let i = 0; i < positions.count; i++) {
        let x = positions.getX(i),
          y = positions.getY(i),
          z = positions.getZ(i);
        if (hat && y > 1.8) {
          y = 1.8 + (y - 1.8) * 0.44;
          if (Math.abs(x) > 0.305)
            x = Math.sign(x) * (0.305 + (Math.abs(x) - 0.305) * 0.25);
          z = Math.max(-0.23, Math.min(0.245, z));
        }
        if (back && y < 1.32 && z < -0.115) {
          y = 1.32 + (y - 1.32) * 0.1;
          z = Math.max(z, -0.145);
        }
        positions.setXYZ(i, x, y, z);
      }
      positions.needsUpdate = true;
      o.geometry.computeBoundingSphere();
    }
  });
}

export async function createPremiumWorld(
  companion: Companion,
  kind: "avatar" | "room",
  base = "/selection/models",
  read: ReadModel = fetchModel,
  signal?: AbortSignal,
  petSetup?: PetSceneSetup,
) {
  const character = characterById(companion.character_id);
  const ids = companion.wardrobe ?? character.outfit;
  const scene = new T.Scene();
  const active = () => {
    if (signal?.aborted) throw Error("Vista reemplazada.");
  };
  try {
    active();
    const avatar = await load(character.id + "-body", base, read);
    scene.add(avatar);
    avatar.name = "teen-avatar";
    fitBody(avatar, ids);
    active();
    // Load sequentially to bound decoded memory on phones. Cached bytes make swaps quick.
    for (const id of ids) {
      if (!wardrobeItem(id))
        throw Error("Prenda desconocida.");
      const garment = await load(id, base, read);
      try {
        active();
        const slot = wardrobeItem(id)!.slot;
        garment.traverse((o) => {
          if (o instanceof T.Mesh) o.userData.wearableSlot = slot;
        });
        bindWearable(avatar, garment);
      } finally {
        disposeModel(garment);
      }
    }
    let target = new T.Vector3(0, 0.87, 0);
    let controller: ReturnType<typeof createCompanionController> | undefined;
    let pet: T.Group | undefined;
    let petController: ReturnType<typeof createPetController> | undefined;
    if (kind === "room") {
      const room = await load(
        roomById(companion.room_style).id + "-room",
        base,
        read,
      );
      scene.add(room);
      const map = roomInteractions[roomById(companion.room_style).id];
      avatar.position.fromArray(map.spawn);
      avatar.rotation.y = -0.22;
      active();
      target = new T.Vector3(0, 1.05, 0);
      const library = await load("rig-animations", base, read);
      controller = createCompanionController(
        avatar,
        scene,
        library.animations,
        map,
      );
      disposeModel(library);
      const petMap = roomPetMaps[roomById(companion.room_style).id];
      const selectedPet = petSetup ? petDefinition(petSetup.definitionId) : undefined;
      if (
        petSetup &&
        selectedPet?.id === petSetup.definitionId &&
        petSetup.preferences.visible &&
        petMap
      ) {
        active();
        pet = await load(selectedPet.variant.model, base, read);
        pet.name = "pet-avatar";
        pet.scale.setScalar(selectedPet.variant.scale);
        pet.position.fromArray(petMap.spawn);
        pet.rotation.y = petMap.home.yaw;
        scene.add(pet);
        petController = createPetController(
          pet,
          pet.animations,
          map,
          petMap,
          petSetup.preferences,
        );
        const propNames = [
          ["pet-bed-cozy", petMap.props.bed],
          ["pet-bowl-cozy", petMap.props.bowl],
          ["pet-toy-basket-cozy", petMap.props.basket],
          ["pet-ball-cozy", petMap.props.ball],
          ["pet-rope-cozy", petMap.props.rope],
        ] as const;
        for (const [name, position] of propNames) {
          active();
          const prop = await load(name, base, read);
          prop.name = name;
          prop.position.fromArray(position);
          scene.add(prop);
        }
        const petHit = new T.Mesh(
          new T.BoxGeometry(1.05, 1.05, 1.25),
          new T.MeshBasicMaterial({
            transparent: true,
            opacity: 0,
            depthWrite: false,
            colorWrite: false,
          }),
        );
        petHit.name = "interaction-pet";
        petHit.userData.roomAction = "pet";
        petHit.position.set(0, .48, 0);
        pet.add(petHit);
      }
      for (const [name, point, size] of [
        [
          "chair",
          [
            map.chair.position[0],
            map.chair.height + 0.32,
            map.chair.position[2],
          ],
          [0.68, 1.1, 0.68],
        ],
        [
          "bed",
          [map.bed.position[0], map.bed.height - 0.16, map.bed.position[2] - 0.7],
          [1.48, 0.5, 2.3],
        ],
        ...(map.pouf ? [["pouf", map.pouf.position, [0.9, 0.6, 0.9]]] : []),
        ...(map.objects ?? []).map(o => ["object:" + o.id, o.position, [0.5, 0.6, 0.5]]),
      ] as [string, number[], number[]][]) {
        const hit = new T.Mesh(
          new T.BoxGeometry(size[0], size[1], size[2]),
          new T.MeshBasicMaterial({
            transparent: true,
            opacity: 0,
            depthWrite: false,
            colorWrite: false,
          }),
        );
        hit.position.set(point[0], point[1], point[2]);
        hit.name = "interaction-" + name;
        hit.userData.roomAction = name;
        room.add(hit);
      }
      const floorHit = new T.Mesh(new T.PlaneGeometry(map.bounds[2] - map.bounds[0], map.bounds[3] - map.bounds[1]), new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }));
      floorHit.rotation.x = -Math.PI / 2;
      floorHit.position.set((map.bounds[0] + map.bounds[2]) / 2, map.floor + .025, (map.bounds[1] + map.bounds[3]) / 2);
      floorHit.userData.roomAction = "floor";
      scene.add(floorHit);
    } else {
      const floor = new T.Mesh(
        new T.PlaneGeometry(20, 20),
        new T.MeshStandardMaterial({ color: "#e9e4dd", roughness: 1 }),
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.007;
      floor.receiveShadow = true;
      scene.add(floor);
    }
    scene.traverse((o) => {
      if (o instanceof T.Mesh && !o.userData.roomAction) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    scene.add(new T.HemisphereLight("#fff6e7", "#9a9291", 1.3));
    const key = new T.DirectionalLight("#ffebd1", 3.2);
    key.position.set(-3, 7, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -5;
    key.shadow.camera.right = 5;
    key.shadow.camera.top = 5;
    key.shadow.camera.bottom = -5;
    key.shadow.normalBias = 0.025;
    scene.add(key);
    const fill = new T.DirectionalLight("#dde9ff", 1);
    fill.position.set(5, 3, 2);
    scene.add(fill);
    const camera = new T.PerspectiveCamera(
      kind === "room" ? 42 : 30,
      1,
      0.05,
      100,
    );
    camera.position.copy(
      kind === "room"
        ? new T.Vector3(7.7, 7.1, 10.3)
        : new T.Vector3(0.8, 1.15, 3.7),
    );
    camera.lookAt(target);
    scene.updateMatrixWorld(true);
    return { scene, camera, target, avatar, controller, pet, petController };
  } catch (error) {
    disposeModel(scene);
    throw error;
  }
}
