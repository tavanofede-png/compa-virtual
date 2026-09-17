import bpy,json,sys
from pathlib import Path
from mathutils import Matrix,Vector
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools/blender'))
from build_companion_collection import CHARACTERS
result={}
for c in CHARACTERS:
    path=ROOT/f'packages/assets/3d/source/{c.id}-master-v4.blend'
    bpy.ops.wm.open_mainfile(filepath=str(path))
    rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
    if rig.animation_data:rig.animation_data.action=None
    for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
    bpy.context.view_layer.update()
    inv=rig.matrix_world.inverted()
    def bounds(objects):
        points=[inv@o.matrix_world@Vector(corner) for o in objects for corner in o.bound_box]
        return [[min(p[i] for p in points) for i in range(3)],[max(p[i] for p in points) for i in range(3)]] if points else None
    slots={s:bounds([o for o in bpy.context.scene.objects if o.type=='MESH' and o.get('compa_slot')==s]) for s in ('hair','body','top','bottom','shoes')}
    result[c.id]={'height':c.height,'rigMatrix':[list(r) for r in rig.matrix_world],'scale':list(rig.scale),'bones':{b.name:{'head':list(b.head_local),'tail':list(b.tail_local)} for b in rig.data.bones},'slots':slots,'bodyParts':{o.name:bounds([o]) for o in bpy.context.scene.objects if o.type=='MESH' and o.get('compa_slot')=='body' and any(s in o.name for s in ('Arm','Forearm','Thigh','Shin','Neck','Waist'))}}
path=ROOT/'packages/assets/3d/wardrobe/body-measurements.json'
path.parent.mkdir(parents=True,exist_ok=True)
path.write_text(json.dumps(result,indent=2),encoding='utf-8')
print('BODY_MEASUREMENTS',path,flush=True)
