"""Build and render the five other editable Compa Virtual rooms."""
import argparse
import hashlib
import json
import math
import sys
import time
from pathlib import Path
import bpy

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools/blender'))
from room_premium_common import RoomKit
from build_cozy_room import PALETTE
import room_collection_designs as design
BASE=ROOT/'room_cozy_premium.blend'
DEST=ROOT/'packages/assets/3d/source/rooms'
RENDERS=ROOT/'renders/room-collection'


def build(theme):
    original_hash=hashlib.sha256(BASE.read_bytes()).hexdigest()
    bpy.ops.wm.open_mainfile(filepath=str(BASE));before=len(bpy.context.scene.objects)
    k=RoomKit()
    for key,color in PALETTE.items():k.material(key,color)
    report=design.apply(k,theme)
    scene=bpy.context.scene
    scene.camera=bpy.data.objects['Camera_Cozy_Hero']
    scene.render.resolution_x=1920;scene.render.resolution_y=1440
    scene.render.resolution_percentage=100;scene.cycles.samples=32;scene.cycles.use_denoising=True
    scene.cycles.adaptive_threshold=.04
    scene.render.filepath=str(RENDERS/theme/'hero.png')
    scene['room_variant']=theme;scene['room_variant_version']=1
    bpy.context.view_layer.update()
    bad=[obj.name for obj in scene.objects if not all(math.isfinite(v) for row in obj.matrix_world for v in row)]
    assert not bad,bad
    assert len(scene.objects)>=before,'Room detail must not be reduced'
    assert len(bpy.data.objects['Companion_RoomAnchor'].children)>0
    assert not list(bpy.data.libraries)
    DEST.mkdir(parents=True,exist_ok=True);(RENDERS/theme).mkdir(parents=True,exist_ok=True)
    path=DEST/(theme+'-master-v1.blend')
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(path),compress=True)
    assert hashlib.sha256(BASE.read_bytes()).hexdigest()==original_hash
    report.update({'sourceBase':'room_cozy_premium.blend','baseSha256':original_hash,'objects':len(scene.objects),
      'baseObjects':before,'addedObjects':len(k.created),'removedObjects':len(k.removed),'nonFiniteObjects':bad,
      'sourceFile':str(path.relative_to(ROOT)),'sourceSha256':hashlib.sha256(path.read_bytes()).hexdigest(),
      'sourceBytes':path.stat().st_size,'render':str((RENDERS/theme/'hero.png').relative_to(ROOT)),
      'units':'meters','companionHeight':bpy.data.objects['Companion_RoomAnchor']['compa_reference_height_m'],
      'blender':bpy.app.version_string,'renderSettings':{'engine':'CYCLES','samples':32,'width':1920,'height':1440},
      'status':'Built, awaiting visual review'})
    (DEST/(theme+'-report.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print('ROOM_VARIANT_BUILT',json.dumps(report,ensure_ascii=False),flush=True)


def render(theme,preview=False):
    scene=bpy.context.scene
    scene.render.resolution_x=960 if preview else 1920;scene.render.resolution_y=720 if preview else 1440
    scene.cycles.samples=16 if preview else 32
    scene.render.filepath=str(RENDERS/theme/('preview.png' if preview else 'hero.png'))
    start=time.time();bpy.ops.render.render(write_still=True)
    print('ROOM_VARIANT_RENDERED',theme,round(time.time()-start,2),flush=True)


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--theme',required=True,choices=list(design.THEMES))
    parser.add_argument('--build',action='store_true');parser.add_argument('--preview',action='store_true');parser.add_argument('--render',action='store_true')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    if args.build:build(args.theme)
    else:bpy.ops.wm.open_mainfile(filepath=str(DEST/(args.theme+'-master-v1.blend')))
    if args.preview:render(args.theme,True)
    if args.render:render(args.theme)
