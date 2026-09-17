import bpy, json
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[1]
out={}
bpy.ops.wm.open_mainfile(filepath=str(root/'room_cozy_premium.blend'))
for o in bpy.context.scene.objects:
    if any(n in o.name.lower() for n in ('chair','mattress','bed_frame','desk_worktop','roomanchor','rug','ottoman','pouf','lounge','bookcase')):
        bounds=[o.matrix_world@Vector(c) for c in o.bound_box] if o.type=='MESH' else []
        out[o.name]={'position':list(o.matrix_world.translation),'rotation':list(o.rotation_euler),'bounds':[list(map(min,zip(*bounds))),list(map(max,zip(*bounds)))] if bounds else []}
bpy.ops.wm.open_mainfile(filepath=str(root/'packages/assets/3d/app/milo-base-editable.blend'))
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
out['rig']={'scale':list(rig.scale),'rotation':list(rig.rotation_euler),'bones':{b.name:{'head':list(b.head_local),'tail':list(b.tail_local),'matrix':[list(r) for r in b.matrix_local]} for b in rig.data.bones}}
(root/'work-motion-inspect.json').write_text(json.dumps(out,indent=2))
print('MOTION_INSPECTION_READY',len(out))
