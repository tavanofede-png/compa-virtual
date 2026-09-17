"""Reference hat/hair intersection cleanup and accessory finish."""
import bpy,sys,math,json
from pathlib import Path
R=Path(__file__).resolve().parents[1];sys.path.insert(0,str(R/'scripts'));sys.path.insert(0,str(R/'tools/blender'))
from new_reference_roster import CHARACTERS_NEW
import character_premium_pipeline as P
from room_premium_common import RoomKit
for name in sys.argv[sys.argv.index('--')+1:]:
 c=next(c for c in CHARACTERS_NEW if c.id==name);bpy.ops.wm.open_mainfile(filepath=str(R/'packages/assets/3d/source/new-reference-characters'/(name+'-reference-v1.blend')))
 rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');ctx=P.Context(rig,c);scale=rig.scale.copy();loc=rig.location.copy();rig.scale=(1,1,1);rig.location=(0,0,0);bpy.context.view_layer.update();k=RoomKit()
 if c.accessory in ('cap','beanie'):
  for o in list(bpy.data.objects):
   if o.name.startswith(('PRM_Hair_Crown','Hair_RootDome')):bpy.data.objects.remove(o,do_unlink=True)
 if name=='rem':
  # Short copper waves and a separate charcoal bag with flap, zipper and hardware.
  for o in bpy.data.objects:
   if o.type=='MESH' and o.name.startswith('PRM_Hair_Long'):
    for v in o.data.vertices:
     if v.co.z<1.45:v.co.z=1.45+(v.co.z-1.45)*.55
     v.co.x+=.012*math.sin(v.co.z*39);v.co.y+=.010*math.cos(v.co.z*29)
   if o.type=='MESH' and o.name.startswith('rem_CrossbodyBag'):
    o.data.materials.clear();o.data.materials.append(ctx.mat('top_dark'))
  ctx.box('REM_BagFlap',(.19,-.254,.878),(.225,.010,.092),ctx.mat('top'),'back','spine',.008)
  for j in range(18):ctx.box('REM_BagZip',(.095+j*.011,-.261,.835),(.006,.005,.005),ctx.mat('metal'),'back','spine',.0006)
  ctx.box('REM_BagBuckle',(.19,-.264,.868),(.027,.008,.018),ctx.mat('metal'),'back','spine',.003)
  # Headphones rest around the neck, clearing the face and hat.
  for sign in (-1,1):
   o=k.cylinder('REM_HeadphoneCup',(sign*.14,-.155,1.235),.050,.038,ctx.mat('black'),'HEADPHONES',20);o.rotation_euler.x=math.pi/2;ctx.attach(o,'face_accessory','spine','neck_headphones')
   o=k.cylinder('REM_HeadphoneRing',(sign*.14,-.177,1.235),.036,.010,ctx.mat('accent'),'HEADPHONES',20);o.rotation_euler.x=math.pi/2;ctx.attach(o,'face_accessory','spine','neck_headphones')
  ob=k.tube('REM_HeadphoneBand',[(-.14,-.14,1.235),(-.10,.02,1.28),(0,.08,1.29),(.10,.02,1.28),(.14,-.14,1.235)],.016,ctx.mat('black'),'HEADPHONES');ctx.attach(ob,'face_accessory','spine','neck_headphones')
 if name=='finn':
  for o in list(bpy.data.objects):
   if o.name.startswith(('finn_SkateDeck','finn_SkateGrip','finn_SkateGraphic')):bpy.data.objects.remove(o,do_unlink=True)
  # Curved deck outline with rounded nose/tail, grip inset and pixel motif.
  outline=[]
  for zcenter,phase in ((.77,0),(.15,math.pi)):
   for j in range(9):
    a=phase+j*math.pi/8;outline.append((.54+.1*math.cos(a),zcenter+.07*math.sin(a)))
  verts=[(x,y,z) for y in (-.085,-.115) for x,z in outline];n=len(outline)
  faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(j,(j+1)%n,(j+1)%n+n,j+n) for j in range(n)]
  o=k.mesh('FINN_ShapedSkateDeck',verts,faces,ctx.mat('hair_mid'),'SKATE',.004);ctx.attach(o,'hand_prop','hand.R','skate')
  o=k.mesh('FINN_GripTape',[(x,-.120,z) for x,z in outline],[tuple(range(n))],ctx.mat('black'),'SKATE',.001);ctx.attach(o,'hand_prop','hand.R','skate')
  glyph=[' 11111 ','11   11','1 1 1 1','1     1','11 1 11',' 11111 ']
  for row,line in enumerate(glyph):
   for col,p in enumerate(line):
    if p=='1':ctx.box('FINN_SkateGraphic',(.48+col*.018,-.126,.50-row*.018),(.017,.003,.017),ctx.mat('white'),'hand_prop','hand.R',.0005)
  for z in (.19,.73):
   for x in (.51,.57):ctx.box('FINN_DeckBolt',(x,-.125,z),(.006,.003,.006),ctx.mat('metal'),'hand_prop','hand.R',.001)
 rig.scale=scale;rig.location=loc;bpy.context.view_layer.update();P.finish_surfaces(ctx)
 bpy.ops.wm.save_as_mainfile(filepath=str(R/'packages/assets/3d/source/new-reference-characters'/(name+'-reference-v2.blend')),compress=True)
 P.render_image(R/'renders/new-reference-characters'/(name+'-reference-v2.png'),bpy.context.scene.camera,1000,24)
