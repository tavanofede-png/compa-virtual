from __future__ import annotations

import json
import math
import os
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))

from build_harper import (
    ROOT,
    add_box,
    add_cylinder,
    add_sphere,
    inspect_glb,
    look_at,
    material,
    move_to_collection,
    optimize_export_meshes,
    rgba,
)


SOURCE_DIR = ROOT / "packages" / "assets" / "3d" / "source"
PREVIEW_DIR = ROOT / "packages" / "assets" / "3d" / "previews"
EXPORT_DIR = ROOT / "packages" / "assets" / "3d"
BLEND_PATH = SOURCE_DIR / "cozy-modern-master-v1.blend"
GLB_PATH = EXPORT_DIR / "habitacion-cozy-premium.glb"
PREVIEW_PATH = PREVIEW_DIR / "habitacion-cozy-premium.png"
REPORT_PATH = SOURCE_DIR / "cozy-modern-master-v1.report.json"


PALETTE = {
    "wall": "#F2DDD0",
    "wall_shadow": "#DDBEAA",
    "trim": "#F7E8DD",
    "floor": "#D8A77E",
    "floor_light": "#E3B58C",
    "floor_dark": "#BD8763",
    "oak": "#B87950",
    "oak_light": "#D39A6E",
    "oak_dark": "#87593F",
    "linen": "#F6EEE4",
    "linen_shadow": "#DACBBE",
    "pink": "#D98F91",
    "pink_light": "#F0B5B2",
    "pink_dark": "#B86D73",
    "sage": "#71866D",
    "sage_light": "#98A58A",
    "leaf": "#426E4B",
    "leaf_light": "#68A064",
    "terracotta": "#B86D48",
    "cream": "#F1D7B8",
    "paper": "#F5EFE4",
    "ink": "#32313A",
    "metal": "#4E4B50",
    "black": "#25242A",
    "screen": "#6A7895",
    "screen_light": "#A8C5C7",
    "sky": "#8CC6DE",
    "gold": "#D7A53B",
    "white": "#FFFFFF",
}


def emissive_material(name: str, color: str, strength: float):
    mat = material(name, color, roughness=0.35)
    principled = mat.node_tree.nodes.get("Principled BSDF")
    if "Emission Color" in principled.inputs:
        principled.inputs["Emission Color"].default_value = rgba(color)
        principled.inputs["Emission Strength"].default_value = strength
    elif "Emission" in principled.inputs:
        principled.inputs["Emission"].default_value = rgba(color)
        principled.inputs["Emission Strength"].default_value = strength
    return mat


