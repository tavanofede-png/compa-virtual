from __future__ import annotations

import json
import math
import os
import random
import sys
from dataclasses import dataclass
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))

from build_harper import (
    ROOT,
    add_box,
    add_cylinder,
    add_frustum,
    add_sphere,
    inspect_glb,
    look_at,
    material,
    move_to_collection,
    optimize_export_meshes,
    parent_to_bone,
    rgba,
)


SOURCE_DIR = ROOT / "packages" / "assets" / "3d" / "source"
PREVIEW_DIR = ROOT / "packages" / "assets" / "3d" / "previews"
EXPORT_DIR = ROOT / "packages" / "assets" / "3d"
MANIFEST_PATH = EXPORT_DIR / "companion-collection.json"
LINEUP_PATH = PREVIEW_DIR / "companion-collection-premium.png"

SLOTS = (
    "body",
    "hair",
    "face_accessory",
    "top",
    "bottom",
    "shoes",
    "back",
    "hand_prop",
)


@dataclass(frozen=True)
class Character:
    id: str
    name: str
    personality: str
    height: float
    skin: str
    skin_light: str
    skin_shadow: str
    blush: str
    hair: str
    hair_mid: str
    hair_light: str
    hair_style: str
    top_style: str
    top: str
    top_light: str
    top_dark: str
    bottom_style: str
    bottom: str
    bottom_dark: str
    shoes: str
    accent: str
    accessory: str = "none"


CHARACTERS = (
    Character("nova", "Nova", "Calma", 1.66, "#D79A74", "#E8B18C", "#B96F54", "#D97972", "#2A2025", "#3C2B31", "#5A3B42", "long", "cardigan", "#89A7C9", "#AEC3DA", "#667F9F", "wide_jeans", "#88A3C3", "#657D9D", "#E9E6DE", "#95BFD2"),
    Character("jay", "Jay", "Motivador", 1.76, "#8E5035", "#A96848", "#663522", "#9C5B50", "#21181B", "#352326", "#513438", "curls", "varsity", "#A7433C", "#D96757", "#762C2B", "cargo", "#302E34", "#1F1E22", "#E8E1D7", "#D94F3D"),
    Character("milo", "Milo", "Divertido", 1.72, "#D18B60", "#E5AA7E", "#AB6545", "#D77D6C", "#4A2D24", "#65402D", "#865638", "messy", "hoodie", "#E6DED1", "#F5EEE5", "#C8BCAF", "cargo", "#3A3432", "#262222", "#E3A736", "#E3A736", "cap"),
    Character("zoe", "Zoe", "Curiosa", 1.64, "#9D5E42", "#B97857", "#75402E", "#A76358", "#38232A", "#513039", "#70434C", "bun", "hoodie", "#8B63B6", "#A982D0", "#67458C", "cargo", "#D8CBB7", "#AC9B83", "#E9E3D9", "#8B63B6", "round_glasses"),
    Character("sky", "Sky", "Creativa", 1.69, "#E2A17D", "#F0B995", "#BE7658", "#DF807A", "#D95B8E", "#E978A4", "#F29ABE", "long", "hoodie", "#29272F", "#3D3945", "#19181D", "cargo", "#312F36", "#201F24", "#E65A9A", "#E65A9A", "beanie"),
    Character("harper", "Harper", "Organizado", 1.74, "#EBA075", "#F5B88E", "#C96F50", "#E88172", "#21191F", "#35272F", "#4A343B", "tousled", "sweater", "#315D4B", "#426F5B", "#234538", "trousers", "#CDBB9A", "#A58E6C", "#28201C", "#4E8A5B", "square_glasses"),
    Character("river", "River", "Relajado", 1.78, "#C77B52", "#DB9569", "#9E563A", "#CC6B5E", "#5A382A", "#724937", "#956248", "locs", "hoodie", "#5C78B0", "#7894CA", "#405987", "cargo", "#2D3038", "#1D2026", "#E8E5DF", "#5B7EB7", "headphones"),
    Character("aria", "Aria", "Energética", 1.68, "#7A402E", "#96543D", "#54291F", "#934E49", "#321B20", "#4C252A", "#6B3137", "ponytail", "cropped_jacket", "#28252B", "#413A43", "#17161A", "cargo", "#B93635", "#812424", "#F1ECE4", "#E2453D", "hoops"),
)


def reset_scene() -> bpy.types.Scene:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in list(bpy.data.collections):
        bpy.data.collections.remove(collection)
    # Keep every master self-contained: no meshes, materials or animation clips
    # from a previously generated companion may leak into the next export.
    for datablocks in (
        bpy.data.actions,
        bpy.data.armatures,
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.cameras,
        bpy.data.lights,
        bpy.data.materials,
    ):
        for datablock in list(datablocks):
            datablocks.remove(datablock)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 900
    scene.render.resolution_y = 1120
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = rgba("#E9E5DF")
    bg.inputs["Strength"].default_value = 0.52
    return scene


