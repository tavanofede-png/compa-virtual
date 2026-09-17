"""Reproducible Cozy v2 build and genuine Blender Cycles review renders.

blender --background --python-exit-code 1 --python scripts/room_premium_pipeline.py -- --build --preview
blender --background --python-exit-code 1 --python scripts/room_premium_pipeline.py -- --final --details
The v1 file and existing app export are intentionally retained as source history.
"""
import argparse
import hashlib
import json
import math
import sys
import time
from pathlib import Path
import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'/'blender'))
from room_premium_common import RoomKit
from build_cozy_room import PALETTE
from build_harper import look_at,rgba
import room_premium_architecture as architecture
import room_premium_textiles as textiles
import room_premium_study as study
import room_premium_botanicals as botanicals
import room_premium_personal_props as personal

SOURCE=ROOT/'packages/assets/3d/source/cozy-modern-master-v1.blend'
MASTER=ROOT/'room_cozy_premium.blend'
VERSION=ROOT/'packages/assets/3d/source/cozy-modern-master-v2.blend'
RENDERS=ROOT/'renders/room-cozy-premium'
REPORT=ROOT/'packages/assets/3d/source/cozy-modern-master-v2.report.json'


def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()


def light(k,name,kind,loc,energy,color,size=1,target=None):
    data=bpy.data.lights.new(name,kind);data.energy=energy;data.color=color
    if kind=='AREA':data.shape='DISK';data.size=size
    elif kind=='POINT':data.shadow_soft_size=size
    elif kind=='SUN':data.angle=size
    obj=bpy.data.objects.new(name,data);k.link(obj,'LIGHTING');obj.location=loc
    if target is not None:look_at(obj,target)
    return obj


def set_camera(k,name,loc,target,scale):
    data=bpy.data.cameras.new(name);obj=bpy.data.objects.new(name,data)
    k.link(obj,'STUDIO_PREVIEW');obj.location=loc;look_at(obj,target)
    data.type='ORTHO';data.ortho_scale=scale;data.lens=52
    data.clip_start=.05;data.clip_end=100
    return obj


def stage(k):
    for obj in list(bpy.data.objects):
        if obj.type in ('LIGHT','CAMERA') or obj.name.startswith('Studio_Ground'):
            bpy.data.objects.remove(obj,do_unlink=True)
    light(k,'Light_WindowSoft','AREA',(-1.70,3.18,2.38),650,(1,.85,.70),1.1,(-.8,-.4,.65))
    light(k,'Light_LateAfternoon','SUN',(-3,5,7),1.4,(1,.82,.62),.08,(.1,-1,0))
    light(k,'Light_SoftFrontFill','AREA',(3,-6,4.7),620,(.82,.89,1),5,(.5,.6,1))
    light(k,'Light_UpperBounce','AREA',(1.4,1.6,2.99),75,(1,.85,.73),2.6,(.6,.8,.2))
    light(k,'Light_BedsideReading','POINT',(-2.64,1.12,1.48),28,(1,.57,.30),.12)
    light(k,'Light_DeskReading','AREA',(2.23,2.04,1.635),24,(1,.72,.43),.16,(1.97,1.90,1.05))
    for i,loc in enumerate(((-2.81,-1.90,2.90),(-2.80,.8,2.91),(1.48,2.36,2.96),(3.6,2.36,2.91))):
        light(k,'Light_LanternBounce_'+str(i),'POINT',loc,3.5,(1,.57,.29),.12)
    mat=k.material('studio_cozy','#B7AAA4',.92)
    k.box('Studio_Ground_Cozy',(0,0,-.165),(200,200,.08),mat,'STUDIO_PREVIEW',0)
    blocker=k.box('Studio_Ceiling_LightBlocker',(.6,0,3.20),(7.45,5.25,.08),'cream','STUDIO_PREVIEW',0)
    blocker.visible_camera=False;blocker.visible_glossy=False;blocker.visible_diffuse=False
    blocker.hide_set(True)
    blocker['purpose']='Render-only ceiling shadow blocker; not part of the playable room.'
    main=set_camera(k,'Camera_Cozy_Hero',(10.0,-12.0,10.0),(.60,.06,1.32),10.15)
    set_camera(k,'Camera_Cozy_Desk',(6.2,-4.1,4.8),(1.68,1.84,1.57),4.1)
    set_camera(k,'Camera_Cozy_Bed',(3.1,-4.4,4.7),(-1.77,.35,1.39),4.0)
    set_camera(k,'Camera_Cozy_Lounge',(4.8,-5.7,4.4),(.38,-.79,.69),3.75)
    scene=bpy.context.scene;scene.camera=main
    scene.world.use_nodes=True
    bg=scene.world.node_tree.nodes.get('Background')
    bg.inputs['Color'].default_value=rgba('#BBCBDD');bg.inputs['Strength'].default_value=.22
    scene.render.engine='CYCLES';scene.cycles.device='CPU'
    scene.cycles.samples=128;scene.cycles.use_denoising=True
    scene.cycles.max_bounces=8;scene.cycles.diffuse_bounces=4;scene.cycles.glossy_bounces=4
    scene.cycles.transparent_max_bounces=8;scene.cycles.use_adaptive_sampling=True
    scene.cycles.adaptive_threshold=.025
    scene.view_settings.view_transform='AgX'
    scene.view_settings.look='AgX - Medium High Contrast'
    scene.view_settings.exposure=.15
    scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB';scene.render.image_settings.color_depth='8'
    scene.render.resolution_x=2400;scene.render.resolution_y=1800;scene.render.resolution_percentage=100
    scene.render.film_transparent=False
    scene.render.filepath=str(RENDERS/'hero.png')
    scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1


