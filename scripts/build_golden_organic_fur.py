"""Upgrade Miel's voxel golden with organic mesh fur that ships in the GLB.

Keeps the voxel body, face, rig and clips. Replaces cube tufts with tapered
locks parented per bone. No hair particles. Run:

  blender --background --python-exit-code 1 --python scripts/build_golden_organic_fur.py
"""
from __future__ import annotations

import json
import math
import random
import shutil
import sys
from collections import defaultdict
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from build_pet_mvp import create_actions, export_selected, make_rig, mat

SOURCE = ROOT / "packages/assets/3d/source/pets"
MODELS = ROOT / "apps/web/public/selection/models"
PREVIEWS = ROOT / "apps/web/public/selection/pets"
MOBILE = ROOT / "apps/mobile/assets/selection/pets"
STAGE = ROOT / "renders/golden-organic-fur"
CLIPS = [
    "pet_idle",
    "pet_look",
    "pet_walk",
    "pet_run",
    "pet_sit_down",
    "pet_seated",
    "pet_stand_up",
    "pet_lie_down",
    "pet_rest",
    "pet_get_up",
    "pet_sniff",
    "pet_react",
    "pet_play",
    "pet_carry",
    "pet_celebrate",
]
REVISION = "voxel-organic-fur-v1"

for folder in (SOURCE, MODELS, PREVIEWS, MOBILE, STAGE):
    folder.mkdir(parents=True, exist_ok=True)


def set_bsdf(material, **values):
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    aliases = {
        "sheen": ("Sheen Weight", "Sheen"),
        "sheen_rough": ("Sheen Roughness",),
        "sss": ("Subsurface Weight", "Subsurface"),
        "sss_scale": ("Subsurface Scale",),
        "coat": ("Coat Weight", "Clearcoat"),
        "spec": ("Specular IOR Level", "Specular"),
    }
    for key, value in values.items():
        for name in aliases.get(key, (key,)):
            socket = bsdf.inputs.get(name)
            if socket is None:
                continue
            try:
                socket.default_value = value
            except Exception:
                pass
            break
    return material


def fur_mat(name, color, rough=0.58):
    material = mat(name, color, rough)
    set_bsdf(material, sheen=0.28, sheen_rough=0.52, sss=0.03, sss_scale=0.012, spec=0.22)
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    tint = bsdf.inputs.get("Sheen Tint")
    if tint is not None:
        try:
            tint.default_value = (*(min(1.0, c * 1.14) for c in color), 1)
        except Exception:
            pass
    radius = bsdf.inputs.get("Subsurface Radius")
    if radius is not None:
        try:
            radius.default_value = (1.0, 0.5, 0.2)
        except Exception:
            pass
    return material


def palette():
    return {
        "gold": fur_mat("Golden_Coat", (0.78, 0.30, 0.04), 0.56),
        "mid": fur_mat("Golden_Mid", (0.90, 0.46, 0.08), 0.55),
        "honey": fur_mat("Golden_Honey", (0.94, 0.58, 0.14), 0.53),
        "light": fur_mat("Golden_Light", (0.95, 0.70, 0.28), 0.57),
        "cream": fur_mat("Golden_Cream", (0.96, 0.82, 0.48), 0.60),
        "shadow": fur_mat("Golden_Shade", (0.32, 0.10, 0.03), 0.62),
        "white": fur_mat("Golden_Muzzle", (0.96, 0.79, 0.50), 0.58),
        "sclera": set_bsdf(mat("Golden_Sclera", (0.98, 0.91, 0.78), 0.28), spec=0.45),
        "iris": set_bsdf(mat("Golden_Iris", (0.36, 0.14, 0.035), 0.24), spec=0.55),
        "black": set_bsdf(mat("Golden_Dark", (0.035, 0.025, 0.022), 0.36), spec=0.42),
        "eye": set_bsdf(mat("Golden_Glint", (1.0, 0.94, 0.78), 0.22), spec=0.7),
        "pink": set_bsdf(mat("Golden_Tongue", (0.92, 0.31, 0.35), 0.46), spec=0.35, sss=0.12),
        "blue": mat("Pet_Bandana_Blue", (0.08, 0.25, 0.47), 0.62),
        "tag": set_bsdf(mat("Pet_Tag_Gold", (0.95, 0.62, 0.12), 0.28, 0.35), spec=0.55),
        "blush": mat("Pet_Cheek", (0.92, 0.40, 0.27), 0.7),
    }


def tag(obj):
    obj["pet_asset"] = True
    return obj


def shade_smooth(obj):
    for face in obj.data.polygons:
        face.use_smooth = True
    return obj


