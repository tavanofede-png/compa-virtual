import * as T from "three";
import type { PetPreferences } from "@compa/domain";
import { findRoomRoute, type RoomMap } from "./motion";

export type PetAction =
  | "come"
  | "roam"
  | "play"
  | "rest"
  | "sleep"
  | "react"
  | "celebrate"
  | "returnHome"
  | "sniff";

export type PetContext = {
  visible?: boolean;
  studying?: boolean;
  talking?: boolean;
  celebration?: number;
  companionPosition?: [number, number, number];
};

export type PetSceneSetup = {
  definitionId: string;
  instanceId: string;
  name: string;
  preferences: PetPreferences;
  habitatId?: string;
  toyIds?: string[];
  accessoryId?: string;
};

export type RoomPetAnchor = {
  position: [number, number, number];
  approach: [number, number, number];
  yaw: number;
};

export type RoomPetMap = {
  roomId: string;
  version: number;
  spawn: [number, number, number];
  home: RoomPetAnchor;
  play: RoomPetAnchor;
  companionNear: RoomPetAnchor;
  roam: [number, number, number][];
  props: {
    bed: [number, number, number];
    bowl: [number, number, number];
    basket: [number, number, number];
    ball: [number, number, number];
    rope: [number, number, number];
  };
};

const cozy: RoomPetMap = {
  roomId: "cozy",
  version: 1,
  spawn: [2.12, 0.18, 0.78],
  home: { position: [2.42, 0.18, 1.35], approach: [1.78, 0.18, 1.1], yaw: 0.35 },
  play: { position: [0.78, 0.18, 0.72], approach: [0.95, 0.18, 0.45], yaw: -0.5 },
  companionNear: { position: [0.8, 0.18, -0.42], approach: [0.95, 0.18, -0.28], yaw: -0.25 },
  roam: [[2.1, 0.18, .58], [1.5, 0.18, .42], [.82, 0.18, .3], [.35, 0.18, -.15]],
  props: {
    bed: [2.48, .18, 1.47], bowl: [2.92, .18, .72], basket: [2.72, .18, 1.85],
    ball: [.66, .18, .78], rope: [1.02, .18, .91],
  },
};

const variant = (roomId: string, dx: number, dz: number): RoomPetMap => ({
  ...cozy,
  roomId,
  spawn: [cozy.spawn[0] + dx, cozy.spawn[1], cozy.spawn[2] + dz],
  home: { ...cozy.home, position: [cozy.home.position[0] + dx, cozy.home.position[1], cozy.home.position[2] + dz], approach: [cozy.home.approach[0] + dx, cozy.home.approach[1], cozy.home.approach[2] + dz] },
  play: { ...cozy.play, position: [cozy.play.position[0] + dx, cozy.play.position[1], cozy.play.position[2] + dz], approach: [cozy.play.approach[0] + dx, cozy.play.approach[1], cozy.play.approach[2] + dz] },
  companionNear: { ...cozy.companionNear, position: [cozy.companionNear.position[0] + dx, cozy.companionNear.position[1], cozy.companionNear.position[2] + dz], approach: [cozy.companionNear.approach[0] + dx, cozy.companionNear.approach[1], cozy.companionNear.approach[2] + dz] },
  roam: cozy.roam.map(([x, y, z]) => [x + dx, y, z + dz]),
  props: Object.fromEntries(Object.entries(cozy.props).map(([key, [x, y, z]]) => [key, [x + dx, y, z + dz]])) as RoomPetMap["props"],
});

export const roomPetMaps: Record<string, RoomPetMap> = {
  cozy,
  minimalista: variant("minimalista", 0, 0),
  tecnologia: variant("tecnologia", 0, 0),
  naturaleza: variant("naturaleza", 0, 0),
  urbano: variant("urbano", 0, 0),
  "biblioteca-moderna": variant("biblioteca-moderna", 0, 0),
};