def import_character(k):
    path=ROOT/'packages/assets/3d/compa-harper-premium.glb'
    before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    imported=[obj for obj in bpy.data.objects if obj not in before]
    # Blender's glTF importer creates a custom bone-display sphere, not model data.
    for obj in list(imported):
        if obj.type=='MESH' and obj.name.startswith('Icosphere') and not obj.get('compa_slot'):
            imported.remove(obj);bpy.data.objects.remove(obj,do_unlink=True)
    collection=k.collection('COMPANION_HARPER')
    for obj in imported:
        for old in list(obj.users_collection):old.objects.unlink(obj)
        collection.objects.link(obj)
    anchor=k.group('Companion_RoomAnchor',(1.94,.30,.18),collection='COMPANION_HARPER')
    for obj in imported:
        if obj.parent is None:obj.parent=anchor
    anchor.rotation_euler.z=-.14
    bpy.context.scene.frame_set(1);bpy.context.view_layer.update()
    # Resolve the actual contact against floor/rug before the avatar is added.
    # This position is outside the rug; reference feet are already at Z=0.
    coords=[]
    deps=bpy.context.evaluated_depsgraph_get()
    for obj in imported:
        if obj.type!='MESH':continue
        ev=obj.evaluated_get(deps);mesh=ev.to_mesh()
        coords.extend(ev.matrix_world@v.co for v in mesh.vertices);ev.to_mesh_clear()
    low=min(v.z for v in coords);high=max(v.z for v in coords)
    anchor.location.z+=.18-low;bpy.context.view_layer.update()
    anchor['compa_reference_height_m']=round(high-low,5)
    anchor['compa_foot_contact_z']=.18
    for obj in imported:
        if obj.type=='ARMATURE':obj.show_in_front=False;obj.hide_render=True
    return {'asset':str(path.relative_to(ROOT)),'heightMeters':round(high-low,5),'feetZ':.18,'anchor':list(anchor.location),'rigBones':sum(len(o.data.bones) for o in imported if o.type=='ARMATURE')}


