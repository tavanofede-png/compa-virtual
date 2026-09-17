"""Lux reference sculpt, isolated from production. Editable rig and slot assignment."""
import bpy,sys,math,json
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[1];sys.path.insert(0,str(R/'scripts'));sys.path.insert(0,str(R/'tools/blender'))
from new_reference_roster import CHARACTERS_NEW
import build_companion_collection as base
import character_premium_pipeline as P
import premium_face_hair as hair
import premium_garments as cloth
from premium_validation import validate_scene
from build_harper import material
out=R/'packages/assets/3d/source/new-reference-characters';out.mkdir(parents=True,exist_ok=True)
pre=R/'renders/new-reference-characters';pre.mkdir(parents=True,exist_ok=True)
c=next(c for c in CHARACTERS_NEW if c.id=='lux')
built=base.build_character(c);rig=built['rig'];ctx=P.Context(rig,c)
worlds={o:o.matrix_world.copy() for o in P.character_meshes(rig)};rig.scale=(1,1,1);bpy.context.view_layer.update()
for o,w in worlds.items():o.matrix_world=w
hair.STYLES[c.id]='bun';hair.upgrade(ctx);cloth.upgrade(ctx)
# Star applique has a shaped outline, raised embroidered edge and stitches.
mat=material('LUX_StarApplique','#B69560',.85);cream=ctx.mat('top_light')
points=[]
for i in range(10):
 a=math.pi/2+i*math.pi/5;r=.072 if i%2==0 else .034;points.append((r*math.cos(a),-.157,1.086+r*math.sin(a)))
mesh=bpy.data.meshes.new('LUX_StarGeometry');mesh.from_pydata(points,[],[tuple(range(10))]);mesh.materials.append(mat)
o=bpy.data.objects.new('LUX_EmbroideredStar',mesh);ctx.collection('top').objects.link(o);ctx.attach(o,'top','spine','lux_star_sweater')
for i in range(10):
 a=Vector(points[i]);b=Vector(points[(i+1)%10])
 for j in range(5):
  p=a.lerp(b,(j+.5)/5);ctx.box('LUX_StarStitch',p+Vector((0,-.002,0)),(.002,.002,.005),cream,'top','spine',.0003)
# Looser irregular tendrils frame the face; each segment has the voxel silhouette.
mats=[ctx.mat('hair'),ctx.mat('hair_mid'),ctx.mat('hair_light')]
for sign in (-1,1):
 for strand in range(3):
  for j in range(11):
   z=1.75-j*.043;x=sign*(.235+.022*strand+.018*math.sin(j*1.20+strand));y=-.10-.020*strand+.018*math.cos(j*.85)
   o=ctx.box('LUX_FaceFramingCurl',(x,y,z),(.028,.038,.058),mats[(j+strand)%3],'hair','head',.005,rotation=(.10*math.sin(j),sign*.23*math.sin(j*.9),.1))
# Woven pink hair tie and small necklace.
for j in range(20):
 a=j*math.tau/20;ctx.box('LUX_PinkHairTie',(.065+.108*math.cos(a),.114+.089*math.sin(a),1.94),(.026,.024,.024),ctx.mat('bottom'),'hair','head',.004)
for j in range(18):
 a=math.pi+j*math.pi/17;ctx.box('LUX_NecklaceLink',(.087*math.cos(a),-.126-.014*math.sin(a),1.265+.025*math.sin(a)),(.008,.005,.007),mat,'top','spine',.001)
# Preserve separate modular backpack but match Lux's reference fabric.
for o in P.character_meshes(rig):
 if o.get('compa_slot')=='back':
  for slot in o.material_slots:
   if slot.material and any(s in slot.material.name.lower() for s in ('bag','backpack')):
    copy=slot.material.copy();copy.name='LUX_PinkPack_'+slot.material.name
    if copy.use_nodes:copy.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=base.rgba('#D98DA7')
    slot.material=copy
P.finish_surfaces(ctx);bpy.context.view_layer.update();low,high=P.bounds(P.character_meshes(rig));rig.scale*=c.height/(high[2]-low[2]);bpy.context.view_layer.update();low,high=P.bounds(P.character_meshes(rig));rig.location.z-=low[2]
P.studio(ctx);scene=bpy.context.scene;scene['reference_status']='Lux first tailored model; pose and wardrobe fit review pending';rig['compa_character_id']='lux'
validation=validate_scene(rig)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'lux-reference-v1.blend'),compress=True)
P.render_image(pre/'lux-reference-v1.png',scene.camera,1000,32)
(out/'lux-reference-v1.json').write_text(json.dumps({'id':'lux','bones':len(rig.data.bones),'validation':validation,'wardrobe_fit_verified':False,'app_integrated':False},indent=2))
print('LUX_REFERENCE_READY',flush=True)

