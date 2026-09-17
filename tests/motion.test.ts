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
} from "../packages/world3d/src/index";
const root = resolve("apps/web/public/selection/models");
const read = async (url: string) => {
  const bytes = await readFile(url);
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
};
it("routes all six rooms around authored furniture with shoulder clearance", () => {
  for (const { id } of rooms) {
    const map = roomInteractions[id];
    for (const to of [map.chair.approach, map.bed.approach, ...map.waypoints]) {
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
