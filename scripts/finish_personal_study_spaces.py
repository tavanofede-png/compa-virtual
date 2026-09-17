"""Apply the quality revision to saved masters, then render and optionally export."""
import sys,bpy,json,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
import build_personal_study_spaces as P
import personal_study_assets as A
import personal_study_finishing as F
from room_premium_common import RoomKit
args=sys.argv[sys.argv.index('--')+1:]
ids=[a for a in args if not a.startswith('--')]
if not ids or 'all' in ids:ids=list(P.NAMES)
for room in ids:
    source=P.SOURCE/f'{room}-master.blend';P.ROOM=room
    bpy.ops.wm.open_mainfile(filepath=str(source));P.K=RoomKit();A.K=P.K
    F.apply(P)
    inventory={}
    for ob in bpy.context.scene.objects:
        if ob.type in ('MESH','CURVE','FONT') and ob.name!='Studio floor':
            key=ob.get('placeable_owner','architecture');inventory[key]=inventory.get(key,0)+1
    (P.OUT/'data'/f'{room}-model-inventory.json').write_text(json.dumps(inventory,indent=2),encoding='utf-8')
    bpy.ops.wm.save_as_mainfile(filepath=str(source));print('FINISHED_MASTER',room,len(bpy.context.scene.objects),flush=True)
    if '--no-render' not in args:P.render_views(source,'--preview' in args,'--views' in args)
    if '--export' in args:P.export_modular(source)
    print('FINISHED_ROOM',room,flush=True)
