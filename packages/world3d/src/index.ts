import * as T from "three";
import { avatarAppearance, type Companion } from "@compa/domain";
import { avatarModel } from "./avatar";
import { roomModel } from "./room";
import { equipmentModel } from "./equipment";
export { avatarModel, roomModel, equipmentModel };
export { disposeModel } from "./primitives";
export type ViewKind = "room" | "avatar" | "icon" | "equipment";
export function appearanceKey(
  c: Companion,
  kind: ViewKind = "avatar",
  item?: string,
) {
  return kind === "equipment"
    ? "equipment:" + item
    : JSON.stringify([
        kind,
        avatarAppearance(c),
        c.eyes,
        c.mouth,
        c.accessory,
        c.outfit,
        kind === "room" ? c.decoration : undefined,
        kind === "room" ? c.room_theme : undefined,
      ]);
}
export function modelMetrics(object: T.Object3D) {
  let meshes = 0,
    vertices = 0,
    triangles = 0,
    finite = true;
  object.traverse((o) => {
    if (o instanceof T.Mesh) {
      meshes++;
      const attribute = o.geometry.getAttribute("position");
      vertices += attribute.count;
      triangles += (o.geometry.index?.count ?? attribute.count) / 3;
      for (const value of attribute.array)
        if (!Number.isFinite(value)) finite = false;
    }
  });
  const size = new T.Box3().setFromObject(object).getSize(new T.Vector3());
  return { meshes, vertices, triangles, finite, size: size.toArray() };
}
export function createWorld(
  c: Companion,
  kind: ViewKind = "room",
  item?: string,
) {
  const scene = new T.Scene();
  const target = new T.Vector3(
    0,
    kind === "room" ? 0.92 : kind === "icon" ? 1.49 : 1.02,
    0,
  );
  let avatar: T.Group | undefined;
  if (kind === "room") {
    scene.add(roomModel(c));
    avatar = avatarModel(c);
    avatar.position.set(0.15, 0.082, 0.73);
    avatar.rotation.y = 0.34;
    scene.add(avatar);
  } else if (kind === "equipment") {
    const equipment = equipmentModel(item ?? "plant");
    const bounds = new T.Box3().setFromObject(equipment),
      size = bounds.getSize(new T.Vector3()),
      center = bounds.getCenter(new T.Vector3());
    equipment.position.sub(center);
    equipment.scale.setScalar(1.4 / Math.max(size.x, size.y, size.z));
    equipment.position.multiplyScalar(equipment.scale.x);
    scene.add(equipment);
    target.set(0, 0, 0);
  } else {
    avatar = avatarModel(c);
    scene.add(avatar);
  }
  const night = kind === "room" && c.room_theme === "night";
  scene.add(
    new T.HemisphereLight(
      night ? "#aebdde" : "#fff2dd",
      "#adabbd",
      night ? 0.65 : 0.9,
    ),
  );
  const key = new T.DirectionalLight(
    night ? "#ffdbad" : "#fff2d8",
    night ? 2.6 : 3.8,
  );
  key.position.set(2.5, 6.5, 3.5);
  key.castShadow = kind === "room";
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -5;
  key.shadow.camera.right = 5;
  key.shadow.camera.top = 5;
  key.shadow.camera.bottom = -5;
  key.shadow.camera.near = 0.1;
  key.shadow.camera.far = 22;
  key.shadow.bias = -0.0002;
  key.shadow.normalBias = 0.009;
  scene.add(key);
  const fill = new T.DirectionalLight("#d8e4f7", 0.6);
  fill.position.set(-4, 4, 3);
  scene.add(fill);
  const rim = new T.DirectionalLight("#ffdbc0", 0.8);
  rim.position.set(0, 3, -4);
  scene.add(rim);
  if (kind === "room") {
    const deskGlow = new T.PointLight(
      night ? "#edb875" : "#fff2dd",
      night ? 5 : 1.5,
      4,
      2,
    );
    deskGlow.position.set(-1.08, 1.1, -1.78);
    scene.add(deskGlow);
    const windowLight = new T.PointLight(
      night ? "#a5bcea" : "#e7f3ff",
      night ? 3 : 7,
      6,
      2,
    );
    windowLight.position.set(1.5, 2, -2.4);
    scene.add(windowLight);
  }
  const camera = new T.PerspectiveCamera(
    kind === "room" ? 38 : kind === "equipment" ? 32 : 30,
    1,
    0.1,
    80,
  );
  camera.position.copy(
    kind === "room"
      ? new T.Vector3(7.4, 6.8, 9.2)
      : kind === "equipment"
        ? new T.Vector3(2.5, 1.5, 3.5)
        : kind === "icon"
          ? new T.Vector3(0.75, 1.62, 2.1)
          : new T.Vector3(1.8, 1.7, 4.1),
  );
  camera.lookAt(target);
  return { scene, camera, target, avatar };
}
