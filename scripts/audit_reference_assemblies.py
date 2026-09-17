"""Selected assembly checks, not a complete collision certification."""
import bpy,json,sys
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[1];OUT=R/'packages/assets/3d/source/rooms/reference-rebuild'
def bbox(root):
 pts=[o.matrix_world@Vector(v) for o in [root,*root.children_recursive] if o.type in ('MESH','CURVE') for v in o.bound_box]
 return ([min(p[i] for p in pts) for i in range(3)],[max(p[i] for p in pts) for i in range(3)]) if pts else None
def overlap(a,b):return all(min(a[1][i],b[1][i])-max(a[0][i],b[0][i])>.012 for i in range(3))
reports=[]
for p in sorted(OUT.glob('*-review.blend')):
 bpy.ops.wm.open_mainfile(filepath=str(p));bpy.context.view_layer.update();bed=bpy.data.objects.get('Bed_Frame');checks=[]
 for o in bpy.context.scene.objects:
  if not o.parent and o.name.startswith(('PRM_BOT_Floor','Premium_Personal_AcousticGuitar','GAMER_EquipmentChest','EXP_FootTravelTrunk','MUSIC_AmplifierCase')):
   bb=bbox(o)
   if bed and bb:checks.append({'pair':['Bed_Frame',o.name],'intersects':overlap(bbox(bed),bb)})
 external=[im.filepath for im in bpy.data.images if im.source=='FILE' and not im.packed_file]
 reports.append({'room':p.stem,'objects':len(bpy.context.scene.objects),'selected_assembly_checks':checks,'external_unpacked_images':external,'full_collision_validation':False,'runtime_validation':False})
(R/'renders/reference-rooms/assembly-review.json').write_text(json.dumps(reports,indent=2),encoding='utf-8')
print(json.dumps({'rooms':len(reports),'selected_overlaps':[{'room':r['room'],'pair':c['pair']} for r in reports for c in r['selected_assembly_checks'] if c['intersects']]}))
