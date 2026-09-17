import * as T from "three";
import maps from "./room-maps.json";

export type CompanionAction =
  "walk" | "pouf" | "inspect" | "sit" | "study" | "rest" | "stand" | "greet" | "celebrate";
export type MotionContext = {
  enabled?: boolean;
  reduced?: boolean;
  resting?: boolean;
  studying?: boolean;
  talking?: boolean;
  celebration?: number;
};
type Point = number[];
export type RoomMap = (typeof maps)["cozy"] & { pouf?: { position: number[]; approach: number[]; yaw: number; height: number }; objects?: { id: string; label: string; position: number[]; approach: number[]; yaw: number }[] };
export const roomInteractions: Record<string, RoomMap> = maps;
const vector = (p: Point) => new T.Vector3(p[0], p[1], p[2]);
const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const smooth = (n: number) => n * n * (3 - 2 * n);

/** Conservative 2D segment/AABB test, including the avatar's shoulder radius. */
export function clearSegment(a: Point, b: Point, map: RoomMap, radius = 0.26) {
  if (![...a, ...b].every(Number.isFinite)) return false;
  for (const p of [a, b]) if (p[0] < map.bounds[0] + radius || p[0] > map.bounds[2] - radius || p[2] < map.bounds[1] + radius || p[2] > map.bounds[3] - radius) return false;
  for (const ob of map.obstacles) {
    let lo = 0,
      hi = 1;
    for (const [axis, k] of [
      [0, 0],
      [2, 1],
    ]) {
      const d = b[axis] - a[axis],
        min = ob.min[k] - radius,
        max = ob.max[k] + radius;
      if (Math.abs(d) < 1e-8) {
        if (a[axis] < min || a[axis] > max) {
          lo = 2;
          break;
        }
      } else {
        const t1 = (min - a[axis]) / d,
          t2 = (max - a[axis]) / d;
        lo = Math.max(lo, Math.min(t1, t2));
        hi = Math.min(hi, Math.max(t1, t2));
      }
    }
    if (lo <= hi && hi >= 0 && lo <= 1) return false;
  }
  return true;
}
export function findRoomRoute(
  from: Point,
  to: Point,
  map: RoomMap,
): Point[] | null {
  const nodes = [from, ...map.waypoints, to],
    end = nodes.length - 1;
  const cost = nodes.map(() => Infinity),
    prev = nodes.map(() => -1),
    visited = new Set<number>();
  cost[0] = 0;
  for (let n = 0; n < nodes.length; n++) {
    let u = -1;
    for (let i = 0; i < nodes.length; i++)
      if (!visited.has(i) && (u < 0 || cost[i] < cost[u])) u = i;
    if (u < 0 || !Number.isFinite(cost[u])) return gridRoute(from, to, map);
    if (u === end) {
      const path: Point[] = [];
      while (u > 0) {
        path.unshift(nodes[u]);
        u = prev[u];
      }
      return path;
    }
    visited.add(u);
    for (let v = 0; v < nodes.length; v++)
      if (!visited.has(v) && clearSegment(nodes[u], nodes[v], map)) {
        const next = cost[u] + distance(nodes[u], nodes[v]);
        if (next < cost[v]) {
          cost[v] = next;
          prev[v] = u;
        }
      }
  }
  return null;
}

/** Grid fallback follows real object footprints when the authored visibility graph is insufficient. */
function gridRoute(from: Point, to: Point, map: RoomMap): Point[] | null {
  if (!clearSegment(from, from, map) || !clearSegment(to, to, map)) return null;
  const step = 0.20, nodes: Point[] = [], lookup = new Map<string, number>();
  for (let x = map.bounds[0] + .28, i = 0; x < map.bounds[2] - .26; x += step, i++)
    for (let z = map.bounds[1] + .28, j = 0; z < map.bounds[3] - .26; z += step, j++) {
      const p = [x, map.floor, z];
      if (clearSegment(p, p, map)) { lookup.set(`${i},${j}`, nodes.length); nodes.push(p); }
    }
  const queue: number[] = [], previous = new Map<number, number>();
  nodes.forEach((p, i) => { if (distance(from, p) < .42 && clearSegment(from, p, map)) { queue.push(i); previous.set(i, -1); } });
  const keys = new Map([...lookup].map(([k, v]) => [v, k.split(',').map(Number)]));
  for (let q = 0; q < queue.length; q++) {
    const u = queue[q], p = nodes[u];
    if (distance(p, to) < .42 && clearSegment(p, to, map)) {
      const path = [to]; let current = u;
      while (current !== -1) { path.unshift(nodes[current]); current = previous.get(current)!; }
      // String pulling retains collision clearance while eliminating tiny grid turns.
      const simplified: Point[] = []; let start = from, index = 0;
      while (index < path.length) { let far = index; while (far + 1 < path.length && clearSegment(start, path[far + 1], map)) far++; simplified.push(path[far]); start = path[far]; index = far + 1; }
      return simplified;
    }
    const [i, j] = keys.get(u)!;
    for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]) {
      const v = lookup.get(`${i+dx},${j+dz}`);
      if (v !== undefined && !previous.has(v) && clearSegment(p, nodes[v], map)) { previous.set(v, u); queue.push(v); }
    }
  }
  return null;
}

