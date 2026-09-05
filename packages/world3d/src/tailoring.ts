import * as T from "three";
import { Model, type V3 } from "./primitives";

// Smooth, closed cross-sections for sewn silhouettes and facial anatomy.
export function loft(
  rings: { y: number; x: number; z: number; offset?: number }[],
  segments = 40,
) {
  const positions: number[] = [],
    indices: number[] = [];
  for (const ring of rings)
    for (let j = 0; j <= segments; j++) {
      const angle = (j / segments) * Math.PI * 2;
      positions.push(
        Math.sin(angle) * ring.x,
        ring.y,
        Math.cos(angle) * ring.z + (ring.offset ?? 0),
      );
    }
  for (let i = 0; i < rings.length - 1; i++)
    for (let j = 0; j < segments; j++) {
      const a = i * (segments + 1) + j,
        b = a + segments + 1;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function duvet(
  m: Model,
  center: V3,
  width: number,
  length: number,
  color: string,
) {
  const geometry = new T.PlaneGeometry(width, length, 56, 64);
  geometry.rotateX(-Math.PI / 2);
  const p = geometry.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      z = p.getZ(i);
    const edge = Math.pow(Math.abs(x) / (width / 2), 9);
    p.setY(
      i,
      0.048 * Math.sin(x * 11 + z * 2.3) * Math.cos(z * 4.2) +
        0.021 * Math.sin(z * 22 + x * 4) -
        edge * 0.13,
    );
  }
  geometry.computeVertexNormals();
  m.finish = "fabric";
  const mesh = m.mesh(geometry, color, center);
  mesh.material.side = T.DoubleSide;
  for (const side of [-1, 1]) {
    const points: V3[] = [];
    for (let i = 0; i <= 32; i++) {
      const z = -length / 2 + (i * length) / 32,
        x = side * width * 0.48;
      const y =
        0.048 * Math.sin(x * 11 + z * 2.3) * Math.cos(z * 4.2) +
        0.021 * Math.sin(z * 22 + x * 4) -
        Math.pow(0.96, 9) * 0.13;
      points.push([center[0] + x, center[1] + y + 0.006, center[2] + z]);
    }
    m.tube(points, 0.004, new T.Color(color).multiplyScalar(0.82).getStyle());
  }
}

export function curtain(m: Model, x: number, color: string) {
  const geometry = new T.PlaneGeometry(0.36, 1.77, 36, 24);
  const p = geometry.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i),
      v = p.getY(i);
    p.setXYZ(
      i,
      u * (1.06 - v * 0.15),
      v,
      Math.sin(u * 98) * (0.026 + (0.89 - v) * 0.009),
    );
  }
  geometry.computeVertexNormals();
  m.finish = "fabric";
  const mesh = m.mesh(geometry, color, [x, 1.82, -2.46]);
  mesh.material.side = T.DoubleSide;
  m.finish = "metal";
  for (let i = 0; i < 7; i++)
    m.torus(
      0.028,
      0.005,
      "#b8a18c",
      [x - 0.145 + i * 0.048, 2.713, -2.46],
      [0, Math.PI / 2, 0],
    );
}

export function hairLock(m: Model, points: V3[], width: number, color: string) {
  const curve = new T.CatmullRomCurve3(points.map((p) => new T.Vector3(...p)));
  const segments = 24,
    radial = 8;
  const geometry = new T.TubeGeometry(curve, segments, width, radial, false);
  const p = geometry.getAttribute("position");
  for (let row = 0; row <= segments; row++) {
    const t = row / segments,
      center = curve.getPointAt(t),
      taper = 0.1 + 0.9 * Math.pow(Math.sin(Math.PI * (0.08 + t * 0.92)), 0.62);
    for (let col = 0; col <= radial; col++) {
      const index = row * (radial + 1) + col;
      p.setXYZ(
        index,
        center.x + (p.getX(index) - center.x) * taper,
        center.y + (p.getY(index) - center.y) * taper,
        center.z + (p.getZ(index) - center.z) * taper,
      );
    }
  }
  geometry.computeVertexNormals();
  return m.mesh(geometry, color);
}