def make_palette(c: Character) -> dict[str, bpy.types.Material]:
    colors = {
        "skin": c.skin,
        "skin_light": c.skin_light,
        "skin_shadow": c.skin_shadow,
        "blush": c.blush,
        "hair": c.hair,
        "hair_mid": c.hair_mid,
        "hair_light": c.hair_light,
        "top": c.top,
        "top_light": c.top_light,
        "top_dark": c.top_dark,
        "bottom": c.bottom,
        "bottom_dark": c.bottom_dark,
        "shoes": c.shoes,
        "accent": c.accent,
        "white": "#F6F2EA",
        "eye_white": "#FCFAF5",
        "eye": "#4A3025",
        "eye_dark": "#141216",
        "metal": "#9A9188",
        "black": "#18171B",
        "sole": "#D5CEC2",
        "backpack": "#29262C",
        "book": "#6077A2",
        "paper": "#EEE6D8",
    }
    mats = {key: material(f"MAT_{c.id.upper()}_{key.upper()}", value) for key, value in colors.items()}
    mats["eye_white"].node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.18
    mats["metal"].node_tree.nodes["Principled BSDF"].inputs["Metallic"].default_value = 0.55
    return mats


def create_rig(c: Character, collection: bpy.types.Collection) -> bpy.types.Object:
    arm_data = bpy.data.armatures.new(f"CompaRig_{c.id}")
    rig = bpy.data.objects.new(f"RIG_{c.name}", arm_data)
    collection.objects.link(rig)
    rig.show_in_front = True
    rig["compa_character_id"] = c.id
    rig["compa_schema"] = "compa-humanoid-v2"
    rig["compa_height_m"] = c.height
    rig["compa_slots"] = ",".join(SLOTS)
    rig["compa_clothing_clearance_m"] = 0.012
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")

    def bone(name, head, tail, parent=None):
        item = arm_data.edit_bones.new(name)
        item.head, item.tail = head, tail
        if parent:
            item.parent = arm_data.edit_bones[parent]
        return item

    bone("root", (0, 0, 0), (0, 0, 0.12))
    bone("hips", (0, 0, 0.72), (0, 0, 0.88), "root")
    bone("spine", (0, 0, 0.88), (0, 0, 1.26), "hips")
    bone("neck", (0, 0, 1.26), (0, 0, 1.36), "spine")
    bone("head", (0, 0, 1.36), (0, 0, 1.70), "neck")
    bone("upper_arm.L", (-0.23, 0, 1.23), (-0.38, 0, 0.98), "spine")
    bone("forearm.L", (-0.38, 0, 0.98), (-0.41, -0.02, 0.75), "upper_arm.L")
    bone("hand.L", (-0.41, -0.02, 0.75), (-0.41, -0.04, 0.64), "forearm.L")
    bone("upper_arm.R", (0.23, 0, 1.23), (0.38, 0, 0.98), "spine")
    bone("forearm.R", (0.38, 0, 0.98), (0.41, -0.02, 0.75), "upper_arm.R")
    bone("hand.R", (0.41, -0.02, 0.75), (0.41, -0.04, 0.64), "forearm.R")
    bone("thigh.L", (-0.135, 0, 0.78), (-0.135, 0, 0.43), "hips")
    bone("shin.L", (-0.135, 0, 0.43), (-0.135, 0, 0.12), "thigh.L")
    bone("foot.L", (-0.135, 0, 0.12), (-0.135, -0.19, 0.07), "shin.L")
    bone("thigh.R", (0.135, 0, 0.78), (0.135, 0, 0.43), "hips")
    bone("shin.R", (0.135, 0, 0.43), (0.135, 0, 0.12), "thigh.R")
    bone("foot.R", (0.135, 0, 0.12), (0.135, -0.19, 0.07), "shin.R")
    bpy.ops.object.mode_set(mode="OBJECT")
    rig.scale = (c.height / 1.75,) * 3
    return rig