export function createCompanionController(
  avatar: T.Group,
  scene: T.Scene,
  clips: T.AnimationClip[],
  map: RoomMap,
) {
  const mixer = new T.AnimationMixer(avatar),
    actions = new Map(clips.map((c) => [c.name, mixer.clipAction(c)]));
  let playing: T.AnimationAction | undefined,
    context: MotionContext = { enabled: true },
    paused = false,
    disposed = false;
  let pose: "stand" | "sit" | "rest" = "stand",
    active: CompanionAction = "greet",
    requested: CompanionAction | null = "greet";
  let elapsed = 0,
    remaining = 0,
    idleFor = 0,
    nextIdle = 32,
    lastCelebration: number | undefined;
  let phase: "idle" | "turn" | "walk" | "pose" | "exit" | "gesture" = "idle";
  let route: Point[] = [],
    routeIndex = 0,
    begin = avatar.position.clone(),
    end = begin.clone();
  let startQ = avatar.quaternion.clone(),
    endQ = startQ.clone(),
    finalPose: "stand" | "sit" | "rest" = "stand";
  let walkTarget: Point | null = null, pendingTarget: Point | null = null;
  let objectTarget: NonNullable<RoomMap["objects"]>[number] | undefined;
  let pendingObject: typeof objectTarget;
  let seatedAt = map.chair;
  let blocked = false;
  const seat = () => active === "pouf" && map.pouf ? map.pouf : map.chair;
  let stowed: T.Group | null = null;
  const hidden: T.Mesh[] = [];
  const bones: T.Bone[] = [];
  avatar.traverse((o) => {
    if (o instanceof T.Bone) bones.push(o);
  });
  const rigScale =
    avatar.children.find((o) => o.userData.compa_schema === "compa-humanoid-v2")
      ?.scale.x ?? 0.88;
  const play = (name: string, loop = true) => {
    const next = actions.get(name);
    if (!next) return;
    if (playing === next && loop) return;
    next
      .reset()
      .setEffectiveWeight(1)
      .setEffectiveTimeScale(1)
      .setLoop(loop ? T.LoopRepeat : T.LoopOnce, loop ? Infinity : 1);
    next.clampWhenFinished = true;
    next.play();
    if (playing && playing !== next) next.crossFadeFrom(playing, 0.22, false);
    playing = next;
  };
  const unstow = () => {
    hidden.forEach((m) => (m.visible = true));
    hidden.length = 0;
    if (stowed) {
      stowed.traverse((o) => {
        if (o instanceof T.Mesh) o.geometry.dispose();
      });
      scene.remove(stowed);
      stowed = null;
    }
  };
  const stow = (where: "chair" | "bed") => {
    if (stowed) return;
    avatar.updateMatrixWorld(true);
    stowed = new T.Group();
    avatar.traverse((o) => {
      if (
        !(o instanceof T.SkinnedMesh) ||
        !["back", "crossbody", "handheld"].includes(
          String(o.userData.wearableSlot),
        ) ||
        !o.visible
      )
        return;
      const geometry = o.geometry.clone(),
        positions = geometry.getAttribute("position"),
        v = new T.Vector3();
      for (let i = 0; i < positions.count; i++) {
        v.fromBufferAttribute(positions, i);
        o.applyBoneTransform(i, v);
        v.applyMatrix4(o.matrixWorld);
        positions.setXYZ(i, v.x, v.y, v.z);
      }
      geometry.deleteAttribute("skinIndex");
      geometry.deleteAttribute("skinWeight");
      geometry.computeVertexNormals();
      const prop = new T.Mesh(geometry, o.material);
      prop.castShadow = true;
      stowed!.add(prop);
      hidden.push(o);
      o.visible = false;
    });
    if (stowed.children.length) {
      const box = new T.Box3().setFromObject(stowed),
        center = box.getCenter(new T.Vector3()),
        position = vector(map.stow[where]);
      stowed.position.set(
        position.x - center.x,
        position.y - box.min.y,
        position.z - center.z,
      );
      scene.add(stowed);
    }
  };
  const transition = (
    target: T.Vector3,
    q: T.Quaternion,
    duration: number,
    clip: string,
    mode: "pose" | "exit",
    posture: "stand" | "sit" | "rest",
  ) => {
    begin = avatar.position.clone();
    end = target;
    startQ = avatar.quaternion.clone();
    endQ = q;
    elapsed = 0;
    remaining = duration;
    phase = mode;
    finalPose = posture;
    play(clip, false);
  };
  const yaw = (angle: number) =>
    new T.Quaternion().setFromEuler(new T.Euler(0, angle, 0));
  const enter = () => {
    if (active === "sit" || active === "study" || active === "pouf") {
      stow("chair");
      seatedAt = seat();
      const p = vector(seatedAt.position);
      p.y = seatedAt.height + 0.1 - 0.78 * rigScale;
      transition(p, yaw(seatedAt.yaw), 1.5, "sit_down", "pose", "sit");
    } else if (active === "inspect") {
      phase = "gesture"; elapsed = 0; remaining = 4; play("idle");
    } else if (active === "rest") {
      stow("bed");
      const p = vector(map.bed.position);
      p.y = map.bed.height + 0.2 * rigScale;
      const q = new T.Quaternion().setFromEuler(
        new T.Euler(-Math.PI / 2, 0, 0),
      );
      transition(p, q, 3.2, "lie_down", "pose", "rest");
    } else {
      phase = "idle";
      play("idle");
      idleFor = 0;
    }
  };
  const beginRoute = () => {
    const destination =
      active === "sit" || active === "study" || active === "pouf"
        ? seat().approach
        : active === "rest"
          ? map.bed.approach
          : active === "inspect" && objectTarget ? objectTarget.approach
          : walkTarget ?? map.waypoints[Math.floor(Math.random() * map.waypoints.length)];
    const found = findRoomRoute(avatar.position.toArray(), destination, map);
    blocked = !found;
    if (!found) {
      active = "stand";
      phase = "idle";
      play("idle");
      return;
    }
    route = found;
    routeIndex = 0;
    step();
  };
  const step = () => {
    if (routeIndex >= route.length) {
      if (active === "walk") {
        phase = "idle";
        play("stop", false);
        idleFor = 0;
        return;
      }
      begin = avatar.position.clone();
      end = begin.clone();
      startQ = avatar.quaternion.clone();
      endQ = yaw(active === "rest" ? map.bed.yaw : active === "inspect" && objectTarget ? objectTarget.yaw : seat().yaw);
      elapsed = 0;
      remaining = 0.6;
      phase = "turn";
      return;
    }
    begin = avatar.position.clone();
    end = vector(route[routeIndex]);
    startQ = avatar.quaternion.clone();
    endQ = yaw(Math.atan2(end.x - begin.x, end.z - begin.z));
    elapsed = 0;
    remaining = 0.45;
    phase = "turn";
    play("turn", false);
  };
  const startRequest = (action: CompanionAction) => {
    active = action;
    idleFor = 0;
    if (pose !== "stand") {
      if (
        (pose === "sit" && (action === "sit" || action === "study" || action === "pouf") && seatedAt === seat()) ||
        (pose === "rest" && action === "rest")
      ) {
        phase = "idle";
        play(action === "study" ? "study" : pose === "sit" ? "seated" : "rest");
        return;
      }
      transition(
        vector(pose === "sit" ? seatedAt.approach : map.bed.approach),
        yaw(pose === "sit" ? seatedAt.yaw : map.bed.yaw),
        pose === "sit" ? 1.6 : 3.1,
        pose === "sit" ? "stand_up" : "get_up",
        "exit",
        "stand",
      );
      return;
    }
    if (action === "greet" || action === "celebrate") {
      phase = "gesture";
      elapsed = 0;
      remaining = action === "greet" ? 2.2 : 1.9;
      play(action, false);
      return;
    }
    if (action === "stand") {
      phase = "idle";
      play("idle");
      return;
    }
    beginRoute();
  };
  play("idle");
  return {
    get state() {
      return {
        phase,
        pose,
        action: active,
        position: avatar.position.toArray(),
        stowed: !!hidden.length,
        blocked,
      };
    },
    walkTo(point: Point) {
      const target = [point[0], map.floor, point[2]];
      if (disposed || !clearSegment(target, target, map)) return false;
      pendingTarget = target; pendingObject = undefined; requested = "walk"; nextIdle = 45; idleFor = 0;
      return true;
    },
    inspect(id: string) {
      const object = map.objects?.find(o => o.id === id);
      if (!object || disposed) return false;
      pendingObject = object; requested = "inspect"; nextIdle = 45; idleFor = 0;
      return true;
    },
    request(action: CompanionAction) {
      if (!disposed) {
        if (action === "pouf" && !map.pouf) return;
        pendingTarget = null;
        requested = action;
        nextIdle = 45;
        idleFor = 0;
      }
    },
    context(next: MotionContext) {
      if (requested === "greet" && (next.enabled === false || next.reduced))
        requested = null;
      if (
        next.celebration !== undefined &&
        lastCelebration !== undefined &&
        next.celebration > lastCelebration
      )
        requested = "celebrate";
      if (next.celebration !== undefined) lastCelebration = next.celebration;
      if (next.studying && !context.studying) requested = "study";
      context = { ...context, ...next };
    },
    pause(value: boolean) {
      paused = value;
    },
    update(delta: number) {
      if (disposed || paused) return false;
      const dt = Math.min(Math.max(delta, 0), 0.067);
      // Latest command only, consumed at a stable posture. Never interrupt contact transitions.
      if (requested && phase === "idle") {
        const request = requested;
        requested = null;
        if (pendingTarget) { walkTarget = pendingTarget; pendingTarget = null; }
        else if (request !== active) walkTarget = null;
        if (pendingObject) { objectTarget = pendingObject; pendingObject = undefined; }
        startRequest(request);
      }
      if (context.talking && phase === "idle") return false;
      if (phase === "idle") {
        idleFor += dt;
        if (context.enabled && !context.reduced && idleFor >= nextIdle) {
          nextIdle = 20 + Math.random() * 40;
          requested = context.resting
            ? "rest"
            : context.studying
              ? "study"
              : pose === "stand"
                ? Math.random() < 0.5
                  ? "walk"
                  : "sit"
                : "walk";
        }
        if (!context.enabled || context.reduced) return false;
      }
      mixer.update(dt);
      elapsed += dt;
      if (phase === "turn") {
        avatar.quaternion.slerpQuaternions(
          startQ,
          endQ,
          smooth(Math.min(1, elapsed / remaining)),
        );
        if (elapsed >= remaining) {
          if (routeIndex >= route.length) enter();
          else {
            phase = "walk";
            elapsed = 0;
            remaining = begin.distanceTo(end) / 0.48;
            play("walk");
          }
        }
      } else if (phase === "walk") {
        avatar.position.lerpVectors(
          begin,
          end,
          Math.min(1, elapsed / remaining),
        );
        if (elapsed >= remaining) {
          routeIndex++;
          step();
        }
      } else if (phase === "pose" || phase === "exit") {
        const t = smooth(Math.min(1, elapsed / remaining));
        avatar.position.lerpVectors(begin, end, t);
        avatar.quaternion.slerpQuaternions(startQ, endQ, t);
        if (elapsed >= remaining) {
          const exited = phase === "exit";
          pose = finalPose;
          phase = "idle";
          play(
            pose === "rest"
              ? "rest"
              : pose === "sit"
                ? active === "study"
                  ? "study"
                  : "seated"
                : "idle",
          );
          if (exited) {
            unstow();
            if (!requested) requested = active;
          }
        }
      } else if (phase === "gesture" && elapsed >= remaining) {
        phase = "idle";
        play("idle");
      }
      return true;
    },
    dispose() {
      disposed = true;
      unstow();
      mixer.stopAllAction();
      mixer.uncacheRoot(avatar);
    },
  };
}
export type CompanionController = ReturnType<typeof createCompanionController>;
