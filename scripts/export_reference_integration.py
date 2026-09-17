"""Export review masters without altering them; retain UVs and each material batch."""
import bpy,sys,json,math
from pathlib import Path
from mathutils import Matrix,Vector
R=Path(__file__).resolve().parents[1];sys.path[:0]=[str(R/'scripts'),str(R/'tools/blender')]
from export_app_models import export_file
from new_reference_roster import CHARACTERS_NEW
from wardrobe_body_fit import create_limb_shell
OUT=R/'apps/web/public/selection/models';OUT.mkdir(exist_ok=True)

def batch(objects,rig=None):
 dep=bpy.context.evaluated_depsgraph_get();groups={};inv=rig.matrix_world.inverted() if rig else Matrix.Identity(4)
 for ob in objects:
  ev=ob.evaluated_get(dep);me=ev.to_mesh()
  if not me:continue
  names={g.index:g.name for g in getattr(ob,'vertex_groups',[])};M=inv@ob.matrix_world
  component=ob.get('compa_component',ob.get('compa_slot','room'))
  uv=me.uv_layers.active
  for poly in me.polygons:
   em=me.materials[poly.material_index] if me.materials else None;mat=bpy.data.materials.get(em.name) if em else None
   d=groups.setdefault((component,mat.name if mat else ''),dict(v=[],f=[],w=[],uv=[],smooth=[],mat=mat))
   face=[]
   for li in poly.loop_indices:
    v=me.vertices[me.loops[li].vertex_index];face.append(len(d['v']));d['v'].append(tuple(M@v.co));d['uv'].append(tuple(uv.data[li].uv) if uv else (0,0))
    weights={ob.parent_bone:1} if ob.parent_type=='BONE' else {names[g.group]:g.weight for g in v.groups if g.group in names}
    d['w'].append(weights or {'root':1})
   d['f'].append(face);d['smooth'].append(poly.use_smooth)
  ev.to_mesh_clear()
 result=[]
 for (component,name),d in groups.items():
  me=bpy.data.meshes.new('APP_'+component+'_'+name);me.from_pydata(d['v'],[],d['f']);me.update()
  if d['mat']:me.materials.append(d['mat'])
  uv=me.uv_layers.new(name='UVMap')
  for poly,smooth in zip(me.polygons,d['smooth']):
   poly.use_smooth=smooth
   for li in poly.loop_indices:uv.data[li].uv=d['uv'][me.loops[li].vertex_index]
  ob=bpy.data.objects.new(me.name,me);bpy.context.scene.collection.objects.link(ob);ob['compa_component']=component
  if rig:
   ob.parent=rig;ob.matrix_parent_inverse=Matrix.Identity(4);ob.matrix_basis=Matrix.Identity(4)
   buckets={}
   for i,weights in enumerate(d['w']):
    for bone,w in weights.items():buckets.setdefault((bone,w),[]).append(i)
   vg={b:ob.vertex_groups.new(name=b) for b in rig.data.bones.keys()}
   for (bone,w),indices in buckets.items():
    if bone in vg:vg[bone].add(indices,w,'REPLACE')
   ob.modifiers.new('Skin','ARMATURE').object=rig
  result.append(ob)
 return result

def bounds(ob):
 pts=[ob.matrix_world@Vector(v) for v in ob.bound_box]
 return [[min(p[i] for p in pts) for i in range(3)],[max(p[i] for p in pts) for i in range(3)]]

def room(id):
 source=R/f'packages/assets/3d/source/rooms/reference-rebuild/{id}-review.blend';bpy.ops.wm.open_mainfile(filepath=str(source));bpy.context.view_layer.update()
 sources=[o for o in bpy.context.scene.objects if o.type in ('MESH','CURVE','FONT') and not o.hide_render and not o.name.startswith(('Studio','STUDIO','Ground','Backdrop')) and not o.get('compa_slot')]
 # Export physical footprints as well as named furniture; low rugs and wall decor are not blockers.
 obstacles=[]
 for o in sources:
  lo,hi=bounds(o)
  if lo[2]<.95 and hi[2]>.37 and hi[2]-lo[2]>.10 and hi[0]-lo[0]>.055 and hi[1]-lo[1]>.055:
   obstacles.append({'id':o.name,'min':[lo[0],-hi[1]],'max':[hi[0],-lo[1]]})
 furniture={}
 for name in ['Desk_ChairSeat','Bed_Mattress','Bed_Frame','Premium_Lounge_KnittedPouf']:
  o=bpy.data.objects.get(name)
  if o:furniture[name]=bounds(o)
 (OUT/(id+'-geometry.json')).write_text(json.dumps({'source':source.name,'furniture':furniture,'obstacles':obstacles},indent=2))
 batches=batch(sources);record=export_file(OUT/(id+'-room.glb'),batches);record['sourceObjects']=len(sources)
 print('READY',id,json.dumps(record),flush=True)

def character(c):
 version='v1' if c.id=='sage' else 'v2';source=R/f'packages/assets/3d/source/new-reference-characters/{c.id}-reference-{version}.blend'
 bpy.ops.wm.open_mainfile(filepath=str(source));rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');rig.animation_data_clear()
 for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
 bpy.context.view_layer.update()
 sources=[o for o in bpy.context.scene.objects if o.type in ('MESH','CURVE','FONT') and not o.hide_render and o.get('compa_slot')]
 # Replace segmented skin limbs with the canonical continuous weighted shells used by the wardrobe.
 body=[o for o in sources if o.get('compa_slot') in ('body','hair') and not any(s in o.name for s in ('Body_UpperArm','Body_Forearm','Body_Thigh','Body_Shin','ContinuousSkin'))]
 coll=bpy.data.collections.new('APP_CONTINUOUS_SKIN');bpy.context.scene.collection.children.link(coll);body+=create_limb_shell(c,rig,coll)
 export_file(OUT/(c.id+'-body.glb'),batch(body,rig),rig)
 items=[]
 for slot in sorted({o.get('compa_slot') for o in sources}-{'body','hair'}):
  obs=[o for o in sources if o.get('compa_slot')==slot];id=c.id+'-signature-'+slot
  # Wardrobe meshes must be exported in canonical bind space, independent of avatar stature.
  bs=batch(obs,rig);saved=rig.matrix_world.copy();rig.matrix_world=Matrix.Identity(4);bpy.context.view_layer.update()
  export_file(OUT/(id+'.glb'),bs,rig);rig.matrix_world=saved;bpy.context.view_layer.update()
  items.append({'id':id,'slot':'handheld' if slot=='hand_prop' else slot,'family':'tee' if c.id=='kai' and slot=='top' else 'signature','color':c.top,'design':'signature','label':c.name+' · '+slot})
 (OUT/(c.id+'-signature.json')).write_text(json.dumps(items,indent=2));print('READY_CHARACTER',c.id,flush=True)

if __name__=='__main__':
 args=sys.argv[sys.argv.index('--')+1:]
 if args[0]=='rooms':
  for id in args[1:]:room(id)
 else:
  for c in CHARACTERS_NEW:
   if len(args)==1 or c.id in args[1:]:character(c)
