import bpy,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
path=ROOT/'packages/assets/3d/source/shared-spaces/v2/living-master.blend'
bpy.ops.wm.open_mainfile(filepath=str(path))
meta_path=ROOT/'work/shared-spaces-v2/living.json';meta=json.loads(meta_path.read_text())
for a in meta['anchors']:
    if a['id'] not in ('SEAT_03','SEAT_04'):continue
    x=-.23 if a['id']=='SEAT_03' else 1.163
    a['position'][0]=x;a['approach'][0]=x
    empty=bpy.data.objects[a['id']];empty.location.x=x;empty['shared_anchor']=json.dumps(a)
bpy.ops.wm.save_as_mainfile(filepath=str(path));meta_path.write_text(json.dumps(meta,indent=2))
