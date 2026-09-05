import * as T from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { surfaceMaterial, type Surface } from "./surfaces";
export type V3 = [number, number, number];
export class Model {
  group = new T.Group();
  finish: Surface = "paint";
  private materials = new Map<string, T.MeshStandardMaterial>();
  material(color: string, glow = 0) {
    const key = color + ":" + glow + ":" + this.finish;
    if (!this.materials.has(key))
      this.materials.set(key, surfaceMaterial(color, this.finish, glow));
    return this.materials.get(key)!;
  }
  mesh(
    geometry: T.BufferGeometry,
    color: string,
    pos: V3 = [0, 0, 0],
    rotation: V3 = [0, 0, 0],
    glow = 0,
  ) {
    const mesh = new T.Mesh(geometry, this.material(color, glow));
    mesh.position.set(...pos);
    mesh.rotation.set(...rotation);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    return mesh;
  }
  box(
    size: V3,
    color: string,
    pos: V3 = [0, 0, 0],
    radius = 0.025,
    rotation: V3 = [0, 0, 0],
  ) {
    return this.mesh(
      radius
        ? new RoundedBoxGeometry(
            ...size,
            Math.max(...size) > 0.8 ? 3 : 2,
            Math.min(radius, Math.min(...size) / 3),
          )
        : new T.BoxGeometry(...size),
      color,
      pos,
      rotation,
    );
  }
  ball(size: V3, color: string, pos: V3 = [0, 0, 0], rotation: V3 = [0, 0, 0]) {
    const mesh = this.mesh(
      new T.SphereGeometry(1, 16, 12),
      color,
      pos,
      rotation,
    );
    mesh.scale.set(...size);
    return mesh;
  }
  cylinder(
    top: number,
    bottom: number,
    height: number,
    color: string,
    pos: V3 = [0, 0, 0],
    rotation: V3 = [0, 0, 0],
  ) {
    return this.mesh(
      new T.CylinderGeometry(top, bottom, height, 18),
      color,
      pos,
      rotation,
    );
  }
  rod(a: V3, b: V3, radius: number, color: string) {
    const start = new T.Vector3(...a),
      end = new T.Vector3(...b),
      delta = end.clone().sub(start);
    const mesh = this.cylinder(
      radius,
      radius,
      delta.length(),
      color,
      start.clone().add(end).multiplyScalar(0.5).toArray() as V3,
    );
    mesh.quaternion.setFromUnitVectors(
      new T.Vector3(0, 1, 0),
      delta.normalize(),
    );
    return mesh;
  }
  tube(points: V3[], radius: number, color: string) {
    return this.mesh(
      new T.TubeGeometry(
        new T.CatmullRomCurve3(points.map((p) => new T.Vector3(...p))),
        Math.max(12, points.length * (radius < 0.006 ? 2 : 4)),
        radius,
        radius < 0.006 ? 4 : 6,
        false,
      ),
      color,
    );
  }
  torus(
    radius: number,
    tube: number,
    color: string,
    pos: V3 = [0, 0, 0],
    rotation: V3 = [0, 0, 0],
    arc = Math.PI * 2,
  ) {
    return this.mesh(
      new T.TorusGeometry(radius, tube, 6, 24, arc),
      color,
      pos,
      rotation,
    );
  }
  add(
    group: T.Object3D,
    pos: V3 = [0, 0, 0],
    rotation: V3 = [0, 0, 0],
    scale = 1,
  ) {
    group.position.set(...pos);
    group.rotation.set(...rotation);
    group.scale.setScalar(scale);
    this.group.add(group);
    return group;
  }
}
// One mesh per material for static furniture and hair. Keeps native draw calls low.
export function compact(group: T.Group) {
  group.updateMatrixWorld(true);
  const buckets = new Map<T.Material, T.BufferGeometry[]>();
  const canonical = new Map<string, T.Material>();
  const redundant = new Set<T.Material>();
  const inverse = group.matrixWorld.clone().invert();
  group.traverse((o) => {
    if (!(o instanceof T.Mesh) || Array.isArray(o.material)) return;
    const geometry = o.geometry
      .clone()
      .applyMatrix4(inverse.clone().multiply(o.matrixWorld));
    const plain = geometry.index ? geometry.toNonIndexed() : geometry;
    for (const key of Object.keys(plain.attributes))
      if (!["position", "normal", "uv"].includes(key))
        plain.deleteAttribute(key);
    if (!plain.getAttribute("uv"))
      plain.setAttribute(
        "uv",
        new T.Float32BufferAttribute(
          new Float32Array(plain.getAttribute("position").count * 2),
          2,
        ),
      );
    const surface = o.material as T.MeshStandardMaterial;
    const key = [
      surface.name,
      surface.side,
      surface.emissiveIntensity,
      surface.roughness,
      surface.metalness,
    ].join(":");
    const material = canonical.get(key) ?? surface;
    canonical.set(key, material);
    if (material !== surface) redundant.add(surface);
    const list = buckets.get(material) ?? [];
    list.push(plain);
    buckets.set(material, list);
    if (plain !== geometry) geometry.dispose();
  });
  group.traverse((o) => {
    if (o instanceof T.Mesh) o.geometry.dispose();
  });
  group.clear();
  redundant.forEach((material) => material.dispose());
  for (const [material, geometries] of buckets) {
    const geometry = mergeGeometries(geometries, false);
    geometries.forEach((g) => g.dispose());
    if (!geometry) throw Error("No se pudo combinar la geometría 3D.");
    const mesh = new T.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}
export function disposeModel(root: T.Object3D) {
  const geometries = new Set<T.BufferGeometry>(),
    materials = new Set<T.Material>();
  root.traverse((o) => {
    if (o instanceof T.Mesh) {
      geometries.add(o.geometry);
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
        materials.add(m),
      );
    }
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
}
