from pathlib import Path
p=Path('packages/world3d/src/motion.ts');s=p.read_text()
s=s.replace('"walk" | "sit" | "study"','"walk" | "pouf" | "inspect" | "sit" | "study"')
s=s.replace('export type RoomMap = (typeof maps)["cozy"];','export type RoomMap = (typeof maps)["cozy"] & { pouf?: { position: number[]; approach: number[]; yaw: number; height: number }; objects?: { id: string; label: string; position: number[]; approach: number[]; yaw: number }[] };')
s=s.replace('export const roomInteractions = maps;','export const roomInteractions: Record<string, RoomMap> = maps;')
s=s.replace('  for (const ob of map.obstacles) {','  if (![...a, ...b].every(Number.isFinite)) return false;\n  for (const p of [a, b]) if (p[0] < map.bounds[0] + radius || p[0] > map.bounds[2] - radius || p[2] < map.bounds[1] + radius || p[2] > map.bounds[3] - radius) return false;\n  for (const ob of map.obstacles) {',1)
s=s.replace('if (u < 0 || !Number.isFinite(cost[u])) return null;', 'if (u < 0 || !Number.isFinite(cost[u])) return gridRoute(from, to, map);')
pos=s.index('\nexport function createCompanionController')
s=s[:pos]+'''
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
''' +s[pos:]
s=s.replace('  let stowed: T.Group | null = null;', '''  let walkTarget: Point | null = null, pendingTarget: Point | null = null;
  let objectTarget: NonNullable<RoomMap["objects"]>[number] | undefined;
  let pendingObject: typeof objectTarget;
  let seatedAt = map.chair;
  let blocked = false;
  const seat = () => active === "pouf" && map.pouf ? map.pouf : map.chair;
  let stowed: T.Group | null = null;''')
s=s.replace('if (active === "sit" || active === "study") {','if (active === "sit" || active === "study" || active === "pouf") {',1)
s=s.replace('const p = vector(map.chair.position);\n      p.y = map.chair.height + 0.1 - 0.78 * rigScale;\n      transition(p, yaw(map.chair.yaw)', 'seatedAt = seat();\n      const p = vector(seatedAt.position);\n      p.y = seatedAt.height + 0.1 - 0.78 * rigScale;\n      transition(p, yaw(seatedAt.yaw)')
s=s.replace('    } else if (active === "rest") {','    } else if (active === "inspect") {\n      phase = "gesture"; elapsed = 0; remaining = 4; play("idle");\n    } else if (active === "rest") {',1)
s=s.replace('active === "sit" || active === "study"\n        ? map.chair.approach','active === "sit" || active === "study" || active === "pouf"\n        ? seat().approach')
s=s.replace(': map.waypoints[Math.floor(nextIdle) % 2 === 0 ? 2 : 4];', ': active === "inspect" && objectTarget ? objectTarget.approach\n          : walkTarget ?? map.waypoints[Math.floor(Math.random() * map.waypoints.length)];')
s=s.replace('    if (!found) {\n      active', '    blocked = !found;\n    if (!found) {\n      active')
s=s.replace('yaw(active === "rest" ? map.bed.yaw : map.chair.yaw)', 'yaw(active === "rest" ? map.bed.yaw : active === "inspect" && objectTarget ? objectTarget.yaw : seat().yaw)')
s=s.replace('(pose === "sit" && (action === "sit" || action === "study"))', '(pose === "sit" && (action === "sit" || action === "study" || action === "pouf") && seatedAt === seat())')
s=s.replace('pose === "sit" ? map.chair.approach', 'pose === "sit" ? seatedAt.approach').replace('pose === "sit" ? map.chair.yaw','pose === "sit" ? seatedAt.yaw')
s=s.replace('        stowed: !!hidden.length,','        stowed: !!hidden.length,\n        blocked,')
s=s.replace('    request(action: CompanionAction) {','''    walkTo(point: Point) {
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
    request(action: CompanionAction) {''')
s=s.replace('        requested = action;','        if (action === "pouf" && !map.pouf) return;\n        pendingTarget = null;\n        requested = action;',1)
s=s.replace('        startRequest(request);','        if (pendingTarget) { walkTarget = pendingTarget; pendingTarget = null; }\n        else if (request !== active) walkTarget = null;\n        if (pendingObject) { objectTarget = pendingObject; pendingObject = undefined; }\n        startRequest(request);')
p.write_text(s)
