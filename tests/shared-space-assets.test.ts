import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { sharedSeats, sharedSpaces } from "../packages/domain/src/index";

describe("authored common-room seats", () => {
  for (const room of sharedSpaces) {
    it(`${room.id}: application seats match the exported Blender furniture`, async () => {
      const meta = JSON.parse(
        await readFile(
          new URL(
            `../apps/web/public/selection/shared-spaces/${room.id}.json`,
            import.meta.url,
          ),
          "utf8",
        ),
      );
      expect(meta.version).toBe(2);
      expect(sharedSeats(room.id)).toEqual(
        meta.anchors.map(
          ({
            id,
            position,
            yaw,
            height,
          }: {
            id: string;
            position: number[];
            yaw: number;
            height: number;
          }) => ({ id, position, yaw, height }),
        ),
      );
    });
  }
  it("does not allow a scene to mutate the shared anchor catalog", () => {
    const before = sharedSeats("living");
    const scene = sharedSeats("living");
    scene[0].position[0] += 100;
    expect(sharedSeats("living")).toEqual(before);
  });
});
