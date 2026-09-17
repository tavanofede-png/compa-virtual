import bpy,sys,math,json
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[1];sys.path.insert(0,str(R/'scripts'));sys.path.insert(0,str(R/'tools/blender'))
from new_reference_roster import CHARACTERS_NEW
import character_premium_pipeline as P
from room_premium_common import RoomKit
from premium_validation import validate_scene
for name in sys.argv[sys.argv.index('--')+1:]:
 c=next(c for c in CHARACTERS_NEW if c.id==name);out=R/'packages/assets/3d/source/new-reference-characters'
 bpy.ops.wm.open_mainfile(filepath=str(out/(name+'-reference-v1.blend')));rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');ctx=P.Context(rig,c);k=RoomKit();s=rig.scale.copy();l=rig.location.copy();rig.scale=(1,1,1);rig.location=(0,0,0);bpy.context.view_layer.update()
 if name=='kai':
  for side,sign in [('L',-1),('R',1)]:
   for joint,loc,size,bone in [('Elbow',(sign*.375,-.005,.985),(.081,.070,.089),'forearm.'+side),('Wrist',(sign*.405,-.021,.748),(.061,.056,.058),'hand.'+side)]:
    ob=k.sphere('KAI_ContinuousSkin'+joint,loc,size,ctx.mat('skin'),'SKIN_JOINTS',16,10);ctx.attach(ob,'body',bone,'skin_joint')
  # Warm center of the flame, not one flat red symbol.
  for row,line in enumerate([' 1 ','111','111',' 1 ']):
   for col,p in enumerate(line):
    if p=='1':ctx.box('KAI_FlameCore',(-.018+col*.017,-.164,1.10-row*.017),(.016,.003,.016),ctx.mat('hair_mid'),'top','spine',.001)
 elif name=='noa':
  # Woven checks live on the garment surface, not floating grid bars.
  for o in list(bpy.data.objects):
   if o.name.startswith(('noa_Plaid','noa_Notebook')):bpy.data.objects.remove(o,do_unlink=True)
  mat=ctx.mat('bottom').copy();mat.name='NOA_WovenPlaid';nt=mat.node_tree;bs=nt.nodes.get('Principled BSDF')
  coord=nt.nodes.new('ShaderNodeTexCoord');sep=nt.nodes.new('ShaderNodeSeparateXYZ');nt.links.new(coord.outputs['Generated'],sep.inputs[0]);signals=[]
  for axis,frequency in [('X',20),('Z',28)]:
   mul=nt.nodes.new('ShaderNodeMath');mul.operation='MULTIPLY';mul.inputs[1].default_value=frequency;nt.links.new(sep.outputs[axis],mul.inputs[0])
   sine=nt.nodes.new('ShaderNodeMath');sine.operation='SINE';nt.links.new(mul.outputs[0],sine.inputs[0])
   threshold=nt.nodes.new('ShaderNodeMath');threshold.operation='GREATER_THAN';threshold.inputs[1].default_value=.86;nt.links.new(sine.outputs[0],threshold.inputs[0]);signals.append(threshold)
  combine=nt.nodes.new('ShaderNodeMath');combine.operation='MAXIMUM'
  for j,n in enumerate(signals):nt.links.new(n.outputs[0],combine.inputs[j])
  mix=nt.nodes.new('ShaderNodeMixRGB');mix.inputs[1].default_value=(.13,.105,.085,1);mix.inputs[2].default_value=(.30,.25,.20,1);nt.links.new(combine.outputs[0],mix.inputs[0]);nt.links.new(mix.outputs[0],bs.inputs['Base Color'])
  for o in bpy.context.scene.objects:
   if o.type=='MESH' and o.name.startswith('Premium_Pants_'):
    o.data.materials.clear();o.data.materials.append(mat)
  # Neutral fitting pose: notebooks sit in the left hand, not suspended on the chest.
  for j in range(3):
   y=-.10-j*.030
   ctx.box('NOA_CarriedPages',(-.41,y,.73),(.21,.022,.28),ctx.mat('paper'),'hand_prop','hand.L',.002)
   for dy in (-.014,.014):ctx.box('NOA_CarriedCover',(-.41,y+dy,.73),(.22,.003,.29),ctx.mat(('top','accent','bottom')[j]),'hand_prop','hand.L',.002)
 elif name=='elise':
  for o in bpy.context.scene.objects:
   if o.name.startswith('elise_TieredSkirt'):
    # Expand the waist silhouette enough to enclose the underlying hips.
    for v in o.data.vertices:
     if v.co.z>.68:v.co.x*=1.14;v.co.y*=1.10
   if o.get('compa_slot')=='shoes' and o.type=='MESH':
    for slot in o.material_slots:
     if slot.material and any(w in slot.material.name.lower() for w in ('accent','sole')):slot.material=ctx.mat('shoes')
  # Long wavy locks retain consistent thickness and a faceted edge.
  for o in bpy.data.objects:
   if o.type=='MESH' and o.name.startswith('PRM_Hair_Long'):
    for v in o.data.vertices:
     v.co.x+=.014*math.sin((v.co.z-1.0)*35+o.name.__len__());v.co.y+=.007*math.cos(v.co.z*28)
  # Remove the school backpack and build the requested leather shoulder bag.
  for o in list(bpy.data.objects):
   if o.get('compa_slot')=='back':bpy.data.objects.remove(o,do_unlink=True)
  ctx.box('ELISE_LeatherBag',(-.29,.03,.92),(.19,.12,.23),ctx.mat('shoes'),'back','spine',.018)
  ctx.box('ELISE_BagFlap',(-.29,-.035,.965),(.19,.016,.13),ctx.mat('hair'),'back','spine',.012)
  ob=k.tube('ELISE_ShoulderStrap',[(-.23,0,1.24),(-.32,-.06,1.09),(-.33,-.04,.97)],.011,ctx.mat('shoes'),'BAG');ctx.attach(ob,'back','spine','shoulder_bag')
 rig.scale=s;rig.location=l;bpy.context.view_layer.update();P.finish_surfaces(ctx)
 report=validate_scene(rig);bpy.ops.wm.save_as_mainfile(filepath=str(out/(name+'-reference-v2.blend')),compress=True)
 P.render_image(R/'renders/new-reference-characters'/(name+'-reference-v2.png'),bpy.context.scene.camera,1000,24)
 (out/(name+'-reference-v2.json')).write_text(json.dumps({'id':name,'structural_validation':report,'all_outfits_validated':False,'app_integrated':False},indent=2))
