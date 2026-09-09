from __future__ import annotations

import json
import math
import os
import random
import struct
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIR = ROOT / "packages" / "assets" / "3d" / "source"
PREVIEW_DIR = ROOT / "packages" / "assets" / "3d" / "previews"
EXPORT_DIR = ROOT / "packages" / "assets" / "3d"
SOURCE_DIR.mkdir(parents=True, exist_ok=True)
PREVIEW_DIR.mkdir(parents=True, exist_ok=True)

BLEND_PATH = SOURCE_DIR / "harper-master-v1.blend"
GLB_PATH = EXPORT_DIR / "compa-harper-premium.glb"
PREVIEW_PATH = PREVIEW_DIR / "compa-harper-premium.png"
REPORT_PATH = SOURCE_DIR / "harper-master-v1.report.json"


PALETTE = {
    "skin": "#EBA075",
    "skin_light": "#F5B88E",
    "skin_shadow": "#C96F50",
    "blush": "#E88172",
    "hair": "#21191F",
    "hair_mid": "#35272F",
    "hair_light": "#4A343B",
    "eye": "#4A2D22",
    "eye_dark": "#171216",
    "eye_glint": "#FFFFFF",
    "glasses": "#121316",
    "sweater": "#315D4B",
    "sweater_light": "#426F5B",
    "sweater_dark": "#234538",
    "shirt": "#F1EEE7",
    "pants": "#CDBB9A",
    "pants_dark": "#A58E6C",
    "shoe": "#28201C",
    "shoe_mid": "#45372E",
    "sole": "#C4B69F",
    "backpack": "#272127",
    "backpack_mid": "#393038",
    "backpack_light": "#51434B",
    "book_blue": "#637DA6",
    "book_navy": "#303A58",
    "book_cream": "#DABF91",
    "paper": "#F2EBDD",
    "metal": "#8D847B",
}


def rgba(hex_value: str) -> tuple[float, float, float, float]:
    value = hex_value.lstrip("#")
    srgb = tuple(int(value[i : i + 2], 16) / 255 for i in (0, 2, 4))

    def to_linear(channel: float) -> float:
        return channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4

    return tuple(to_linear(channel) for channel in srgb) + (1.0,)


