"""Rebuild Miel as a premium stylized golden retriever.

Organic volumes, designed fur locks, canine-standard rig and animation contract.
No voxel cubes. Run:

  blender --background --python-exit-code 1 --python scripts/build_golden_stylized.py
"""
from __future__ import annotations

import json
import math
import shutil
import sys
from pathlib import Path

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from build_pet_mvp import create_actions, export_selected, make_rig, mat

SOURCE = ROOT / "packages/assets/3d/source/pets"
MODELS = ROOT / "apps/web/public/selection/models"
PREVIEWS = ROOT / "apps/web/public/selection/pets"
MOBILE = ROOT / "apps/mobile/assets/selection/pets"
STAGE = ROOT / "renders/golden-stylized"
for folder in (SOURCE, MODELS, PREVIEWS, MOBILE, STAGE):
    folder.mkdir(parents=True, exist_ok=True)


def backup_once(path: Path) -> None:
    if not path.exists():
        return
    dest = path.with_name(path.stem + "-voxel-backup" + path.suffix)
    if not dest.exists():
        shutil.copy2(path, dest)


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
        names = aliases.get(key, (key,))
        for name in names:
            socket = bsdf.inputs.get(name)
            if socket is not None:
                try:
                    socket.default_value = value
                except Exception:
                    pass
                break
    return material


def fur_mat(name, color, rough=0.56):
    material = mat(name, color, rough)
    set_bsdf(material, sheen=0.38, sheen_rough=0.45, sss=0.07, sss_scale=0.02, spec=0.32)
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    tint = bsdf.inputs.get("Sheen Tint")
    if tint is not None:
        try:
            tint.default_value = (*(min(1, c * 1.12) for c in color), 1)
        except Exception:
            pass
    radius = bsdf.inputs.get("Subsurface Radius")
    if radius is not None:
        try:
            radius.default_value = (1.0, 0.48, 0.18)
        except Exception:
            pass
    return material


PALETTE = None


def palette():
    global PALETTE
    if PALETTE:
        return PALETTE
    PALETTE = {
        "gold": fur_mat("Golden_Coat", (0.90, 0.50, 0.12), 0.52),
        "honey": fur_mat("Golden_Honey", (0.93, 0.58, 0.16), 0.5),
        "cream": fur_mat("Golden_Cream", (0.95, 0.84, 0.62), 0.58),
        "light": fur_mat("Golden_Light", (0.90, 0.70, 0.38), 0.55),
        "shadow": fur_mat("Golden_Shade", (0.62, 0.36, 0.12), 0.6),
        "ear": fur_mat("Golden_Ear", (0.76, 0.48, 0.18), 0.58),
        "inner": mat("Golden_EarInner", (0.86, 0.62, 0.52), 0.72),
        "nose": set_bsdf(mat("Golden_Nose", (0.07, 0.045, 0.04), 0.32), spec=0.55, coat=0.18),
        "pad": mat("Golden_Pad", (0.28, 0.14, 0.10), 0.7),
        "skin": mat("Golden_Skin", (0.72, 0.48, 0.36), 0.68),
        "iris": set_bsdf(mat("Golden_Iris", (0.38, 0.20, 0.07), 0.22), spec=0.55),
        "sclera": set_bsdf(mat("Golden_Sclera", (0.96, 0.90, 0.80), 0.28), spec=0.45),
        "black": set_bsdf(mat("Golden_Dark", (0.025, 0.018, 0.016), 0.24), spec=0.4),
        "glint": set_bsdf(mat("Golden_Glint", (0.99, 0.97, 0.92), 0.12), spec=0.8),
        "mouth": mat("Golden_Mouth", (0.18, 0.08, 0.06), 0.55),
        "tongue": mat("Golden_Tongue", (0.78, 0.32, 0.34), 0.48),
    }
    return PALETTE


def tag(obj, **custom):
    obj["pet_asset"] = True
    for key, value in custom.items():
        obj[key] = value
    return obj


def smooth(obj):
    for face in obj.data.polygons:
        face.use_smooth = True
    return obj


