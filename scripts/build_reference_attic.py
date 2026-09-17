"""Independent attic architecture; existing detailed furnishings are reusable assets.
Never overwrites the old room or registers unreviewed navigation maps in the app.
"""
import bpy, sys, math, json, random
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools/blender'))
from room_premium_common import RoomKit
from build_harper import look_at
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'room_cozy_premium.blend'))
k=RoomKit(); rng=random.Random(910)
for name,color in [('attic_wood','#815236'),('attic_edge','#B57B4B'),('attic_plaster','#E5CBB0'),('attic_tile','#AB6646'),('attic_canvas','#F8EBCD'),('attic_blue','#42869A'),('attic_orange','#DE7842'),('attic_green','#576D41')]:k.material(name,color)
# Keep the reusable furniture/soft goods intact; completely replace the envelope.
for collection in ('ARCHITECTURE','WINDOW_EXTERIOR'):
 c=bpy.data.collections.get(collection)
 if c:
  for o in list(c.objects):bpy.data.objects.remove(o,do_unlink=True)
for obj_name in list(bpy.data.objects.keys()):
 o=bpy.data.objects.get(obj_name)
 if o is None:continue
 if o.name.startswith(('Architecture_','Premium_Curtain','Premium_Window','Premium_Outside','Companion_RoomAnchor')):
  def drop(ob):
   for child in list(ob.children):drop(child)
   bpy.data.objects.remove(ob,do_unlink=True)
  if o.name in bpy.data.objects:drop(o)
# Room is a true elevated attic with an opening in its floor for stairs.
C='ATTIC_STRUCTURE'
k.box('Attic_FloorMain',(-.35,0,-.03),(5.65,5.35,.32),'attic_wood',C)
k.box('Attic_FloorDeskWing',(3.43,1.12,-.03),(1.90,3.12,.32),'attic_wood',C)
for ix in range(25):
 x=-3.02+ix*.295
 for iy in range(10):
  y=-2.39+iy*.53
  if x>2.48 and y<-.45:continue
  k.box('Attic_IndividualFloorboard',(x,y,.15),(.288,.52,.045),('floor','floor_light','floor_dark')[(ix+iy)%3],C,.004)
# Low side wall, tall gable at rear, open roof cutaway toward the viewer.
k.box('Attic_LeftKneeWall',(-3.1,0,1.3),(.18,5.32,2.30),'attic_plaster',C)
k.box('Attic_GableLower',(.6,2.63,1.3),(7.55,.18,2.30),'attic_plaster',C)
verts=[(-3.175,2.54,2.45),(4.375,2.54,2.45),(.60,2.54,4.5),(-3.175,2.72,2.45),(4.375,2.72,2.45),(.60,2.72,4.5)]
k.mesh('Attic_TriangularGable',verts,[(0,1,2),(5,4,3),(0,3,4,1),(1,4,5,2),(2,5,3,0)],'attic_plaster',C)
def beam(name,a,b,width=.13,depth=.16):
 a,b=Vector(a),Vector(b);ob=k.box(name,(a+b)/2,(width,depth,(b-a).length),'attic_wood',C,.012);ob.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return ob
for y in (-2.58,2.47):
 beam('Attic_LeftRoofRafter',(-3.2,y,2.46),(.6,y,4.54),.18,.2)
 beam('Attic_RightRoofRafter',(.6,y,4.54),(4.40,y,2.46),.18,.2)
# Front rafter omitted in the cutaway: it would occlude the room in the source view.
for o in list(bpy.data.objects):
 if o.name.startswith(('Attic_LeftRoofRafter','Attic_RightRoofRafter')) and o.location.y<0:bpy.data.objects.remove(o,do_unlink=True)
beam('Attic_RidgeTimber',(.6,1.6,4.52),(.6,2.82,4.52),.22,.22)
for x in (-3.12,4.32):beam('Attic_EaveTimber',(x,-2.65,2.45),(x,2.8,2.45),.17,.18)
for side in (-1,1):
 slope=side*math.atan2(2.08,3.8)
 for i in range(13):
  x=.6+side*(i+.5)*.29;z=4.51-(i+.5)*.29*2.08/3.8
  for j in range(3):
   k.box('Attic_RoofClayTile',(x,2.40+j*.18,z+.06),(.32,.20,.065),'attic_tile',C,.018,rotation=(0,slope,0))
# Dormer/skylight, a sloping independent window above the study desk.
G='ATTIC_SKYLIGHT'
root=k.group('Attic_Skylight',(2.3,2.20,3.48),rotation=(math.radians(38),0,0),collection=G)
sky=k.material('attic_sky','#A5D1EC',.3)
bs=sky.node_tree.nodes.get('Principled BSDF');bs.inputs['Emission Color'].default_value=(.35,.60,.85,1);bs.inputs['Emission Strength'].default_value=.35
k.box('Attic_SkylightGlass',(0,0,0),(1.82,.05,1.18),sky,G,parent=root)
for x in (-.95,0,.95):k.box('Attic_SkylightUpright',(x,-.06,0),(.075,.13,1.36),'attic_wood',G,parent=root)
for z in (-.65,.65):k.box('Attic_SkylightCrossbar',(0,-.06,z),(1.98,.13,.085),'attic_wood',G,parent=root)
for i in range(6):k.box('Attic_SkyCloud',(-.7+i*.12,-.034,.25+math.sin(i)*.03),(.21,.01,.11),'white',G,.02,parent=root)
# Open stairwell: visible descending treads, stringers, newels, rails and balusters.
S='ATTIC_STAIR'
for i in range(9):
 y=-2.36+i*.22;z=-1.43+i*.185
 k.box('Attic_StairTread',(3.30,y,z),(1.45,.27,.095),'attic_edge',S,.013)
 k.box('Attic_StairRiser',(3.30,y+.10,z-.083),(1.42,.045,.18),'attic_wood',S,.007)