def build_character(c: Character) -> dict[str, object]:
    scene = reset_scene()
    root = bpy.data.collections.new(f"COMPA_{c.id.upper()}_MASTER")
    scene.collection.children.link(root)
    collections: dict[str, bpy.types.Collection] = {}
    for slot in (*SLOTS, "rig"):
        coll = bpy.data.collections.new(f"SLOT_{slot.upper()}")
        root.children.link(coll)
        collections[slot] = coll
    mats = make_palette(c)
    rig = create_rig(c, collections["rig"])
    parts: dict[str, list[bpy.types.Object]] = {}

    def attach(slot: str, bone: str, obj: bpy.types.Object, item: str = "base"):
        obj["compa_slot"] = slot
        obj["compa_item"] = item
        obj["compa_rig"] = "compa-humanoid-v2"
        parts.setdefault(bone, []).append(obj)
        return obj

    def box(slot, bone, name, loc, dims, mat, rotation=(0, 0, 0), bevel=0.018, item="base"):
        return attach(slot, bone, add_box(name, loc, dims, mat, collections[slot], rotation=rotation, bevel=bevel, segments=2), item)

    def sphere(slot, bone, name, loc, scale, mat, item="base"):
        return attach(slot, bone, add_sphere(name, loc, scale, mat, collections[slot], segments=12, rings=8), item)

    # Neutral body shell: hands, neck and a refined stylized face remain visible with any outfit.
    box("body", "spine", "Body_Neck", (0, 0, 1.335), (0.15, 0.14, 0.17), mats["skin_shadow"], bevel=0.045)
    box("body", "head", "Body_Head", (0, 0, 1.535), (0.49, 0.40, 0.45), mats["skin"], bevel=0.105)
    box("body", "head", "Body_FacePlane", (0, -0.198, 1.515), (0.425, 0.042, 0.335), mats["skin_light"], bevel=0.075)
    box("body", "head", "Body_JawPlane", (0, -0.205, 1.395), (0.31, 0.034, 0.105), mats["skin_light"], bevel=0.048)
    for side, x in (("L", -0.267), ("R", 0.267)):
        sphere("body", "head", f"Body_Ear_{side}", (x, -0.005, 1.535), (0.062, 0.045, 0.088), mats["skin"])
        box("body", "head", f"Detail_Ear_{side}", (x + (-0.008 if side == "L" else 0.008), -0.048, 1.535), (0.025, 0.012, 0.050), mats["skin_shadow"], bevel=0.008)

    # Smaller eyes and layered lids retain expression while giving the face more believable proportions.
    for side, x in (("L", -0.128), ("R", 0.128)):
        box("body", "head", f"Face_EyeWhite_{side}", (x, -0.226, 1.555), (0.120, 0.020, 0.092), mats["eye_white"], bevel=0.027)
        box("body", "head", f"Face_Iris_{side}", (x + (0.008 if side == "L" else -0.008), -0.239, 1.553), (0.052, 0.012, 0.066), mats["eye"], bevel=0.015)
        box("body", "head", f"Face_Pupil_{side}", (x + (0.008 if side == "L" else -0.008), -0.247, 1.551), (0.025, 0.009, 0.043), mats["eye_dark"], bevel=0.008)
        box("body", "head", f"Face_Glint_{side}", (x - 0.003, -0.254, 1.575), (0.012, 0.006, 0.016), mats["eye_white"], bevel=0.003)
        box("body", "head", f"Face_UpperLid_{side}", (x, -0.242, 1.602), (0.132, 0.012, 0.018), mats["hair"], rotation=(0, 0, 0.05 if side == "L" else -0.05), bevel=0.005)
        box("body", "head", f"Face_Brow_{side}", (x, -0.228, 1.647), (0.125, 0.016, 0.024), mats["hair"], rotation=(0, 0, 0.08 if side == "L" else -0.08), bevel=0.007)
    box("body", "head", "Face_NoseBridge", (0, -0.232, 1.505), (0.030, 0.030, 0.076), mats["skin_shadow"], bevel=0.012)
    box("body", "head", "Face_NoseTip", (0, -0.248, 1.475), (0.052, 0.026, 0.034), mats["skin_shadow"], bevel=0.014)
    for side, x in (("L", -0.192), ("R", 0.192)):
        box("body", "head", f"Face_Blush_{side}", (x, -0.228, 1.468), (0.064, 0.008, 0.025), mats["blush"], bevel=0.010)
    box("body", "head", "Face_Lip", (0, -0.237, 1.414), (0.105, 0.012, 0.020), mats["skin_shadow"], bevel=0.008)
    box("body", "head", "Face_SmileHighlight", (0, -0.244, 1.421), (0.068, 0.006, 0.006), mats["white"], bevel=0.002)

    # Shared limb envelope. Garments overlap this by 12 mm, so future clothes can be swapped safely.
    for side, x in (("L", -0.135), ("R", 0.135)):
        box("body", f"thigh.{side}", f"Body_Thigh_{side}", (x, 0, 0.61), (0.16, 0.18, 0.36), mats["skin"], bevel=0.035)
        box("body", f"shin.{side}", f"Body_Shin_{side}", (x, 0, 0.29), (0.145, 0.165, 0.32), mats["skin"], bevel=0.032)
    for side, x in (("L", -0.355), ("R", 0.355)):
        box("body", f"upper_arm.{side}", f"Body_UpperArm_{side}", (x, 0, 1.09), (0.14, 0.16, 0.33), mats["skin"], rotation=(0, 0, -0.10 if side == "L" else 0.10), bevel=0.038)
        box("body", f"forearm.{side}", f"Body_Forearm_{side}", (x + (-0.035 if side == "L" else 0.035), -0.01, 0.82), (0.13, 0.15, 0.27), mats["skin"], bevel=0.035)
        box("body", f"hand.{side}", f"Body_Hand_{side}", (x + (-0.04 if side == "L" else 0.04), -0.025, 0.655), (0.14, 0.13, 0.17), mats["skin_light"], bevel=0.045)
        for finger in range(3):
            box("body", f"hand.{side}", f"Detail_Finger_{side}_{finger}", (x + (-0.04 if side == "L" else 0.04) + (finger - 1) * 0.031, -0.091, 0.635), (0.024, 0.026, 0.075), mats["skin"], bevel=0.009)

    # Bottom garments with waistband, seams, cuffs and cargo pockets.
    bottom_item = c.bottom_style
    box("bottom", "hips", "Bottom_Hips", (0, 0, 0.79), (0.39, 0.245, 0.22), mats["bottom"], bevel=0.040, item=bottom_item)
    box("bottom", "hips", "Bottom_Waistband", (0, -0.002, 0.88), (0.405, 0.252, 0.065), mats["bottom_dark"], bevel=0.015, item=bottom_item)
    leg_width = 0.205 if c.bottom_style in ("cargo", "wide_jeans") else 0.185
    for side, x in (("L", -0.125), ("R", 0.125)):
        box("bottom", f"thigh.{side}", f"Bottom_Thigh_{side}", (x, 0, 0.61), (leg_width, 0.235, 0.39), mats["bottom"], bevel=0.038, item=bottom_item)
        box("bottom", f"shin.{side}", f"Bottom_Shin_{side}", (x, 0.006, 0.31), (leg_width - 0.010, 0.225, 0.31), mats["bottom"], bevel=0.034, item=bottom_item)
        box("bottom", f"shin.{side}", f"Bottom_OuterSeam_{side}", (x + (-leg_width / 2 if side == "L" else leg_width / 2), -0.012, 0.44), (0.012, 0.155, 0.52), mats["bottom_dark"], bevel=0.003, item=bottom_item)
        box("bottom", f"shin.{side}", f"Bottom_Cuff_{side}", (x, 0.004, 0.17), (leg_width + 0.008, 0.232, 0.055), mats["bottom_dark"], bevel=0.012, item=bottom_item)
        if c.bottom_style == "cargo":
            box("bottom", f"thigh.{side}", f"Bottom_CargoPocket_{side}", (x + (-0.095 if side == "L" else 0.095), -0.002, 0.58), (0.085, 0.255, 0.16), mats["bottom_dark"], bevel=0.015, item=bottom_item)
            box("bottom", f"thigh.{side}", f"Bottom_CargoFlap_{side}", (x + (-0.098 if side == "L" else 0.098), -0.135, 0.645), (0.09, 0.022, 0.042), mats["accent"], bevel=0.006, item=bottom_item)

    # Shoes use a common ankle and sole anchor across every character.
    for side, x in (("L", -0.135), ("R", 0.135)):
        box("shoes", f"foot.{side}", f"Shoe_Main_{side}", (x, -0.035, 0.095), (0.215, 0.335, 0.16), mats["shoes"], bevel=0.045, item="sneakers")
        box("shoes", f"foot.{side}", f"Shoe_Toe_{side}", (x, -0.178, 0.078), (0.225, 0.15, 0.125), mats["top_light"], bevel=0.045, item="sneakers")
        box("shoes", f"foot.{side}", f"Shoe_Sole_{side}", (x, -0.045, 0.023), (0.228, 0.345, 0.048), mats["sole"], bevel=0.012, item="sneakers")
        for lace in range(3):
            box("shoes", f"foot.{side}", f"Shoe_Lace_{side}_{lace}", (x, -0.20 + lace * 0.035, 0.151), (0.12, 0.010, 0.010), mats["sole"], bevel=0.003, item="sneakers")

    # Top shells preserve a common arm clearance and neckline.
    top_item = c.top_style
    attach("top", "spine", add_frustum("Top_Torso", (0, 0, 1.08), (0.48, 0.29), (0.42, 0.25), 0.48, mats["top"], collections["top"], bevel=0.038), top_item)
    box("top", "spine", "Top_Hem", (0, -0.004, 0.855), (0.485, 0.292, 0.070), mats["top_dark"], bevel=0.014, item=top_item)
    for side, x in (("L", -0.315), ("R", 0.315)):
        sleeve_mat = mats["white"] if c.top_style == "varsity" else mats["top"]
        box("top", f"upper_arm.{side}", f"Top_UpperSleeve_{side}", (x, 0, 1.095), (0.19, 0.215, 0.35), sleeve_mat, rotation=(0, 0, -0.10 if side == "L" else 0.10), bevel=0.042, item=top_item)
        box("top", f"forearm.{side}", f"Top_ForeSleeve_{side}", (x + (-0.035 if side == "L" else 0.035), -0.01, 0.855), (0.17, 0.205, 0.25), sleeve_mat, bevel=0.038, item=top_item)
        box("top", f"forearm.{side}", f"Top_Cuff_{side}", (x + (-0.038 if side == "L" else 0.038), -0.01, 0.735), (0.177, 0.212, 0.065), mats["top_dark"], bevel=0.014, item=top_item)
    if c.top_style == "hoodie":
        box("top", "spine", "Top_Hood", (0, 0.155, 1.285), (0.36, 0.18, 0.26), mats["top_dark"], bevel=0.072, item=top_item)
        box("top", "spine", "Top_KangarooPocket", (0, -0.158, 1.00), (0.30, 0.035, 0.15), mats["top_light"], bevel=0.028, item=top_item)
        for side, x in (("L", -0.055), ("R", 0.055)):
            box("top", "spine", f"Top_Drawstring_{side}", (x, -0.16, 1.235), (0.015, 0.015, 0.18), mats["sole"], bevel=0.004, item=top_item)
    elif c.top_style == "sweater":
        for x in (-0.17, -0.11, -0.055, 0, 0.055, 0.11, 0.17):
            box("top", "spine", f"Top_KnitRib_{x:+.3f}", (x, -0.151, 1.08), (0.010, 0.010, 0.34), mats["top_light"], bevel=0.003, item=top_item)
        for side, x, angle in (("L", -0.075, -0.55), ("R", 0.075, 0.55)):
            box("top", "spine", f"Top_Collar_{side}", (x, -0.158, 1.305), (0.17, 0.030, 0.10), mats["white"], rotation=(0, 0, angle), bevel=0.012, item=top_item)
    elif c.top_style == "varsity":
        box("top", "spine", "Top_VarsityOpening", (0, -0.157, 1.08), (0.026, 0.018, 0.39), mats["white"], bevel=0.004, item=top_item)
        for z in (0.94, 1.07, 1.20):
            sphere("top", "spine", f"Top_Snap_{z:.2f}", (0, -0.176, z), (0.018, 0.010, 0.018), mats["metal"], item=top_item)
        box("top", "spine", "Top_LetterPatch", (-0.13, -0.177, 1.16), (0.10, 0.018, 0.14), mats["white"], bevel=0.016, item=top_item)
    elif c.top_style == "cardigan":
        box("top", "spine", "Top_CardiganOpening", (0, -0.158, 1.08), (0.030, 0.018, 0.40), mats["white"], bevel=0.005, item=top_item)
        box("top", "spine", "Top_InnerShirt", (0, -0.165, 1.13), (0.22, 0.022, 0.28), mats["white"], bevel=0.025, item=top_item)
    elif c.top_style == "cropped_jacket":
        box("top", "spine", "Top_CropPanel", (0, -0.163, 0.94), (0.32, 0.025, 0.14), mats["white"], bevel=0.022, item=top_item)
        box("top", "spine", "Top_JacketZip", (0, -0.176, 1.145), (0.022, 0.016, 0.30), mats["metal"], bevel=0.004, item=top_item)

    # Hair is built from deterministic layered clumps, with a style-specific silhouette.
    rng = random.Random(1100 + sum(ord(ch) for ch in c.id))

    def tuft(name, loc, dims, shade=0, rot=(0, 0, 0)):
        return box("hair", "head", name, loc, dims, (mats["hair"], mats["hair_mid"], mats["hair_light"])[shade % 3], rotation=rot, bevel=min(dims) * 0.25, item=c.hair_style)

    tuft("Hair_UnderCap", (0, 0.025, 1.715), (0.49, 0.37, 0.24), 0)
    for row, z in enumerate((1.66, 1.75, 1.82)):
        for col, x in enumerate((-0.20, -0.10, 0, 0.10, 0.20)):
            if row == 2 and abs(x) > 0.15:
                continue
            tuft(f"Hair_Crown_{row}_{col}", (x + rng.uniform(-0.012, 0.012), -0.06 + row * 0.035, z), (rng.uniform(0.10, 0.14), rng.uniform(0.11, 0.15), rng.uniform(0.09, 0.13)), row + col, (rng.uniform(-0.10, 0.10), rng.uniform(-0.08, 0.08), rng.uniform(-0.18, 0.18)))
    for i, (x, z) in enumerate(((-0.20, 1.69), (-0.10, 1.68), (0, 1.69), (0.10, 1.68), (0.20, 1.69))):
        tuft(f"Hair_Fringe_{i}", (x, -0.19, z), (0.13, 0.10, 0.16), i, (0, 0, (i - 2) * 0.08))
    if c.hair_style == "long":
        for side, x in (("L", -0.245), ("R", 0.245)):
            for i, z in enumerate((1.53, 1.37, 1.21, 1.05)):
                tuft(f"Hair_Long_{side}_{i}", (x, 0.055, z), (0.14, 0.17, 0.22), i, (0, 0, -0.05 if side == "L" else 0.05))
    elif c.hair_style in ("curls", "locs"):
        for side, x in (("L", -0.25), ("R", 0.25)):
            for i, z in enumerate((1.63, 1.49, 1.35)):
                dims = (0.14, 0.15, 0.15 if c.hair_style == "curls" else 0.22)
                tuft(f"Hair_{c.hair_style}_{side}_{i}", (x, 0.02, z), dims, i)
    elif c.hair_style == "bun":
        sphere("hair", "head", "Hair_Bun", (0.08, 0.09, 1.97), (0.18, 0.16, 0.18), mats["hair_mid"], item=c.hair_style)
        for angle in range(0, 360, 60):
            a = math.radians(angle)
            tuft(f"Hair_BunCurl_{angle}", (0.08 + math.cos(a) * 0.12, 0.09 + math.sin(a) * 0.09, 1.97 + math.sin(a) * 0.05), (0.09, 0.09, 0.09), angle // 60)
    elif c.hair_style == "ponytail":
        sphere("hair", "head", "Hair_PonyBase", (0.06, 0.15, 1.84), (0.18, 0.16, 0.18), mats["hair_mid"], item=c.hair_style)
        for i, z in enumerate((1.72, 1.58, 1.44)):
            tuft(f"Hair_Pony_{i}", (0.13, 0.20, z), (0.22, 0.18, 0.21), i)

    # Accessories have dedicated slots and can be removed without touching the face or hair.
    if "glasses" in c.accessory:
        round_frames = c.accessory == "round_glasses"
        for side, x in (("L", -0.128), ("R", 0.128)):
            if round_frames:
                attach("face_accessory", "head", add_cylinder(f"Glasses_Lens_{side}", (x, -0.258, 1.555), 0.076, 0.018, mats["black"], collections["face_accessory"], vertices=16), c.accessory)
                box("face_accessory", "head", f"Glasses_Cutout_{side}", (x, -0.270, 1.555), (0.105, 0.012, 0.105), mats["eye_white"], bevel=0.040, item=c.accessory)
            else:
                for suffix, loc, dims in (("T", (x, -0.267, 1.61), (0.16, 0.022, 0.022)), ("B", (x, -0.267, 1.50), (0.16, 0.022, 0.022)), ("O", (x + (-0.08 if side == "L" else 0.08), -0.267, 1.555), (0.022, 0.022, 0.13)), ("I", (x + (0.08 if side == "L" else -0.08), -0.267, 1.555), (0.022, 0.022, 0.13))):
                    box("face_accessory", "head", f"Glasses_{side}_{suffix}", loc, dims, mats["black"], bevel=0.006, item=c.accessory)
        box("face_accessory", "head", "Glasses_Bridge", (0, -0.270, 1.56), (0.09, 0.022, 0.018), mats["black"], bevel=0.005, item=c.accessory)
    if c.accessory == "headphones":
        for side, x in (("L", -0.29), ("R", 0.29)):
            sphere("face_accessory", "head", f"HeadphoneCup_{side}", (x, 0.005, 1.55), (0.07, 0.055, 0.10), mats["black"], item=c.accessory)
            sphere("face_accessory", "head", f"HeadphonePad_{side}", (x + (0.012 if side == "L" else -0.012), -0.045, 1.55), (0.055, 0.025, 0.08), mats["accent"], item=c.accessory)
        for i, x in enumerate((-0.20, -0.10, 0, 0.10, 0.20)):
            z = 1.83 + (1 - abs(x) / 0.22) * 0.07
            box("face_accessory", "head", f"HeadphoneBand_{i}", (x, 0.015, z), (0.11, 0.055, 0.045), mats["black"], bevel=0.014, item=c.accessory)
    if c.accessory in ("cap", "beanie"):
        cap_mat = mats["accent"] if c.accessory == "cap" else mats["top"]
        box("face_accessory", "head", "Headwear_Crown", (0, -0.005, 1.84), (0.48, 0.36, 0.20), cap_mat, bevel=0.070, item=c.accessory)
        if c.accessory == "cap":
            box("face_accessory", "head", "Headwear_Brim", (0, -0.245, 1.80), (0.32, 0.20, 0.045), cap_mat, bevel=0.018, item=c.accessory)
        else:
            box("face_accessory", "head", "Headwear_Rib", (0, -0.055, 1.76), (0.49, 0.37, 0.075), mats["accent"], bevel=0.018, item=c.accessory)
    if c.accessory == "hoops":
        for side, x in (("L", -0.285), ("R", 0.285)):
            attach("face_accessory", "head", add_cylinder(f"Earring_{side}", (x, -0.04, 1.45), 0.055, 0.012, mats["metal"], collections["face_accessory"], vertices=16), c.accessory)

    # Backpack is a fully independent back slot on every starter character.
    box("back", "spine", "Backpack_Main", (0, 0.205, 1.06), (0.43, 0.20, 0.52), mats["backpack"], bevel=0.065, item="classic_backpack")
    box("back", "spine", "Backpack_Pocket", (0, 0.315, 0.98), (0.31, 0.055, 0.19), mats["top_dark"], bevel=0.030, item="classic_backpack")
    box("back", "spine", "Backpack_Zip", (0, 0.347, 1.11), (0.25, 0.012, 0.012), mats["metal"], bevel=0.003, item="classic_backpack")
    for side, x in (("L", -0.17), ("R", 0.17)):
        box("back", "spine", f"Backpack_Strap_{side}", (x, -0.145, 1.11), (0.075, 0.052, 0.40), mats["top_dark"], bevel=0.018, item="classic_backpack")

    for bone_name, objects in parts.items():
        for obj in objects:
            parent_to_bone(obj, rig, bone_name)

    # Shared idle action, usable by every character and future outfit.
    scene.frame_start, scene.frame_end, scene.render.fps = 1, 96, 24
    rig.animation_data_create()
    action = bpy.data.actions.new("Idle")
    rig.animation_data.action = action
    for frame, breathe, head_turn, lift in ((1, 0, -0.015, 0), (24, 0.010, 0.008, 0.004), (48, 0, 0.022, 0), (72, -0.008, 0.005, 0.004), (96, 0, -0.015, 0)):
        rig.pose.bones["spine"].rotation_mode = "XYZ"
        rig.pose.bones["spine"].rotation_euler[0] = breathe
        rig.pose.bones["spine"].keyframe_insert(data_path="rotation_euler", frame=frame)
        rig.pose.bones["head"].rotation_mode = "XYZ"
        rig.pose.bones["head"].rotation_euler[2] = head_turn
        rig.pose.bones["head"].keyframe_insert(data_path="rotation_euler", frame=frame)
        rig.pose.bones["root"].location[2] = lift
        rig.pose.bones["root"].keyframe_insert(data_path="location", frame=frame)

    root["character_id"] = c.id
    root["display_name"] = c.name
    root["personality"] = c.personality
    root["schema"] = "compa-humanoid-v2"
    root["height_m"] = c.height
    root["room_avatar_anchor"] = "0.85,-0.42,0.20"
    root["slots"] = ",".join(SLOTS)
    root["license"] = "Original Compa Virtual production asset"

    studio = bpy.data.collections.new("STUDIO_PREVIEW")
    scene.collection.children.link(studio)
    add_box("StudioFloor", (0, 0, -0.035), (4.5, 4.5, 0.07), material("MAT_STUDIO", "#E5E0D8", 0.92), studio, bevel=0.018)
    for name, light_type, loc, energy, size, color in (
        ("Key", "AREA", (2.8, -3.5, 4.0), 850, 3.0, (1.0, 0.86, 0.74)),
        ("Fill", "AREA", (-2.4, -1.4, 2.5), 520, 2.5, (0.72, 0.83, 1.0)),
        ("Rim", "AREA", (1.2, 2.5, 3.2), 700, 2.0, (0.76, 0.86, 1.0)),
    ):
        bpy.ops.object.light_add(type=light_type, location=loc)
        light = bpy.context.object
        light.name = f"Studio{name}"
        light.data.energy, light.data.size, light.data.color = energy, size, color
        look_at(light, (0, 0, 0.92))
        move_to_collection(light, studio)
    bpy.ops.object.camera_add(location=(2.15, -4.15, 1.95))
    camera = bpy.context.object
    camera.name = "CameraCharacter"
    camera.data.lens = 68
    look_at(camera, (0, 0, 0.91))
    move_to_collection(camera, studio)
    scene.camera = camera
    return {"scene": scene, "root": root, "rig": rig, "collections": collections}


def save_character(c: Character, built: dict[str, object]) -> dict[str, object]:
    blend_path = SOURCE_DIR / f"{c.id}-master-v2.blend"
    glb_path = EXPORT_DIR / f"compa-{c.id}-premium.glb"
    preview_path = PREVIEW_DIR / f"compa-{c.id}-premium.png"
    report_path = SOURCE_DIR / f"{c.id}-master-v2.report.json"
    scene: bpy.types.Scene = built["scene"]
    rig: bpy.types.Object = built["rig"]
    scene.frame_set(1)
    scene.render.filepath = str(preview_path)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path), compress=True)
    bpy.ops.render.render(write_still=True)
    export_collections = tuple(f"SLOT_{slot.upper()}" for slot in SLOTS)
    export_meshes = optimize_export_meshes(export_collections)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in (*export_meshes, rig):
        obj.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.export_scene.gltf(filepath=str(glb_path), export_format="GLB", use_selection=True, export_animations=True, export_extras=True, export_apply=True, export_yup=True)
    metrics = inspect_glb(glb_path)
    report = {
        "character": c.name,
        "id": c.id,
        "personality": c.personality,
        "schema": "compa-humanoid-v2",
        "heightMeters": c.height,
        "slots": list(SLOTS),
        "source": os.fspath(blend_path.relative_to(ROOT)),
        "export": os.fspath(glb_path.relative_to(ROOT)),
        "preview": os.fspath(preview_path.relative_to(ROOT)),
        "bones": len(rig.data.bones),
        "animations": [action.name for action in bpy.data.actions],
        "glbBytes": glb_path.stat().st_size,
        "blendBytes": blend_path.stat().st_size,
        "blenderVersion": bpy.app.version_string,
        **metrics,
    }
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    return report