export function createPetController(
  pet: T.Group,
  clips: T.AnimationClip[],
  roomMap: RoomMap,
  petMap: RoomPetMap,
  preferences: PetPreferences,
) {
  const mixer = new T.AnimationMixer(pet);
  const actions = new Map(clips.map((clip) => [clip.name, mixer.clipAction(clip)]));
  let playing: T.AnimationAction | undefined;
  let phase: "idle" | "turn" | "walk" | "action" = "idle";
  let pose: "stand" | "rest" = "stand";
  let active: PetAction = "react";
  let requested: PetAction | null = preferences.reducedMotion ? null : "react";
  let context: PetContext = { visible: true };
  let paused = false, disposed = false, elapsed = 0, duration = 0, idleFor = 0;
  let nextDecision = preferences.activityLevel === "active" ? 18 : preferences.activityLevel === "calm" ? 42 : 28;
  let route: number[][] = [], routeIndex = 0;
  let from = pet.position.clone(), to = pet.position.clone();
  let fromQ = pet.quaternion.clone(), toQ = pet.quaternion.clone();
  let lastCelebration: number | undefined;

  const play = (clip: string, loop = true, speed = 1) => {
    const next = actions.get(clip) ?? actions.get("pet_idle");
    if (!next || (next === playing && loop)) return;
    next.reset().setEffectiveWeight(1).setEffectiveTimeScale(speed).setLoop(loop ? T.LoopRepeat : T.LoopOnce, loop ? Infinity : 1);
    next.clampWhenFinished = true;
    next.play();
    if (playing && playing !== next) next.crossFadeFrom(playing, .2, false);
    playing = next;
  };
  const yaw = (value: number) => new T.Quaternion().setFromEuler(new T.Euler(0, value, 0));
  const actionClip = (action: PetAction) => ({
    play: "pet_play", rest: "pet_lie_down", sleep: "pet_rest", react: "pet_react",
    celebrate: "pet_celebrate", sniff: "pet_sniff", returnHome: "pet_lie_down",
  } as Partial<Record<PetAction, string>>)[action] ?? "pet_idle";
  const destination = (action: PetAction): number[] => {
    if (action === "rest" || action === "sleep" || action === "returnHome") return petMap.home.approach;
    if (action === "play") return petMap.play.approach;
    if (action === "come") return petMap.companionNear.approach;
    return petMap.roam[Math.floor(Math.random() * petMap.roam.length)];
  };
  const finishAction = () => {
    pose = active === "rest" || active === "sleep" || active === "returnHome" ? "rest" : "stand";
    phase = "idle";
    play(pose === "rest" ? "pet_rest" : "pet_idle");
    idleFor = 0;
  };
  const beginAction = () => {
    if (["react", "celebrate", "sniff"].includes(active)) {
      phase = "action"; elapsed = 0; duration = active === "celebrate" ? 1.8 : 1.2;
      play(actionClip(active), false);
      return;
    }
    const final = active === "rest" || active === "sleep" || active === "returnHome" ? petMap.home : active === "play" ? petMap.play : active === "come" ? petMap.companionNear : null;
    if (final) {
      fromQ = pet.quaternion.clone(); toQ = yaw(final.yaw); elapsed = 0; duration = .45; phase = "turn";
      route = [];
      return;
    }
    finishAction();
  };
  const step = () => {
    if (routeIndex >= route.length) { beginAction(); return; }
    from = pet.position.clone(); to = new T.Vector3(route[routeIndex][0], roomMap.floor, route[routeIndex][2]);
    fromQ = pet.quaternion.clone(); toQ = yaw(Math.atan2(to.x - from.x, to.z - from.z));
    elapsed = 0; duration = .32; phase = "turn"; play("pet_walk");
  };
  const begin = (request: PetAction) => {
    active = request; pose = "stand";
    if (["react", "celebrate", "sniff"].includes(request)) { beginAction(); return; }
    const found = findRoomRoute(pet.position.toArray(), destination(request), roomMap);
    if (!found) { active = "sniff"; beginAction(); return; }
    route = found; routeIndex = 0; step();
  };
  play("pet_idle");
  return {
    get state() { return { phase, pose, action: active, position: pet.position.toArray() }; },
    request(action: PetAction) { if (!disposed) { requested = action; idleFor = 0; } },
    context(next: PetContext) {
      if (next.celebration !== undefined && lastCelebration !== undefined && next.celebration > lastCelebration) requested = "celebrate";
      if (next.celebration !== undefined) lastCelebration = next.celebration;
      if (next.studying && !context.studying) requested = "rest";
      context = { ...context, ...next };
    },
    pause(value: boolean) { paused = value; },
    update(delta: number) {
      if (disposed || paused || context.visible === false) return false;
      const dt = Math.min(Math.max(delta, 0), .067);
      if (requested && phase === "idle") { const next = requested; requested = null; begin(next); }
      if (phase === "idle") {
        idleFor += dt;
        if (preferences.automaticMovement && !preferences.reducedMotion && !context.talking && idleFor >= nextDecision) {
          nextDecision = (preferences.activityLevel === "active" ? 18 : preferences.activityLevel === "calm" ? 38 : 24) + Math.random() * 18;
          requested = context.studying ? "rest" : Math.random() < .28 ? "sniff" : "roam";
        }
      }
      mixer.update(dt); elapsed += dt;
      if (phase === "turn") {
        pet.quaternion.slerpQuaternions(fromQ, toQ, Math.min(1, elapsed / duration));
        if (elapsed >= duration) {
          if (routeIndex < route.length) { phase = "walk"; from = pet.position.clone(); to = new T.Vector3(route[routeIndex][0], roomMap.floor, route[routeIndex][2]); elapsed = 0; duration = Math.max(.25, from.distanceTo(to) / .72); play("pet_walk", true, 1.05); }
          else { phase = "action"; elapsed = 0; duration = active === "play" ? 1.8 : active === "come" ? .8 : 1.6; play(actionClip(active), active === "sleep"); }
        }
      } else if (phase === "walk") {
        pet.position.lerpVectors(from, to, Math.min(1, elapsed / duration));
        if (elapsed >= duration) { routeIndex++; step(); }
      } else if (phase === "action" && elapsed >= duration) finishAction();
      return phase !== "idle" || !!playing;
    },
    dispose() { disposed = true; mixer.stopAllAction(); mixer.uncacheRoot(pet); },
  };
}

export type PetController = ReturnType<typeof createPetController>;