def material(name: str, color: str, roughness: float = 0.72, metallic: float = 0.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = rgba(color)
    mat.use_nodes = True
    principled = mat.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = rgba(color)
    principled.inputs["Roughness"].default_value = roughness
    principled.inputs["Metallic"].default_value = metallic
    return mat


def move_to_collection(obj: bpy.types.Object, collection: bpy.types.Collection) -> None:
    for owner in list(obj.users_collection):
        owner.objects.unlink(obj)
    collection.objects.link(obj)


def add_box(
    name: str,
    location: tuple[float, float, float],
    dimensions: tuple[float, float, float],
    mat: bpy.types.Material,
    collection: bpy.types.Collection,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
    bevel: float = 0.025,
    segments: int = 2,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel > 0:
        mod = obj.modifiers.new("Soft voxel edges", "BEVEL")
        mod.width = min(bevel, min(dimensions) * 0.3)
        mod.segments = segments
    obj.data.materials.append(mat)
    move_to_collection(obj, collection)
    return obj


def add_sphere(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    mat: bpy.types.Material,
    collection: bpy.types.Collection,
    segments: int = 12,
    rings: int = 8,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    move_to_collection(obj, collection)
    for polygon in obj.data.polygons:
        polygon.use_smooth = False
    bevel = obj.modifiers.new("Facet softening", "BEVEL")
    bevel.width = min(scale) * 0.055
    bevel.segments = 1
    return obj


def add_cylinder(
    name: str,
    location: tuple[float, float, float],
    radius: float,
    depth: float,
    mat: bpy.types.Material,
    collection: bpy.types.Collection,
    rotation: tuple[float, float, float] = (math.pi / 2, 0.0, 0.0),
    vertices: int = 12,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    move_to_collection(obj, collection)
    bevel = obj.modifiers.new("Edge softening", "BEVEL")
    bevel.width = min(radius * 0.13, depth * 0.18)
    bevel.segments = 2
    return obj


def add_frustum(
    name: str,
    location: tuple[float, float, float],
    bottom: tuple[float, float],
    top: tuple[float, float],
    height: float,
    mat: bpy.types.Material,
    collection: bpy.types.Collection,
    bevel: float = 0.03,
) -> bpy.types.Object:
    bx, by = bottom[0] / 2, bottom[1] / 2
    tx, ty = top[0] / 2, top[1] / 2
    hz = height / 2
    vertices = [
        (-bx, -by, -hz), (bx, -by, -hz), (bx, by, -hz), (-bx, by, -hz),
        (-tx, -ty, hz), (tx, -ty, hz), (tx, ty, hz), (-tx, ty, hz),
    ]
    faces = [
        (0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1),
        (1, 5, 6, 2), (2, 6, 7, 3), (4, 0, 3, 7),
    ]
    mesh = bpy.data.meshes.new(name + "Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    obj.location = location
    collection.objects.link(obj)
    obj.data.materials.append(mat)
    mod = obj.modifiers.new("Soft voxel edges", "BEVEL")
    mod.width = bevel
    mod.segments = 2
    return obj


def parent_to_bone(obj: bpy.types.Object, rig: bpy.types.Object, bone: str) -> None:
    world = obj.matrix_world.copy()
    obj.parent = rig
    obj.parent_type = "BONE"
    obj.parent_bone = bone
    obj.matrix_world = world


def look_at(obj: bpy.types.Object, target: tuple[float, float, float]) -> None:
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def optimize_export_meshes(collection_names: tuple[str, ...]) -> list[bpy.types.Object]:
    """Apply bevels and batch rigid parts by bone/material for mobile draw-call budgets."""
    mesh_objects: list[bpy.types.Object] = []
    for collection_name in collection_names:
        mesh_objects.extend(obj for obj in bpy.data.collections[collection_name].all_objects if obj.type == "MESH")

    for obj in mesh_objects:
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        for modifier in list(obj.modifiers):
            bpy.ops.object.modifier_apply(modifier=modifier.name)

    batches: dict[tuple[str, str], list[bpy.types.Object]] = {}
    for obj in mesh_objects:
        material_name = obj.data.materials[0].name if obj.data.materials else "NO_MATERIAL"
        batches.setdefault((obj.parent_bone or "root", material_name), []).append(obj)

    for (bone_name, material_name), batch in batches.items():
        if len(batch) < 2:
            continue
        bpy.ops.object.select_all(action="DESELECT")
        for obj in batch:
            obj.select_set(True)
        active = batch[0]
        bpy.context.view_layer.objects.active = active
        bpy.ops.object.join()
        active.name = f"BATCH_{bone_name}_{material_name.removeprefix('MAT_')}"

    optimized: list[bpy.types.Object] = []
    for collection_name in collection_names:
        optimized.extend(obj for obj in bpy.data.collections[collection_name].all_objects if obj.type == "MESH")
    return list(dict.fromkeys(optimized))


def inspect_glb(path: Path) -> dict[str, object]:
    data = path.read_bytes()
    if data[:4] != b"glTF" or struct.unpack_from("<I", data, 4)[0] != 2:
        raise RuntimeError("The exported file is not a valid glTF 2.0 binary")
    declared_length = struct.unpack_from("<I", data, 8)[0]
    if declared_length != len(data):
        raise RuntimeError("The exported GLB length header is invalid")
    json_length = struct.unpack_from("<I", data, 12)[0]
    document = json.loads(data[20 : 20 + json_length].decode("utf-8"))
    vertices = 0
    triangles = 0
    for mesh in document.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            vertices += document["accessors"][primitive["attributes"]["POSITION"]]["count"]
            index_count = document["accessors"][primitive["indices"]]["count"] if "indices" in primitive else document["accessors"][primitive["attributes"]["POSITION"]]["count"]
            triangles += index_count // 3
    return {
        "validGlb2": True,
        "exportedMeshes": len(document.get("meshes", [])),
        "exportedNodes": len(document.get("nodes", [])),
        "exportedMaterials": len(document.get("materials", [])),
        "exportedVertices": vertices,
        "exportedTriangles": triangles,
        "skins": len(document.get("skins", [])),
        "animationClips": [animation.get("name", "unnamed") for animation in document.get("animations", [])],
        "externalImages": len([image for image in document.get("images", []) if image.get("uri", "").startswith("data:") is False and "uri" in image]),
    }


def build_scene() -> dict[str, object]:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        pass

    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1200
    scene.render.resolution_y = 1200
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.world.color = (0.035, 0.035, 0.045)

    root_collection = bpy.data.collections.new("HARPER_MASTER")
    scene.collection.children.link(root_collection)
    collections = {}
    for name in ("BASE_BODY", "HAIR", "OUTFIT", "ACCESSORIES", "RIG"):
        collection = bpy.data.collections.new(name)
        root_collection.children.link(collection)
        collections[name] = collection

    mats = {key: material("MAT_" + key.upper(), value) for key, value in PALETTE.items()}
    mats["eye_glint"].node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.16
    mats["glasses"].node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.25
    mats["metal"].node_tree.nodes["Principled BSDF"].inputs["Metallic"].default_value = 0.55

    body = collections["BASE_BODY"]
    outfit = collections["OUTFIT"]
    hair = collections["HAIR"]
    accessories = collections["ACCESSORIES"]

    parts: dict[str, list[bpy.types.Object]] = {
        "hips": [], "spine": [], "head": [], "upper_arm.L": [], "forearm.L": [],
        "hand.L": [], "upper_arm.R": [], "forearm.R": [], "hand.R": [],
        "thigh.L": [], "shin.L": [], "foot.L": [], "thigh.R": [], "shin.R": [], "foot.R": [],
    }

    def keep(bone: str, obj: bpy.types.Object) -> bpy.types.Object:
        parts[bone].append(obj)
        return obj

    # Long teenage silhouette with softly beveled voxel construction.
    keep("hips", add_box("Body_Hips", (0, 0, 1.17), (0.70, 0.36, 0.24), mats["pants"], outfit, bevel=0.045))
    keep("spine", add_frustum("Outfit_Sweater_Torso", (0, 0, 1.62), (0.72, 0.41), (0.62, 0.36), 0.72, mats["sweater"], outfit, bevel=0.055))
    keep("spine", add_box("Outfit_Sweater_Hem", (0, -0.015, 1.275), (0.73, 0.405, 0.105), mats["sweater_dark"], outfit, bevel=0.022))
    for x in (-0.27, -0.18, -0.09, 0, 0.09, 0.18, 0.27):
        keep("spine", add_box(f"Detail_Knit_{x:+.2f}", (x, -0.216, 1.63), (0.018, 0.018, 0.52), mats["sweater_light"], outfit, bevel=0.006, segments=1))

    # Shirt collar and knit neckline.
    keep("spine", add_box("Outfit_Shirt_Collar_L", (-0.115, -0.225, 1.965), (0.23, 0.055, 0.16), mats["shirt"], outfit, rotation=(0.0, 0.0, -0.58), bevel=0.018))
    keep("spine", add_box("Outfit_Shirt_Collar_R", (0.115, -0.225, 1.965), (0.23, 0.055, 0.16), mats["shirt"], outfit, rotation=(0.0, 0.0, 0.58), bevel=0.018))
    keep("spine", add_box("Outfit_Shirt_Hem", (0, -0.015, 1.205), (0.67, 0.37, 0.08), mats["shirt"], outfit, bevel=0.015))

    # Legs, seams and rolled cuffs.
    for side, x in (("L", -0.205), ("R", 0.205)):
        keep(f"thigh.{side}", add_box(f"Outfit_Pants_Thigh_{side}", (x, 0, 0.87), (0.31, 0.33, 0.55), mats["pants"], outfit, bevel=0.04))
        keep(f"shin.{side}", add_box(f"Outfit_Pants_Shin_{side}", (x, 0.008, 0.47), (0.29, 0.31, 0.43), mats["pants"], outfit, bevel=0.035))
        keep(f"shin.{side}", add_box(f"Detail_Pants_Seam_{side}", (x + (-0.145 if side == "L" else 0.145), -0.035, 0.69), (0.018, 0.20, 0.58), mats["pants_dark"], outfit, bevel=0.004, segments=1))
        keep(f"shin.{side}", add_box(f"Outfit_Pants_Cuff_{side}", (x, -0.002, 0.29), (0.305, 0.325, 0.12), mats["pants_dark"], outfit, bevel=0.018))
        keep(f"foot.{side}", add_box(f"Outfit_Shoe_{side}", (x, -0.075, 0.135), (0.35, 0.50, 0.22), mats["shoe"], outfit, bevel=0.055, segments=3))
        keep(f"foot.{side}", add_box(f"Outfit_Shoe_Toe_{side}", (x, -0.265, 0.12), (0.36, 0.23, 0.18), mats["shoe_mid"], outfit, bevel=0.06, segments=3))
        keep(f"foot.{side}", add_box(f"Outfit_Sole_{side}", (x, -0.09, 0.035), (0.37, 0.51, 0.075), mats["sole"], outfit, bevel=0.018))
        for lace_index in range(3):
            keep(f"foot.{side}", add_box(f"Detail_Lace_{side}_{lace_index}", (x, -0.302 + lace_index * 0.055, 0.195), (0.22, 0.018, 0.018), mats["sole"], outfit, bevel=0.005, segments=1))

    # Neck, head, ears and layered facial planes.
    keep("spine", add_box("Body_Neck", (0, 0, 2.01), (0.22, 0.22, 0.20), mats["skin_shadow"], body, bevel=0.05, segments=3))
    keep("head", add_box("Body_Head", (0, 0, 2.34), (0.78, 0.64, 0.70), mats["skin"], body, bevel=0.15, segments=5))
    keep("head", add_box("Body_Face_Plane", (0, -0.306, 2.33), (0.68, 0.055, 0.52), mats["skin_light"], body, bevel=0.105, segments=4))
    keep("head", add_sphere("Body_Ear_L", (-0.425, -0.005, 2.34), (0.10, 0.075, 0.14), mats["skin"], body))
    keep("head", add_sphere("Body_Ear_R", (0.425, -0.005, 2.34), (0.10, 0.075, 0.14), mats["skin"], body))
    keep("head", add_box("Detail_EarInner_L", (-0.455, -0.075, 2.34), (0.055, 0.025, 0.085), mats["skin_shadow"], body, bevel=0.02))
    keep("head", add_box("Detail_EarInner_R", (0.455, -0.075, 2.34), (0.055, 0.025, 0.085), mats["skin_shadow"], body, bevel=0.02))

    # Expressive eyes, eyebrows, nose, smile and cheeks.
    for side, x in (("L", -0.205), ("R", 0.205)):
        keep("head", add_box(f"Face_EyeWhite_{side}", (x, -0.353, 2.375), (0.205, 0.035, 0.19), mats["eye_glint"], body, bevel=0.052, segments=3))
        keep("head", add_box(f"Face_Iris_{side}", (x + (0.018 if side == "L" else -0.018), -0.377, 2.37), (0.092, 0.025, 0.125), mats["eye"], body, bevel=0.027, segments=2))
        keep("head", add_box(f"Face_Pupil_{side}", (x + (0.018 if side == "L" else -0.018), -0.393, 2.365), (0.045, 0.018, 0.082), mats["eye_dark"], body, bevel=0.013))
        keep("head", add_box(f"Face_Glint_{side}", (x - 0.003, -0.405, 2.412), (0.026, 0.012, 0.034), mats["eye_glint"], body, bevel=0.008))
        keep("head", add_box(f"Face_Brow_{side}", (x, -0.375, 2.515), (0.19, 0.027, 0.043), mats["hair"], body, rotation=(0.0, 0.0, 0.08 if side == "L" else -0.08), bevel=0.014))
    keep("head", add_box("Face_Nose", (0, -0.384, 2.275), (0.065, 0.055, 0.075), mats["skin_shadow"], body, bevel=0.022, segments=3))
    keep("head", add_box("Face_Blush_L", (-0.305, -0.371, 2.255), (0.095, 0.02, 0.045), mats["blush"], body, bevel=0.018))
    keep("head", add_box("Face_Blush_R", (0.305, -0.371, 2.255), (0.095, 0.02, 0.045), mats["blush"], body, bevel=0.018))
    for index, (x, z, rot) in enumerate(((-0.075, 2.19, -0.20), (0, 2.175, 0), (0.075, 2.19, 0.20))):
        keep("head", add_box(f"Face_Smile_{index}", (x, -0.383, z), (0.09, 0.024, 0.027), mats["skin_shadow"], body, rotation=(0.0, 0.0, rot), bevel=0.008))

    # Glasses with real depth and temples.
    for side, x in (("L", -0.205), ("R", 0.205)):
        for suffix, loc, dims in (
            ("Top", (x, -0.405, 2.475), (0.265, 0.035, 0.035)),
            ("Bottom", (x, -0.405, 2.29), (0.265, 0.035, 0.035)),
            ("Outer", (x + (-0.132 if side == "L" else 0.132), -0.405, 2.382), (0.035, 0.035, 0.22)),
            ("Inner", (x + (0.132 if side == "L" else -0.132), -0.405, 2.382), (0.035, 0.035, 0.22)),
        ):
            keep("head", add_box(f"Accessory_Glasses_{side}_{suffix}", loc, dims, mats["glasses"], accessories, bevel=0.012, segments=2))
    keep("head", add_box("Accessory_Glasses_Bridge", (0, -0.407, 2.395), (0.14, 0.035, 0.035), mats["glasses"], accessories, bevel=0.012))
    keep("head", add_box("Accessory_Glasses_Temple_L", (-0.402, -0.25, 2.42), (0.035, 0.31, 0.035), mats["glasses"], accessories, bevel=0.01))
    keep("head", add_box("Accessory_Glasses_Temple_R", (0.402, -0.25, 2.42), (0.035, 0.31, 0.035), mats["glasses"], accessories, bevel=0.01))

    # Dense, layered voxel hair. The deterministic jitter avoids a tiled look.
    rng = random.Random(2409)
    keep("head", add_box("Hair_UnderCap", (0, 0.03, 2.61), (0.80, 0.63, 0.42), mats["hair"], hair, bevel=0.12, segments=4))
    tuft_count = 0
    for row, z in enumerate((2.49, 2.60, 2.71)):
        for column, x in enumerate((-0.34, -0.17, 0.0, 0.17, 0.34)):
            if row == 2 and abs(x) > 0.25:
                continue
            y = -0.12 + row * 0.08 + rng.uniform(-0.035, 0.035)
            dims = (rng.uniform(0.18, 0.23), rng.uniform(0.20, 0.27), rng.uniform(0.16, 0.22))
            shade = mats[("hair", "hair_mid", "hair_light")[(row + column) % 3]]
            keep("head", add_box(f"Hair_Tuft_Top_{tuft_count:02}", (x + rng.uniform(-0.025, 0.025), y, z), dims, shade, hair, rotation=(rng.uniform(-0.13, 0.13), rng.uniform(-0.13, 0.13), rng.uniform(-0.20, 0.20)), bevel=0.055, segments=2))
            tuft_count += 1
    for side, x in (("L", -0.39), ("R", 0.39)):
        for index, z in enumerate((2.30, 2.46, 2.60)):
            keep("head", add_box(f"Hair_Tuft_Side_{side}_{index}", (x, 0.005 + index * 0.025, z), (0.19, 0.25, 0.22), mats["hair_mid" if index == 1 else "hair"], hair, rotation=(0.0, 0.0, (-0.18 if side == "L" else 0.18)), bevel=0.055, segments=2))
    for index, (x, z, rot) in enumerate(((-0.31, 2.55, -0.30), (-0.15, 2.56, -0.14), (0.02, 2.56, 0.06), (0.19, 2.55, 0.17), (0.33, 2.52, 0.29))):
        keep("head", add_box(f"Hair_Fringe_{index}", (x, -0.325, z), (0.20, 0.16, 0.25), mats["hair_mid" if index % 2 else "hair"], hair, rotation=(0.0, 0.0, rot), bevel=0.05, segments=2))
    for row, z in enumerate((2.35, 2.53, 2.68)):
        for x in (-0.27, -0.09, 0.09, 0.27):
            keep("head", add_box(f"Hair_Back_{row}_{x:+.2f}", (x, 0.31, z), (0.20, 0.16, 0.20), mats["hair" if row != 1 else "hair_mid"], hair, bevel=0.05, segments=2))

    # Backpack: volume, front pocket, straps, zip and brand patch.
    keep("spine", add_box("Accessory_Backpack_Main", (0, 0.28, 1.62), (0.72, 0.31, 0.78), mats["backpack"], accessories, bevel=0.10, segments=4))
    keep("spine", add_box("Accessory_Backpack_Pocket", (0, 0.445, 1.48), (0.53, 0.10, 0.30), mats["backpack_mid"], accessories, bevel=0.06, segments=3))
    keep("spine", add_box("Detail_Backpack_Zip", (0, 0.505, 1.64), (0.40, 0.025, 0.025), mats["metal"], accessories, bevel=0.006))
    keep("spine", add_box("Detail_Backpack_Patch", (0, 0.505, 1.78), (0.15, 0.025, 0.15), mats["pants_dark"], accessories, rotation=(0, 0, math.pi / 4), bevel=0.02))
    for side, x in (("L", -0.31), ("R", 0.31)):
        keep("spine", add_box(f"Accessory_Backpack_Strap_{side}", (x, -0.205, 1.70), (0.12, 0.08, 0.60), mats["backpack_light"], accessories, rotation=(0.06, 0.0, (-0.06 if side == "L" else 0.06)), bevel=0.03))

    # Arms holding a stack of notebooks. The segmentation follows the reusable rig.
    keep("upper_arm.L", add_box("Outfit_UpperArm_L", (-0.49, -0.01, 1.67), (0.23, 0.28, 0.57), mats["sweater"], outfit, rotation=(0.0, -0.04, -0.08), bevel=0.06, segments=3))
    keep("upper_arm.R", add_box("Outfit_UpperArm_R", (0.49, -0.015, 1.68), (0.23, 0.28, 0.56), mats["sweater"], outfit, rotation=(0.0, 0.04, 0.08), bevel=0.06, segments=3))
    keep("forearm.L", add_box("Outfit_Forearm_L", (-0.28, -0.285, 1.43), (0.49, 0.24, 0.22), mats["sweater"], outfit, rotation=(0.0, 0.0, 0.10), bevel=0.055, segments=3))
    keep("forearm.R", add_box("Outfit_Forearm_R", (0.25, -0.36, 1.56), (0.45, 0.24, 0.22), mats["sweater"], outfit, rotation=(0.0, 0.0, -0.12), bevel=0.055, segments=3))
    keep("forearm.L", add_box("Outfit_Cuff_L", (-0.07, -0.30, 1.45), (0.13, 0.255, 0.245), mats["sweater_dark"], outfit, bevel=0.035))
    keep("forearm.R", add_box("Outfit_Cuff_R", (0.055, -0.375, 1.55), (0.13, 0.255, 0.245), mats["sweater_dark"], outfit, bevel=0.035))
    keep("hand.L", add_box("Body_Hand_L", (0.02, -0.33, 1.45), (0.17, 0.18, 0.19), mats["skin"], body, bevel=0.055, segments=3))
    keep("hand.R", add_box("Body_Hand_R", (-0.03, -0.405, 1.55), (0.17, 0.18, 0.19), mats["skin"], body, bevel=0.055, segments=3))
    for hand, x, z in (("L", 0.04, 1.43), ("R", -0.05, 1.57)):
        for finger in range(3):
            keep(f"hand.{hand}", add_box(f"Detail_Finger_{hand}_{finger}", (x + (finger - 1) * 0.042, -0.432, z), (0.035, 0.065, 0.10), mats["skin_light"], body, bevel=0.014))

    # Books use separate covers/pages so they read clearly at mobile size.
    book_specs = (
        ("Cream", -0.105, 1.66, 0.40, 0.58, mats["book_cream"]),
        ("Blue", -0.045, 1.61, 0.43, 0.54, mats["book_blue"]),
        ("Navy", 0.02, 1.55, 0.39, 0.46, mats["book_navy"]),
    )
    for index, (label, x, z, width, height, cover_mat) in enumerate(book_specs):
        keep("spine", add_box(f"Accessory_Book_{label}_Pages", (x, -0.455 - index * 0.025, z), (width - 0.035, 0.085, height - 0.035), mats["paper"], accessories, rotation=(0.0, 0.0, -0.04 + index * 0.035), bevel=0.018))
        keep("spine", add_box(f"Accessory_Book_{label}_Cover", (x, -0.505 - index * 0.025, z), (width, 0.025, height), cover_mat, accessories, rotation=(0.0, 0.0, -0.04 + index * 0.035), bevel=0.012))
        keep("spine", add_box(f"Detail_Book_{label}_Spine", (x - width / 2 + 0.018, -0.50 - index * 0.025, z), (0.035, 0.05, height), cover_mat, accessories, rotation=(0.0, 0.0, -0.04 + index * 0.035), bevel=0.008))

    # Reusable humanoid armature, aligned to semantic modular pieces.
    arm_data = bpy.data.armatures.new("HarperRig")
    rig = bpy.data.objects.new("RIG_Harper", arm_data)
    collections["RIG"].objects.link(rig)
    rig.show_in_front = True
    rig["compa_character_id"] = "harper"
    rig["compa_asset_version"] = 1
    rig["compa_style"] = "premium_stylized_voxel"
    rig["compa_slots"] = "skin,hair,eyes,glasses,top,bottom,shoes,backpack,hand_prop"
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")

    def bone(name: str, head: tuple[float, float, float], tail: tuple[float, float, float], parent: str | None = None):
        item = arm_data.edit_bones.new(name)
        item.head = head
        item.tail = tail
        if parent:
            item.parent = arm_data.edit_bones[parent]
        return item

    bone("root", (0, 0, 0), (0, 0, 0.2))
    bone("hips", (0, 0, 1.05), (0, 0, 1.30), "root")
    bone("spine", (0, 0, 1.30), (0, 0, 1.88), "hips")
    bone("neck", (0, 0, 1.88), (0, 0, 2.08), "spine")
    bone("head", (0, 0, 2.08), (0, 0, 2.62), "neck")
    bone("upper_arm.L", (-0.31, 0, 1.84), (-0.49, 0, 1.54), "spine")
    bone("forearm.L", (-0.49, 0, 1.54), (-0.08, -0.23, 1.44), "upper_arm.L")
    bone("hand.L", (-0.08, -0.23, 1.44), (0.04, -0.28, 1.44), "forearm.L")
    bone("upper_arm.R", (0.31, 0, 1.84), (0.49, 0, 1.55), "spine")
    bone("forearm.R", (0.49, 0, 1.55), (0.08, -0.30, 1.55), "upper_arm.R")
    bone("hand.R", (0.08, -0.30, 1.55), (-0.04, -0.34, 1.55), "forearm.R")
    bone("thigh.L", (-0.205, 0, 1.10), (-0.205, 0, 0.67), "hips")
    bone("shin.L", (-0.205, 0, 0.67), (-0.205, 0, 0.28), "thigh.L")
    bone("foot.L", (-0.205, 0, 0.28), (-0.205, -0.28, 0.12), "shin.L")
    bone("thigh.R", (0.205, 0, 1.10), (0.205, 0, 0.67), "hips")
    bone("shin.R", (0.205, 0, 0.67), (0.205, 0, 0.28), "thigh.R")
    bone("foot.R", (0.205, 0, 0.28), (0.205, -0.28, 0.12), "shin.R")
    bpy.ops.object.mode_set(mode="OBJECT")

    for bone_name, bone_parts in parts.items():
        for obj in bone_parts:
            parent_to_bone(obj, rig, bone_name)

    # Idle animation: small breathing and head movement, authored on the shared rig.
    scene.frame_start = 1
    scene.frame_end = 96
    scene.render.fps = 24
    rig.animation_data_create()
    action = bpy.data.actions.new("Idle")
    rig.animation_data.action = action
    for frame, chest_angle, head_angle, root_z in (
        (1, 0.0, -0.018, 0.0),
        (24, 0.012, 0.012, 0.008),
        (48, 0.0, 0.025, 0.0),
        (72, -0.010, 0.005, 0.008),
        (96, 0.0, -0.018, 0.0),
    ):
        rig.pose.bones["spine"].rotation_mode = "XYZ"
        rig.pose.bones["spine"].rotation_euler[0] = chest_angle
        rig.pose.bones["spine"].keyframe_insert(data_path="rotation_euler", frame=frame)
        rig.pose.bones["head"].rotation_mode = "XYZ"
        rig.pose.bones["head"].rotation_euler[2] = head_angle
        rig.pose.bones["head"].keyframe_insert(data_path="rotation_euler", frame=frame)
        rig.pose.bones["root"].location[2] = root_z
        rig.pose.bones["root"].keyframe_insert(data_path="location", frame=frame)
    # Studio presentation scene.
    studio = bpy.data.collections.new("STUDIO_PREVIEW")
    scene.collection.children.link(studio)
    floor_mat = material("MAT_STUDIO_FLOOR", "#EEEAE3", roughness=0.9)
    add_box("Studio_Floor", (0, 0, -0.055), (6.0, 6.0, 0.10), floor_mat, studio, bevel=0.025)

    bpy.ops.object.light_add(type="AREA", location=(3.7, -4.0, 5.3))
    key = bpy.context.object
    key.name = "Studio_Key"
    key.data.energy = 1050
    key.data.shape = "DISK"
    key.data.size = 4.0
    look_at(key, (0, 0, 1.35))
    move_to_collection(key, studio)

    bpy.ops.object.light_add(type="AREA", location=(-3.1, -1.5, 3.2))
    fill = bpy.context.object
    fill.name = "Studio_Fill"
    fill.data.energy = 720
    fill.data.size = 3.2
    look_at(fill, (0, 0, 1.4))
    move_to_collection(fill, studio)

    bpy.ops.object.light_add(type="AREA", location=(0.8, 2.7, 4.0))
    rim = bpy.context.object
    rim.name = "Studio_Rim"
    rim.data.energy = 920
    rim.data.color = (0.75, 0.86, 1.0)
    rim.data.size = 2.6
    look_at(rim, (0, 0, 1.6))
    move_to_collection(rim, studio)

    bpy.ops.object.camera_add(location=(2.75, -4.75, 2.78))
    camera = bpy.context.object
    camera.name = "Camera_Premium_Preview"
    camera.data.lens = 62
    camera.data.sensor_width = 36
    look_at(camera, (0, 0, 1.38))
    move_to_collection(camera, studio)
    scene.camera = camera
    scene.render.filepath = str(PREVIEW_PATH)

    # Color management and ambient contact shadows.
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = rgba("#EAE6E1")
    background.inputs["Strength"].default_value = 0.65

    # Metadata helps the runtime and future artists inspect the master without guessing.
    root_collection["character_id"] = "harper"
    root_collection["display_name"] = "Harper"
    root_collection["reference"] = "harper-original.png"
    root_collection["license"] = "Original Compa Virtual production asset"
    root_collection["scale_meters"] = 2.8
    root_collection["target_platforms"] = "web,android,ios"

    return {"rig": rig, "root": root_collection, "studio": studio}


def save_and_export(built: dict[str, object]) -> None:
    scene = bpy.context.scene
    scene.frame_set(1)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH), compress=True)
    bpy.ops.render.render(write_still=True)

    export_collections = ("BASE_BODY", "HAIR", "OUTFIT", "ACCESSORIES")
    export_meshes = optimize_export_meshes(export_collections)
    bpy.ops.object.select_all(action="DESELECT")
    export_objects = [*export_meshes, built["rig"]]
    for obj in export_objects:
        obj.hide_render = False
        obj.select_set(True)
    bpy.context.view_layer.objects.active = built["rig"]
    bpy.ops.export_scene.gltf(
        filepath=str(GLB_PATH),
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_extras=True,
        export_apply=True,
        export_yup=True,
    )

    mesh_objects = [obj for obj in export_objects if obj.type == "MESH"]
    raw_vertices = sum(len(obj.data.vertices) for obj in mesh_objects)
    raw_triangles = sum(len(obj.data.loop_triangles) for obj in mesh_objects)
    report = {
        "character": "Harper",
        "style": "premium stylized voxel",
        "source": os.fspath(BLEND_PATH.relative_to(ROOT)),
        "export": os.fspath(GLB_PATH.relative_to(ROOT)),
        "preview": os.fspath(PREVIEW_PATH.relative_to(ROOT)),
        "objects": len(export_objects),
        "meshObjects": len(mesh_objects),
        "rawVerticesBeforeModifiers": raw_vertices,
        "rawTrianglesBeforeModifiers": raw_triangles,
        "bones": len(built["rig"].data.bones),
        "animations": [action.name for action in bpy.data.actions],
        "glbBytes": GLB_PATH.stat().st_size,
        "blendBytes": BLEND_PATH.stat().st_size,
        "renderEngine": scene.render.engine,
        "blenderVersion": bpy.app.version_string,
        **inspect_glb(GLB_PATH),
    }
    REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    save_and_export(build_scene())
