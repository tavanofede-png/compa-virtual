import { it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
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

it("preserves detailed Blender wardrobe geometry, weights and measured export scale", async () => {
  const root = new URL("../packages/assets/3d/", import.meta.url),
    manifest = JSON.parse(
      await readFile(new URL("companion-collection.json", root), "utf8"),
    );
  expect(manifest.schema).toBe("compa-humanoid-v2");
  expect(manifest.assetVersion).toBe(4);
  const audit = JSON.parse(
    await readFile(
      new URL("source/collection-v4-export.audit.json", root),
      "utf8",
    ),
  );
  expect(audit.characters).toHaveLength(8);
  expect(manifest.characters).toHaveLength(8);
  expect(manifest.slots).toEqual([
    "body",
    "hair",
    "face_accessory",
    "top",
    "bottom",
    "shoes",
    "back",
    "hand_prop",
  ]);
  expect(manifest.room.ceilingHeightMeters).toBeGreaterThan(3);
  for (const companion of manifest.characters) {
    expect(companion.heightMeters).toBeGreaterThanOrEqual(1.6);
    expect(companion.heightMeters).toBeLessThanOrEqual(1.8);
    expect(companion.bones).toBe(17);
    expect(companion.validation.passed).toBe(true);
    expect(companion.validation.rigIdentityPreserved).toBe(true);
    expect(
      companion.validation.stateRestoration.poseMatrixBasisMaxError,
    ).toBeLessThan(0.000001);
    expect(companion.geometryAfter.sourceVertices).toBeGreaterThan(
      companion.geometryBefore.sourceVertices * 5,
    );
    const file = companion.export
        .replaceAll("\\", "/")
        .replace("packages/assets/3d/", ""),
      buffer = await readFile(new URL(file, root));
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
    expect(triangles).toBeLessThanOrEqual(80_000);
    // v4 keeps the complete hairstyle/wardrobe and per-vertex skinning data.
    // The densest validated companion is 5.58 MB after lossless-position packing.
    expect(buffer.length).toBeLessThanOrEqual(5_800_000);
    expect(companion.exportedTriangles).toBe(triangles);
    const hash = createHash("sha256").update(buffer).digest("hex");
    expect(companion.glbSha256).toBe(hash);
    const measured = audit.characters.find(
      (entry: { id: string }) => entry.id === companion.id,
    );
    expect(measured.sha256).toBe(hash);
    expect(measured.passed).toBe(true);
    expect(
      Math.abs(measured.measuredBounds.heightMeters - companion.heightMeters),
    ).toBeLessThan(0.01);
    expect(measured.blendedVertices).toBeGreaterThan(0);
    expect(measured.weightedSleeves).toHaveLength(2);
    expect(gltf.skins).toHaveLength(1);
    expect(gltf.skins[0].joints).toHaveLength(17);
    const readAccessor = (index: number): number[][] => {
      const accessor = gltf.accessors[index],
        view = gltf.bufferViews[accessor.bufferView];
      const sizes: Record<number, number> = {
        5121: 1,
        5123: 2,
        5125: 4,
        5126: 4,
      };
      const counts: Record<string, number> = {
        SCALAR: 1,
        VEC2: 2,
        VEC3: 3,
        VEC4: 4,
        MAT4: 16,
      };
      const size = sizes[accessor.componentType],
        count = counts[accessor.type];
      if (!size || !count) throw new Error("Unsupported asset accessor");
      const start =
        28 + jsonLength + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
      const values: number[][] = [];
      for (let i = 0; i < accessor.count; i++) {
        const row: number[] = [];
        for (let j = 0; j < count; j++) {
          const offset =
            start + i * (view.byteStride ?? size * count) + j * size;
          let value =
            accessor.componentType === 5126
              ? buffer.readFloatLE(offset)
              : accessor.componentType === 5125
                ? buffer.readUInt32LE(offset)
                : accessor.componentType === 5123
                  ? buffer.readUInt16LE(offset)
                  : buffer.readUInt8(offset);
          if (accessor.normalized)
            value /= accessor.componentType === 5121 ? 255 : 65535;
          row.push(value);
        }
        values.push(row);
      }
      return values;
    };
    let blended = 0;
    const occupied = new Set<string>();
    for (const node of gltf.nodes) {
      if (node.mesh === undefined) continue;
      expect(manifest.slots).toContain(node.extras?.compa_slot);
      occupied.add(node.extras.compa_slot);
      for (const primitive of gltf.meshes[node.mesh].primitives) {
        const positions = readAccessor(primitive.attributes.POSITION);
        expect(positions.every((row) => row.every(Number.isFinite))).toBe(true);
        const weights = readAccessor(primitive.attributes.WEIGHTS_0);
        const joints = readAccessor(primitive.attributes.JOINTS_0);
        expect(weights.length).toBe(positions.length);
        expect(
          weights.every(
            (row) =>
              row.every((v) => Number.isFinite(v) && v >= 0) &&
              Math.abs(row.reduce((a, b) => a + b, 0) - 1) < 0.0001,
          ),
        ).toBe(true);
        const usedJoints = new Set<string>();
        for (let i = 0; i < weights.length; i++) {
          if (weights[i].filter((w) => w > 1e-6).length > 1) blended++;
          for (let j = 0; j < 4; j++)
            if (weights[i][j] > 1e-6) {
              const jointIndex = gltf.skins[0].joints[joints[i][j]];
              if (jointIndex === undefined)
                throw new Error("Weight references missing joint");
              usedJoints.add(gltf.nodes[jointIndex].name);
            }
        }
        if (node.extras.compa_rigid_bone)
          expect([...usedJoints]).toEqual([node.extras.compa_rigid_bone]);
      }
    }
    expect(blended).toBeGreaterThan(0);
    for (const slot of ["body", "hair", "top", "bottom", "shoes", "back"])
      expect(occupied.has(slot)).toBe(true);
    if (companion.id === "harper") expect(occupied.has("hand_prop")).toBe(true);
    expect(
      gltf.animations.map((animation: { name: string }) => animation.name),
    ).toEqual(["Idle"]);
    expect(
      (gltf.images ?? []).filter(
        (image: { uri?: string }) =>
          image.uri && !image.uri.startsWith("data:"),
      ),
    ).toHaveLength(0);
  }
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
