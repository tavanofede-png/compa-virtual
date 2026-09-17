"""High resolution photographic review of the real eight Blender masters."""
import bpy,sys,json,time
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
import build_personal_study_spaces as P
import personal_study_assets as A
import personal_study_finishing as F
from room_premium_common import RoomKit
args=sys.argv[sys.argv.index('--')+1:];ids=[a for a in args if not a.startswith('--')]
if not ids or 'all' in ids:ids=list(P.NAMES)
for room in ids:
    started=time.time();P.ROOM=room;source=P.SOURCE/f'{room}-master.blend'
    bpy.ops.wm.open_mainfile(filepath=str(source));scene=bpy.context.scene;P.K=RoomKit();A.K=P.K;F.apply(P)
    scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
    scene.cycles.use_adaptive_sampling=True;scene.cycles.adaptive_threshold=.035
    scene.cycles.max_bounces=6;scene.cycles.diffuse_bounces=3;scene.cycles.glossy_bounces=3
    scene.render.resolution_percentage=100;scene.render.resolution_x=1800;scene.render.resolution_y=1200
    inventory={}
    for ob in scene.objects:
        if ob.type in ('MESH','CURVE','FONT') and ob.name!='Studio floor':
            owner=ob.get('placeable_owner','architecture');inventory[owner]=inventory.get(owner,0)+1
    (P.OUT/'data'/f'{room}-model-inventory.json').write_text(json.dumps(inventory,indent=2),encoding='utf-8')
    bpy.ops.wm.save_as_mainfile(filepath=str(source))
    cam=scene.camera
    if '--detail-only' not in args:
        scene.render.filepath=str(P.OUT/'images'/f'{room}-model-hero.png');bpy.ops.render.render(write_still=True)
        print('HERO_HQ',room,round(time.time()-started),flush=True)
    if '--hero-only' in args:
        if '--export' in args:P.export_modular(source)
        print('REVIEW_READY',room,round(time.time()-started),flush=True)
        continue
    # Camera sees the actual tabletop and a relevant adjoining object at close range.
    desk=bpy.data.objects.get('desk');target=desk.matrix_world.translation+Vector((0,0,.60))
    if room=='minimal':target=Vector((-.60,.57,1.04))
    if room=='tech':target=Vector((.12,1.19,1.12))
    if room=='library':target=Vector((.40,.02,.88))
    offset=Vector((3.2,-4.8,3.4));cam.location=target+offset
    cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=2.65 if room not in ('tech','minimal') else 3.25
    scene.render.resolution_x=1500;scene.render.resolution_y=1500
    # Roof remains in the master; this is an explicitly labeled cutaway review.
    for ob in scene.objects:
        if ob.get('module')=='roof' or ob.name.startswith(('Continuous pavilion roof','Mitered overlapping green roof tile','Roof hip cap tile','Roof ridge tile','Roof finial')):ob.hide_render=True
    scene.render.filepath=str(P.OUT/'images'/f'{room}-detail.png');bpy.ops.render.render(write_still=True)
    print('DETAIL_HQ',room,round(time.time()-started),flush=True)
    if '--alternate' in args:
        scene.render.resolution_x=1500;scene.render.resolution_y=1000
        W,D=P.DIMS[room];cam.location=(5,-10,10);target=Vector((0,0,.95));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=max(W,D)*1.85
        scene.render.filepath=str(P.OUT/'images'/f'{room}-alternate.png');bpy.ops.render.render(write_still=True)
    if '--export' in args:P.export_modular(source)
    print('REVIEW_READY',room,round(time.time()-started),flush=True)
