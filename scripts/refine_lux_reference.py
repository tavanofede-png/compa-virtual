import bpy,sys,math
from pathlib import Path
R=Path(__file__).resolve().parents[1];sys.path.insert(0,str(R/'scripts'));sys.path.insert(0,str(R/'tools/blender'))
import character_premium_pipeline as P
from new_reference_roster import CHARACTERS_NEW
from room_premium_common import RoomKit
bpy.ops.wm.open_mainfile(filepath=str(R/'packages/assets/3d/source/new-reference-characters/lux-reference-v1.blend'))
c=CHARACTERS_NEW[0];rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');ctx=P.Context(rig,c)
# Work in the same canonical bind space used by the wardrobe generator.
old_scale=rig.scale.copy();old_loc=rig.location.copy();rig.scale=(1,1,1);rig.location=(0,0,0);bpy.context.view_layer.update()
for o in list(bpy.data.objects):
 if o.name.startswith(('Premium_Top_FoldedShirtCollar','Hair_TiedCore','PRM_Hair_Tied','LUX_PinkHairTie')):bpy.data.objects.remove(o,do_unlink=True)
kit=RoomKit();mats=[ctx.mat('hair'),ctx.mat('hair_mid'),ctx.mat('hair_light')]
for j in range(15):
 a=j*2.399;cx=.025+.064*math.cos(a);cy=.09+.052*math.sin(a);cz=1.91+(j%3)*.03
 pts=[]
 for q in range(15):
  t=q*math.tau/14;pts.append((cx+.065*math.cos(t),cy+.039*math.sin(t),cz+.057*math.sin(t+a*.2)))
 ob=kit.tube('LUX_SculptedBunLock',pts,.013,mats[j%3],'LUX_HAIR');ctx.attach(ob,'hair','head','lux_updo')
# Rounded ribbed crew neck, not a formal shirt collar.
for j in range(32):
 a=j*math.tau/32;ctx.box('LUX_CrewNeckRib',(.086*math.cos(a),.071*math.sin(a)-.008,1.292),(.015,.014,.023),ctx.mat('top_light'),'top','spine',.003,rotation=(0,0,a))
# Fine horizontal knit pattern across the sleeves and torso.
for row in range(15):
 z=.916+row*.021
 for col in range(16):
  x=-.155+col*.020
  if abs(x)<.080 and 1.01<z<1.17:continue
  ctx.box('LUX_KnitV',(x,-.149,z),(.004,.003,.006),ctx.mat('top_light'),'top','spine',.0005,rotation=(0,.3 if (row+col)%2 else -.3,0))
rig.scale=old_scale;rig.location=old_loc;bpy.context.view_layer.update()
P.finish_surfaces(ctx)
scene=bpy.context.scene;bpy.ops.wm.save_as_mainfile(filepath=str(R/'packages/assets/3d/source/new-reference-characters/lux-reference-v2.blend'),compress=True)
P.render_image(R/'renders/new-reference-characters/lux-reference-v2.png',scene.camera,1000,32)