def render_lineup(reports: list[dict[str, object]]) -> None:
    scene = reset_scene()
    scene.render.resolution_x, scene.render.resolution_y = 2200, 920
    imported_roots: list[bpy.types.Object] = []
    for index, report in enumerate(reports):
        before = set(bpy.context.scene.objects)
        bpy.ops.import_scene.gltf(filepath=str(ROOT / str(report["export"])))
        imported = [obj for obj in bpy.context.scene.objects if obj not in before]
        x = (index - 3.5) * 0.74
        for obj in imported:
            if obj.parent is None:
                obj.location.x += x
        imported_roots.extend(imported)
    studio = bpy.data.collections.new("COLLECTION_PREVIEW")
    scene.collection.children.link(studio)
    add_box("LineupFloor", (0, 0, -0.04), (8.5, 4.0, 0.08), material("MAT_LINEUP_FLOOR", "#E8E3DB", 0.92), studio, bevel=0.015)
    for name, loc, energy, size, color in (
        ("LineupKey", (4.5, -5.5, 5.0), 1550, 5.0, (1.0, 0.87, 0.76)),
        ("LineupFill", (-4.0, -2.0, 3.2), 1050, 4.0, (0.73, 0.84, 1.0)),
        ("LineupRim", (0, 4.0, 4.5), 1250, 5.0, (0.80, 0.88, 1.0)),
    ):
        bpy.ops.object.light_add(type="AREA", location=loc)
        light = bpy.context.object
        light.name, light.data.energy, light.data.size, light.data.color = name, energy, size, color
        look_at(light, (0, 0, 0.9))
        move_to_collection(light, studio)
    bpy.ops.object.camera_add(location=(5.3, -11.8, 2.9))
    camera = bpy.context.object
    camera.name = "CameraLineup"
    camera.data.lens = 72
    look_at(camera, (0, 0, 0.88))
    move_to_collection(camera, studio)
    scene.camera = camera
    scene.render.filepath = str(LINEUP_PATH)
    bpy.ops.render.render(write_still=True)


def main() -> None:
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    requested = None
    if "--" in sys.argv:
        args = sys.argv[sys.argv.index("--") + 1 :]
        if args:
            requested = args[0].lower()
    chosen = [c for c in CHARACTERS if requested in (None, "all", c.id)]
    if not chosen:
        raise SystemExit(f"Unknown character: {requested}")
    reports = [save_character(c, build_character(c)) for c in chosen]
    existing_reports = []
    for c in CHARACTERS:
        path = SOURCE_DIR / f"{c.id}-master-v2.report.json"
        if path.exists():
            existing_reports.append(json.loads(path.read_text(encoding="utf-8")))
    manifest = {
        "schema": "compa-humanoid-v2",
        "units": "meters",
        "canonicalHeightMeters": 1.75,
        "room": {
            "file": "habitacion-cozy-premium.glb",
            "ceilingHeightMeters": 3.08,
            "avatarAnchor": [0.85, -0.42, 0.20],
        },
        "slots": list(SLOTS),
        "characters": existing_reports,
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    if len(existing_reports) == len(CHARACTERS):
        render_lineup(existing_reports)
    print(f"Generated {len(reports)} companion(s); manifest has {len(existing_reports)}")


if __name__ == "__main__":
    main()