def bind(obj, rig, bone):
    bpy.context.view_layer.update()
    world = obj.matrix_world.copy()
    obj.parent = rig
    obj.matrix_world = world
    group = obj.vertex_groups.new(name=bone)
    group.add(list(range(len(obj.data.vertices))), 1, "REPLACE")
    arm = obj.modifiers.new("Pet anatomical rig", "ARMATURE")
    arm.object = rig
    return tag(obj)


def mesh_object(name, vertices, faces, material):
    mesh = bpy.data.meshes.new(name + "-mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    mesh.materials.append(material)
    return tag(smooth(obj))


def ellipsoid(name, center, radii, material, segments=36, rings=22):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.scale = radii
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    return tag(smooth(obj))


def sculpt(name, volumes, material, voxel=0.009, ratio=0.62):
    parts = [ellipsoid(name + f"-vol{i}", *volume, material, 28, 18) for i, volume in enumerate(volumes)]
    bpy.ops.object.select_all(action="DESELECT")
    for obj in parts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    remesh = obj.modifiers.new("Organic surface", "REMESH")
    remesh.mode = "VOXEL"
    remesh.voxel_size = voxel
    remesh.use_smooth_shade = True
    bpy.ops.object.modifier_apply(modifier=remesh.name)
    smooth_mod = obj.modifiers.new("Soft transitions", "SMOOTH")
    smooth_mod.factor = 1.05
    smooth_mod.iterations = 6
    bpy.ops.object.modifier_apply(modifier=smooth_mod.name)
    dec = obj.modifiers.new("Production topology", "DECIMATE")
    dec.ratio = ratio
    bpy.ops.object.modifier_apply(modifier=dec.name)
    return tag(smooth(obj))


def tube(name, points, radii, material, sides=12):
    points = [Vector(p) for p in points]
    vertices, faces = [], []
    for i, point in enumerate(points):
        direction = (points[min(i + 1, len(points) - 1)] - points[max(0, i - 1)]).normalized()
        ref = Vector((0, 0, 1)) if abs(direction.z) < 0.85 else Vector((0, 1, 0))
        u = direction.cross(ref).normalized()
        v = direction.cross(u).normalized()
        for k in range(sides):
            a = k * math.tau / sides
            vertices.append(point + radii[i] * (math.cos(a) * u + math.sin(a) * v))
    for i in range(len(points) - 1):
        for k in range(sides):
            j = i * sides + k
            faces.append((j, i * sides + (k + 1) % sides, (i + 1) * sides + (k + 1) % sides, j + sides))
    faces.append(tuple(range(sides - 1, -1, -1)))
    faces.append(tuple((len(points) - 1) * sides + k for k in range(sides)))
    return mesh_object(name, vertices, faces, material)


def lock(name, start, end, radius, material, sides=12, rings=7, droop=0.18):
    start, end = Vector(start), Vector(end)
    direction = end - start
    length = max(direction.length, 1e-4)
    direction.normalize()
    ref = Vector((0, 0, 1)) if abs(direction.z) < 0.9 else Vector((0, 1, 0))
    u = direction.cross(ref).normalized()
    v = direction.cross(u).normalized()
    vertices = []
    for i in range(rings):
        t = i / (rings - 1)
        profile = 0.42 + 0.58 * math.sin(t * math.pi) ** 0.72
        if i == 0:
            profile = 0.62
        if i == rings - 1:
            profile = 0.12
        r = radius * profile * (1 - t * 0.22)
        point = start.lerp(end, t) + Vector((0, 0, -droop * length * t * t))
        for k in range(sides):
            a = k * math.tau / sides
            vertices.append(point + r * (math.cos(a) * u + math.sin(a) * v))
    faces = [tuple(reversed(range(sides)))]
    for i in range(rings - 1):
        for k in range(sides):
            a = i * sides + k
            faces.append((a, i * sides + (k + 1) % sides, (i + 1) * sides + (k + 1) % sides, a + sides))
    faces.append(tuple(range((rings - 1) * sides, rings * sides)))
    return mesh_object(name, vertices, faces, material)


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
    return tag(smooth(obj))


def fibonacci(count):
    golden = math.pi * (3 - math.sqrt(5))
    for index in range(count):
        z = 1 - 2 * (index + 0.5) / count
        radial = math.sqrt(max(0, 1 - z * z))
        angle = index * golden
        yield Vector((math.cos(angle) * radial, math.sin(angle) * radial, z))


def on_ellipsoid(center, radii, normal):
    n = Vector(normal)
    return Vector(center) + Vector((n.x * radii[0], n.y * radii[1], n.z * radii[2]))


def front_surface(obj):
    bpy.context.view_layer.update()
    tree = BVHTree.FromObject(obj, bpy.context.evaluated_depsgraph_get())

    def sample(x, z):
        hit, _, _, _ = tree.ray_cast(Vector((x, -2.4, z)), Vector((0, 1, 0)), 5)
        return hit.y if hit else -0.52

    return sample


def shade_coat(obj, cream_pred, shadow_pred=None):
    colors = palette()
    obj.data.materials.clear()
    for material in (colors["gold"], colors["cream"], colors["shadow"], colors["honey"], colors["light"]):
        obj.data.materials.append(material)
    for face in obj.data.polygons:
        p = face.center
        if shadow_pred and shadow_pred(p):
            face.material_index = 2
        elif cream_pred(p):
            face.material_index = 1
        elif p.y > 0.18:
            face.material_index = 3
        else:
            face.material_index = 0
    return obj


def canine_rig():
    rig = make_rig()
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")
    bones = rig.data.edit_bones
    bones["root"].head, bones["root"].tail = (0, 0, 0.04), (0, 0, 0.16)
    bones["spine"].head, bones["spine"].tail = (0, 0.04, 0.40), (0, -0.10, 0.56)
    bones["head"].head, bones["head"].tail = (0, -0.18, 0.66), (0, -0.44, 0.74)
    bones["ear.L"].head, bones["ear.L"].tail = (-0.14, -0.40, 0.80), (-0.16, -0.42, 0.58)
    bones["ear.R"].head, bones["ear.R"].tail = (0.14, -0.40, 0.80), (0.16, -0.42, 0.58)
    bones["tail.01"].head, bones["tail.01"].tail = (0, 0.28, 0.48), (0, 0.48, 0.64)
    bones["tail.02"].head, bones["tail.02"].tail = (0, 0.48, 0.64), (0.04, 0.62, 0.78)
    for side, sign in (("L", -1), ("R", 1)):
        bones["leg.F" + side].head, bones["leg.F" + side].tail = (sign * 0.15, -0.18, 0.44), (sign * 0.15, -0.20, 0.18)
        bones["paw.F" + side].head, bones["paw.F" + side].tail = (sign * 0.15, -0.20, 0.18), (sign * 0.15, -0.28, 0.03)
        bones["leg.B" + side].head, bones["leg.B" + side].tail = (sign * 0.15, 0.20, 0.44), (sign * 0.15, 0.24, 0.18)
        bones["paw.B" + side].head, bones["paw.B" + side].tail = (sign * 0.15, 0.24, 0.18), (sign * 0.15, 0.16, 0.03)
    bpy.ops.object.mode_set(mode="OBJECT")
    rig.name = "pet-canine-rig"
    rig["rig_family"] = "canine-standard"
    rig["schema"] = "compa-pet-v1"
    return rig


def build_body(rig, colors):
    body = sculpt(
        "Golden_Body",
        [
            ((0, 0.02, 0.46), (0.19, 0.24, 0.20)),
            ((0, -0.16, 0.47), (0.185, 0.16, 0.21)),
            ((0, 0.20, 0.45), (0.18, 0.15, 0.19)),
            ((0, 0.04, 0.32), (0.14, 0.18, 0.10)),
            ((0, -0.24, 0.56), (0.13, 0.11, 0.12)),
            ((0, -0.28, 0.44), (0.15, 0.09, 0.13)),
            ((0, -0.22, 0.38), (0.12, 0.08, 0.10)),
            ((-0.12, -0.08, 0.50), (0.08, 0.10, 0.08)),
            ((0.12, -0.08, 0.50), (0.08, 0.10, 0.08)),
        ],
        colors["gold"],
        0.008,
        0.58,
    )
    shade_coat(
        body,
        lambda p: p.y < -0.18 and p.z < 0.50 and abs(p.x) < 0.13,
        lambda p: abs(p.x) > 0.15 and p.z > 0.50,
    )
    bind(body, rig, "spine")
    return body


def build_head(rig, colors):
    head = sculpt(
        "Golden_Head",
        [
            ((0, -0.36, 0.72), (0.155, 0.14, 0.135)),
            ((0, -0.34, 0.81), (0.11, 0.10, 0.055)),
            ((-0.09, -0.44, 0.66), (0.075, 0.07, 0.065)),
            ((0.09, -0.44, 0.66), (0.075, 0.07, 0.065)),
            ((0, -0.46, 0.76), (0.10, 0.055, 0.04)),
            ((0, -0.50, 0.645), (0.075, 0.07, 0.05)),
            ((0, -0.56, 0.635), (0.055, 0.045, 0.04)),
            ((-0.12, -0.40, 0.70), (0.04, 0.05, 0.05)),
            ((0.12, -0.40, 0.70), (0.04, 0.05, 0.05)),
        ],
        colors["gold"],
        0.006,
        0.6,
    )
    shade_coat(
        head,
        lambda p: p.y < -0.48 and p.z < 0.69,
        lambda p: p.z > 0.80,
    )
    bind(head, rig, "head")
    return head


def build_face(head, rig, colors):
    surface = front_surface(head)
    for sign, side in ((-1, "L"), (1, "R")):
        x, z = sign * 0.058, 0.73
        y = surface(x, z) - 0.002
        bind(ellipsoid(f"Golden_EyeSocket{side}", (x, y + 0.004, z), (0.032, 0.012, 0.034), colors["black"], 24, 14), rig, "head")
        bind(ellipsoid(f"Golden_Sclera{side}", (x, y - 0.002, z), (0.026, 0.014, 0.028), colors["sclera"], 24, 14), rig, "head")
        bind(ellipsoid(f"Golden_Iris{side}", (x, y - 0.010, z - 0.001), (0.020, 0.010, 0.022), colors["iris"], 22, 12), rig, "head")
        bind(ellipsoid(f"Golden_Pupil{side}", (x, y - 0.015, z), (0.010, 0.005, 0.013), colors["black"], 16, 10), rig, "head")
        bind(ellipsoid(f"Golden_Glint{side}", (x - 0.008, y - 0.018, z + 0.010), (0.006, 0.003, 0.007), colors["glint"], 14, 8), rig, "head")
        bind(ellipsoid(f"Golden_GlintSmall{side}", (x + 0.009, y - 0.016, z - 0.008), (0.003, 0.002, 0.004), colors["glint"], 10, 6), rig, "head")
        lid = ellipsoid(f"Golden_Lid{side}", (x, y, z + 0.022), (0.026, 0.008, 0.008), colors["gold"], 18, 10)
        lid.rotation_euler.y = sign * 0.06
        bind(lid, rig, "head")
    nose_y = surface(0, 0.635)
    bind(ellipsoid("Golden_Nose", (0, nose_y - 0.006, 0.632), (0.022, 0.014, 0.016), colors["nose"], 24, 14), rig, "head")
    bind(ellipsoid("Golden_NostrilL", (-0.008, nose_y - 0.012, 0.626), (0.006, 0.004, 0.004), colors["black"], 10, 6), rig, "head")
    bind(ellipsoid("Golden_NostrilR", (0.008, nose_y - 0.012, 0.626), (0.006, 0.004, 0.004), colors["black"], 10, 6), rig, "head")


def build_ears(rig, colors):
    for sign, side in ((-1, "L"), (1, "R")):
        ear = sculpt(
            f"Golden_Ear{side}",
            [
                ((sign * 0.15, -0.38, 0.76), (0.04, 0.03, 0.04)),
                ((sign * 0.16, -0.43, 0.68), (0.05, 0.028, 0.065)),
                ((sign * 0.155, -0.45, 0.60), (0.04, 0.024, 0.05)),
            ],
            colors["ear"],
            0.007,
            0.72,
        )
        bind(ear, rig, f"ear.{side}")
        inner = ellipsoid(
            f"Golden_EarInner{side}",
            (sign * 0.14, -0.455, 0.67),
            (0.026, 0.008, 0.055),
            colors["inner"],
            22,
            12,
        )
        bind(inner, rig, f"ear.{side}")


def build_legs(rig, colors):
    for sign, side in ((-1, "L"), (1, "R")):
        for rear, y, letter in ((False, -0.18, "F"), (True, 0.20, "B")):
            bone = f"leg.{letter}{side}"
            paw_bone = f"paw.{letter}{side}"
            x = sign * 0.15
            limb = tube(
                f"Golden_Limb{letter}{side}",
                [
                    (x, y, 0.42),
                    (x, y, 0.28),
                    (x, y - (0.015 if not rear else -0.01), 0.16),
                    (x, y - (0.03 if not rear else -0.02), 0.07),
                ],
                [0.055, 0.042, 0.032, 0.036],
                colors["gold"],
                12,
            )
            bind(limb, rig, bone)
            if rear:
                bind(
                    ellipsoid(f"Golden_Pants{letter}{side}", (x, y + 0.04, 0.22), (0.045, 0.05, 0.08), colors["light"], 18, 12),
                    rig,
                    bone,
                )
            paw_y = y - (0.07 if not rear else -0.06)
            paw = ellipsoid(f"Golden_Paw{letter}{side}", (x, paw_y, 0.045), (0.05, 0.072, 0.032), colors["cream"], 22, 12)
            bind(paw, rig, paw_bone)
            pad = ellipsoid(f"Golden_Pad{letter}{side}", (x, paw_y + 0.01, 0.014), (0.026, 0.032, 0.008), colors["pad"], 14, 8)
            bind(pad, rig, paw_bone)
            for d in (-1, 0, 1):
                toe_y = paw_y - (0.04 if not rear else -0.04)
                bind(
                    ellipsoid(f"Golden_Toe{letter}{side}{d}", (x + d * 0.016, toe_y, 0.032), (0.012, 0.016, 0.012), colors["cream"], 12, 8),
                    rig,
                    paw_bone,
                )
                bind(
                    ellipsoid(f"Golden_ToePad{letter}{side}{d}", (x + d * 0.016, toe_y, 0.012), (0.007, 0.009, 0.004), colors["pad"], 10, 6),
                    rig,
                    paw_bone,
                )


def build_tail(rig, colors):
    volumes = []
    for i in range(8):
        t = i / 7
        volumes.append((
            (0.02 * math.sin(t * math.pi), 0.26 + 0.30 * t, 0.48 + 0.28 * t - 0.06 * t * t),
            (0.07 * (1 - t * 0.35), 0.09 * (1 - t * 0.25), 0.07 * (1 - t * 0.3)),
        ))
    tail = sculpt("Golden_Tail", volumes, colors["gold"], 0.008, 0.65)
    bind(tail, rig, "tail.01")
    second = tail.vertex_groups.new(name="tail.02")
    first = tail.vertex_groups.get("tail.01")
    for vert in tail.data.vertices:
        t = (vert.co.y - 0.28) / 0.34
        w = max(0, min(1, (t - 0.38) / 0.42))
        first.add([vert.index], 1 - w, "REPLACE")
        second.add([vert.index], w, "REPLACE")
    shade_coat(tail, lambda p: p.z < 0.55, lambda p: p.y > 0.52)


def clear_pose(rig):
    if rig.animation_data:
        rig.animation_data.action = None
    for bone in rig.pose.bones:
        bone.location = (0, 0, 0)
        bone.rotation_euler = (0, 0, 0)
    bpy.context.scene.frame_set(1)
    bpy.context.view_layer.update()


def apply_action(rig, name, frame):
    action = bpy.data.actions.get(name)
    if action is None:
        raise RuntimeError("missing action " + name)
    rig.animation_data_create()
    rig.animation_data.action = action
    bpy.context.scene.frame_set(frame)
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


def configure_eevee(samples=64):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    eevee = scene.eevee
    if hasattr(eevee, "taa_render_samples"):
        eevee.taa_render_samples = samples
    if hasattr(eevee, "use_shadows"):
        eevee.use_shadows = True
    if hasattr(eevee, "use_raytracing"):
        eevee.use_raytracing = True
    if hasattr(eevee, "use_volumetric_shadows"):
        eevee.use_volumetric_shadows = False


def setup_studio():
    scene = bpy.context.scene
    configure_eevee(48)
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = 0.05
    world = bpy.data.worlds.new("Golden studio")
    background = world.node_tree.nodes.get("Background")
    background.inputs[0].default_value = (0.83, 0.78, 0.70, 1)
    background.inputs[1].default_value = 0.55
    scene.world = world
    bpy.ops.mesh.primitive_plane_add(size=20, location=(0, 0, 0))
    ground = bpy.context.object
    ground.name = "Studio_ShadowCatcher"
    ground.hide_render = True
    ground.is_shadow_catcher = True
    for name, location, energy, size, color in (
        ("Key", (-1.9, -2.4, 2.9), 520, 2.8, (1.0, 0.88, 0.74)),
        ("Fill", (2.3, -1.3, 1.7), 220, 2.4, (0.82, 0.88, 1.0)),
        ("Rim", (1.1, 2.5, 2.3), 340, 2.0, (1.0, 0.92, 0.80)),
        ("Kick", (-0.2, -0.4, 3.4), 120, 3.2, (1.0, 0.95, 0.88)),
    ):
        bpy.ops.object.light_add(type="AREA", location=location)
        light = bpy.context.object
        light.name = name
        light.data.energy = energy
        light.data.shape = "DISK"
        light.data.size = size
        light.data.color = color
        aim(light, (0, -0.05, 0.46))
    bpy.ops.object.camera_add(location=(1.55, -2.55, 1.18))
    camera = bpy.context.object
    camera.name = "CAM_GOLDEN"
    camera.data.lens = 70
    camera.data.dof.use_dof = False
    scene.camera = camera
    return camera


def render_view(path, camera, location, target, *, lens=70, ortho=None, resolution=(720, 720), samples=48):
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
        ground.data.materials.append(mat("Preview_Ground", (0.93, 0.88, 0.80), 0.9))
    render_view(
        PREVIEWS / "golden-retriever.webp",
        camera,
        (1.48, -2.45, 1.12),
        (0, -0.04, 0.46),
        lens=62,
        resolution=(720, 720),
        samples=64,
    )
    shutil.copy2(PREVIEWS / "golden-retriever.webp", MOBILE / "golden-retriever.webp")
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    if ground:
        ground.is_shadow_catcher = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.83, 0.78, 0.70, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.42


def render_turnaround(rig, camera):
    clear_pose(rig)
    apply_custom(rig, {"head": (0.04, 0, 0.16), "tail.01": (0.05, 0, 0.18), "tail.02": (0.08, 0, 0.12)})
    target = (0, -0.04, 0.46)
    render_view(STAGE / "hero.png", camera, (1.58, -2.48, 1.14), target, lens=68, resolution=(1024, 1024), samples=48)
    clear_pose(rig)
    apply_custom(rig, {"tail.01": (0, 0, 0.1)})
    render_view(STAGE / "front.png", camera, (0.0, -3.1, 0.72), target, ortho=1.55, resolution=(768, 768), samples=40)
    render_view(STAGE / "side.png", camera, (3.1, 0.02, 0.72), target, ortho=1.55, resolution=(768, 768), samples=40)
    render_view(STAGE / "back.png", camera, (0.0, 3.1, 0.72), target, ortho=1.55, resolution=(768, 768), samples=40)
    render_view(STAGE / "three-quarter.png", camera, (2.2, -2.2, 0.78), target, ortho=1.55, resolution=(768, 768), samples=40)
    render_view(STAGE / "face.png", camera, (0.55, -1.55, 0.92), (0, -0.46, 0.70), lens=85, resolution=(900, 900), samples=64)


def render_poses(rig, camera):
    target = (0, -0.04, 0.42)
    apply_action(rig, "pet_seated", 30)
    render_view(STAGE / "pose-sit.png", camera, (1.5, -2.4, 1.05), target, lens=68, resolution=(720, 720), samples=40)
    apply_action(rig, "pet_rest", 40)
    render_view(STAGE / "pose-rest.png", camera, (1.55, -2.35, 0.95), (0, -0.02, 0.28), lens=68, resolution=(720, 720), samples=40)
    apply_action(rig, "pet_walk", 12)
    render_view(STAGE / "pose-trot.png", camera, (1.65, -2.45, 1.12), target, lens=68, resolution=(720, 720), samples=40)
    apply_custom(
        rig,
        {
            "spine": (-0.42, 0, 0),
            "head": (0.22, 0, 0.12),
            "leg.FL": (-0.55, 0, 0),
            "leg.FR": (-0.48, 0, 0),
            "paw.FL": (0.35, 0, 0),
            "paw.FR": (0.28, 0, 0),
            "tail.01": (-0.25, 0, 0.28),
            "tail.02": (-0.15, 0, 0.2),
        },
        {"spine": (0, -0.05, -0.04)},
    )
    render_view(STAGE / "pose-play.png", camera, (1.5, -2.4, 1.0), (0, -0.08, 0.36), lens=68, resolution=(720, 720), samples=40)
    apply_custom(
        rig,
        {"head": (-0.32, 0, 0.08), "ear.L": (0.12, 0, 0), "ear.R": (0.12, 0, 0), "tail.01": (0.1, 0, 0.22), "tail.02": (0.12, 0, 0.16)},
    )
    render_view(STAGE / "pose-lookup.png", camera, (1.45, -2.35, 1.22), (0, -0.06, 0.52), lens=70, resolution=(720, 720), samples=40)
    clear_pose(rig)


def build_golden():
    global PALETTE
    bpy.ops.wm.read_factory_settings(use_empty=True)
    PALETTE = None
    colors = palette()
    rig = canine_rig()
    head = build_head(rig, colors)
    build_face(head, rig, colors)
    build_body(rig, colors)
    build_ears(rig, colors)
    build_legs(rig, colors)
    build_tail(rig, colors)
    create_actions(rig)
    clear_pose(rig)
    parts = [obj for obj in bpy.context.scene.objects if obj.get("pet_asset")]
    for obj in parts:
        if obj.type == "MESH" and not obj.vertex_groups:
            raise RuntimeError("Unbound mesh " + obj.name)
    vertices = sum(len(obj.data.vertices) for obj in parts if obj.type == "MESH")
    bpy.context.scene["asset_manifest"] = json.dumps(
        {
            "id": "golden-retriever",
            "schema": "compa-pet-v1",
            "revision": "stylized-organic-v1",
            "rig": "canine-standard",
            "height": 0.98,
            "colliderRadius": 0.32,
            "meshCount": len(parts),
            "vertices": vertices,
            "style": "stylized-organic",
        }
    )
    return rig, parts, vertices


def main():
    backup_once(SOURCE / "golden-retriever-master.blend")
    backup_once(MODELS / "pet-golden-retriever.glb")
    backup_once(PREVIEWS / "golden-retriever.webp")
    rig, parts, vertices = build_golden()
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / "golden-retriever-master.blend"))
    export_selected(MODELS / "pet-golden-retriever.glb", [rig] + parts)
    camera = setup_studio()
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / "golden-retriever-master.blend"))
    render_turnaround(rig, camera)
    render_poses(rig, camera)
    render_selector_preview(camera)
    manifest = {
        "id": "golden-retriever",
        "name": "Miel",
        "revision": "stylized-organic-v1",
        "vertices": vertices,
        "glb": "apps/web/public/selection/models/pet-golden-retriever.glb",
        "preview": "apps/web/public/selection/pets/golden-retriever.webp",
        "sheet": "renders/golden-stylized/miel-character-sheet.png",
        "renders": sorted(path.name for path in STAGE.glob("*.png")),
    }
    (STAGE / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print("GOLDEN_STYLIZED_READY", vertices, flush=True)


if __name__ == "__main__":
    main()
