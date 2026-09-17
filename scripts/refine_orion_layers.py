import bpy,sys,math
from pathlib import Path
R=Path(__file__).resolve().parents[1];sys.path.insert(0,str(R/'scripts'));sys.path.insert(0,str(R/'tools/blender'))
import character_premium_pipeline as P
from new_reference_roster import CHARACTERS_NEW
from room_premium_common import RoomKit
c=next(c for c in CHARACTERS_NEW if c.id=='orion');out=R/'packages/assets/3d/source/new-reference-characters'
bpy.ops.wm.open_mainfile(filepath=str(out/'orion-reference-v1.blend'));rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');ctx=P.Context(rig,c);s=rig.scale.copy();l=rig.location.copy();rig.scale=(1,1,1);rig.location=(0,0,0);bpy.context.view_layer.update()
for o in list(bpy.data.objects):
 if o.name.startswith(('Top_VarsityOpening','Top_Snap','Premium_Top_JPatch','Premium_Top_FrontFacing','Premium_Top_WeltPocket')):bpy.data.objects.remove(o,do_unlink=True)
for o in bpy.data.objects:
 if o.name.startswith('orion_PixelEmbroidery'):o.location.y-=.025
 if o.type=='MESH' and o.name.startswith('Premium_Top_ContinuousSleeve'):
  o.data.materials.clear();o.data.materials.append(ctx.mat('top'))
for sign in (-1,1):
 ctx.box('ORION_JacketLapel',(sign*.124,-.180,1.10),(.039,.022,.35),ctx.mat('top_light'),'top','spine',.003,rotation=(0,sign*.06,0))
 ctx.box('ORION_ChestPocket',(sign*.165,-.180,1.17),(.070,.017,.10),ctx.mat('top_dark'),'top','spine',.005)
 for z in (.94,1.04,1.14):ctx.box('ORION_SideSnap',(sign*.125,-.195,z),(.009,.005,.009),ctx.mat('metal'),'top','spine',.002)
k=RoomKit();o=k.tube('ORION_InnerHood',[(-.17,.05,1.25),(-.16,.12,1.33),(0,.18,1.38),(.16,.12,1.33),(.17,.05,1.25)],.042,ctx.mat('white'),'HOOD');ctx.attach(o,'top','spine','inner_hood')
rig.scale=s;rig.location=l;bpy.context.view_layer.update();P.finish_surfaces(ctx)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'orion-reference-v2.blend'),compress=True);P.render_image(R/'renders/new-reference-characters/orion-reference-v2.png',bpy.context.scene.camera,1000,24)