def add_cloth(
    name: str,
    center: tuple[float, float, float],
    width: float,
    length: float,
    mat: bpy.types.Material,
    collection: bpy.types.Collection,
    segments_x: int = 12,
    segments_y: int = 18,
    wave: float = 0.025,
    edge_drop: float = 0.10,
) -> bpy.types.Object:
    vertices = []
    faces = []
    for iy in range(segments_y + 1):
        y = -length / 2 + length * iy / segments_y
        for ix in range(segments_x + 1):
            x = -width / 2 + width * ix / segments_x
            ripple = math.sin(ix * 1.7 + iy * 0.55) * wave
            drop = edge_drop * (abs(x) / (width / 2)) ** 7
            vertices.append((x + center[0], y + center[1], center[2] + ripple - drop))
    stride = segments_x + 1
    for iy in range(segments_y):
        for ix in range(segments_x):
            a = iy * stride + ix
            faces.append((a, a + 1, a + 1 + stride, a + stride))
    mesh = bpy.data.meshes.new(name + "Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.data.materials.append(mat)
    solidify = obj.modifiers.new("Cloth thickness", "SOLIDIFY")
    solidify.thickness = 0.055
    bevel = obj.modifiers.new("Soft textile edge", "BEVEL")
    bevel.width = 0.018
    bevel.segments = 2
    return obj


def add_curtain(
    name: str,
    x_center: float,
    width: float,
    mat: bpy.types.Material,
    collection: bpy.types.Collection,
) -> bpy.types.Object:
    segments_x = 12
    segments_z = 10
    vertices = []
    faces = []
    for iz in range(segments_z + 1):
        z = 0.95 + iz * 1.75 / segments_z
        for ix in range(segments_x + 1):
            x = x_center - width / 2 + width * ix / segments_x
            y = 2.535 - 0.06 * math.cos(ix * math.pi * 2.5 / segments_x)
            vertices.append((x, y, z))
    stride = segments_x + 1
    for iz in range(segments_z):
        for ix in range(segments_x):
            a = iz * stride + ix
            faces.append((a, a + 1, a + 1 + stride, a + stride))
    mesh = bpy.data.meshes.new(name + "Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.data.materials.append(mat)
    solidify = obj.modifiers.new("Curtain thickness", "SOLIDIFY")
    solidify.thickness = 0.045
    bevel = obj.modifiers.new("Curtain soft edge", "BEVEL")
    bevel.width = 0.015
    bevel.segments = 2
    return obj


def add_plant(
    prefix: str,
    location: tuple[float, float, float],
    scale: float,
    mats: dict[str, bpy.types.Material],
    collection: bpy.types.Collection,
) -> None:
    x, y, z = location
    add_cylinder(prefix + "_Pot", (x, y, z + 0.16 * scale), 0.18 * scale, 0.30 * scale, mats["terracotta"], collection, rotation=(0, 0, 0), vertices=12)
    add_cylinder(prefix + "_Soil", (x, y, z + 0.315 * scale), 0.145 * scale, 0.025 * scale, mats["oak_dark"], collection, rotation=(0, 0, 0), vertices=12)
    for index, (dx, dy, dz, rz) in enumerate(
        (
            (-0.10, 0.00, 0.46, -0.55),
            (0.10, 0.00, 0.52, 0.55),
            (0.00, -0.06, 0.61, 0.05),
            (-0.07, 0.06, 0.68, -0.30),
            (0.08, 0.05, 0.73, 0.35),
        )
    ):
        leaf = add_sphere(prefix + f"_Leaf_{index}", (x + dx * scale, y + dy * scale, z + dz * scale), (0.105 * scale, 0.055 * scale, 0.25 * scale), mats["leaf_light" if index % 2 else "leaf"], collection, segments=10, rings=6)
        leaf.rotation_euler[1] = rz


def add_books(
    prefix: str,
    origin: tuple[float, float, float],
    count: int,
    mats: dict[str, bpy.types.Material],
    collection: bpy.types.Collection,
    vertical: bool = True,
) -> None:
    colors = (mats["pink_dark"], mats["sage"], mats["screen"], mats["cream"], mats["ink"], mats["gold"])
    x, y, z = origin
    for index in range(count):
        color = colors[index % len(colors)]
        if vertical:
            width = 0.10 + (index % 3) * 0.018
            height = 0.30 + (index % 4) * 0.035
            add_box(prefix + f"_{index}", (x + index * 0.125, y, z + height / 2), (width, 0.18, height), color, collection, rotation=(0, 0, (-0.05 if index % 4 == 3 else 0.0)), bevel=0.012)
            add_box(prefix + f"_Spine_{index}", (x + index * 0.125, y - 0.096, z + height / 2), (width * 0.55, 0.012, height * 0.72), mats["paper"], collection, bevel=0.004)
        else:
            add_box(prefix + f"_{index}", (x, y, z + index * 0.075), (0.40 - index * 0.02, 0.25, 0.06), color, collection, rotation=(0, 0, 0.025 * (index - 1)), bevel=0.012)


def build_scene() -> dict[str, object]:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1400
    scene.render.resolution_y = 1100
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.look = "AgX - Medium High Contrast"

    root = bpy.data.collections.new("ROOM_COZY_MODERN_MASTER")
    scene.collection.children.link(root)
    collections: dict[str, bpy.types.Collection] = {}
    for name in ("ARCHITECTURE", "BED", "DESK", "STORAGE", "DECOR", "LIGHTING", "STUDIO_PREVIEW"):
        collection = bpy.data.collections.new(name)
        root.children.link(collection)
        collections[name] = collection

    mats = {key: material("MAT_" + key.upper(), color) for key, color in PALETTE.items()}
    mats["metal"].node_tree.nodes["Principled BSDF"].inputs["Metallic"].default_value = 0.50
    mats["screen"].node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.22
    mats["led"] = emissive_material("MAT_LED_WARM", "#FFD3A1", 4.0)
    mats["screen_glow"] = emissive_material("MAT_SCREEN_GLOW", "#78B7C7", 1.7)

    arch = collections["ARCHITECTURE"]
    bed = collections["BED"]
    desk = collections["DESK"]
    storage = collections["STORAGE"]
    decor = collections["DECOR"]

    # Cutaway shell with a real window opening and visible wall thickness.
    add_box("Architecture_FloorSlab", (0, 0, 0.02), (6.35, 5.35, 0.20), mats["floor_dark"], arch, bevel=0.04)
    for index in range(20):
        x = -3.0 + index * 0.315
        floor_mat = mats[("floor", "floor_light", "floor", "floor_dark")[index % 4]]
        add_box(f"Architecture_FloorPlank_{index:02}", (x, 0, 0.145), (0.30, 5.12, 0.055), floor_mat, arch, bevel=0.008, segments=1)
    for index in range(9):
        y = -2.32 + index * 0.58
        add_box(f"Detail_FloorJoint_{index}", (0, y, 0.177), (6.05, 0.016, 0.008), mats["floor_dark"], arch, bevel=0.002, segments=1)

    # Back wall segments frame a 1.65 x 1.35 m window.
    add_box("Architecture_BackWall_Left", (-2.67, 2.62, 1.58), (0.95, 0.20, 3.08), mats["wall"], arch, bevel=0.035)
    add_box("Architecture_BackWall_Right", (0.55, 2.62, 1.58), (4.45, 0.20, 3.08), mats["wall"], arch, bevel=0.035)
    add_box("Architecture_BackWall_BelowWindow", (-1.72, 2.62, 0.55), (0.95, 0.20, 1.02), mats["wall"], arch, bevel=0.02)
    add_box("Architecture_BackWall_AboveWindow", (-1.72, 2.62, 2.72), (0.95, 0.20, 0.80), mats["wall"], arch, bevel=0.02)
    add_box("Architecture_LeftWall", (-3.07, 0, 1.58), (0.20, 5.25, 3.08), mats["wall_shadow"], arch, bevel=0.035)
    add_box("Architecture_BackBaseboard", (0, 2.48, 0.29), (6.05, 0.10, 0.22), mats["trim"], arch, bevel=0.025)
    add_box("Architecture_LeftBaseboard", (-2.93, 0, 0.29), (0.10, 5.05, 0.22), mats["trim"], arch, bevel=0.025)

    # Window, sill, mullions and curtains.
    add_box("Architecture_WindowGlass", (-1.72, 2.60, 1.88), (0.88, 0.045, 1.23), mats["sky"], arch, bevel=0.01)
    add_box("Architecture_WindowFrame_Top", (-1.72, 2.50, 2.54), (1.08, 0.12, 0.09), mats["white"], arch, bevel=0.018)
    add_box("Architecture_WindowFrame_Bottom", (-1.72, 2.50, 1.22), (1.08, 0.12, 0.09), mats["white"], arch, bevel=0.018)
    add_box("Architecture_WindowFrame_Left", (-2.24, 2.50, 1.88), (0.09, 0.12, 1.40), mats["white"], arch, bevel=0.018)
    add_box("Architecture_WindowFrame_Right", (-1.20, 2.50, 1.88), (0.09, 0.12, 1.40), mats["white"], arch, bevel=0.018)
    add_box("Architecture_WindowMullion", (-1.72, 2.47, 1.88), (0.055, 0.13, 1.27), mats["white"], arch, bevel=0.012)
    add_box("Architecture_WindowSill", (-1.72, 2.39, 1.17), (1.20, 0.34, 0.09), mats["trim"], arch, bevel=0.022)
    add_box("Decor_CurtainRod", (-1.72, 2.39, 2.72), (2.05, 0.07, 0.07), mats["metal"], decor, bevel=0.02)
    add_curtain("Decor_Curtain_Left", -2.38, 0.48, mats["pink_light"], decor)
    add_curtain("Decor_Curtain_Right", -1.05, 0.48, mats["pink_light"], decor)

    # Bed with slatted headboard, mattress, wavy duvet, throw and pillows.
    add_box("Bed_Frame", (-1.78, 0.15, 0.47), (1.58, 2.55, 0.30), mats["oak"], bed, bevel=0.08, segments=3)
    add_box("Bed_Mattress", (-1.78, 0.02, 0.70), (1.48, 2.31, 0.28), mats["linen"], bed, bevel=0.12, segments=4)
    add_box("Bed_Headboard", (-1.78, 1.37, 1.05), (1.63, 0.16, 1.10), mats["oak_light"], bed, bevel=0.055)
    for index in range(6):
        add_box(f"Detail_HeadboardSlat_{index}", (-2.40 + index * 0.25, 1.275, 1.05), (0.065, 0.04, 0.92), mats["oak_dark"], bed, bevel=0.014)
    add_cloth("Bed_Duvet", (-1.78, -0.22, 0.96), 1.54, 1.78, mats["linen"], bed, wave=0.022, edge_drop=0.13)
    add_cloth("Bed_PinkThrow", (-1.78, -0.86, 1.02), 1.56, 0.56, mats["pink"], bed, segments_x=12, segments_y=7, wave=0.032, edge_drop=0.15)
    add_box("Bed_Pillow_Back", (-1.98, 0.84, 1.02), (0.78, 0.48, 0.26), mats["linen_shadow"], bed, rotation=(0.08, 0, -0.05), bevel=0.13, segments=4)
    add_box("Bed_Pillow_Front", (-1.55, 0.75, 1.08), (0.72, 0.44, 0.25), mats["linen"], bed, rotation=(0.06, 0, 0.08), bevel=0.13, segments=4)
    add_box("Bed_Cushion", (-1.76, 0.63, 1.16), (0.40, 0.30, 0.29), mats["pink_dark"], bed, rotation=(0.08, 0, -0.08), bevel=0.10, segments=4)

    # Nightstand and warm lamp.
    add_box("Storage_Nightstand", (-2.64, 1.17, 0.62), (0.58, 0.58, 0.72), mats["oak_light"], storage, bevel=0.045)
    add_box("Storage_NightstandDrawer", (-2.64, 0.868, 0.68), (0.46, 0.035, 0.22), mats["oak"], storage, bevel=0.012)
    add_sphere("Detail_NightstandKnob", (-2.64, 0.838, 0.68), (0.035, 0.025, 0.035), mats["metal"], storage, segments=8, rings=6)
    add_cylinder("Decor_LampBase", (-2.64, 1.12, 1.04), 0.17, 0.08, mats["gold"], decor, rotation=(0, 0, 0), vertices=16)
    add_cylinder("Decor_LampStem", (-2.64, 1.12, 1.28), 0.025, 0.42, mats["gold"], decor, rotation=(0, 0, 0), vertices=10)
    add_cylinder("Decor_LampShade", (-2.64, 1.12, 1.48), 0.23, 0.30, mats["cream"], decor, rotation=(0, 0, 0), vertices=16)
    add_cylinder("Decor_LampGlow", (-2.64, 1.12, 1.46), 0.11, 0.14, mats["led"], decor, rotation=(0, 0, 0), vertices=12)

    # Desk, drawers and organized work surface.
    add_box("Desk_Worktop", (1.30, 2.05, 0.98), (2.35, 0.80, 0.14), mats["oak_light"], desk, bevel=0.055)
    add_box("Desk_LeftDrawerUnit", (0.35, 2.05, 0.58), (0.52, 0.66, 0.74), mats["pink_light"], desk, bevel=0.045)
    for index in range(3):
        add_box(f"Desk_Drawer_{index}", (0.35, 1.704, 0.39 + index * 0.23), (0.42, 0.035, 0.18), mats["pink"], desk, bevel=0.012)
        add_box(f"Desk_DrawerHandle_{index}", (0.35, 1.675, 0.39 + index * 0.23), (0.16, 0.026, 0.026), mats["gold"], desk, bevel=0.008)
    for x in (1.05, 2.15):
        add_box(f"Desk_Leg_{x}", (x, 2.10, 0.55), (0.10, 0.58, 0.84), mats["oak"], desk, bevel=0.025)

    # Monitor, keyboard, notebook, cup and desk lamp.
    add_box("Desk_MonitorStand", (1.18, 2.00, 1.22), (0.10, 0.18, 0.34), mats["metal"], desk, bevel=0.025)
    add_box("Desk_MonitorBase", (1.18, 1.93, 1.05), (0.43, 0.30, 0.055), mats["metal"], desk, bevel=0.025)
    add_box("Desk_MonitorFrame", (1.18, 1.96, 1.58), (1.02, 0.12, 0.66), mats["black"], desk, bevel=0.055)
    add_box("Desk_MonitorScreen", (1.18, 1.892, 1.58), (0.88, 0.025, 0.53), mats["screen_glow"], desk, bevel=0.032)
    for index, (width, z, color) in enumerate(((0.50, 1.70, mats["white"]), (0.68, 1.59, mats["sage_light"]), (0.40, 1.48, mats["pink_light"]))):
        add_box(f"Detail_MonitorUI_{index}", (1.18, 1.873, z), (width, 0.014, 0.035), color, desk, bevel=0.006)
    add_box("Desk_Keyboard", (1.22, 1.58, 1.08), (0.68, 0.30, 0.055), mats["cream"], desk, rotation=(0.07, 0, 0), bevel=0.025)
    for row in range(3):
        for col in range(8):
            add_box(f"Detail_Key_{row}_{col}", (0.94 + col * 0.08, 1.48 + row * 0.07, 1.12 + row * 0.002), (0.055, 0.045, 0.014), mats["white"], desk, bevel=0.004, segments=1)
    add_box("Desk_Notebook", (2.02, 1.68, 1.07), (0.40, 0.30, 0.045), mats["pink"], desk, rotation=(0, 0, -0.12), bevel=0.015)
    add_cylinder("Desk_PencilCup", (2.26, 2.00, 1.22), 0.10, 0.26, mats["cream"], desk, rotation=(0, 0, 0), vertices=12)
    for index, color in enumerate((mats["pink_dark"], mats["sage"], mats["gold"])):
        add_box(f"Desk_Pencil_{index}", (2.21 + index * 0.045, 2.00, 1.43 + index * 0.03), (0.025, 0.025, 0.34), color, desk, rotation=(0.0, 0.08 * (index - 1), 0), bevel=0.005)
    add_cylinder("Desk_LampBase", (2.30, 2.13, 1.08), 0.14, 0.05, mats["metal"], desk, rotation=(0, 0, 0), vertices=12)
    add_box("Desk_LampArm", (2.30, 2.13, 1.40), (0.05, 0.05, 0.58), mats["metal"], desk, rotation=(0.0, 0.22, 0), bevel=0.015)
    add_box("Desk_LampHead", (2.20, 2.05, 1.70), (0.32, 0.28, 0.18), mats["pink_dark"], desk, rotation=(0.15, 0, -0.12), bevel=0.06)

    # Office chair with five-star base.
    add_box("Desk_ChairSeat", (1.36, 1.17, 0.68), (0.66, 0.62, 0.17), mats["pink"], desk, bevel=0.09, segments=4)
    add_box("Desk_ChairBack", (1.36, 1.43, 1.11), (0.66, 0.18, 0.76), mats["pink_light"], desk, rotation=(-0.10, 0, 0), bevel=0.11, segments=4)
    add_cylinder("Desk_ChairStem", (1.36, 1.17, 0.40), 0.06, 0.45, mats["metal"], desk, rotation=(0, 0, 0), vertices=12)
    for index in range(5):
        angle = index * math.tau / 5
        add_box(f"Desk_ChairSpoke_{index}", (1.36 + math.cos(angle) * 0.22, 1.17 + math.sin(angle) * 0.22, 0.22), (0.48, 0.07, 0.07), mats["metal"], desk, rotation=(0, 0, angle), bevel=0.018)
        add_cylinder(f"Desk_ChairWheel_{index}", (1.36 + math.cos(angle) * 0.44, 1.17 + math.sin(angle) * 0.44, 0.18), 0.06, 0.055, mats["black"], desk, rotation=(math.pi / 2, 0, angle), vertices=10)

    # Tall open shelving with books, storage boxes, trophies and plants.
    add_box("Storage_BookcaseBack", (2.30, 1.15, 1.48), (1.20, 0.13, 2.50), mats["oak_dark"], storage, bevel=0.025)
    for x in (1.75, 2.85):
        add_box(f"Storage_BookcaseSide_{x}", (x, 0.85, 1.48), (0.13, 0.60, 2.50), mats["oak"], storage, bevel=0.025)
    for index, z in enumerate((0.30, 0.78, 1.26, 1.74, 2.22, 2.68)):
        add_box(f"Storage_BookcaseShelf_{index}", (2.30, 0.85, z), (1.20, 0.60, 0.11), mats["oak_light"], storage, bevel=0.022)
    add_books("Storage_Books_Lower", (1.90, 0.53, 0.83), 6, mats, storage)
    add_books("Storage_Books_Middle", (1.93, 0.53, 1.31), 5, mats, storage)
    add_books("Storage_Books_Stack", (2.30, 0.73, 1.78), 3, mats, storage, vertical=False)
    add_box("Storage_Box", (2.30, 0.82, 0.53), (0.72, 0.45, 0.28), mats["pink_dark"], storage, bevel=0.045)
    add_box("Storage_BoxHandle", (2.30, 0.575, 0.54), (0.18, 0.025, 0.055), mats["cream"], storage, bevel=0.012)

    # Trophy reads as a premium collectible at room scale.
    add_cylinder("Decor_TrophyCup", (2.30, 0.78, 2.43), 0.15, 0.24, mats["gold"], decor, rotation=(0, 0, 0), vertices=16)
    add_cylinder("Decor_TrophyStem", (2.30, 0.78, 2.25), 0.035, 0.22, mats["gold"], decor, rotation=(0, 0, 0), vertices=10)
    add_box("Decor_TrophyBase", (2.30, 0.78, 2.11), (0.30, 0.26, 0.12), mats["oak_dark"], decor, bevel=0.025)
    for side in (-1, 1):
        add_box(f"Decor_TrophyHandle_{side}", (2.30 + side * 0.18, 0.78, 2.45), (0.12, 0.05, 0.16), mats["gold"], decor, rotation=(0, 0, side * 0.35), bevel=0.018)

    # Floating shelf and curated personal objects.
    add_box("Storage_FloatingShelf", (0.58, 2.43, 2.35), (2.25, 0.32, 0.11), mats["oak_light"], storage, bevel=0.025)
    add_books("Decor_FloatingBooks", (-0.32, 2.22, 2.42), 6, mats, decor)
    add_plant("Decor_ShelfPlant", (1.26, 2.22, 2.38), 0.56, mats, decor)
    add_box("Decor_PhotoFrame", (0.62, 2.22, 2.55), (0.42, 0.10, 0.38), mats["pink_dark"], decor, bevel=0.035)
    add_box("Decor_Photo", (0.62, 2.16, 2.55), (0.32, 0.015, 0.28), mats["screen_light"], decor, bevel=0.012)

    # Wall art, corkboard and clock use layered geometry for readable depth.
    add_box("Decor_PosterFrame", (-2.94, -0.38, 1.93), (0.05, 1.02, 0.82), mats["oak"], decor, bevel=0.025)
    add_box("Decor_PosterArt", (-2.905, -0.38, 1.93), (0.018, 0.87, 0.67), mats["screen_light"], decor, bevel=0.012)
    for index, (y, z, color) in enumerate(((-0.62, 2.08, mats["pink"]), (-0.30, 1.92, mats["sage"]), (-0.02, 1.78, mats["cream"]))):
        add_box(f"Detail_PosterShape_{index}", (-2.89, y, z), (0.015, 0.28, 0.18), color, decor, bevel=0.025)
    add_box("Decor_Corkboard", (2.14, 2.50, 2.07), (1.05, 0.08, 0.72), mats["oak"], decor, bevel=0.04)
    for index, (x, z, color) in enumerate(((1.83, 2.23, mats["paper"]), (2.15, 2.10, mats["pink_light"]), (2.41, 2.28, mats["sage_light"]), (2.01, 1.91, mats["cream"]))):
        add_box(f"Decor_CorkNote_{index}", (x, 2.445, z), (0.24, 0.018, 0.17), color, decor, rotation=(0, 0, 0.06 * (index - 1)), bevel=0.008)
        add_sphere(f"Decor_Pin_{index}", (x, 2.425, z + 0.055), (0.022, 0.012, 0.022), mats["pink_dark"], decor, segments=8, rings=5)
    add_cylinder("Decor_ClockFace", (-2.92, -1.55, 2.38), 0.30, 0.06, mats["cream"], decor, rotation=(0, math.pi / 2, 0), vertices=32)
    add_cylinder("Decor_ClockRim", (-2.885, -1.55, 2.38), 0.32, 0.035, mats["oak_dark"], decor, rotation=(0, math.pi / 2, 0), vertices=32)
    add_box("Decor_ClockHandHour", (-2.86, -1.48, 2.42), (0.018, 0.16, 0.025), mats["ink"], decor, rotation=(0, math.pi / 2, -0.55), bevel=0.006)
    add_box("Decor_ClockHandMinute", (-2.85, -1.47, 2.30), (0.018, 0.25, 0.025), mats["ink"], decor, rotation=(0, math.pi / 2, 0.16), bevel=0.006)

    # Round rug and lounge corner.
    add_cylinder("Decor_RugOuter", (0.35, -0.72, 0.20), 1.30, 0.055, mats["pink_light"], decor, rotation=(0, 0, 0), vertices=64)
    add_cylinder("Decor_RugMiddle", (0.35, -0.72, 0.232), 1.03, 0.028, mats["cream"], decor, rotation=(0, 0, 0), vertices=64)
    add_cylinder("Decor_RugInner", (0.35, -0.72, 0.25), 0.72, 0.022, mats["pink"], decor, rotation=(0, 0, 0), vertices=64)
    add_cylinder("Decor_Pouf", (-2.13, -1.64, 0.46), 0.58, 0.54, mats["pink"], decor, rotation=(0, 0, 0), vertices=20)
    for index in range(12):
        angle = index * math.tau / 12
        add_box(f"Detail_PoufSeam_{index}", (-2.13 + math.cos(angle) * 0.43, -1.64 + math.sin(angle) * 0.43, 0.48), (0.025, 0.025, 0.38), mats["pink_dark"], decor, rotation=(0, 0, angle), bevel=0.006)
    add_box("Decor_SideTableTop", (-1.24, -1.55, 0.62), (0.68, 0.60, 0.10), mats["oak_light"], decor, bevel=0.055)
    for x in (-1.49, -0.99):
        add_box(f"Decor_SideTableLeg_{x}", (x, -1.55, 0.39), (0.08, 0.46, 0.46), mats["oak"], decor, bevel=0.018)
    add_books("Decor_TableBooks", (-1.26, -1.56, 0.72), 3, mats, decor, vertical=False)
    add_cylinder("Decor_TableMug", (-0.99, -1.70, 0.78), 0.09, 0.17, mats["cream"], decor, rotation=(0, 0, 0), vertices=12)

    # Larger floor plants and a compact backpack near the desk.
    add_plant("Decor_FloorPlant", (2.31, -1.87, 0.20), 1.12, mats, decor)
    add_plant("Decor_WindowPlant", (-1.72, 2.28, 1.23), 0.48, mats, decor)
    add_box("Decor_BackpackMain", (2.37, 0.04, 0.58), (0.58, 0.34, 0.72), mats["pink_dark"], decor, rotation=(0.02, 0, -0.05), bevel=0.11, segments=4)
    add_box("Decor_BackpackPocket", (2.37, -0.15, 0.48), (0.42, 0.10, 0.25), mats["pink"], decor, bevel=0.055)
    add_box("Decor_BackpackZip", (2.37, -0.21, 0.68), (0.35, 0.02, 0.025), mats["gold"], decor, bevel=0.006)

    # Guitar and skateboard make the room feel inhabited by a teenager.
    add_sphere("Decor_GuitarBodyLower", (-2.76, -1.26, 0.73), (0.25, 0.13, 0.34), mats["oak_light"], decor, segments=14, rings=8)
    add_sphere("Decor_GuitarBodyUpper", (-2.76, -1.26, 1.00), (0.20, 0.11, 0.27), mats["oak_light"], decor, segments=14, rings=8)
    add_cylinder("Decor_GuitarSoundhole", (-2.76, -1.405, 0.91), 0.085, 0.02, mats["oak_dark"], decor, rotation=(math.pi / 2, 0, 0), vertices=16)
    add_box("Decor_GuitarNeck", (-2.76, -1.26, 1.42), (0.10, 0.10, 0.80), mats["oak_dark"], decor, rotation=(0, 0, -0.04), bevel=0.022)
    add_box("Decor_GuitarHead", (-2.79, -1.26, 1.85), (0.17, 0.12, 0.25), mats["oak_dark"], decor, rotation=(0, 0, -0.08), bevel=0.035)
    add_box("Decor_SkateDeck", (-2.86, 0.16, 1.00), (0.10, 0.34, 1.08), mats["sage"], decor, rotation=(0, -0.10, 0.05), bevel=0.05, segments=3)
    for z in (0.65, 1.35):
        for y in (0.02, 0.28):
            add_cylinder(f"Decor_SkateWheel_{z}_{y}", (-2.75, y, z), 0.065, 0.05, mats["pink"], decor, rotation=(0, math.pi / 2, 0), vertices=10)

    # Warm LED line and bulbs, represented as emissive geometry in the GLB.
    add_box("Decor_LED_BackWall", (0.70, 2.45, 2.91), (4.46, 0.035, 0.035), mats["led"], decor, bevel=0.012)
    add_box("Decor_LED_LeftWall", (-2.90, 0.20, 2.91), (0.035, 4.42, 0.035), mats["led"], decor, bevel=0.012)
    for index in range(10):
        add_sphere(f"Decor_StringBulb_{index}", (-2.84, -2.0 + index * 0.43, 2.66 + 0.08 * math.sin(index * 0.9)), (0.045, 0.045, 0.055), mats["led"], decor, segments=8, rings=5)

    # Deliberately empty zone for avatar placement and interaction.
    root["avatar_anchor"] = [0.65, -0.42, 0.20]
    root["camera_target"] = [0.0, 0.15, 1.20]
    root["room_theme"] = "cozy_modern"
    root["asset_version"] = 1
    root["style"] = "premium_stylized_voxel"
    root["units"] = "meters"

    # Warm architectural lighting for the review render.
    lights = collections["LIGHTING"]
    bpy.ops.object.light_add(type="AREA", location=(1.4, -2.8, 5.8))
    key = bpy.context.object
    key.name = "Light_Key"
    key.data.energy = 1250
    key.data.shape = "DISK"
    key.data.size = 5.0
    key.data.color = (1.0, 0.78, 0.62)
    look_at(key, (0, 0.2, 0.8))
    move_to_collection(key, lights)
    bpy.ops.object.light_add(type="AREA", location=(-4.6, -2.0, 3.8))
    fill = bpy.context.object
    fill.name = "Light_Fill"
    fill.data.energy = 900
    fill.data.size = 4.0
    fill.data.color = (0.68, 0.82, 1.0)
    look_at(fill, (-0.5, 0.3, 1.0))
    move_to_collection(fill, lights)
    bpy.ops.object.light_add(type="AREA", location=(2.0, 2.0, 4.8))
    rim = bpy.context.object
    rim.name = "Light_WindowBounce"
    rim.data.energy = 1050
    rim.data.size = 3.0
    rim.data.color = (0.72, 0.90, 1.0)
    look_at(rim, (-0.6, 0.4, 1.2))
    move_to_collection(rim, lights)
    bpy.ops.object.light_add(type="POINT", location=(-2.64, 1.02, 1.55))
    lamp_light = bpy.context.object
    lamp_light.name = "Light_BedsideLamp"
    lamp_light.data.energy = 115
    lamp_light.data.color = (1.0, 0.52, 0.26)
    lamp_light.data.shadow_soft_size = 0.55
    move_to_collection(lamp_light, lights)

    studio = collections["STUDIO_PREVIEW"]
    studio_floor = material("MAT_STUDIO", "#EDE8E3", roughness=0.92)
    add_box("Studio_Ground", (0, 0, -0.18), (11, 11, 0.15), studio_floor, studio, bevel=0.04)
    bpy.ops.object.camera_add(location=(8.1, -9.4, 7.4))
    camera = bpy.context.object
    camera.name = "Camera_Isometric_Cozy"
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 7.7
    look_at(camera, (0, 0.15, 1.15))
    move_to_collection(camera, studio)
    scene.camera = camera
    scene.render.filepath = str(PREVIEW_PATH)
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = rgba("#E8E4E1")
    background.inputs["Strength"].default_value = 0.72
    return {"root": root, "collections": collections}


def save_and_export(built: dict[str, object]) -> None:
    scene = bpy.context.scene
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH), compress=True)
    bpy.ops.render.render(write_still=True)

    export_collections = ("ARCHITECTURE", "BED", "DESK", "STORAGE", "DECOR")
    export_meshes = optimize_export_meshes(export_collections)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in export_meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = export_meshes[0]
    bpy.ops.export_scene.gltf(
        filepath=str(GLB_PATH),
        export_format="GLB",
        use_selection=True,
        export_animations=False,
        export_extras=True,
        export_apply=True,
        export_yup=True,
    )
    report = {
        "room": "Cozy moderno",
        "style": "premium stylized voxel",
        "source": os.fspath(BLEND_PATH.relative_to(ROOT)),
        "export": os.fspath(GLB_PATH.relative_to(ROOT)),
        "preview": os.fspath(PREVIEW_PATH.relative_to(ROOT)),
        "sourceCollections": ["ARCHITECTURE", "BED", "DESK", "STORAGE", "DECOR", "LIGHTING"],
        "optimizedMeshObjects": len(export_meshes),
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
