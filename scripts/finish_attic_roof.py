import bpy,sys,math
from pathlib import Path
R=Path(__file__).resolve().parents[1];sys.path.insert(0,str(R/'tools/blender'))
from room_premium_common import RoomKit
from build_harper import look_at
bpy.ops.wm.open_mainfile(filepath=str(R/'packages/assets/3d/source/rooms/reference-rebuild/atico-creativo-v2.blend'))
k=RoomKit();C='ATTIC_FURNITURE'
# The skylight belongs to the roof plane, with a real opening and flashing.
window=bpy.data.objects.get('Attic_Skylight')
window.location=(2.30,1.82,3.60)
window.rotation_euler=(math.pi/2,math.atan2(2.08,3.8),0)
for ix in range(19):
 x=.70+ix*.20;z=4.53-(x-.6)*2.08/3.8
 for iy in range(8):
  y=1.02+iy*.20
  if 1.34<x<3.25 and 1.17<y<2.48:continue
  k.box('V2_RoofAroundSkylight',(x,y,z),(.215,.214,.065),'attic_tile','ATTIC_STRUCTURE',.015,rotation=(0,math.atan2(2.08,3.8),0))
# Keep every print inside the gable silhouette.
for o in bpy.context.scene.objects:
 if o.name.startswith('V2_Collage_') and o.type=='EMPTY':
  half=max((abs(v.co.z) for ch in o.children if ch.type=='MESH' for v in ch.data.vertices),default=.25)
  roof=4.5-abs(o.location.x-.6)*2.08/3.8
  o.location.z=min(o.location.z,roof-half-.15)
# Long staggered oak boards replace the checkerboard-like floor.
for o in list(bpy.data.objects):
 if o.name.startswith('Attic_IndividualFloorboard'):bpy.data.objects.remove(o,do_unlink=True)
for key,color in [('v3_oak1','#C99467'),('v3_oak2','#CEA075'),('v3_oak3','#C7986C')]:
 m=k.material(key,color,.55)
 nodes=m.node_tree.nodes;bs=nodes.get('Principled BSDF');coord=nodes.new('ShaderNodeTexCoord');stretch=nodes.new('ShaderNodeVectorMath');stretch.operation='MULTIPLY';stretch.inputs[1].default_value=(80,5,35)
 noise=nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=2;noise.inputs['Detail'].default_value=3
 bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.2;bump.inputs['Distance'].default_value=.012
 m.node_tree.links.new(coord.outputs['Generated'],stretch.inputs[0]);m.node_tree.links.new(stretch.outputs[0],noise.inputs['Vector']);m.node_tree.links.new(noise.outputs['Fac'],bump.inputs['Height']);m.node_tree.links.new(bump.outputs['Normal'],bs.inputs['Normal'])
for ix in range(25):
 x=-3.02+ix*.295
 offset=(ix%3)*.33
 for iy in range(6):
  lo=max(-2.64,-2.64+iy*1.06-offset);hi=min(2.66,-2.64+(iy+1)*1.06-offset)
  if hi<=lo:continue
  if x>2.48:lo=max(lo,-.42)
  if hi<=lo:continue
  y=(lo+hi)/2
  k.box('V3_OakPlank',(x,y,.15),(.288,hi-lo-.008,.045),('v3_oak1','v3_oak2','v3_oak3')[(ix*7+iy)%3],C,.003)
  for side in (-1,1):k.cylinder('V3_OakNail',(x+side*.095,hi-.05,.174),.0025,.0015,'oak_dark',C,8)
# Laptop with modeled hinges, keycaps and touchpad.
for name in list(bpy.data.objects.keys()):
 o=bpy.data.objects.get(name)
 if o and name.startswith(('Desk_Monitor','STUDY_UI_','Desk_Keyboard','STUDY_Keyboard')):bpy.data.objects.remove(o,do_unlink=True)
k.box('V3_LaptopBase',(1.18,1.93,1.104),(.61,.42,.027),'ink',C,.01)
k.box('V3_LaptopPalmrest',(1.18,1.92,1.12),(.58,.38,.009),'linen_shadow',C,.004)
k.box('V3_LaptopTouchpad',(1.18,1.79,1.127),(.20,.08,.004),'cream',C,.004)
for row in range(4):
 for col in range(12):k.box('V3_LaptopKey',(0.936+col*.044,1.88+row*.046,1.133),(.038,.037,.008),'ink',C,.003)
for x in (.94,1.42):k.cylinder('V3_LaptopHinge',(x,2.12,1.125),.02,.06,'gold',C,16).rotation_euler[1]=math.pi/2
lid=k.group('V3_LaptopLid',(1.18,2.15,1.34),rotation=(math.radians(-12),0,0),collection=C)
k.box('V3_LaptopScreenShell',(0,0,0),(.61,.027,.43),'ink',C,.012,parent=lid)
k.box('V3_LaptopScreen',(0,-.017,0),(.56,.005,.375),'attic_blue',C,.003,parent=lid)
for i in range(8):k.box('V3_ScreenDocumentLine',(-.11,-.022,.12-i*.027),(.23 if i%3 else .17,.002,.006),'cream',C,.001,parent=lid)

scene=bpy.context.scene
scene.camera.location=(10,-12,9);look_at(scene.camera,(.5,.15,1.42));scene.camera.data.ortho_scale=10.8
scene.cycles.samples=32;scene.render.resolution_x=1800;scene.render.resolution_y=1500
scene.render.filepath=str(R/'renders/reference-rooms/atico-creativo-v3.png')
bpy.ops.wm.save_as_mainfile(filepath=str(R/'packages/assets/3d/source/rooms/reference-rebuild/atico-creativo-v3.blend'),compress=True)
bpy.ops.render.render(write_still=True)
print('V3_RENDER_READY',flush=True)
