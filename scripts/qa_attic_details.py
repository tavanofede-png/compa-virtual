import bpy,json
from pathlib import Path
from mathutils import Vector
r=Path.cwd();bpy.ops.wm.open_mainfile(filepath=str(r/'packages/assets/3d/source/rooms/reference-rebuild/atico-creativo-v2.blend'))
bpy.context.view_layer.update()
plants=[]
for o in bpy.context.scene.objects:
 if o.name.startswith('PRM_BOT_') and o.name.endswith('_OpenPot'):
  pts=[o.matrix_world@Vector(c) for c in o.bound_box]
  x=sum(p.x for p in pts)/8;y=sum(p.y for p in pts)/8;z=min(p.z for p in pts)
  plants.append({'pot':o.name,'position':[round(x,3),round(y,3),round(z,3)],'in_stair_opening':2.48<x<4.30 and -2.7<y<-.45})
report={'plant_pots':plants,'stair_pot_intrusions':sum(p['in_stair_opening'] for p in plants),'artworks':len([o for o in bpy.context.scene.objects if o.name.startswith('V2_Collage_') and o.name.endswith('_Art')]),'packed_textures':[im.name for im in bpy.data.images if im.packed_file],'note':'Checks pot bases, not full collision-free navigation. Visual checks also required.'}
(r/'work/attic-v2-qa.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps({k:v for k,v in report.items() if k!='plant_pots'}),flush=True)