def parent_bone(obj, rig, bone):
    bpy.context.view_layer.update()
    world = obj.matrix_world.copy()
    obj.parent = rig
    obj.parent_type = "BONE"
    obj.parent_bone = bone
    obj.matrix_world = world
    return tag(obj)


def block(name, loc, scale, material, bevel=0.04, parent=None, bone=None, segments=4, soften=False):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    width = min(bevel, min(scale) * 0.78)
    mod = obj.modifiers.new("Soft bevel", "BEVEL")
    mod.width = width
    mod.segments = segments
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)
    if soften:
        soft = obj.modifiers.new("Coat ease", "SMOOTH")
        soft.factor = 0.55
        soft.iterations = 2
        bpy.ops.object.modifier_apply(modifier=soft.name)
    obj.data.materials.append(material)
    shade_smooth(obj)
    tag(obj)
    if parent and bone:
        parent_bone(obj, parent, bone)
    return obj


def ball(name, loc, scale, material, parent=None, bone=None, subdivisions=2):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    shade_smooth(obj)
    tag(obj)
    if parent and bone:
        parent_bone(obj, parent, bone)
    return obj


def lock(name, start, end, radius, material, *, sides=8, rings=6, droop=0.22, flatten=0.52, wave=0.0, twist=0.0):
    start, end = Vector(start), Vector(end)
    direction = end - start
    length = max(direction.length, 1e-4)
    direction.normalize()
    ref = Vector((0, 0, 1)) if abs(direction.z) < 0.9 else Vector((0, 1, 0))
    u = direction.cross(ref)
    if u.length < 1e-6:
        u = Vector((1, 0, 0))
    u.normalize()
    v = direction.cross(u).normalized()
    vertices = []
    for i in range(rings):
        t = i / (rings - 1)
        profile = 0.5 + 0.5 * math.sin(t * math.pi) ** 0.7
        if i == 0:
            profile = 0.82
        if i == rings - 1:
            profile = 0.07
        r = radius * profile * (1 - t * 0.2)
        point = start.lerp(end, t) + Vector((0, 0, -droop * length * t * t))
        if wave:
            point += u * (math.sin(t * math.pi * 2.1) * wave)
            point += v * (math.cos(t * math.pi * 1.6) * wave * 0.45)
        for k in range(sides):
            a = k * math.tau / sides + twist * t
            vertices.append(point + (math.cos(a) * r * flatten) * u + (math.sin(a) * r) * v)
    faces = [tuple(reversed(range(sides)))]
    for i in range(rings - 1):
        for k in range(sides):
            a = i * sides + k
            faces.append((a, i * sides + (k + 1) % sides, (i + 1) * sides + (k + 1) % sides, a + sides))
    faces.append(tuple(range((rings - 1) * sides, rings * sides)))
    mesh = bpy.data.meshes.new(name + "-mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    mesh.materials.append(material)
    return shade_smooth(tag(obj))


def join_objects(name, objects):
    objects = [obj for obj in objects if obj is not None]
    if not objects:
        raise RuntimeError("nothing to join for " + name)
    if len(objects) == 1:
        objects[0].name = name
        return objects[0]
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return shade_smooth(tag(obj))


class FurBuilder:
    def __init__(self, colors, seed=17):
        self.colors = colors
        self.rng = random.Random(seed)
        self.groups = defaultdict(list)
        self.count = 0

    def add(self, bone, obj):
        self.groups[bone].append(obj)
        self.count += 1
        return obj

    def tuft(self, bone, start, end, radius, material, **kwargs):
        self.count += 1
        obj = lock(f"Golden_Lock_{self.count:04d}", start, end, radius, material, **kwargs)
        self.groups[bone].append(obj)
        return obj

    def mass(self, bone, loc, scale, material, rotation=None):
        self.count += 1
        bpy.ops.mesh.primitive_uv_sphere_add(segments=14, ring_count=9, location=loc)
        obj = bpy.context.object
        obj.name = f"Golden_Mass_{self.count:04d}"
        obj.scale = scale
        if rotation:
            obj.rotation_euler = rotation
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        obj.data.materials.append(material)
        shade_smooth(obj)
        tag(obj)
        self.groups[bone].append(obj)
        return obj

    def patch(
        self,
        bone,
        origin,
        u_vec,
        v_vec,
        nu,
        nv,
        length,
        radius,
        direction,
        materials,
        *,
        droop=0.22,
        jitter=0.38,
        length_var=0.28,
        radius_var=0.22,
        flatten=0.5,
        wave=0.012,
        sides=8,
        rings=6,
        stagger=True,
        skip=None,
    ):
        origin, u_vec, v_vec = Vector(origin), Vector(u_vec), Vector(v_vec)
        direction = Vector(direction)
        if direction.length < 1e-6:
            direction = Vector((0, 0, 1))
        direction.normalize()
        for i in range(nu):
            for j in range(nv):
                su = 0.0 if nu == 1 else i / (nu - 1)
                sv = 0.0 if nv == 1 else j / (nv - 1)
                pu, pv = su * 2 - 1, sv * 2 - 1
                ju = (self.rng.random() - 0.5) * jitter
                jv = (self.rng.random() - 0.5) * jitter
                start = origin + u_vec * (pu + ju) + v_vec * (pv + jv)
                if stagger and j % 2 and nu > 1:
                    start += u_vec * (1.0 / nu)
                if skip and skip(start):
                    continue
                length_i = length * (1 + (self.rng.random() - 0.5) * length_var)
                radius_i = radius * (1 + (self.rng.random() - 0.5) * radius_var)
                tilt = Vector(
                    (
                        self.rng.random() - 0.5,
                        self.rng.random() - 0.5,
                        (self.rng.random() - 0.5) * 0.45,
                    )
                ) * 0.12
                heading = (direction + tilt).normalized()
                end = start + heading * length_i
                material = materials[(i * 3 + j + self.rng.randint(0, 2)) % len(materials)]
                self.tuft(
                    bone,
                    start,
                    end,
                    radius_i,
                    material,
                    sides=sides,
                    rings=rings,
                    droop=droop * (0.82 + 0.36 * self.rng.random()),
                    flatten=flatten * (0.88 + 0.22 * self.rng.random()),
                    wave=wave * (0.4 + self.rng.random()),
                    twist=(self.rng.random() - 0.5) * 0.7,
                )

    def finish(self, rig):
        meshes = []
        for bone, objects in self.groups.items():
            joined = join_objects("Golden_Fur_" + bone.replace(".", "_"), objects)
            bpy.context.view_layer.objects.active = joined
            joined.select_set(True)
            soft = joined.modifiers.new("Fur soften", "SMOOTH")
            soft.factor = 0.32
            soft.iterations = 2
            bpy.ops.object.modifier_apply(modifier=soft.name)
            shade_smooth(joined)
            parent_bone(joined, rig, bone)
            meshes.append(joined)
        return meshes


def build_core(rig, colors):
    block("Golden_Body", (0, 0.06, 0.58), (0.31, 0.50, 0.285), colors["gold"], 0.145, rig, "spine", 4, True)
    block("Golden_Ribcage", (0, 0.04, 0.61), (0.325, 0.39, 0.285), colors["mid"], 0.135, rig, "spine", 4, True)
    block("Golden_Shoulder", (0, -0.27, 0.64), (0.335, 0.235, 0.285), colors["mid"], 0.125, rig, "spine", 4, True)
    block("Golden_Chest", (0, -0.405, 0.52), (0.255, 0.17, 0.285), colors["cream"], 0.115, rig, "spine", 4, True)
    block("Golden_Neck", (0, -0.27, 0.75), (0.265, 0.205, 0.18), colors["light"], 0.095, rig, "spine", 4, True)
    block("Golden_Head", (0, -0.47, 0.875), (0.31, 0.255, 0.285), colors["gold"], 0.135, rig, "head", 4, True)
    block("Golden_Crown", (0, -0.455, 1.055), (0.245, 0.205, 0.105), colors["mid"], 0.07, rig, "head", 4, True)
    block("Golden_Forehead", (0, -0.685, 0.955), (0.255, 0.075, 0.145), colors["mid"], 0.058, rig, "head", 3)
    block("Golden_BrowPlane", (0, -0.724, 0.885), (0.245, 0.035, 0.12), colors["gold"], 0.034, rig, "head", 3)
    block("Golden_Muzzle", (0, -0.745, 0.705), (0.205, 0.125, 0.125), colors["white"], 0.068, rig, "head", 3)
    block("Golden_MuzzleL", (-0.092, -0.805, 0.725), (0.115, 0.058, 0.095), colors["white"], 0.05, rig, "head", 3)
    block("Golden_MuzzleR", (0.092, -0.805, 0.725), (0.115, 0.058, 0.095), colors["white"], 0.05, rig, "head", 3)
    block("Golden_Chin", (0, -0.79, 0.645), (0.135, 0.052, 0.055), colors["white"], 0.032, rig, "head", 3)
    ball("Golden_Nose", (0, -0.873, 0.775), (0.086, 0.052, 0.065), colors["black"], rig, "head", 3)
    block("Golden_NoseBridge", (0, -0.765, 0.825), (0.050, 0.048, 0.075), colors["mid"], 0.028, rig, "head", 3)
    block("Golden_Tongue", (0, -0.845, 0.625), (0.060, 0.038, 0.086), colors["pink"], 0.032, rig, "head", 3)
    for x in (-0.125, 0.125):
        side = "L" if x < 0 else "R"
        ball("Golden_EyeWhite" + side, (x, -0.775, 0.882), (0.098, 0.035, 0.116), colors["black"], rig, "head", 3)
        ball("Golden_Iris" + side, (x, -0.806, 0.870), (0.068, 0.018, 0.082), colors["iris"], rig, "head", 3)
        ball("Golden_Pupil" + side, (x, -0.820, 0.880), (0.044, 0.010, 0.064), colors["black"], rig, "head", 2)
        ball("Golden_EyeSpark" + side, (x - 0.022, -0.832, 0.920), (0.020, 0.008, 0.026), colors["eye"], rig, "head", 2)
        ball("Golden_EyeSparkSmall" + side, (x + 0.026, -0.832, 0.850), (0.010, 0.006, 0.013), colors["eye"], rig, "head", 2)
        block(
            "Golden_EyeCorner" + side,
            (x + (0.074 if x < 0 else -0.074), -0.815, 0.888),
            (0.012, 0.007, 0.032),
            colors["sclera"],
            0.005,
            rig,
            "head",
            2,
        )
        brow = block("Golden_Brow" + side, (x, -0.776, 1.010), (0.105, 0.020, 0.024), colors["shadow"], 0.012, rig, "head", 2)
        brow.rotation_euler.y = -0.10 if x < 0 else 0.10
        block("Golden_Cheek" + side, (x * 1.42, -0.790, 0.730), (0.041, 0.012, 0.024), colors["blush"], 0.010, rig, "head", 2)
    for side, x, sign in (("L", -0.292, -1), ("R", 0.292, 1)):
        for i, (z, y, sx, sz, key) in enumerate(
            [(0.945, -0.50, 0.090, 0.155, "shadow"), (0.830, -0.51, 0.120, 0.180, "gold"), (0.695, -0.49, 0.105, 0.155, "mid")]
        ):
            ear = block(
                f"Golden_Ear{side}_{i}",
                (x + sign * i * 0.018, y, z),
                (sx, 0.10, sz),
                colors[key],
                0.058,
                rig,
                "ear." + side,
                4,
                True,
            )
            ear.rotation_euler.y = sign * (0.14 + i * 0.08)
    for side, x in (("L", -0.205), ("R", 0.205)):
        for pos, bone in [((x, -0.275, 0.38), "leg.F" + side), ((x, 0.30, 0.37), "leg.B" + side)]:
            block("Golden_UpperLeg" + bone, (pos[0], pos[1], pos[2] + 0.105), (0.112, 0.125, 0.145), colors["gold"], 0.06, rig, bone, 4, True)
            block("Golden_LowerLeg" + bone, (pos[0], pos[1] - 0.018, pos[2] - 0.075), (0.088, 0.098, 0.155), colors["mid"], 0.05, rig, bone, 4, True)
            block(
                "Golden_Hock" + bone,
                (pos[0], pos[1] + (0.045 if ".B" in bone else -0.035), 0.225),
                (0.092, 0.092, 0.072),
                colors["gold"],
                0.038,
                rig,
                bone,
                3,
            )
        for y, bone in [(-0.32, "paw.F" + side), (0.24, "paw.B" + side)]:
            block("Golden_Paw" + bone, (x, y, 0.095), (0.112, 0.155, 0.080), colors["light"], 0.048, rig, bone, 3, True)
            for toe in (-0.045, 0, 0.045):
                block("Toe", (x + toe, y - 0.12, 0.105), (0.016, 0.025, 0.018), colors["white"], 0.008, rig, bone, 2)
    tail1 = block("Golden_Tail1", (0, 0.57, 0.67), (0.12, 0.24, 0.12), colors["gold"], 0.072, rig, "tail.01", 4, True)
    tail1.rotation_euler.x = 0.35
    tail2 = block("Golden_Tail2", (0, 0.79, 0.79), (0.105, 0.22, 0.095), colors["light"], 0.06, rig, "tail.02", 4, True)
    tail2.rotation_euler.x = 0.55
    for x, angle in ((-0.055, -0.28), (0.055, 0.28)):
        smile = block("Golden_Smile", (x, -0.833, 0.677), (0.055, 0.009, 0.012), colors["shadow"], 0.005, rig, "head", 2)
        smile.rotation_euler.y = angle
    block("Pet_Bandana_Blue", (0, -0.405, 0.64), (0.285, 0.045, 0.055), colors["blue"], 0.026, rig, "spine", 3)
    block("Pet_Bandana_KnotL", (-0.245, -0.37, 0.64), (0.062, 0.05, 0.05), colors["blue"], 0.024, rig, "spine", 3)
    block("Pet_Bandana_KnotR", (0.245, -0.37, 0.64), (0.062, 0.05, 0.05), colors["blue"], 0.024, rig, "spine", 3)
    flap = block("Pet_Bandana_Flap", (0, -0.40, 0.52), (0.12, 0.035, 0.115), colors["blue"], 0.028, rig, "spine", 3)
    flap.rotation_euler.y = math.pi / 4
    ball("Pet_Tag", (0, -0.445, 0.57), (0.035, 0.02, 0.035), colors["tag"], rig, "spine")


def face_disk(p):
    return p.y < -0.76 and 0.62 < p.z < 0.98 and abs(p.x) < 0.22


def build_fur(rig, colors):
    fur = FurBuilder(colors)
    golds = [colors["gold"], colors["mid"], colors["honey"]]
    lights = [colors["mid"], colors["light"], colors["honey"]]
    creams = [colors["cream"], colors["light"], colors["white"]]
    ears = [colors["gold"], colors["mid"], colors["shadow"], colors["honey"]]
    comb = dict(flatten=0.36, wave=0.01, rings=6, sides=10, jitter=0.28, length_var=0.18, radius_var=0.16)

    # Soft undercoat masses hide the cube edges before locks add fringe.
    fur.mass("head", (0, -0.46, 1.10), (0.20, 0.14, 0.055), colors["mid"])
    fur.mass("head", (0, -0.36, 1.02), (0.16, 0.11, 0.05), colors["gold"])
    for sign in (-1, 1):
        fur.mass("head", (sign * 0.28, -0.50, 0.78), (0.07, 0.08, 0.08), colors["light"])
        fur.mass("head", (sign * 0.29, -0.42, 0.88), (0.06, 0.08, 0.07), colors["gold"])
        fur.mass("ear." + ("L" if sign < 0 else "R"), (sign * 0.32, -0.54, 0.84), (0.07, 0.09, 0.14), colors["mid"])
        fur.mass("ear." + ("L" if sign < 0 else "R"), (sign * 0.33, -0.58, 0.70), (0.06, 0.08, 0.10), colors["gold"])
        fur.mass("spine", (sign * 0.33, -0.08, 0.62), (0.06, 0.18, 0.11), colors["gold"])
        fur.mass("spine", (sign * 0.30, 0.18, 0.58), (0.06, 0.14, 0.10), colors["mid"])
        fur.mass("spine", (sign * 0.22, 0.26, 0.44), (0.07, 0.08, 0.10), colors["light"])
    fur.mass("spine", (0, -0.30, 0.78), (0.16, 0.08, 0.07), colors["light"])
    fur.mass("spine", (0, -0.48, 0.42), (0.14, 0.08, 0.10), colors["cream"])
    fur.mass("spine", (0, 0.04, 0.88), (0.22, 0.24, 0.06), colors["gold"])
    fur.mass("spine", (0, 0.18, 0.84), (0.18, 0.16, 0.055), colors["mid"])
    fur.mass("spine", (0, 0.02, 0.34), (0.12, 0.18, 0.05), colors["cream"])
    fur.mass("tail.01", (0, 0.58, 0.70), (0.09, 0.16, 0.09), colors["gold"])
    fur.mass("tail.01", (0, 0.64, 0.62), (0.08, 0.12, 0.08), colors["light"])
    fur.mass("tail.02", (0, 0.84, 0.80), (0.09, 0.16, 0.09), colors["light"])
    fur.mass("tail.02", (0, 0.92, 0.74), (0.07, 0.11, 0.07), colors["cream"])
    for sign, letter, y in ((-1, "F", -0.28), (1, "F", -0.28), (-1, "B", 0.30), (1, "B", 0.30)):
        bone = f"leg.{letter}{'L' if sign < 0 else 'R'}"
        back = -0.07 if letter == "F" else 0.08
        fur.mass(bone, (sign * 0.205, y + back, 0.38), (0.07, 0.08, 0.12), colors["light"])

    # Crown — sit on the head, comb back
    fur.patch("head", (0, -0.46, 1.12), (0.22, 0, 0), (0, 0.18, 0.01), 11, 8, 0.10, 0.042, (0, 0.65, 0.4), golds, droop=0.14, **comb)
    fur.patch("head", (0, -0.34, 1.04), (0.17, 0, 0), (0, 0.11, -0.02), 8, 5, 0.085, 0.036, (0, 0.85, 0.05), golds, droop=0.16, **comb)
    # Cheeks
    for sign in (-1, 1):
        fur.patch("head", (sign * 0.30, -0.54, 0.76), (0, 0.09, 0), (0, 0, 0.10), 5, 6, 0.08, 0.034, (sign * 0.4, 0.25, -0.4), lights, droop=0.24, skip=face_disk, **comb)
        fur.patch("head", (sign * 0.32, -0.42, 0.86), (0, 0.12, 0), (0, 0, 0.12), 6, 6, 0.09, 0.036, (sign * 0.3, 0.65, -0.15), golds, droop=0.2, **comb)
    fur.patch("head", (0, -0.66, 1.06), (0.16, 0, 0), (0, 0.04, 0.02), 8, 3, 0.06, 0.028, (0, 0.35, 0.65), golds, droop=0.08, skip=face_disk, **comb)
    fur.patch("head", (0, -0.26, 0.90), (0.16, 0, 0), (0, 0.08, 0.08), 7, 5, 0.09, 0.036, (0, 0.75, -0.3), golds, droop=0.22, **comb)
    # Ears
    for sign, bone in ((-1, "ear.L"), (1, "ear.R")):
        fur.patch(bone, (sign * 0.32, -0.52, 0.86), (sign * 0.06, 0.05, 0), (0, 0.03, 0.15), 6, 8, 0.11, 0.038, (sign * 0.1, -0.15, -0.85), ears, droop=0.38, flatten=0.32, rings=7, wave=0.012)
        fur.patch(bone, (sign * 0.34, -0.58, 0.72), (sign * 0.05, 0.06, 0), (0, 0.04, 0.11), 5, 6, 0.10, 0.034, (sign * 0.08, -0.4, -0.7), lights, droop=0.42, flatten=0.32, rings=7)
    # Neck stays behind the bandana; chest is a short cream ruff, not icicles
    fur.patch("spine", (0, -0.28, 0.78), (0.18, 0, 0), (0, 0.08, 0.06), 8, 5, 0.08, 0.036, (0, 0.35, -0.55), lights, droop=0.22, **comb)
    fur.patch("spine", (0, -0.48, 0.44), (0.18, 0, 0), (0, 0.07, 0.08), 9, 6, 0.08, 0.038, (0, 0.15, -0.75), [colors["cream"], colors["light"], colors["honey"]], droop=0.22, flatten=0.34, rings=6)
    fur.patch("spine", (0, -0.42, 0.56), (0.16, 0, 0), (0, 0.08, 0.05), 7, 4, 0.07, 0.034, (0, 0.2, -0.6), lights, droop=0.2, **comb)
    # Belly
    fur.patch("spine", (0, 0.02, 0.32), (0.16, 0, 0), (0, 0.24, 0), 7, 6, 0.08, 0.032, (0, 0.15, -0.9), creams, droop=0.18, **comb)
    # Back combed toward the tail
    fur.patch("spine", (0, 0.06, 0.90), (0.26, 0, 0), (0, 0.26, 0.01), 12, 9, 0.12, 0.044, (0, 0.85, 0.15), golds, droop=0.14, rings=7, flatten=0.34)
    fur.patch("spine", (0, 0.22, 0.82), (0.20, 0, 0), (0, 0.14, -0.02), 8, 5, 0.11, 0.04, (0, 0.9, -0.05), golds, droop=0.2, **comb)
    # Sides, shoulders, thighs
    for sign in (-1, 1):
        fur.patch("spine", (sign * 0.36, 0.02, 0.60), (0, 0.30, 0), (0, 0, 0.16), 10, 7, 0.11, 0.04, (sign * 0.25, 0.85, -0.2), golds, droop=0.18, **comb)
        fur.patch("spine", (sign * 0.32, -0.26, 0.68), (0, 0.10, 0), (0, 0, 0.10), 5, 5, 0.10, 0.038, (sign * 0.3, 0.55, -0.15), golds, droop=0.16, **comb)
        fur.patch("spine", (sign * 0.24, 0.28, 0.44), (0.07, 0.09, 0), (0, 0, 0.11), 5, 5, 0.12, 0.042, (sign * 0.2, 0.55, -0.6), lights, droop=0.36, flatten=0.34)
    # Tail plume
    fur.patch("tail.01", (0, 0.60, 0.70), (0.11, 0, 0), (0, 0.16, 0.06), 6, 6, 0.13, 0.044, (0, 0.8, 0.15), golds, droop=0.26, rings=7, flatten=0.34)
    fur.patch("tail.01", (0, 0.64, 0.58), (0.09, 0, 0), (0, 0.12, 0.04), 5, 5, 0.13, 0.042, (0, 0.45, -0.7), creams, droop=0.4, flatten=0.34)
    fur.patch("tail.02", (0, 0.84, 0.82), (0.10, 0, 0), (0, 0.16, 0.06), 6, 6, 0.14, 0.042, (0, 0.85, 0.05), lights, droop=0.3, rings=7, flatten=0.32)
    fur.patch("tail.02", (0, 0.90, 0.72), (0.08, 0, 0), (0, 0.12, 0.04), 5, 4, 0.12, 0.038, (0, 0.5, -0.55), creams, droop=0.38, flatten=0.32)
    # Leg feathers
    for sign, letter, y, z in ((-1, "F", -0.275, 0.40), (1, "F", -0.275, 0.40), (-1, "B", 0.30, 0.39), (1, "B", 0.30, 0.39)):
        bone = f"leg.{letter}{'L' if sign < 0 else 'R'}"
        back = -0.08 if letter == "F" else 0.08
        fur.patch(bone, (sign * 0.205, y + back, z), (0.055, 0.05, 0), (0, 0, 0.13), 5, 6, 0.12, 0.038, (sign * 0.08, back * 3.5, -0.8), creams, droop=0.42, flatten=0.34)
        paw = f"paw.{letter}{'L' if sign < 0 else 'R'}"
        paw_y = -0.32 if letter == "F" else 0.24
        fur.patch(paw, (sign * 0.205, paw_y, 0.14), (0.07, 0.05, 0), (0, 0.05, 0.02), 4, 3, 0.055, 0.026, (0, -0.15 if letter == "F" else 0.15, 0.4), creams, droop=0.12, rings=5, flatten=0.4)
    return fur.finish(rig)


def clear_pose(rig):
    if rig.animation_data:
        rig.animation_data.action = None
    for bone in rig.pose.bones:
        bone.location = (0, 0, 0)
        bone.rotation_euler = (0, 0, 0)
    bpy.context.scene.frame_set(1)
    bpy.context.view_layer.update()


def apply_custom(rig, rotations, translations=None):
    clear_pose(rig)
    for name, value in rotations.items():
        rig.pose.bones[name].rotation_euler = value
    for name, value in (translations or {}).items():
        rig.pose.bones[name].location = value
    bpy.context.view_layer.update()


def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def configure_eevee(samples=48):
    scene = bpy.context.scene
    for engine in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"):
        try:
            scene.render.engine = engine
            break
        except Exception:
            continue
    eevee = scene.eevee
    if hasattr(eevee, "taa_render_samples"):
        eevee.taa_render_samples = samples
    if hasattr(eevee, "use_shadows"):
        eevee.use_shadows = True
    if hasattr(eevee, "use_raytracing"):
        eevee.use_raytracing = True


def setup_studio():
    scene = bpy.context.scene
    configure_eevee(48)
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = -0.15
    world = bpy.data.worlds.new("Golden studio")
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs[0].default_value = (0.86, 0.80, 0.72, 1)
    background.inputs[1].default_value = 0.52
    scene.world = world
    bpy.ops.mesh.primitive_plane_add(size=20, location=(0, 0, 0))
    ground = bpy.context.object
    ground.name = "Studio_ShadowCatcher"
    ground.hide_render = True
    ground.is_shadow_catcher = True
    for name, location, energy, size, color in (
        ("Key", (-1.8, -2.5, 3.0), 480, 2.8, (1.0, 0.82, 0.62)),
        ("Fill", (2.4, -1.2, 1.8), 140, 2.4, (0.82, 0.88, 1.0)),
        ("Rim", (1.0, 2.6, 2.2), 280, 2.0, (1.0, 0.86, 0.62)),
        ("Kick", (-0.2, -0.3, 3.5), 70, 3.0, (1.0, 0.92, 0.80)),
    ):
        bpy.ops.object.light_add(type="AREA", location=location)
        light = bpy.context.object
        light.name = name
        light.data.energy = energy
        light.data.shape = "DISK"
        light.data.size = size
        light.data.color = color
        aim(light, (0, -0.05, 0.58))
    bpy.ops.object.camera_add(location=(1.62, -2.92, 1.48))
    camera = bpy.context.object
    camera.name = "CAM_GOLDEN"
    camera.data.lens = 56
    camera.data.dof.use_dof = False
    scene.camera = camera
    return camera


def render_view(path, camera, location, target, *, lens=56, ortho=None, resolution=(720, 720), samples=48):
    scene = bpy.context.scene
    camera.location = location
    camera.data.type = "ORTHO" if ortho else "PERSP"
    camera.data.lens = lens
    if ortho:
        camera.data.ortho_scale = ortho
    aim(camera, target)
    if hasattr(scene.eevee, "taa_render_samples"):
        scene.eevee.taa_render_samples = samples
    scene.render.resolution_x, scene.render.resolution_y = resolution
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    print("RENDERED", path.name, flush=True)


def render_selector_preview(camera):
    scene = bpy.context.scene
    scene.render.film_transparent = False
    scene.render.image_settings.file_format = "WEBP"
    scene.render.image_settings.color_mode = "RGB"
    world = scene.world
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.95, 0.92, 0.86, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.55
    ground = bpy.data.objects.get("Studio_ShadowCatcher")
    if ground:
        ground.hide_render = False
        ground.is_shadow_catcher = False
        if not ground.data.materials:
            ground.data.materials.append(mat("Preview_Ground", (0.93, 0.88, 0.80), 0.9))
    render_view(PREVIEWS / "golden-retriever.webp", camera, (1.55, -2.70, 1.22), (0, -0.05, 0.56), lens=54, resolution=(720, 720), samples=64)
    shutil.copy2(PREVIEWS / "golden-retriever.webp", MOBILE / "golden-retriever.webp")
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    if ground:
        ground.is_shadow_catcher = True
        ground.hide_render = True


def render_turnaround(camera):
    target = (0, -0.04, 0.56)
    render_view(STAGE / "hero.png", camera, (1.62, -2.80, 1.28), target, lens=54, resolution=(1024, 1024), samples=56)
    render_view(STAGE / "front.png", camera, (0.0, -3.2, 0.78), target, ortho=1.7, resolution=(768, 768), samples=40)
    render_view(STAGE / "side.png", camera, (3.2, 0.02, 0.78), target, ortho=1.7, resolution=(768, 768), samples=40)
    render_view(STAGE / "three-quarter.png", camera, (2.3, -2.3, 0.86), target, ortho=1.7, resolution=(768, 768), samples=40)
    render_view(STAGE / "face.png", camera, (0.72, -1.95, 1.08), (0, -0.50, 0.84), lens=70, resolution=(900, 900), samples=64)


def build_golden():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    colors = palette()
    rig = make_rig()
    build_core(rig, colors)
    fur_meshes = build_fur(rig, colors)
    create_actions(rig)
    clear_pose(rig)
    present = {action.name for action in bpy.data.actions}
    missing = [name for name in CLIPS if name not in present]
    if missing:
        raise RuntimeError("missing clips: " + ", ".join(missing))
    parts = [obj for obj in bpy.context.scene.objects if obj.get("pet_asset")]
    vertices = sum(len(obj.data.vertices) for obj in parts if obj.type == "MESH")
    bpy.context.scene["asset_manifest"] = json.dumps(
        {
            "id": "golden-retriever",
            "schema": "compa-pet-v1",
            "revision": REVISION,
            "rig": "canine-standard",
            "height": 0.98,
            "colliderRadius": 0.32,
            "meshCount": len(parts),
            "furMeshes": len(fur_meshes),
            "vertices": vertices,
            "style": "voxel-organic-fur",
        }
    )
    return rig, parts, vertices, fur_meshes


def main():
    voxel_glb = MODELS / "pet-golden-retriever-voxel-backup.glb"
    voxel_blend = SOURCE / "golden-retriever-master-voxel-backup.blend"
    voxel_preview = PREVIEWS / "golden-retriever-voxel-backup.webp"
    for path in (voxel_glb, voxel_blend, voxel_preview):
        if not path.exists():
            raise RuntimeError("missing voxel backup " + str(path))
    rig, parts, vertices, fur_meshes = build_golden()
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / "golden-retriever-master.blend"))
    export_selected(MODELS / "pet-golden-retriever.glb", [rig] + parts)
    glb_size = (MODELS / "pet-golden-retriever.glb").stat().st_size
    if glb_size > 5_500_000:
        raise RuntimeError(f"GLB too large: {glb_size} bytes")
    camera = setup_studio()
    render_turnaround(camera)
    render_selector_preview(camera)
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / "golden-retriever-master.blend"))
    manifest = {
        "id": "golden-retriever",
        "name": "Miel",
        "revision": REVISION,
        "vertices": vertices,
        "furMeshes": len(fur_meshes),
        "glbBytes": glb_size,
        "clips": CLIPS,
        "master": "packages/assets/3d/source/pets/golden-retriever-master.blend",
        "glb": "apps/web/public/selection/models/pet-golden-retriever.glb",
        "preview": "apps/web/public/selection/pets/golden-retriever.webp",
        "voxelBackup": "apps/web/public/selection/models/pet-golden-retriever-voxel-backup.glb",
        "renders": sorted(path.name for path in STAGE.glob("*.png")),
    }
    (STAGE / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print("LOCKED", vertices, "verts", len(fur_meshes), "fur meshes", glb_size, "bytes", flush=True)


if __name__ == "__main__":
    main()
