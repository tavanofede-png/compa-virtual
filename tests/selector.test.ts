import { expect, it } from "vitest";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import * as T from "../packages/world3d/node_modules/three";
import {
  characters,
  rooms,
  selectCharacter,
  emptySnapshot,
  demoSnapshot,
  transition,
  wardrobeItems,
  equipWardrobe,
  companionSchema,
} from "../packages/domain/src/index";
import {
  createPremiumWorld,
  disposeModel,
} from "../packages/world3d/src/index";
import { createDemo, type AsyncStorage } from "../packages/client/src/index";
const now = "2026-09-09T15:00:00Z";
const profile = {
  nickname: "Prueba",
  birth_date: "2000-01-15",
  school_year: 4,
  country: "AR",
  timezone: "America/Argentina/Buenos_Aires",
  sleep_start: 1320,
  sleep_end: 420,
  autonomy_level: 2,
  onboarding_complete: false,
  school_day_limit: 60,
  free_day_limit: 90,
};
it("resumes a partially saved welcome and completes it atomically without replacing academic progress", () => {
  const before = demoSnapshot(),
    companion = selectCharacter("harper");
  const draft = transition(
    before,
    { type: "onboarding.save", payload: { companion, step: 1 } },
    now,
  );
  expect(draft.profile?.onboarding_complete).toBe(false);
  expect(draft.onboarding?.step).toBe(1);
  const completed = transition(
    draft,
    { type: "onboarding.complete", payload: { companion, profile, step: 5 } },
    now,
  );
  expect(completed.profile?.onboarding_complete).toBe(true);
  expect(completed.profile?.id).toBe(before.profile?.id);
  expect(completed.items).toEqual(before.items);
  expect(completed.coins).toBe(before.coins);
  expect(completed.preferences.quiet_start).toBe(1320);
  expect(before.profile?.onboarding_complete).toBe(true);
  expect(() =>
    transition(
      draft,
      { type: "onboarding.complete", payload: { companion, step: 5 } },
      now,
    ),
  ).toThrow("datos");
  expect(draft.profile?.onboarding_complete).toBe(false);
});
it("validates wardrobe slots and changes outfits without invalid layering or losing unrelated accessories", () => {
  for (const character of characters)
    expect(
      companionSchema.safeParse(selectCharacter(character.id)).success,
    ).toBe(true);
  const outfit = equipWardrobe(
    selectCharacter("milo").wardrobe!,
    "tee-white-planet",
  );
  expect(outfit).toContain("cap-yellow-smile");
  expect(outfit).not.toContain("hoodie-ivory-better-days");
  expect(outfit).toContain("tee-white-planet");
  const companion = selectCharacter("milo");
  for (const wardrobe of [
    [],
    [...outfit, "unknown"],
    [...outfit, "tee-black-cat"],
    [...outfit, outfit[0]],
  ]) {
    expect(companionSchema.safeParse({ ...companion, wardrobe }).success).toBe(
      false,
    );
  }
});
it("persists a clean welcome demo across launches, separately from populated demo data", async () => {
  const entries = new Map<string, string>();
  const storage: AsyncStorage = {
    getItem: async (k) => entries.get(k) ?? null,
    setItem: async (k, v) => {
      entries.set(k, v);
    },
    removeItem: async (k) => {
      entries.delete(k);
    },
  };
  const repo = createDemo(storage, { onboarding: true });
  const initial = await repo.load();
  expect(initial.state.items).toHaveLength(0);
  const saved = await repo.command(
    {
      type: "onboarding.save",
      payload: { step: 2, companion: selectCharacter("aria") },
    },
    initial.version,
  );
  const resumed = await createDemo(storage, { onboarding: true }).load();
  expect(resumed).toEqual(saved);
  expect((await createDemo(storage).load()).state.items.length).toBeGreaterThan(
    0,
  );
  expect(emptySnapshot().companion.character_id).toBeUndefined();
});
const assetRoot = resolve("apps/web/public/selection");
it("ships a model and a real preview for every selectable item, character and room", async () => {
  for (const item of wardrobeItems) {
    expect(
      (await stat(resolve(assetRoot, "models", item.id + ".glb"))).size,
    ).toBeGreaterThan(100);
    expect(
      (await stat(resolve(assetRoot, "wardrobe", item.id + ".webp"))).size,
    ).toBeGreaterThan(100);
  }
  for (const name of [
    ...characters.map((c) => c.id + "-body"),
    ...rooms.map((r) => r.id + "-room"),
  ]) {
    expect(
      (await stat(resolve(assetRoot, "models", name + ".glb"))).size,
    ).toBeLessThan(25 * 1024 * 1024);
  }
});
const read = async (url: string) => {
  const bytes = await readFile(url);
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
};
function bounds(object: T.Object3D) {
  object.updateMatrixWorld(true);
  object.traverse((o) => {
    if ((o as T.SkinnedMesh).isSkinnedMesh)
      (o as T.SkinnedMesh).skeleton.update();
  });
  const box = new T.Box3(),
    point = new T.Vector3();
  object.traverseVisible((o) => {
    if (!(o as T.Mesh).isMesh) return;
    const p = (o as T.Mesh).geometry.getAttribute("position");
    for (let n = 0; n < p.count; n++) {
      (o as T.Mesh).getVertexPosition(n, point);
      point.applyMatrix4(o.matrixWorld);
      box.expandByPoint(point);
    }
  });
  return box;
}
it("binds real Blender clothes to all eight scaled skeletons, keeping rest dimensions finite and proportionate", async () => {
  for (const c of characters) {
    const world = await createPremiumWorld(
      selectCharacter(c.id),
      "avatar",
      resolve(assetRoot, "models"),
      read,
    );
    try {
      const box = bounds(world.avatar),
        size = box.getSize(new T.Vector3());
      expect(Number.isFinite(size.length()), c.id).toBe(true);
      expect(size.y, c.id).toBeGreaterThan(1.45);
      expect(size.y, c.id).toBeLessThan(2.2);
      expect(size.x, c.id).toBeLessThan(1.5);
      expect(Math.abs(box.min.y), c.id).toBeLessThan(0.12);
      let meshes = 0;
      world.avatar.traverse((o) => {
        if ((o as T.SkinnedMesh).isSkinnedMesh) {
          meshes++;
          expect(
            (o as T.SkinnedMesh).skeleton.bones.every((b) => b.parent !== null),
          ).toBe(true);
        }
      });
      expect(meshes, c.id).toBeGreaterThan(10);
    } finally {
      disposeModel(world.scene);
    }
  }
}, 120000);
it("loads a furnished room with an avatar at the shared floor anchor", async () => {
  const world = await createPremiumWorld(
    selectCharacter("harper"),
    "room",
    resolve(assetRoot, "models"),
    read,
  );
  try {
    const box = bounds(world.avatar);
    expect(box.min.y).toBeCloseTo(0.18, 1);
    expect(world.avatar.position.x).toBe(1.94);
    let meshes = 0;
    world.scene.traverse((o) => {
      if ((o as T.Mesh).isMesh) meshes++;
    });
    expect(meshes).toBeGreaterThan(65);
    expect(meshes).toBeLessThan(250);
  } finally {
    disposeModel(world.scene);
  }
}, 60000);
