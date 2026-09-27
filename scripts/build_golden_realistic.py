"""Build Miel, the golden retriever, as a stylized-realistic groomed 3D pet.

Anatomical volumes (skull with stop, medium muzzle, deep chest, angulated legs,
plumed tail) plus real Blender hair particles groomed per region. Exports the
skinned base mesh to GLB (hair stays in the Blender master and renders) and
produces the renders used by scripts/compose_golden_sheet.cjs.

  blender --background --python-exit-code 1 --python scripts/build_golden_realistic.py
"""
from __future__ import annotations

import json
import math
import shutil
import sys
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
STAGE = ROOT / "renders/golden-stylized"
for folder in (SOURCE, MODELS, PREVIEWS, MOBILE, STAGE):
    folder.mkdir(parents=True, exist_ok=True)

FAST = "--fast" in sys.argv
ONLY_HERO = "--hero" in sys.argv
LIFT = 0.05  # raises trunk, head and tail so the legs read golden-length


def lift(objects):
    """Translate finished meshes upward after weights are painted, before fur."""
    for obj in objects:
        if obj.type != "MESH":
            continue
        for vert in obj.data.vertices:
            vert.co.z += LIFT
        obj.data.update()


def clamp01(value):
    return max(0.0, min(1.0, value))


def backup_once(path: Path) -> None:
    if not path.exists():
        return
    dest = path.with_name(path.stem + "-voxel-backup" + path.suffix)
    if not dest.exists():
        shutil.copy2(path, dest)


# --------------------------------------------------------------------------- materials
ALIASES = {
    "sheen": ("Sheen Weight",),
    "sheen_rough": ("Sheen Roughness",),
    "coat": ("Coat Weight",),
    "coat_rough": ("Coat Roughness",),
    "spec": ("Specular IOR Level",),
    "sss": ("Subsurface Weight",),
}


def set_inputs(material, **values):
    node = material.node_tree.nodes.get("Principled BSDF")
    for key, value in values.items():
        for name in ALIASES.get(key, (key,)):
            socket = node.inputs.get(name)
            if socket is not None:
                socket.default_value = value
                break
    return material


def skin_mat(name, color, rough=0.62):
    material = mat(name, color, rough)
    set_inputs(material, sheen=0.2, spec=0.3)
    return material


def hair_mat(name, root, mid, tip, rough=0.42):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    tree = material.node_tree
    principled = tree.nodes["Principled BSDF"]
    info = tree.nodes.new("ShaderNodeHairInfo")
    ramp = tree.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.interpolation = "EASE"
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = (*root, 1)
    middle = ramp.color_ramp.elements.new(0.62)
    middle.color = (*mid, 1)
    ramp.color_ramp.elements[-1].position = 1.0
    ramp.color_ramp.elements[-1].color = (*tip, 1)
    spread = tree.nodes.new("ShaderNodeMapRange")
    spread.inputs["From Min"].default_value = 0.0
    spread.inputs["From Max"].default_value = 1.0
    spread.inputs["To Min"].default_value = 0.84
    spread.inputs["To Max"].default_value = 1.10
    hsv = tree.nodes.new("ShaderNodeHueSaturation")
    tree.links.new(info.outputs["Intercept"], ramp.inputs["Fac"])
    tree.links.new(info.outputs["Random"], spread.inputs["Value"])
    tree.links.new(spread.outputs["Result"], hsv.inputs["Value"])
    tree.links.new(ramp.outputs["Color"], hsv.inputs["Color"])
    tree.links.new(hsv.outputs["Color"], principled.inputs["Base Color"])
    principled.inputs["Roughness"].default_value = rough
    set_inputs(material, spec=0.42, sheen=0.35, sheen_rough=0.4)
    material.diffuse_color = (*mid, 1)
    return material


