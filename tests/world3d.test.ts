import { it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import {
  avatarPresets,
  avatarAppearance,
  hairStyles,
  defaultCompanion,
  demoSnapshot,
  transition,
  companionSchema,
  catalog,
} from "../packages/domain/src/index";
import {
  avatarModel,
  createWorld,
  equipmentModel,
  disposeModel,
  modelMetrics,
} from "../packages/world3d/src/index";
it("migrates previous creatures to human appearances without altering study data", () => {
  const s = demoSnapshot(),
    old = structuredClone(s),
    appearance = avatarAppearance(s.companion);
  expect(appearance.skin_tone).toBeGreaterThanOrEqual(0);
  expect(appearance.skin_tone).toBeLessThan(8);
  const next = transition(
    s,
    {
      type: "companion.save",
      payload: { ...s.companion, ...avatarPresets[5] },
    },
    new Date().toISOString(),
  );
  expect(s).toEqual(old);
  expect(next.items).toEqual(s.items);
  expect(next.coins).toBe(s.coins);
  expect(next.companion.hair_style).toBe("braids");
  expect(() =>
    companionSchema.parse({ ...next.companion, skin_tone: 8 }),
  ).toThrow();
  expect(() =>
    transition(
      { ...s, inventory: ["plant"] },
      {
        type: "companion.save",
        payload: { ...s.companion, accessory: "plant" },
      },
      new Date().toISOString(),
    ),
  ).toThrow("corresponde");
});
it("builds six distinct hairstyles and fully covered finite 3D models", () => {
  const shapes = new Set<string>();
  for (const style of hairStyles) {
    const model = avatarModel({
        ...defaultCompanion,
        ...avatarPresets[0],
        hair_style: style.id,
      }),
      metrics = modelMetrics(model);
    expect(metrics.finite).toBe(true);
    expect(metrics.size[1]).toBeGreaterThan(1.9);
    expect(metrics.size[1]).toBeLessThan(2.5);
    expect(metrics.meshes).toBeLessThan(40);
    expect(metrics.triangles).toBeLessThan(80000);
    shapes.add(JSON.stringify([metrics.vertices, metrics.size]));
    disposeModel(model);
  }
  expect(shapes.size).toBe(6);
});
it("uses a cutaway room with real depth and an elevated diagonal camera", () => {
  const world = createWorld(defaultCompanion),
    metrics = modelMetrics(world.scene);
  expect(metrics.finite).toBe(true);
  expect(metrics.size[0]).toBeGreaterThan(6);
  expect(metrics.size[2]).toBeGreaterThan(5);
  expect(metrics.meshes).toBeLessThan(150);
  expect(metrics.triangles).toBeLessThan(300000);
  expect(world.camera.position.x).toBeGreaterThan(5);
  expect(world.camera.position.y).toBeGreaterThan(5);
  expect(world.camera.position.z).toBeGreaterThan(5);
  disposeModel(world.scene);
});
it("provides geometry for every wearable and decoration in the catalogue", () => {
  for (const item of catalog) {
    const model = equipmentModel(item.id),
      metrics = modelMetrics(model);
    expect(metrics.finite).toBe(true);
    expect(metrics.vertices).toBeGreaterThan(100);
    disposeModel(model);
  }
});
it("exports original editable glTF 2.0 binary assets with a valid scene", async () => {
  const path = new URL("../packages/assets/3d/", import.meta.url),
    catalogue = JSON.parse(
      await readFile(new URL("catalog.json", path), "utf8"),
    );
  expect(catalogue.files.length).toBe(18);
  for (const asset of catalogue.files) {
    const buffer = await readFile(new URL(asset.file, path));
    expect(buffer.toString("ascii", 0, 4)).toBe("glTF");
    expect(buffer.readUInt32LE(4)).toBe(2);
    expect(buffer.readUInt32LE(8)).toBe(buffer.length);
    const length = buffer.readUInt32LE(12),
      json = JSON.parse(buffer.toString("utf8", 20, 20 + length));
    expect(json.scenes[0].nodes.length).toBeGreaterThan(0);
    expect(json.meshes.length).toBeGreaterThan(0);
  }
});

it("ships the Blender-authored Harper master within the mobile budget", async () => {
  const path = new URL(
      "../packages/assets/3d/compa-harper-premium.glb",
      import.meta.url,
    ),
    buffer = await readFile(path);
  expect(buffer.toString("ascii", 0, 4)).toBe("glTF");
  expect(buffer.readUInt32LE(4)).toBe(2);
  expect(buffer.readUInt32LE(8)).toBe(buffer.length);
  const jsonLength = buffer.readUInt32LE(12),
    gltf = JSON.parse(buffer.toString("utf8", 20, 20 + jsonLength));
  let triangles = 0;
  for (const mesh of gltf.meshes) {
    for (const primitive of mesh.primitives) {
      const indexCount =
        primitive.indices === undefined
          ? gltf.accessors[primitive.attributes.POSITION].count
          : gltf.accessors[primitive.indices].count;
      triangles += indexCount / 3;
    }
  }
  expect(gltf.meshes.length).toBeLessThanOrEqual(50);
  expect(triangles).toBeLessThanOrEqual(20_000);
  expect(buffer.length).toBeLessThanOrEqual(1_500_000);
  expect(gltf.skins).toHaveLength(1);
  expect(
    gltf.animations.map((animation: { name: string }) => animation.name),
  ).toContain("Idle");
  expect(
    (gltf.images ?? []).filter(
      (image: { uri?: string }) => image.uri && !image.uri.startsWith("data:"),
    ),
  ).toHaveLength(0);
});

it("ships the Blender-authored Cozy room within the mobile budget", async () => {
  const path = new URL(
      "../packages/assets/3d/habitacion-cozy-premium.glb",
      import.meta.url,
    ),
    buffer = await readFile(path);
  expect(buffer.toString("ascii", 0, 4)).toBe("glTF");
  expect(buffer.readUInt32LE(4)).toBe(2);
  expect(buffer.readUInt32LE(8)).toBe(buffer.length);
  const jsonLength = buffer.readUInt32LE(12),
    gltf = JSON.parse(buffer.toString("utf8", 20, 20 + jsonLength));
  let triangles = 0;
  for (const mesh of gltf.meshes) {
    for (const primitive of mesh.primitives) {
      const indexCount =
        primitive.indices === undefined
          ? gltf.accessors[primitive.attributes.POSITION].count
          : gltf.accessors[primitive.indices].count;
      triangles += indexCount / 3;
    }
  }
  expect(gltf.meshes.length).toBeLessThanOrEqual(40);
  expect(triangles).toBeLessThanOrEqual(50_000);
  expect(buffer.length).toBeLessThanOrEqual(4_000_000);
  expect(gltf.skins ?? []).toHaveLength(0);
  expect(gltf.animations ?? []).toHaveLength(0);
  expect(
    (gltf.images ?? []).filter(
      (image: { uri?: string }) => image.uri && !image.uri.startsWith("data:"),
    ),
  ).toHaveLength(0);
});