for x in (2.58,4.02):
 beam('Attic_StairStringer',(x,-2.48,-1.58),(x,-.35,.20),.13,.17)
 for y in (-2.55,-1.45,-.42):k.box('Attic_RailingNewel',(x,y,.63),(.11,.11,.98),'attic_wood',S)
 k.box('Attic_RailingTop',(x,-1.48,1.13),(.11,2.23,.10),'attic_edge',S)
 for i in range(9):k.box('Attic_RailingBaluster',(x,-2.43+i*.235,.66),(.044,.044,.86),'attic_wood',S,.005)
# Dedicated artist's station in the space formerly used by the tall shared shelf.
for o in list(bpy.data.objects):
 if o.name.startswith(('Storage_Shelf','Detail_Shelf','Decor_Shelf')):o.hide_render=True
A='ATTIC_ART'
for x in (-.40,.24):beam('Attic_EaselLeg',(x,1.69,.18),(x,1.95,2.14),.045,.065)
beam('Attic_EaselRear',(-.08,2.30,.18),(-.08,1.94,1.98),.045,.065)
k.box('Attic_EaselTray',(-.08,1.72,.92),(.95,.22,.07),'attic_edge',A)
k.box('Attic_ArtCanvasFrame',(-.08,1.90,1.50),(.85,.075,1.03),'attic_wood',A)
k.box('Attic_ArtCanvas',(-.08,1.85,1.50),(.79,.025,.97),'attic_canvas',A)
for i in range(55):
 x=-.40+rng.random()*.63;z=1.12+rng.random()*.71
 k.box('Attic_PaintedMosaic',(x,1.832,z),(.045+rng.random()*.07,.005,.045+rng.random()*.09),('attic_blue','attic_green','attic_orange','pink')[i%4],A,.003)
for i in range(7):
 x=-.45+i*.115
 k.cylinder('Attic_PaintJar',(x,1.66,.995),.037,.10,('attic_blue','attic_orange','attic_green','pink')[i%4],A)
 k.cylinder('Attic_PaintJarLid',(x,1.66,1.05),.039,.015,'gold',A)
# Dense individually framed inspiration wall to the left of the easel.
for row in range(4):
 for col in range(5):
  x=-2.65+col*.39;z=1.50+row*.36
  k.box('Attic_InspirationPhotoBorder',(x,2.50,z),(.28,.028,.30),'cream',A,.003)
  k.box('Attic_InspirationPhoto',(x,2.478,z),(.235,.008,.23),('attic_blue','sage','pink','attic_orange')[(row+col)%4],A,.001)
  for j in range(3):k.box('Attic_PhotoMotif',(x-.07+j*.065,2.471,z-.045+j*.03),(.05,.005,.075),('cream','attic_green','gold')[j],A,.002)
# Warm fairy lights following the actual roof pitch.
glow=k.material('attic_bulb','#FFD18A',.3);bs=glow.node_tree.nodes.get('Principled BSDF');bs.inputs['Emission Color'].default_value=(1,.57,.21,1);bs.inputs['Emission Strength'].default_value=4
for side in (-1,1):
 points=[]
 for i in range(15):
  t=i/14;x=.6+side*3.58*t;z=4.3-1.95*t-.08*math.sin(t*math.pi)
  points.append((x,2.20,z))
  if i%2:k.sphere('Attic_FairyBulb',(x,2.20,z-.05),(.037,.037,.055),glow,'ATTIC_LIGHTS')
 k.tube('Attic_FairyCable',points,.009,'attic_wood','ATTIC_LIGHTS')
# Low storage under the roof is original furniture, filled with separate bound books.
for x in (3.1,3.65,4.2):k.box('Attic_LowCubbyDivider',(x,2.0,.55),(.045,.65,.74),'attic_wood',A)
for z in (.19,.90):k.box('Attic_LowCubbyShelf',(3.65,2.0,z),(1.15,.68,.055),'attic_edge',A)
for i in range(12):k.book('Attic_ArtReferenceBook',(3.17+i*.077,1.69,.23),.055,.27+(i%3)*.025,.20,('sage','pink','attic_blue')[i%3],collection=A)
scene=bpy.context.scene;scene['reference_rebuild']='attic-creative-v1';scene['review_status']='Work in progress: compare against supplied plate before app integration'
scene.camera=bpy.data.objects.get('Camera_Cozy_Hero') or scene.camera
scene.camera.location=(10,-12,9);look_at(scene.camera,(.5,.15,1.45));scene.camera.data.type='ORTHO';scene.camera.data.ortho_scale=11.2
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.resolution_x=1500;scene.render.resolution_y=1200;scene.render.resolution_percentage=100
out=ROOT/'packages/assets/3d/source/rooms/reference-rebuild';out.mkdir(parents=True,exist_ok=True)
render=ROOT/'renders/reference-rooms';render.mkdir(parents=True,exist_ok=True)
scene.render.filepath=str(render/'atico-creativo-v1.png')
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(out/'atico-creativo-v1.blend'),compress=True)
(out/'atico-creativo-v1.json').write_text(json.dumps({'status':'awaiting visual review','objects':len(scene.objects),'new_objects':len(k.created),'new_architecture':['gable','roof tiles','exposed rafters','skylight','open stairwell','railing'],'app_integrated':False},indent=2),encoding='utf-8')
bpy.ops.render.render(write_still=True)
print('ATTIC_RENDER_READY',scene.render.filepath,flush=True)