def audit(k,modules,baseline):
    scene=bpy.context.scene;deps=bpy.context.evaluated_depsgraph_get();result={}
    verts=tris=0;bad=[]
    for obj in scene.objects:
        if not all(math.isfinite(v) for row in obj.matrix_world for v in row):bad.append(obj.name)
        if obj.type not in ('MESH','CURVE','FONT'):continue
        category=next((c.name for c in obj.users_collection),'UNASSIGNED')
        result[category]=result.get(category,0)+1
        if category in ('STUDIO_PREVIEW','COMPANION_HARPER'):continue
        ev=obj.evaluated_get(deps);mesh=ev.to_mesh()
        if mesh:
            mesh.calc_loop_triangles();verts+=len(mesh.vertices);tris+=len(mesh.loop_triangles)
            if any(not all(math.isfinite(a) for a in v.co) for v in mesh.vertices):bad.append(obj.name)
        ev.to_mesh_clear()
    assert not bad,('Invalid transforms/vertices',bad)
    assert digest(SOURCE)==baseline['sha256'],'Original source was changed'
    assert all(bpy.data.objects.get(name) for name in ('Bed_Frame','Desk_Worktop','Storage_FloatingShelf')),'Structural anchor missing'
    return {'version':2,'sourceOriginal':baseline,'sourceOutput':str(VERSION.relative_to(ROOT)),
            'master':str(MASTER.relative_to(ROOT)),'blender':bpy.app.version_string,'units':'meters',
            'objects':len(scene.objects),'geometryObjectsByCollection':result,'roomEvaluatedVertices':verts,'roomEvaluatedTriangles':tris,
            'createdObjects':len(k.created),'replacedObjects':len(k.removed),'nonFiniteObjects':bad,'modules':modules,
            'densityPolicy':'All designed geometry preserved in editable source. No object-density reduction or decimation.',
            'renders':{'hero':'renders/room-cozy-premium/hero.png','desk':'renders/room-cozy-premium/desk.png','bed':'renders/room-cozy-premium/bed.png','lounge':'renders/room-cozy-premium/lounge.png'},
            'renderEngine':'Cycles CPU / AgX','reviewStatus':'Built; images require visual review'}


def build():
    baseline={'path':str(SOURCE.relative_to(ROOT)),'sha256':digest(SOURCE),'bytes':SOURCE.stat().st_size}
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE));k=RoomKit()
    for key,color in PALETTE.items():
        mat=k.material(key,color)
        # v1 preceded the shared sRGB-to-linear fix; normalize old PBR values too.
        mat.diffuse_color=rgba(color)
        mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=rgba(color)
    modules={}
    for name,module in [('architecture',architecture),('textiles',textiles),('study',study),('botanicals',botanicals),('personal',personal)]:
        print('BUILD_MODULE',name,flush=True);modules[name]=module.upgrade(k)
    architecture.finish_materials(k)
    modules['companion']=import_character(k)
    stage(k)
    root=bpy.data.collections.get('ROOM_COZY_MODERN_MASTER')
    root['asset_version']=2;root['avatar_anchor']=[1.94,.30,.18]
    root['room_theme']='cozy_botanical_study';root['design_story']='Pequeños mundos: estudiar, observar y crecer de a poco.'
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action='DESELECT')
    # Store a useful rendered-material camera view for the editable source.
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=='VIEW_3D':
                area.spaces.active.region_3d.view_perspective='CAMERA'
                area.spaces.active.overlay.show_overlays=False
                area.spaces.active.shading.type='MATERIAL'
                area.spaces.active.shading.use_scene_world=True
                area.spaces.active.shading.use_scene_lights=True
    RENDERS.mkdir(parents=True,exist_ok=True)
    report=audit(k,modules,baseline)
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(VERSION),compress=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(MASTER),compress=True)
    report['blendBytes']=MASTER.stat().st_size;report['masterSha256']=digest(MASTER)
    REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print('ROOM_BUILD_COMPLETE',json.dumps({'objects':report['objects'],'triangles':report['roomEvaluatedTriangles'],'masterBytes':report['blendBytes']}),flush=True)


def render(camera,filename,width,height,samples):
    scene=bpy.context.scene;scene.camera=bpy.data.objects[camera]
    scene.render.resolution_x=width;scene.render.resolution_y=height;scene.render.resolution_percentage=100
    scene.cycles.samples=samples;scene.render.filepath=str(RENDERS/filename)
    start=time.time();bpy.ops.render.render(write_still=True)
    print('ROOM_RENDER_COMPLETE',filename,round(time.time()-start,1),flush=True)


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--build',action='store_true');parser.add_argument('--preview',action='store_true')
    parser.add_argument('--final',action='store_true');parser.add_argument('--details',action='store_true');parser.add_argument('--lounge',action='store_true')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if args.build:build()
    else:bpy.ops.wm.open_mainfile(filepath=str(MASTER))
    if args.preview:render('Camera_Cozy_Hero','preview.png',1200,900,32)
    if args.final:render('Camera_Cozy_Hero','hero.png',2400,1800,64)
    if args.details:
        for key in ('Desk','Bed','Lounge'):render('Camera_Cozy_'+key,key.lower()+'.png',1600,1400,48)
    if args.lounge:render('Camera_Cozy_Lounge','lounge.png',1600,1400,32)