def palette():
    return {
        "skin": skin_mat("Golden_Skin", (0.72, 0.46, 0.18), 0.62),
        "skin_light": skin_mat("Golden_SkinLight", (0.86, 0.66, 0.40), 0.6),
        "muzzle": skin_mat("Golden_Muzzle", (0.90, 0.72, 0.48), 0.58),
        "fur_gold": hair_mat("Fur_Gold", (0.32, 0.14, 0.03), (0.72, 0.42, 0.13), (0.92, 0.70, 0.36)),
        "fur_cream": hair_mat("Fur_Cream", (0.50, 0.29, 0.09), (0.84, 0.60, 0.28), (0.97, 0.86, 0.58)),
        "fur_ear": hair_mat("Fur_Ear", (0.26, 0.11, 0.03), (0.58, 0.29, 0.06), (0.84, 0.54, 0.20)),
        "fur_short": hair_mat("Fur_Short", (0.52, 0.30, 0.10), (0.78, 0.50, 0.19), (0.92, 0.72, 0.42), 0.5),
        "nose": set_inputs(mat("Golden_Nose", (0.045, 0.030, 0.026), 0.34), coat=0.35, coat_rough=0.15, spec=0.5),
        "black": set_inputs(mat("Golden_Black", (0.012, 0.009, 0.008), 0.3), spec=0.45),
        "sclera": set_inputs(mat("Golden_Sclera", (0.42, 0.27, 0.15), 0.25), coat=0.6, coat_rough=0.08, spec=0.5),
        "glint": set_inputs(mat("Golden_Glint", (0.95, 0.93, 0.88), 0.2), spec=0.6),
        "iris": set_inputs(mat("Golden_Iris", (0.15, 0.075, 0.03), 0.18), coat=0.8, coat_rough=0.06, spec=0.55),
        "pupil": set_inputs(mat("Golden_Pupil", (0.006, 0.004, 0.004), 0.14), coat=0.8, coat_rough=0.06),
        "lid": skin_mat("Golden_Lid", (0.10, 0.06, 0.04), 0.65),
        "mouth": mat("Golden_MouthInside", (0.16, 0.05, 0.045), 0.6),
        "tongue": set_inputs(mat("Golden_Tongue", (0.78, 0.30, 0.32), 0.38), coat=0.4, coat_rough=0.2, sss=0.2),
        "pad": mat("Golden_Pad", (0.24, 0.13, 0.10), 0.7),
    }


# --------------------------------------------------------------------------- geometry
def tag(obj):
    obj["pet_asset"] = True
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


