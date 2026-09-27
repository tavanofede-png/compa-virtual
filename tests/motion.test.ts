import { it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  characters,
  rooms,
  selectCharacter,
} from "../packages/domain/src/index";
import {
  createPremiumWorld,
  disposeModel,
  findRoomRoute,
  clearSegment,
  roomInteractions,
  roomPetMaps,
} from "../packages/world3d/src/index";
const root = resolve("apps/web/public/selection/models");
const read = async (url: string) => {
  const bytes = await readFile(url);
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
};
it("routes all twelve bedrooms around authored furniture with shoulder clearance", () => {
  for (const { id } of rooms) {
    const map = roomInteractions[id];
    const destinations = [map.chair.approach, map.bed.approach, ...map.waypoints];
    if (map.pouf) destinations.push(map.pouf.approach);
    for (const object of map.objects ?? []) destinations.push(object.approach);
    for (const to of destinations) {
      const route = findRoomRoute(map.spawn, to, map);
      expect(route, id + ": " + to).not.toBeNull();
      let from = map.spawn;
      for (const step of route!) {
        expect(clearSegment(from, step, map)).toBe(true);
        from = step;
      }
    }
    expect(clearSegment([-2, 0.18, -2], [-2, 0.18, 2], map)).toBe(false);
  }
});
it("keeps pet actions reachable in the six additional bedrooms", () => {
  for (const id of ["atico-creativo", "rincon-urbano", "sala-control-gamer", "habitacion-invernadero", "estudio-musical", "rincon-explorador"]) {
    const room = roomInteractions[id], pet = roomPetMaps[id];
    expect(pet, id).toBeDefined();
    for (const to of [pet.home.approach, pet.play.approach, pet.companionNear.approach, ...pet.roam]) {
      const route = findRoomRoute(pet.spawn, to, room);
      expect(route, `${id}: mascota hacia ${to}`).not.toBeNull();
      let from = pet.spawn;
      for (const point of route!) {
        expect(clearSegment(from, point, room), id).toBe(true);
        from = point;
      }
    }
  }
});
it("places pet habitat props clear of the actual furniture in additional bedrooms", async () => {
  const collisions: string[] = [];
  for (const id of ["atico-creativo", "rincon-urbano", "sala-control-gamer", "habitacion-invernadero", "estudio-musical", "rincon-explorador"]) {
    const geometry = JSON.parse(await readFile(resolve(root, `${id}-geometry.json`), "utf8")) as {
      obstacles: { id: string; min: number[]; max: number[] }[];
    };
    for (const [prop, halfX, halfZ] of [["bed", .48, .38], ["bowl", .2, .2], ["basket", .25, .25]] as const) {
      const [x, , z] = roomPetMaps[id].props[prop];
      const overlaps = geometry.obstacles.filter((item) =>
        item.min[0] < x + halfX && item.max[0] > x - halfX &&
        item.min[1] < z + halfZ && item.max[1] > z - halfZ);
      if (overlaps.length) collisions.push(`${id}: ${prop}: ${overlaps.map((item) => item.id).join(", ")}`);
    }
  }
  expect(collisions).toEqual([]);
});
it("loads real clips, honors pause, completes contacts, queues commands, and restores outfits for all eight rigs", async () => {
  for (const { id } of characters) {
    const companion = selectCharacter(id),
      before = JSON.stringify(companion);
    const world = await createPremiumWorld(companion, "room", root, read),
      c = world.controller!;
    const advance = (seconds: number) => {
      for (let i = 0; i < seconds * 30; i++) c.update(1 / 30);
    };
    try {
      c.context({ enabled: false });
      c.request("sit");
      advance(16);
      expect(c.state.pose, id).toBe("sit");
      expect(c.state.position.every(Number.isFinite)).toBe(true);
      const seated =
        world.avatar.getObjectByName("thighL") ??
        world.avatar.getObjectByName("thigh.L");
      expect(seated, id + " rig").toBeDefined();
      const q = seated!.quaternion.clone();
      c.request("rest");
      advance(1);
      const paused = c.state;
      c.pause(true);
      advance(10);
      expect(c.state).toEqual(paused);
      c.pause(false);
      advance(22);
      expect(c.state.pose, id).toBe("rest");
      c.request("stand");
      advance(12);
      expect(c.state.pose, id).toBe("stand");
      expect(c.state.stowed).toBe(false);
      expect(
        seated!.quaternion.angleTo(q),
        id + " seated bend",
      ).toBeGreaterThan(0.5);
      expect(JSON.stringify(companion)).toBe(before);
    } finally {
      c.dispose();
      disposeModel(world.scene);
    }
  }
}, 120000);
