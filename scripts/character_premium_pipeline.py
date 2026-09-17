"""Upgrade the inspected v3 masters in place on copies, preserve rigs, render and export.

Blender CLI: blender --background --python scripts/character_premium_pipeline.py -- build harper
Modes: build [id|all], preview [id], render [id|all], presentation, export [id|all].
Re-running starts from the same preserved v3 master; assets never accumulate.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
import bmesh
from mathutils import Vector, Matrix, Quaternion

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools' / 'blender'))
from build_harper import add_box, parent_to_bone, look_at, material, rgba, inspect_glb
from build_companion_collection import CHARACTERS, SLOTS

ASSETS = ROOT / 'packages' / 'assets' / '3d'
SOURCES = ASSETS / 'source'
RENDERS = ROOT / 'renders'


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False), encoding='utf-8')


class Context:
    def __init__(self, rig, character):
        self.rig, self.character = rig, character
        self.character_id = character.id

    def collection(self, slot):
        name = 'SLOT_' + slot.upper()
        collection = bpy.data.collections.get(name)
        if collection is None:
            collection = bpy.data.collections.new(name)
            bpy.context.scene.collection.children.link(collection)
        return collection

    def mat(self, key):
        mat = bpy.data.materials.get(f'MAT_{self.character_id.upper()}_{key.upper()}')
        defaults={'paper':'#EEE6D8','book':'#344B73','black':'#18171B',
                  'white':'#F6F2EA','metal':'#9A9188','sole':'#D5CEC2'}
        if not mat and key in defaults:
            mat = material(f'MAT_{self.character_id.upper()}_{key.upper()}',
                           defaults[key], .82)
        if not mat and isinstance(getattr(self.character, key, None), str):
            color = getattr(self.character, key)
            if color.startswith('#'):
                mat = material(f'MAT_{self.character_id.upper()}_{key.upper()}', color, .74)
        if not mat:
            raise KeyError(f'Missing inspected material: {key}')
        return mat

    def find(self, name):
        return bpy.data.objects.get(name)

    def remove(self, obj):
        if obj is not None:
            bpy.data.objects.remove(obj, do_unlink=True)

    def attach(self, obj, slot, bone, item='premium'):
        world = obj.matrix_basis.copy() if obj.parent is None else obj.matrix_world.copy()
        target = self.collection(slot)
        for owner in list(obj.users_collection):
            owner.objects.unlink(obj)
        target.objects.link(obj)
        obj['compa_slot'], obj['compa_item'] = slot, item
        obj['compa_rig'] = 'compa-humanoid-v2'
        # Bone-parent transform is measured at the tail. Set its inverse explicitly
        # to avoid re-evaluating every bevel in the scene after each stitch.
        pose_bone = self.rig.pose.bones[bone]
        parent = self.rig.matrix_world @ pose_bone.matrix @ Matrix.Translation((0, pose_bone.length, 0))
        obj.parent, obj.parent_type, obj.parent_bone = self.rig, 'BONE', bone
        obj.matrix_parent_inverse = parent.inverted()
        obj.matrix_basis = world
        return obj

    def box(self, name, loc, dims, mat, slot, bone, bevel=.002, rotation=(0, 0, 0)):
        vertices = [(x*dims[0]/2,y*dims[1]/2,z*dims[2]/2)
                    for x,y,z in ((-1,-1,-1),(-1,-1,1),(-1,1,-1),(-1,1,1),(1,-1,-1),(1,-1,1),(1,1,-1),(1,1,1))]
        data = bpy.data.meshes.new(name+'Geometry')
        data.from_pydata(vertices, [], [(0,4,6,2),(1,3,7,5),(0,1,5,4),(2,6,7,3),(0,2,3,1),(4,5,7,6)])
        data.update()
        obj = bpy.data.objects.new(name, data)
        self.collection(slot).objects.link(obj)
        obj.location, obj.rotation_euler = loc, rotation
        obj.data.materials.append(mat)
        if bevel > 0:
            mod = obj.modifiers.new('Tailored micro bevel', 'BEVEL')
            mod.width, mod.segments = min(bevel, min(dims)*.22), 2
        return self.attach(obj, slot, bone)


def character_meshes(rig):
    return [o for o in bpy.context.scene.objects if o.type == 'MESH' and
            (o.get('compa_slot') or any(m.type == 'ARMATURE' and m.object == rig for m in o.modifiers))]


def bounds(objects):
    dep = bpy.context.evaluated_depsgraph_get()
    points = [o.evaluated_get(dep).matrix_world @ Vector(p)
              for o in objects for p in o.evaluated_get(dep).bound_box]
    return ([min(p[i] for p in points) for i in range(3)],
            [max(p[i] for p in points) for i in range(3)])


def finish_surfaces(ctx):
    repaired = 0
    for obj in character_meshes(ctx.rig):
        # Small nondestructive bevels; polygon normals remain flat on the main planes.
        for mod in obj.modifiers:
            if mod.type == 'BEVEL':
                dims = sorted(obj.dimensions)
                mod.width = min(mod.width, dims[1] * .018, dims[0] * .18)
                mod.segments = 2
                mod.limit_method = 'ANGLE'
                mod.harden_normals = True
        if not obj.data.shape_keys:
            bm = bmesh.new()
            bm.from_mesh(obj.data)
            bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
            bm.to_mesh(obj.data)
            bm.free()
            repaired += 1
        # Avoid plastic high-frequency bumps; retain material differences and small roughness variations.
    for mat in bpy.data.materials:
        if not mat.use_nodes:
            continue
        for node in mat.node_tree.nodes:
            if node.type == 'BUMP':
                node.inputs['Distance'].default_value = min(node.inputs['Distance'].default_value, .0004)
                node.inputs['Strength'].default_value = min(node.inputs['Strength'].default_value, .045)
    return repaired


def studio(ctx):
    scene = bpy.context.scene
    for obj in list(scene.objects):
        if obj.type in ('LIGHT', 'CAMERA') or (obj.type == 'MESH' and not obj.get('compa_slot')):
            ctx.remove(obj)
    for name in ('LIGHTING', 'CAMERAS', 'ENVIRONMENT', 'RENDER_SETUP'):
        if not bpy.data.collections.get(name):
            coll = bpy.data.collections.new(name)
            scene.collection.children.link(coll)
    environment = bpy.data.collections['ENVIRONMENT']
    # A broad, smooth cyclorama. There is no visible floor/wall corner.
    profile = [(-6., -.012), (2., -.012)]
    profile += [(2. + 1.8 * math.sin(i * math.pi / 64), 1.788 - 1.8 * math.cos(i * math.pi / 64)) for i in range(1, 33)]
    profile.append((3.8, 6.))
    verts = [(x, y, z) for x in (-8., 8.) for y, z in profile]
    n = len(profile)
    mesh = bpy.data.meshes.new('CYC_SmoothSweep')
    mesh.from_pydata(verts, [], [(i, i + 1, n + i + 1, n + i) for i in range(n - 1)])
    mesh.update()
    for face in mesh.polygons:
        face.use_smooth = True
    floor = bpy.data.objects.new('ENV_Cyclorama', mesh)
    environment.objects.link(floor)
    floor.data.materials.append(material('MAT_CYC_Limestone', '#C7C1B8', .87))
    lighting = bpy.data.collections['LIGHTING']
    for name, loc, power, size, color in (
        ('KEY_Softbox', (-3.0, -4.0, 4.5), 440, 2.8, (1., .88, .75)),
        ('FILL_Softbox', (3.8, -2.0, 2.8), 165, 3.0, (.86, .92, 1.)),
        ('RIM_Softbox', (1.5, 2.5, 3.6), 560, 2.2, (1., .86, .71)),
    ):
        data = bpy.data.lights.new(name, 'AREA')
        data.energy, data.shape, data.size, data.color = power, 'DISK', size, color
        obj = bpy.data.objects.new(name, data)
        lighting.objects.link(obj)
        obj.location = loc
        look_at(obj, (0, 0, 1.05))
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get('Background')
    background.inputs['Color'].default_value = rgba('#B9C2CE')
    background.inputs['Strength'].default_value = .22
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 256
    scene.cycles.use_denoising = True
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = .025
    scene.cycles.max_bounces = 6
    scene.cycles.transmission_bounces = 4
    scene.cycles.transparent_max_bounces = 6
    scene.cycles.device = 'CPU'
    scene.render.threads_mode = 'FIXED'
    scene.render.threads = 8
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.render.resolution_x = scene.render.resolution_y = 2048
    low, high = bounds(character_meshes(ctx.rig))
    height = high[2] - low[2]
    cameras = bpy.data.collections['CAMERAS']
    for label, angle in [('MAIN', 24), ('FRONT', 0), ('SIDE_LEFT', -90), ('BACK', 180), ('SIDE_RIGHT', 90), ('3QUARTER', 24), ('3QUARTER_BACK', 145)]:
        data = bpy.data.cameras.new('CAM_CHARACTER_' + label)
        cam = bpy.data.objects.new(data.name, data)
        cameras.objects.link(cam)
        a = math.radians(angle)
        cam.location = (math.sin(a) * 3.9, -math.cos(a) * 3.9, height * .70)
        data.lens = 65
        look_at(cam, (0, 0, height * .51))
        data.dof.use_dof = label == 'MAIN'
        data.dof.focus_distance = (cam.location - Vector((0, -.19, height * .84))).length
        data.dof.aperture_fstop = 8.
    scene.camera = bpy.data.objects['CAM_CHARACTER_MAIN']
    scene.render.filepath = str(RENDERS / 'character_hero.png')
    # Open the copied .blend on the finished model, without a selected bone overlay.
    bpy.ops.object.select_all(action='DESELECT')
    ctx.rig.show_in_front = False
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == 'VIEW_3D':
                area.spaces.active.region_3d.view_perspective = 'CAMERA'
                area.spaces.active.shading.type = 'MATERIAL'


def build(character):
    from premium_face_hair import upgrade as upgrade_face
    from premium_garments import upgrade as upgrade_garments
    from premium_validation import audit_scene, validate_scene
    source = SOURCES / f'{character.id}-master-v3.blend'
    source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
    bpy.ops.wm.open_mainfile(filepath=str(source))
    rig = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
    ctx = Context(rig, character)
    bpy.context.preferences.filepaths.save_version = 0
    destination = ROOT / 'character_master_premium.blend' if character.id == 'harper' else SOURCES / f'{character.id}-master-v4.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(destination), compress=True)
    baseline = audit_scene(rig)
    before_test = validate_scene(rig)
    write_json(SOURCES / f'{character.id}-v4-before.audit.json', {'inventory': baseline, 'validation': before_test})
    # v3 scaled the rig object by preset height but kept the meshes in canonical
    # world space. Restore the canonical object scale before binding new cloth;
    # preserve existing mesh world positions and every bone's rest matrix.
    old_scale=list(rig.scale)
    original_worlds={obj:obj.matrix_world.copy() for obj in character_meshes(rig)}
    rig.scale=(1,1,1)
    bpy.context.view_layer.update()
    for obj,world in original_worlds.items():obj.matrix_world=world
    bpy.context.view_layer.update()
    changes = {'faceHair': upgrade_face(ctx), 'garments': upgrade_garments(ctx)}
    changes['originalRigObjectScale']=old_scale
    changes['normalCheckedMeshes'] = finish_surfaces(ctx)
    bpy.context.view_layer.update()
    low, high = bounds(character_meshes(rig))
    measured_before = high[2] - low[2]
    rig.scale *= character.height / measured_before
    bpy.context.view_layer.update()
    low, high = bounds(character_meshes(rig))
    rig.location.z -= low[2]
    bpy.context.view_layer.update()
    low, high = bounds(character_meshes(rig))
    rig['compa_measured_height_m'] = high[2] - low[2]
    rig['compa_asset_version'] = 4
    validation = validate_scene(rig, baseline)
    if not validation['passed']:
        write_json(SOURCES / f'{character.id}-v4-failed.audit.json', validation)
        raise RuntimeError('Rig validation failed; inspect audit before publishing')
    after_audit=audit_scene(rig)
    write_json(SOURCES / f'{character.id}-v4-after.audit.json', after_audit)
    studio(ctx)
    bpy.ops.wm.save_as_mainfile(filepath=str(destination), compress=True)
    if character.id == 'harper':
        bpy.ops.wm.save_as_mainfile(filepath=str(SOURCES / 'harper-master-v4.blend'), compress=True, copy=True)
    assert source_hash == hashlib.sha256(source.read_bytes()).hexdigest(), 'Source changed'
    report = {'character': character.name, 'id': character.id, 'schema': 'compa-humanoid-v2',
              'assetVersion': 4, 'heightMeters': high[2] - low[2], 'sourceUnchanged': True,
              'originalSourceSha256': source_hash, 'source': destination.relative_to(ROOT).as_posix(),
              'slots': list(SLOTS), 'bones': len(rig.data.bones), 'changes': changes, 'validation': validation}
    report['geometryBefore']=baseline['character']
    report['geometryAfter']=after_audit['character']
    write_json(SOURCES / f'{character.id}-master-v4.report.json', report)
    print('BUILT_V4', character.id, flush=True)


def open_master(character):
    path = ROOT / 'character_master_premium.blend' if character.id == 'harper' else SOURCES / f'{character.id}-master-v4.blend'
    bpy.ops.wm.open_mainfile(filepath=str(path))
    return next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')


def render_image(path, camera, size=1024, samples=64, engine='CYCLES'):
    scene = bpy.context.scene
    path.parent.mkdir(parents=True, exist_ok=True)
    scene.camera = camera
    scene.render.resolution_x = scene.render.resolution_y = size
    scene.render.resolution_percentage = 100
    scene.render.engine = engine
    scene.cycles.samples = samples
    scene.render.filepath = str(path)
    print('RENDER_START', path.name, flush=True)
    bpy.ops.render.render(write_still=True)
    print('RENDER_DONE', path.name, flush=True)


def academic_hero_pose(rig):
    if rig.animation_data:rig.animation_data.action=None
    for bone in rig.pose.bones:
        bone.matrix_basis=Matrix.Identity(4)
        bone.rotation_mode='XYZ'
    upper=rig.pose.bones['upper_arm.L']
    rest=upper.bone.matrix_local.to_quaternion()
    upper.rotation_euler=(rest.inverted() @ Quaternion((0,1,0),-.20) @ rest).to_euler()
    rig.pose.bones['forearm.L'].rotation_euler=(-1.14,0,0)
    rig.pose.bones['hand.L'].rotation_euler=(1.14,0,0)
    rig.pose.bones['forearm.R'].rotation_euler=(-.10,0,0)
    rig.pose.bones['head'].rotation_euler=(0,0,.035)
    bpy.context.view_layer.update()


def export_asset(character):
    rig = open_master(character)
    objects = character_meshes(rig)
    # Runtime LOD0 retains every designed piece with a single chamfer segment.
    # The editable/render master keeps the 2-segment bevels for close-ups.
    for obj in objects:
        for mod in obj.modifiers:
            if mod.type=='BEVEL':mod.segments=1
    bpy.context.view_layer.update()
    # Batch strictly within slot/item/bone. Cross-slot joining would break clothing swaps.
    batches = {}
    weighted = []
    depsgraph=bpy.context.evaluated_depsgraph_get()
    for obj in objects:
        if any(m.type == 'ARMATURE' for m in obj.modifiers):
            weighted.append(obj)
            continue
        key = (obj.get('compa_slot'), obj.get('compa_item', 'premium'), obj.parent_bone)
        batches.setdefault(key, []).append(obj)
    exported = list(weighted)
    ctx=Context(rig,character)
    for (slot, item, bone), batch in batches.items():
        # Evaluate bevels once and assemble in world coordinates. No destructive
        # joins of editable originals or repeated full-scene operator updates.
        verts=[]; faces=[]; materials=[]; indices=[]; smooth=[]
        bone_to_rest=(rig.matrix_world @ rig.data.bones[bone].matrix_local @
                      (rig.matrix_world @ rig.pose.bones[bone].matrix).inverted())
        for obj in batch:
            evaluated=obj.evaluated_get(depsgraph)
            mesh=evaluated.to_mesh()
            offset=len(verts)
            verts.extend(tuple(bone_to_rest @ evaluated.matrix_world @ v.co) for v in mesh.vertices)
            remap=[]
            for mat in mesh.materials:
                mat=bpy.data.materials[mat.name]
                if mat not in materials:materials.append(mat)
                remap.append(materials.index(mat))
            for face in mesh.polygons:
                faces.append(tuple(offset+i for i in face.vertices))
                indices.append(remap[face.material_index])
                smooth.append(face.use_smooth)
            evaluated.to_mesh_clear()
        name=f'SLOT_{slot}__{item}__{bone}'
        data=bpy.data.meshes.new(name+'Geometry')
        data.from_pydata(verts,[],faces)
        for mat in materials:data.materials.append(mat)
        for face,index,smooth_face in zip(data.polygons,indices,smooth):
            face.material_index=index
            face.use_smooth=smooth_face
        data.update()
        active=bpy.data.objects.new(name,data)
        ctx.collection(slot).objects.link(active)
        active.parent=rig
        active.matrix_parent_inverse=rig.matrix_world.inverted()
        active.matrix_basis=Matrix.Identity(4)
        active['compa_slot'],active['compa_item']=slot,item
        active['compa_rigid_bone']=bone
        group=active.vertex_groups.new(name=bone)
        group.add(list(range(len(data.vertices))),1.0,'REPLACE')
        armature=active.modifiers.new('Rigid single-bone skin','ARMATURE')
        armature.object=rig
        exported.append(active)
    # Procedural bumps are Blender-only. Export constant PBR fallbacks honestly; no missing texture requests.
    for mat in bpy.data.materials:
        if mat.use_nodes:
            for node in mat.node_tree.nodes:
                if node.type == 'BSDF_PRINCIPLED':
                    for name in ('Normal', 'Roughness'):
                        for link in list(node.inputs[name].links):
                            mat.node_tree.links.remove(link)
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action='DESELECT')
    for obj in [rig, *exported]:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = rig
    path = ASSETS / f'compa-{character.id}-premium.glb'
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True,
        export_animations=True, export_extras=True, export_apply=True, export_yup=True)
    from premium_glb import optimize_skin_attributes
    packed=optimize_skin_attributes(path)
    report_path = SOURCES / f'{character.id}-master-v4.report.json'
    report = json.loads(report_path.read_text(encoding='utf-8'))
    report.update(inspect_glb(path))
    report.update({'export': path.relative_to(ROOT).as_posix(), 'glbBytes': path.stat().st_size,
                   'preview': f'packages/assets/3d/previews/compa-{character.id}-premium.png',
                   'renderEngine': 'CYCLES', 'renderSamples': 256 if character.id=='harper' else 64, 'denoise': True})
    report['glbSha256']=hashlib.sha256(path.read_bytes()).hexdigest()
    report['skinPacking']=packed
    write_json(report_path, report)
    print('EXPORTED_V4', character.id, report['exportedTriangles'], report['glbBytes'], flush=True)


def presentation():
    c = next(c for c in CHARACTERS if c.id == 'harper')
    rig = open_master(c)
    for name, cam in [('front', 'FRONT'), ('side_left', 'SIDE_LEFT'), ('back', 'BACK'), ('side_right', 'SIDE_RIGHT'), ('3quarter', '3QUARTER'), ('3quarter_back', '3QUARTER_BACK')]:
        render_image(RENDERS / f'character_{name}.png', bpy.data.objects['CAM_CHARACTER_' + cam])
    # Fixed geometry targets use evaluated bounds after the uniform size normalization.
    groups = {
        'face': lambda o: any(x in o.name.lower() for x in ('face', 'eye', 'brow', 'glasses', 'head', 'ear')),
        'hair': lambda o: o.get('compa_slot') == 'hair',
        'glasses': lambda o: 'glasses' in o.name.lower(),
        'backpack': lambda o: o.get('compa_slot') == 'back',
        'books': lambda o: o.get('compa_slot') == 'hand_prop' or ('hand' in o.name.lower() and o.parent_bone == 'hand.L'),
        'shoes': lambda o: o.get('compa_slot') == 'shoes',
    }
    for name, match in groups.items():
        objs = [o for o in character_meshes(rig) if match(o)]
        if not objs:
            raise RuntimeError('Missing detail group ' + name)
        low, high = bounds(objs)
        center = (Vector(low) + Vector(high)) / 2
        size = max(high[i] - low[i] for i in range(3))
        data = bpy.data.cameras.new('CAM_DETAIL_' + name.upper())
        cam = bpy.data.objects.new(data.name, data)
        bpy.data.collections['CAMERAS'].objects.link(cam)
        data.type, data.ortho_scale = 'ORTHO', size * 1.35
        cam.location = center + (Vector((.7, 2.8, 1.1)) if name == 'backpack' else Vector((.55, -3., .85)))
        look_at(cam, center)
        render_image(RENDERS / 'details' / f'{name}.png', cam)
    # Silhouette evidence is rendered from the actual model at the same size in five directions.
    black = material('QA_Silhouette', '#000000', 1.)
    for o in character_meshes(rig):
        for i in range(len(o.data.materials)):
            o.data.materials[i] = black
    for name in ('FRONT', '3QUARTER', 'SIDE_LEFT', 'BACK', '3QUARTER_BACK'):
        render_image(RENDERS / 'silhouettes' / f'{name.lower()}.png', bpy.data.objects['CAM_CHARACTER_' + name], 768, 16, 'BLENDER_EEVEE')


def pose_review(character):
    rig=open_master(character)
    if rig.animation_data:rig.animation_data.action=None
    for pose,rotations in {
        'elbow_90':{'forearm.L':(-math.pi/2,0,0),'forearm.R':(-math.pi/2,0,0)},
        'raised_arm':{'upper_arm.L':(0,0,-1.10),'upper_arm.R':(0,0,1.10)},
        'knee_70':{'shin.L':(1.22,0,0),'shin.R':(1.22,0,0)},
        'head_turn':{'head':(.16,0,.6)},
        'walking':{'thigh.L':(-.5,0,0),'thigh.R':(.5,0,0),'shin.L':(.45,0,0),'upper_arm.L':(.35,0,0),'upper_arm.R':(-.35,0,0)},
        'book_hold':{'forearm.L':(-1.1,0,0),'hand.L':(.15,.35,.18)},
        'backpack':{'spine':(.3,.12,.15)},
    }.items():
        for bone in rig.pose.bones:
            bone.matrix_basis=Matrix.Identity(4)
            bone.rotation_mode='XYZ'
        for name,rotation in rotations.items():rig.pose.bones[name].rotation_euler=rotation
        if pose=='raised_arm':
            for side,angle in (('L',1.1),('R',-1.1)):
                bone=rig.pose.bones['upper_arm.'+side]
                rest=bone.bone.matrix_local.to_quaternion()
                bone.rotation_euler=(rest.inverted() @ Quaternion((0,1,0),angle) @ rest).to_euler()
        bpy.context.view_layer.update()
        camera=bpy.data.objects['CAM_CHARACTER_3QUARTER_BACK' if pose=='backpack' else 'CAM_CHARACTER_MAIN']
        camera.data.dof.use_dof=False
        render_image(RENDERS/'poses'/character.id/(pose+'.png'),camera,1024,32,'CYCLES')


def manifest():
    reports = [json.loads((SOURCES / f'{c.id}-master-v4.report.json').read_text(encoding='utf-8')) for c in CHARACTERS if (SOURCES / f'{c.id}-master-v4.report.json').exists()]
    if len(reports) == 8 and all('export' in r for r in reports):
        write_json(ASSETS / 'companion-collection.json', {'schema':'compa-humanoid-v2','assetVersion':4,
            'units':'meters','canonicalHeightMeters':1.75,'slots':list(SLOTS),
            'room':{'file':'habitacion-cozy-premium.glb','ceilingHeightMeters':3.08,
                    'avatarAnchorBlenderZUp':[.85,-.42,.20],'avatarAnchorGltfYUp':[.85,.20,.42]},
            'characters':reports})


def main():
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['build','harper']
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=['build','preview','render','presentation','export','poses'])
    parser.add_argument('character', nargs='?', default='harper')
    options = parser.parse_args(args)
    chosen = [c for c in CHARACTERS if options.character in (c.id, 'all')]
    if options.mode == 'presentation':
        presentation()
        return
    if not chosen:
        raise ValueError('Unknown character')
    for c in chosen:
        if options.mode == 'build':
            build(c)
        elif options.mode == 'export':
            export_asset(c)
        elif options.mode=='poses':
            pose_review(c)
        else:
            rig=open_master(c)
            is_hero = options.mode == 'render' and c.id == 'harper'
            if c.id=='harper':academic_hero_pose(rig)
            path = RENDERS / 'character_hero.png' if is_hero else (RENDERS / 'preview_iteration.png' if options.mode == 'preview' else ASSETS / 'previews' / f'compa-{c.id}-premium.png')
            render_image(path, bpy.data.objects['CAM_CHARACTER_MAIN'], 2048 if is_hero else 1024,
                         (256 if is_hero else 64) if options.mode == 'render' else 32)
            if is_hero:
                bpy.data.images['Render Result'].save_render(str(ASSETS / 'previews' / 'compa-harper-premium.png'))
    manifest()


if __name__ == '__main__':
    main()