def ellipsoid(name, center, radii, material, segments=32, rings=18, rotation=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.scale = radii
    if rotation:
        obj.rotation_euler = rotation  # rotates about the ellipsoid centre, before baking
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    obj.data.materials.append(material)
    return tag(smooth(obj))


def sculpt(name, volumes, material, voxel=0.008, ratio=0.6, smooth_iterations=5):
    parts = [ellipsoid(f"{name}-vol{i}", *volume, material, 24, 14) for i, volume in enumerate(volumes)]
    bpy.ops.object.select_all(action="DESELECT")
    for obj in parts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = name
    remesh = obj.modifiers.new("Organic surface", "REMESH")
    remesh.mode = "VOXEL"
    remesh.voxel_size = voxel
    remesh.use_smooth_shade = True
    bpy.ops.object.modifier_apply(modifier=remesh.name)
    soft = obj.modifiers.new("Soft transitions", "SMOOTH")
    soft.factor = 1.0
    soft.iterations = smooth_iterations
    bpy.ops.object.modifier_apply(modifier=soft.name)
    if ratio < 1:
        dec = obj.modifiers.new("Production topology", "DECIMATE")
        dec.ratio = ratio
        bpy.ops.object.modifier_apply(modifier=dec.name)
    return tag(smooth(obj))


def limb(name, points, radii, material, voxel=0.007):
    points = [Vector(p) for p in points]
    volumes = []
    for i in range(len(points) - 1):
        a, b = points[i], points[i + 1]
        ra, rb = radii[i], radii[i + 1]
        steps = max(2, int((b - a).length / (min(ra, rb) * 0.45)))
        for k in range(steps + (1 if i == len(points) - 2 else 0)):
            t = k / steps
            r = ra * (1 - t) + rb * t
            volumes.append((tuple(a.lerp(b, t)), (r, r * 1.08, r)))
    return sculpt(name, volumes, material, voxel, 0.7, 3)


def paint(obj, materials, rule):
    obj.data.materials.clear()
    for material in materials:
        obj.data.materials.append(material)
    for face in obj.data.polygons:
        face.material_index = rule(face.center)


def weight_group(obj, name, fn):
    group = obj.vertex_groups.new(name=name)
    for vert in obj.data.vertices:
        group.add([vert.index], max(0.0, min(1.0, fn(vert.co))), "REPLACE")
    return name


def add_material(obj, material):
    if material.name not in [m.name for m in obj.data.materials]:
        obj.data.materials.append(material)
    return [m.name for m in obj.data.materials].index(material.name) + 1


def fur(obj, name, material, count, length, *, align, normal=0.55, gravity=0.25, children=20,
        length_group=None, density_group=None, clump=0.42, radius=0.014, wave=0.0, seed=1, thickness=0.0009):
    if FAST:
        count = max(60, count // 4)
        children = max(4, children // 2)
    obj.modifiers.new(name, "PARTICLE_SYSTEM")
    psys = obj.particle_systems[-1]
    settings = psys.settings
    settings.name = f"{obj.name}-{name}"
    settings.type = "HAIR"
    settings.count = count
    settings.hair_length = length
    settings.emit_from = "FACE"
    settings.use_emit_random = True
    settings.use_even_distribution = True
    # Blender stores hair length as normal_factor * 4; the grown path length is
    # |initial velocity| * 4. Scale the combed direction so its magnitude yields
    # the requested length instead of metres-long strands.
    magnitude = math.sqrt(normal ** 2 + sum(c * c for c in align))
    scale = length / (4.0 * magnitude)
    settings.use_advanced_hair = True
    settings.normal_factor = normal * scale
    settings.object_align_factor = tuple(c * scale for c in align)
    settings.factor_random = 0.05 * scale
    settings.effector_weights.gravity = gravity
    settings.hair_step = 5
    settings.render_step = 3
    settings.display_step = 2
    settings.use_hair_bspline = True
    settings.child_type = "INTERPOLATED"
    settings.rendered_child_count = children
    if hasattr(settings, "child_percent"):
        settings.child_percent = max(1, children // 6)
    settings.child_radius = radius
    settings.child_roundness = 0.7
    settings.clump_factor = clump
    settings.clump_shape = 0.2
    settings.roughness_1 = 0.02
    settings.roughness_1_size = 0.5
    settings.roughness_endpoint = 0.035
    settings.roughness_end_shape = 1.0
    settings.roughness_2 = 0.012
    settings.roughness_2_size = 1.2
    settings.roughness_2_threshold = 0.0
    settings.child_length = 1.0
    settings.child_length_threshold = 0.0
    if wave:
        settings.kink = "WAVE"
        settings.kink_amplitude = wave
        settings.kink_frequency = 1.4
        settings.kink_shape = 0.15
    settings.material = add_material(obj, material)
    settings.root_radius = 1.0
    settings.tip_radius = 0.12
    settings.radius_scale = thickness
    settings.shape = 0.15
    psys.seed = seed
    if length_group:
        psys.vertex_group_length = length_group
    if density_group:
        psys.vertex_group_density = density_group
    return psys


# --------------------------------------------------------------------------- rig
def canine_rig():
    rig = make_rig()
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")
    bones = rig.data.edit_bones
    up = LIFT
    bones["root"].head, bones["root"].tail = (0, 0, 0.03), (0, 0, 0.15)
    bones["spine"].head, bones["spine"].tail = (0, 0.12, 0.48 + up), (0, -0.20, 0.56 + up)
    bones["head"].head, bones["head"].tail = (0, -0.28, 0.63 + up), (0, -0.50, 0.73 + up)
    bones["ear.L"].head, bones["ear.L"].tail = (-0.11, -0.385, 0.79 + up), (-0.13, -0.41, 0.63 + up)
    bones["ear.R"].head, bones["ear.R"].tail = (0.11, -0.385, 0.79 + up), (0.13, -0.41, 0.63 + up)
    bones["tail.01"].head, bones["tail.01"].tail = (0, 0.30, 0.50 + up), (0, 0.48, 0.54 + up)
    bones["tail.02"].head, bones["tail.02"].tail = (0, 0.48, 0.54 + up), (0, 0.66, 0.52 + up)
    for side, sign in (("L", -1), ("R", 1)):
        x = sign * 0.125
        bones["leg.F" + side].head, bones["leg.F" + side].tail = (x, -0.20, 0.33 + up), (x, -0.215, 0.10)
        bones["paw.F" + side].head, bones["paw.F" + side].tail = (x, -0.215, 0.10), (x, -0.26, 0.03)
        bones["leg.B" + side].head, bones["leg.B" + side].tail = (x, 0.17, 0.30 + up), (x, 0.31, 0.15)
        bones["paw.B" + side].head, bones["paw.B" + side].tail = (x, 0.31, 0.15), (x, 0.27, 0.03)
    bpy.ops.object.mode_set(mode="OBJECT")
    rig.name = "pet-canine-rig"
    rig["rig_family"] = "canine-standard"
    rig["schema"] = "compa-pet-v1"
    return rig


# --------------------------------------------------------------------------- anatomy
def build_body(rig, colors):
    body = sculpt(
        "Golden_Body",
        [
            ((0, -0.02, 0.46), (0.150, 0.220, 0.170)),   # rib cage
            ((0, -0.20, 0.44), (0.140, 0.120, 0.160)),   # forechest
            ((0, -0.16, 0.36), (0.100, 0.140, 0.100)),   # keel
            ((0, -0.14, 0.56), (0.100, 0.140, 0.090)),   # withers
            ((0, 0.16, 0.48), (0.130, 0.140, 0.140)),    # loin
            ((0, 0.26, 0.47), (0.120, 0.090, 0.120)),    # croup
            ((-0.12, -0.18, 0.46), (0.050, 0.080, 0.100)),  # shoulders
            ((0.12, -0.18, 0.46), (0.050, 0.080, 0.100)),
            ((-0.115, 0.22, 0.40), (0.050, 0.085, 0.110)),  # thighs
            ((0.115, 0.22, 0.40), (0.050, 0.085, 0.110)),
            ((0, -0.28, 0.62), (0.090, 0.100, 0.100)),   # neck base
            ((0, -0.33, 0.68), (0.082, 0.085, 0.088)),   # neck
        ],
        colors["skin"],
        0.008,
        0.6,
    )
    paint(body, [colors["skin"], colors["skin_light"]], lambda p: 1 if p.z < 0.33 else 0)
    weight_group(body, "FurLength", lambda p: (
        1.0 if (p.y < -0.16 and p.z < 0.60) else
        0.95 if p.z < 0.35 else
        0.85 if (p.y > 0.14 and p.z < 0.44 and abs(p.x) > 0.06) else
        0.70 if (p.y < -0.22) else
        0.42 if p.z > 0.58 else
        0.55))
    def chest(p):
        front = clamp01((-0.10 - p.y) / 0.08) * clamp01((0.15 - abs(p.x)) / 0.06) * clamp01((0.60 - p.z) / 0.07)
        belly = 0.75 * clamp01((0.35 - p.z) / 0.06)
        return max(front, belly)

    weight_group(body, "Chest", chest)
    weight_group(body, "Coat", lambda p: 1.0 - chest(p))
    bind(body, rig, "spine")
    lift([body])
    fur(body, "Coat", colors["fur_gold"], 3800, 0.075, align=(0, 0.70, -0.50), normal=0.38, gravity=0.22,
        children=22, length_group="FurLength", density_group="Coat", wave=0.003, seed=3, radius=0.016)
    fur(body, "Chest", colors["fur_cream"], 1600, 0.075, align=(0, 0.15, -0.90), normal=0.34, gravity=0.3,
        children=22, length_group="FurLength", density_group="Chest", wave=0.004, seed=7, clump=0.35, radius=0.016)
    return body


def build_head(rig, colors):
    head = sculpt(
        "Golden_Head",
        [
            ((0, -0.37, 0.745), (0.122, 0.125, 0.108)),  # broad skull
            ((0, -0.30, 0.72), (0.105, 0.090, 0.092)),   # occiput
            ((0, -0.46, 0.752), (0.100, 0.052, 0.048)),  # brow / stop
            ((-0.088, -0.43, 0.695), (0.052, 0.062, 0.058)),  # cheeks
            ((0.088, -0.43, 0.695), (0.052, 0.062, 0.058)),
            ((0, -0.535, 0.694), (0.066, 0.075, 0.058)),  # muzzle, deep and square
            ((0, -0.595, 0.692), (0.056, 0.040, 0.050)),  # muzzle tip
            ((-0.048, -0.52, 0.664), (0.030, 0.062, 0.034)),  # flews
            ((0.048, -0.52, 0.664), (0.030, 0.062, 0.034)),
        ],
        colors["skin"],
        0.006,
        0.65,
        4,
    )
    paint(head, [colors["skin"], colors["muzzle"]], lambda p: 1 if (p.y < -0.495 and p.z < 0.748) else 0)
    eyes = [Vector((-0.060, -0.483, 0.758)), Vector((0.060, -0.483, 0.758))]
    weight_group(head, "FurLength", lambda p: (
        0.13 if (p.y < -0.495 and p.z < 0.750) else
        0.30 if p.y < -0.44 else
        1.0 if p.y > -0.33 else
        0.60 if abs(p.x) > 0.085 else 0.45))
    muzzle = lambda p: p.y < -0.495 and p.z < 0.750
    near_eye = lambda p: min((p - e).length for e in eyes) < 0.031
    weight_group(head, "Density", lambda p: 0.0 if (near_eye(p) or muzzle(p) or p.y < -0.615) else 1.0)
    weight_group(head, "Muzzle", lambda p: 0.0 if (near_eye(p) or p.y < -0.622 or not muzzle(p)) else 1.0)
    bind(head, rig, "head")
    lift([head])
    fur(head, "Coat", colors["fur_gold"], 2400, 0.042, align=(0, 0.62, -0.32), normal=0.34, gravity=0.18,
        children=16, length_group="FurLength", density_group="Density", radius=0.010, seed=11)
    # Short velvet combed toward the nose, like a real golden muzzle.
    fur(head, "MuzzleFur", colors["fur_short"], 700, 0.0045, align=(0, -0.8, -0.35), normal=0.3, gravity=0.0,
        children=10, density_group="Muzzle", radius=0.005, seed=13, clump=0.2, thickness=0.0005)
    return head, eyes


def build_face(rig, colors, eyes):
    before = set(bpy.context.scene.objects)
    for sign, center in ((-1, eyes[0]), (1, eyes[1])):
        side = "L" if sign < 0 else "R"
        radius = 0.0215
        # The eyeball sits mostly inside the skull; a slightly larger dark sphere
        # behind it reads as the eyelid margin where the eye emerges from the fur.
        bind(ellipsoid(f"Golden_EyeRim{side}", center + Vector((0, 0.007, 0)), (0.0245, 0.0245, 0.0235), colors["lid"], 24, 12), rig, "head")
        bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=32, radius=radius, location=center)
        eye = bpy.context.object
        eye.name = f"Golden_Eye{side}"
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        smooth(eye)
        for material in (colors["sclera"], colors["iris"], colors["pupil"]):
            eye.data.materials.append(material)
        forward = Vector((sign * 0.24, -1.0, 0.10)).normalized()
        for face in eye.data.polygons:
            d = (face.center - center).normalized().dot(forward)
            face.material_index = 2 if d > 0.90 else 1 if d > 0.52 else 0
        bind(eye, rig, "head")
        bind(ellipsoid(f"Golden_EyeGlint{side}", center + forward * 0.0200 + Vector((-sign * 0.006, 0, 0.008)), (0.0024, 0.0015, 0.0024), colors["glint"], 12, 8), rig, "head")
    bind(ellipsoid("Golden_Nose", (0, -0.640, 0.700), (0.029, 0.021, 0.023), colors["nose"], 26, 14), rig, "head")
    for sign in (-1, 1):
        bind(ellipsoid(f"Golden_Nostril{sign}", (sign * 0.0118, -0.659, 0.696), (0.0068, 0.005, 0.0065), colors["black"], 12, 8), rig, "head")
    bind(ellipsoid("Golden_Philtrum", (0, -0.660, 0.684), (0.0022, 0.004, 0.012), colors["black"], 10, 6), rig, "head")
    jaw = sculpt(
        "Golden_LowerJaw",
        [
            ((0, -0.525, 0.612), (0.048, 0.072, 0.027)),
            ((0, -0.578, 0.616), (0.038, 0.034, 0.023)),
        ],
        colors["muzzle"],
        0.006,
        0.7,
        3,
    )
    bind(jaw, rig, "head")
    bind(ellipsoid("Golden_MouthInside", (0, -0.545, 0.637), (0.042, 0.060, 0.010), colors["mouth"], 20, 10), rig, "head")
    bind(ellipsoid("Golden_Tongue", (0, -0.590, 0.630), (0.021, 0.040, 0.008), colors["tongue"], 22, 12, rotation=(0.24, 0, 0)), rig, "head")
    for sign in (-1, 1):
        bind(ellipsoid(f"Golden_LipCorner{sign}", (sign * 0.047, -0.505, 0.648), (0.006, 0.012, 0.004), colors["black"], 10, 6), rig, "head")
    lift(set(bpy.context.scene.objects) - before)


def build_ears(rig, colors):
    for sign, side in ((-1, "L"), (1, "R")):
        ear = sculpt(
            f"Golden_Ear{side}",
            [
                ((sign * 0.118, -0.395, 0.790), (0.024, 0.048, 0.038)),
                ((sign * 0.140, -0.420, 0.710), (0.020, 0.058, 0.072)),
                ((sign * 0.142, -0.430, 0.622), (0.016, 0.046, 0.044)),
            ],
            colors["skin"],
            0.006,
            0.75,
            3,
        )
        weight_group(ear, "Inner", lambda p, s=sign: 0.2 if (s * p.x < 0.126 and p.y < -0.40) else 1.0)
        bind(ear, rig, f"ear.{side}")
        lift([ear])
        fur(ear, "Fur", colors["fur_ear"], 620, 0.055, align=(sign * 0.12, 0.05, -0.9), normal=0.22, gravity=0.35,
            children=18, density_group="Inner", radius=0.010, wave=0.004, seed=5 + (sign > 0))


def build_legs(rig, colors):
    for sign, side in ((-1, "L"), (1, "R")):
        x = sign * 0.125
        front = limb(f"Golden_ForelegF{side}", [(x, -0.19, 0.40 + LIFT), (x, -0.20, 0.33 + LIFT), (x, -0.215, 0.10)], [0.050, 0.042, 0.034], colors["skin"])
        weight_group(front, "FurLength", lambda p: (1.0 if (p.y > -0.20 and p.z > 0.16) else 0.55 if p.z > 0.16 else 0.35))
        bind(front, rig, f"leg.F{side}")
        fur(front, "Fur", colors["fur_gold"], 560, 0.036, align=(0, 0.35, -0.85), normal=0.32, gravity=0.3,
            children=14, length_group="FurLength", radius=0.009, seed=21)
        paw(rig, colors, x, -0.245, "F", side)
        rear = limb(f"Golden_HindlegB{side}", [(x, 0.20, 0.36 + LIFT), (x, 0.17, 0.30 + LIFT), (x, 0.31, 0.15), (x, 0.28, 0.08)], [0.054, 0.044, 0.032, 0.030], colors["skin"])
        weight_group(rear, "FurLength", lambda p: (1.0 if (p.y > 0.22 and p.z > 0.20) else 0.55 if p.z > 0.16 else 0.35))
        bind(rear, rig, f"leg.B{side}")
        fur(rear, "Fur", colors["fur_gold"], 600, 0.040, align=(0, 0.45, -0.8), normal=0.32, gravity=0.3,
            children=14, length_group="FurLength", radius=0.009, seed=23)
        paw(rig, colors, x, 0.265, "B", side)


def paw(rig, colors, x, y, letter, side):
    forward = -1  # toes point toward the nose on every paw
    base = ellipsoid(f"Golden_Paw{letter}{side}", (x, y, 0.040), (0.046, 0.060, 0.034), colors["skin_light"], 22, 12)
    bind(base, rig, f"paw.{letter}{side}")
    fur(base, "Fur", colors["fur_short"], 220, 0.012, align=(0, forward * 0.4, -0.5), normal=0.5, gravity=0.1, children=10, radius=0.008, seed=31)
    for d in (-1.5, -0.5, 0.5, 1.5):
        toe = ellipsoid(f"Golden_Toe{letter}{side}{d}", (x + d * 0.017, y + forward * 0.050, 0.026), (0.012, 0.018, 0.012), colors["skin_light"], 12, 8)
        bind(toe, rig, f"paw.{letter}{side}")
    bind(ellipsoid(f"Golden_Pad{letter}{side}", (x, y + forward * 0.01, 0.009), (0.026, 0.032, 0.006), colors["pad"], 14, 8), rig, f"paw.{letter}{side}")


def build_tail(rig, colors):
    volumes = []
    for i in range(10):
        t = i / 9
        volumes.append((
            (0.012 * math.sin(t * math.pi), 0.29 + 0.37 * t, 0.50 - 0.02 * t + 0.10 * t * (1 - t)),
            (0.046 * (1 - t * 0.55), 0.058 * (1 - t * 0.45), 0.046 * (1 - t * 0.55)),
        ))
    tail = sculpt("Golden_Tail", volumes, colors["skin"], 0.007, 0.7, 3)

    def plume(p):
        t = max(0.0, min(1.0, (p.y - 0.29) / 0.37))
        spine_z = 0.50 - 0.02 * t + 0.10 * t * (1 - t)
        return (0.55 if p.z > spine_z else 1.0) * (1.0 - 0.3 * t)

    weight_group(tail, "FurLength", plume)
    bind(tail, rig, "tail.01")
    second = tail.vertex_groups.new(name="tail.02")
    first = tail.vertex_groups.get("tail.01")
    for vert in tail.data.vertices:
        t = (vert.co.y - 0.29) / 0.37
        w = max(0.0, min(1.0, (t - 0.40) / 0.40))
        first.add([vert.index], 1 - w, "REPLACE")
        second.add([vert.index], w, "REPLACE")
    lift([tail])
    fur(tail, "Plume", colors["fur_gold"], 1500, 0.095, align=(0, 0.30, -0.70), normal=0.5, gravity=0.42,
        children=22, length_group="FurLength", radius=0.016, wave=0.005, seed=41, clump=0.38)


# --------------------------------------------------------------------------- posing
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


# --------------------------------------------------------------------------- studio
def setup_studio():
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    eevee = scene.eevee
    eevee.taa_render_samples = 24 if FAST else 48
    # Raytracing off: its denoiser tiles bloomed into white squares around the
    # small glossy eye/nose objects. Shadows get the largest pool and finest LOD.
    for attr, value in (("use_shadows", True), ("use_raytracing", False), ("shadow_ray_count", 3), ("shadow_step_count", 6),
                        ("shadow_resolution_scale", 1.0), ("shadow_pool_size", "1024")):
        if hasattr(eevee, attr):
            try:
                setattr(eevee, attr, value)
            except TypeError:
                pass
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.resolution_percentage = 100
    # Standard keeps the warm golden hues that AgX desaturates towards cream.
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = -0.35
    world = bpy.data.worlds.new("Golden studio")
    background = world.node_tree.nodes.get("Background")
    background.inputs[0].default_value = (0.80, 0.74, 0.66, 1)
    background.inputs[1].default_value = 0.22
    scene.world = world
    bpy.ops.mesh.primitive_plane_add(size=20, location=(0, 0, 0))
    ground = bpy.context.object
    ground.name = "Studio_Ground"
    ground.hide_render = True
    ground.data.materials.append(mat("Preview_Ground", (0.90, 0.85, 0.77), 0.9))
    for name, location, energy, size, color in (
        ("Key", (-1.7, -2.3, 2.6), 140, 2.6, (1.0, 0.90, 0.78)),
        ("Fill", (2.4, -1.4, 1.5), 50, 2.6, (0.86, 0.90, 1.0)),
        ("Rim", (0.9, 2.4, 2.2), 120, 1.8, (1.0, 0.92, 0.80)),
        ("Top", (0.0, -0.3, 3.4), 36, 3.0, (1.0, 0.96, 0.90)),
    ):
        bpy.ops.object.light_add(type="AREA", location=location)
        light = bpy.context.object
        light.name = name
        light.data.energy = energy
        light.data.shape = "DISK"
        light.data.size = size
        light.data.color = color
        for attr, value in (("shadow_maximum_resolution", 0.0004), ("use_shadow_jitter", True), ("shadow_filter_radius", 1.5)):
            if hasattr(light.data, attr):
                setattr(light.data, attr, value)
        aim(light, (0, -0.05, 0.42 + LIFT))
    bpy.ops.object.camera_add(location=(1.5, -2.3, 1.0))
    camera = bpy.context.object
    camera.name = "CAM_GOLDEN"
    camera.data.lens = 70
    scene.camera = camera
    return camera


def render_view(path, camera, location, target, *, lens=70, ortho=None, resolution=(720, 720)):
    scene = bpy.context.scene
    camera.location = location
    camera.data.type = "ORTHO" if ortho else "PERSP"
    camera.data.lens = lens
    if ortho:
        camera.data.ortho_scale = ortho
    aim(camera, target)
    scene.render.resolution_x, scene.render.resolution_y = resolution
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    print("RENDERED", path.name, flush=True)


HERO_POSE = ({"head": (0.02, 0, 0.16), "tail.01": (0.55, 0, 0.30), "tail.02": (0.35, 0, 0.15)}, {})
TURN_POSE = ({"tail.01": (0.35, 0, 0.0), "tail.02": (0.25, 0, 0.0)}, {})
# root points +Z, so a negative local Y translation lowers the whole dog.
POSES = {
    "pose-sit": ({"spine": (-0.30, 0, 0), "leg.FL": (0.30, 0, 0), "leg.FR": (0.30, 0, 0),
                  "leg.BL": (-1.15, 0, 0), "leg.BR": (-1.15, 0, 0), "paw.BL": (0.75, 0, 0), "paw.BR": (0.75, 0, 0),
                  "head": (0.18, 0, 0.10), "tail.01": (-0.25, 0, 0.18), "tail.02": (0.05, 0, 0.12)}, {"root": (0, -0.13, 0)}),
    "pose-rest": ({"leg.FL": (-1.15, 0, 0), "leg.FR": (-1.15, 0, 0), "leg.BL": (-1.10, 0, 0), "leg.BR": (-1.10, 0, 0),
                   "paw.FL": (1.1, 0, 0), "paw.FR": (1.1, 0, 0), "paw.BL": (1.05, 0, 0), "paw.BR": (1.05, 0, 0),
                   "head": (0.14, 0, 0.12), "tail.01": (-0.3, 0, 0.2)}, {"root": (0, -0.22, 0)}),
    "pose-trot": ({"leg.FL": (0.45, 0, 0), "leg.BR": (0.42, 0, 0), "leg.FR": (-0.42, 0, 0), "leg.BL": (-0.40, 0, 0),
                   "paw.FL": (-0.3, 0, 0), "paw.BR": (-0.25, 0, 0), "head": (-0.05, 0, 0.08), "tail.01": (0.15, 0, 0.1), "tail.02": (0.2, 0, 0.1)},
                  {}),
    "pose-play": ({"spine": (0.34, 0, 0), "head": (-0.10, 0, 0.14), "leg.FL": (-0.95, 0, 0), "leg.FR": (-0.90, 0, 0),
                   "paw.FL": (0.9, 0, 0), "paw.FR": (0.85, 0, 0), "leg.BL": (-0.34, 0, 0), "leg.BR": (-0.34, 0, 0),
                   "tail.01": (0.55, 0, 0.30), "tail.02": (0.30, 0, 0.22)},
                  {"root": (0, -0.05, 0)}),
    "pose-lookup": ({"head": (-0.34, 0, 0.06), "ear.L": (0.10, 0, 0), "ear.R": (0.10, 0, 0), "tail.01": (0.12, 0, 0.22), "tail.02": (0.14, 0, 0.16)}, {}),
}


def wanted(name):
    if "--views" not in sys.argv:
        return True
    views = sys.argv[sys.argv.index("--views") + 1].split(",")
    return name in views


def render_all(rig, camera):
    hero_target = (0, -0.09, 0.44 + LIFT)
    if wanted("hero"):
        apply_custom(rig, *HERO_POSE)
        render_view(STAGE / "hero.png", camera, (1.80, -2.10, 0.95), hero_target, lens=68, resolution=(1000, 1200))
    if ONLY_HERO:
        return
    # Long lens far away instead of orthographic: EEVEE shadow tiles stay fine.
    apply_custom(rig, *TURN_POSE)
    target = (0, -0.02, 0.42 + LIFT)
    far, lens = 6.4, 150
    for name, direction in (("front", (0, -1, 0.06)), ("side", (1, 0, 0.06)), ("back", (0, 1, 0.06)), ("three-quarter", (0.72, -0.72, 0.09))):
        if wanted(name):
            d = Vector(direction).normalized() * far
            render_view(STAGE / f"{name}.png", camera, (d.x, d.y, target[2] + d.z), target, lens=lens, resolution=(700, 700))
    if wanted("face"):
        apply_custom(rig, *HERO_POSE)
        render_view(STAGE / "face.png", camera, (0.55, -1.40, 0.86 + LIFT), (0, -0.50, 0.72 + LIFT), lens=90, resolution=(900, 760))
    for name, (rotations, translations) in POSES.items():
        if not wanted(name):
            continue
        apply_custom(rig, rotations, translations)
        target = (0, -0.02, 0.24 + LIFT) if name in ("pose-rest", "pose-play") else (0, -0.02, 0.36 + LIFT)
        render_view(STAGE / f"{name}.png", camera, (1.55, -2.35, 0.95), target, lens=70, resolution=(760, 760))
    clear_pose(rig)


def render_selector_preview(rig, camera):
    scene = bpy.context.scene
    scene.render.film_transparent = False
    scene.render.image_settings.file_format = "WEBP"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.image_settings.quality = 90
    world = scene.world
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.96, 0.93, 0.87, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.30
    ground = bpy.data.objects.get("Studio_Ground")
    if ground:
        ground.hide_render = False
    apply_custom(rig, *HERO_POSE)
    render_view(PREVIEWS / "golden-retriever.webp", camera, (1.5, -2.35, 1.05), (0, -0.04, 0.42 + LIFT), lens=62, resolution=(720, 720))
    shutil.copy2(PREVIEWS / "golden-retriever.webp", MOBILE / "golden-retriever.webp")
    clear_pose(rig)
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    if ground:
        ground.hide_render = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.80, 0.74, 0.66, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.22


# --------------------------------------------------------------------------- main
def build_golden():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    colors = palette()
    rig = canine_rig()
    head, eyes = build_head(rig, colors)
    build_face(rig, colors, eyes)
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
    strands = 0
    for obj in parts:
        for psys in obj.particle_systems:
            strands += psys.settings.count * psys.settings.rendered_child_count
    bpy.context.scene["asset_manifest"] = json.dumps({
        "id": "golden-retriever", "schema": "compa-pet-v1", "revision": "stylized-realistic-fur-v1",
        "rig": "canine-standard", "height": round(0.85 + LIFT, 2), "colliderRadius": 0.32,
        "meshCount": len(parts), "vertices": vertices, "renderedHairStrands": strands,
        "note": "Hair particles stay in the Blender master; the GLB carries the skinned base mesh.",
    })
    return rig, parts, vertices, strands


def main():
    backup_once(SOURCE / "golden-retriever-master.blend")
    backup_once(MODELS / "pet-golden-retriever.glb")
    backup_once(PREVIEWS / "golden-retriever.webp")
    rig, parts, vertices, strands = build_golden()
    camera = setup_studio()
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / "golden-retriever-master.blend"))
    if not ONLY_HERO and "--views" not in sys.argv:
        export_selected(MODELS / "pet-golden-retriever.glb", [rig] + parts)
    render_all(rig, camera)
    if not ONLY_HERO and wanted("preview"):
        render_selector_preview(rig, camera)
    manifest = {
        "id": "golden-retriever", "name": "Miel", "revision": "stylized-realistic-fur-v1",
        "vertices": vertices, "renderedHairStrands": strands,
        "master": "packages/assets/3d/source/pets/golden-retriever-master.blend",
        "glb": "apps/web/public/selection/models/pet-golden-retriever.glb",
        "preview": "apps/web/public/selection/pets/golden-retriever.webp",
        "sheet": "renders/golden-stylized/miel-character-sheet.png",
        "renders": sorted(path.name for path in STAGE.glob("*.png")),
    }
    (STAGE / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print("GOLDEN_REALISTIC_READY", vertices, strands, flush=True)


if __name__ == "__main__":
    main()
