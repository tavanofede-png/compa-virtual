"""Finish hero props and render review close-ups without replacing released assets."""
import bpy,sys,math,json
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[1];sys.path.insert(0,str(R/'scripts'))
from build_distinct_reference_rooms import *
from refine_reference_room_layouts import bounds
C='FINAL_REFERENCE_DETAILS'

def foliage(k,name,x,y,z):
 k.cylinder(name+'Pot',(x,y,z+.10),.13,.20,'terracotta',C,18,radius_top=.15)
 for j in range(7):
  a=j*2.399;xx=x+.12*math.cos(a);yy=y+.12*math.sin(a);zz=z+.30+(j%3)*.07
  k.tube(name+'Stem',[(x,y,z+.17),(xx,yy,zz)],.004,'sage',C)
  for p in range(5):
   angle=p*math.tau/5;o=k.sphere(name+'Petal',(xx+.038*math.cos(angle),yy+.038*math.sin(angle),zz),(.032,.026,.016),'pink_light' if j%2 else 'cream',C,8,4)
  k.sphere(name+'Pollen',(xx,yy,zz+.012),(.018,.018,.015),'gold',C,8,4)

def final(theme):
 src=OUT/(theme+('-v7.blend' if theme=='atico-creativo' else '-v2.blend'))
 bpy.ops.wm.open_mainfile(filepath=str(src));k=RoomKit()
 if theme=='rincon-urbano':
  remove(('PRM_BOT_MainShelfPothos',))
  for n in ('Desk_ChairSeat','Desk_ChairBack'):
   o=bpy.data.objects.get(n)
   if o:o.data.materials.clear();o.data.materials.append(k.mat('cream'))
  o=bpy.data.objects.get('CITY_StudyPoster')
  if o:o.location=(.65,2.5,2.99);o.scale*=.55
  for n in ('CITY_QuoteFrame','CITY_Quote'):
   o=bpy.data.objects.get(n)
   if o:o.location.z+=.40
 elif theme=='rincon-explorador':
  if not bpy.context.scene.get('bedside_relocated_for_library'):
   for o in list(bpy.context.scene.objects):
    if not o.parent and o.name.startswith(('Premium_Bedside_Right','Premium_Bedside_CurrentBooks','PRM_BOT_BedsideCalathea')):o.location+=Vector((-1.97,-2.80,0))
   bpy.context.scene['bedside_relocated_for_library']=True
  # Remove the floating shelf assembly obstructing the window, keep the side libraries.
  for obj_name in list(bpy.context.scene.objects.keys()):
   o=bpy.data.objects.get(obj_name)
   if o is None:continue
   if o.parent or o.name.startswith(('EXP_','Architecture_')):continue
   bb=bounds(o)
   if bb and bb[0][1]>2.08 and bb[0][2]>2.2 and bb[1][2]<2.96 and bb[0][0]>-.85 and bb[1][0]<1.95:drop(o)
  # Telescopic objective and focusing collar.
  for loc,r,depth,key in [((2.58,1.95,1.66),.074,.034,'gold'),((2.596,1.944,1.668),.059,.014,'dusk'),((2.22,2.11,1.44),.044,.045,'ink')]:
   o=k.cylinder('EXP_ScopeDetail',loc,r,depth,key,C,32);o.rotation_euler=(.5,1.1,0)
  # Camera and strap on the foot trunk.
  k.box('EXP_TravelCamera',(-1.58,-1.72,.82),(.23,.12,.14),'ink',C,.016)
  o=k.cylinder('EXP_CameraLens',(-1.58,-1.799,.83),.053,.07,'metal',C,24);o.rotation_euler.x=math.pi/2
  o=k.cylinder('EXP_CameraGlass',(-1.58,-1.84,.83),.042,.008,'dusk',C,24);o.rotation_euler.x=math.pi/2
  k.tube('EXP_CameraStrap',[(-1.70,-1.72,.80),(-1.79,-1.65,.77),(-1.55,-1.57,.76),(-1.46,-1.72,.8)],.007,'oak_dark',C)
 elif theme=='sala-control-gamer':
  # Orient the auxiliary monitor toward the open working edge of the L return.
  o=bpy.data.objects.get('GAMER_ReturnDisplay')
  if o:o.rotation_euler.z=0;o.location=(3.11,.90,1.58)
  o=bpy.data.objects.get('GAMER_ReturnMonitorBack')
  if o:o.location=(3.11,.926,1.58);o.rotation_euler.z=math.pi/2
  # Illustrated game spines with individual colors, platform strips and emblems.
  for row in range(2):
   for j in range(9):
    y=-.39+j*.14;z=1.72+row*.44+.14
    k.box('GAMER_GameSpineArt',(-2.679,y,z),(.005,.080,.204),('dusk','pink_dark','sage','gold')[(j+row)%4],C,.001)
    k.box('GAMER_GamePlatformStripe',(-2.674,y,z+.084),(.006,.080,.015),'cream',C,.001)
    for q in range(3):k.box('GAMER_GameTitleGlyph',(-2.670,y-.024+q*.022,z-.046),(.006,.012,.018+q*.004),'cream',C,0)
    for q in range(4):k.sphere('GAMER_GameCoverConstellation',(-2.669,y+.024*math.cos(q*1.6),z+.027+.027*math.sin(q*1.6)),(.004,.007,.009),'gold',C,6,4)
  # Individual helmets and accessories distinguish the collectible silhouettes.
  for j in range(9):
   x=-.28+j*.26
   if j%3==0:k.box('GAMER_CollectibleVisor',(x,2.184,2.594),(.08,.009,.027),'dusk',C,.006)
   elif j%3==1:
    for dx in (-.046,.046):k.sphere('GAMER_CollectibleEar',(x+dx,2.23,2.63),(.02,.024,.029),'pink',C,8,4)
   else:k.box('GAMER_CollectibleHelmet',(x,2.23,2.632),(.11,.095,.030),'gold',C,.008)
 elif theme=='habitacion-invernadero':
  # Woven green reading chair by the fountain, behind the foreground planter line.
  x=2.30;y=-.68
  k.box('GARDEN_ReadingCushion',(x,y,.61),(.59,.61,.17),'sage',C,.06)
  k.box('GARDEN_ReadingBack',(x,y+.28,.92),(.60,.14,.61),'sage_light',C,.06)
  for dx in (-.35,.35):
   for dy in (-.25,.26):beam(k,'GARDEN_ReadingLeg',(x+dx,y+dy,.20),(x+dx,y+dy,.76),.045,'oak')
   beam(k,'GARDEN_ReadingArm',(x+dx,y-.28,.8),(x+dx,y+.3,.8),.05,'oak')
  for j in range(12):beam(k,'GARDEN_ChairBackWeave',(x-.28+j*.05,y+.365,.69),(x-.28+j*.05,y+.365,1.16),.014,'oak_light')
  for j,pos in enumerate([(-2.72,-.9,.24),(3.75,1.9,2.75),(2.14,2.22,1.08)]):foliage(k,'GARDEN_Flower%d_'%j,*pos)
 elif theme=='estudio-musical':
  # DAW display with separate track lanes and waveform segments.
  k.box('MUSIC_DawDisplay',(1.17,1.838,1.53),(.69,.007,.40),'ink',C,.003)
  for row in range(6):
   z=1.375+row*.057;k.box('MUSIC_TrackLabel',(.895,1.831,z),(.10,.003,.037),('sage','pink','dusk')[row%3],C,.001)
   for j in range(14):k.box('MUSIC_Waveform',(.98+j*.033,1.827,z),(.012,.003,.010+.027*abs(math.sin(j*1.33+row))),('sage_light','pink_light','gold')[row%3],C,0)
  # Acoustic instrument with a waisted soundbox, rosette and strings.
  g=k.group('MUSIC_AcousticFeature',(-2.90,.90,1.35),rotation=(0,0,math.pi/2),collection=C)
  for z,s in ((.12,(.17,.045,.20)),(.33,(.13,.045,.17))):k.sphere('MUSIC_AcousticBody',(0,0,z),s,'oak_light',C,20,12,g)
  k.box('MUSIC_AcousticNeck',(0,0,.64),(.050,.042,.51),'oak_dark',C,.006,parent=g)
  k.box('MUSIC_AcousticHeadstock',(0,0,.94),(.074,.044,.12),'oak',C,.007,parent=g)
  o=k.cylinder('MUSIC_AcousticRosette',(0,-.047,.29),.051,.009,'oak_dark',C,32,parent=g);o.rotation_euler.x=math.pi/2
  o=k.cylinder('MUSIC_AcousticSoundhole',(0,-.055,.29),.037,.008,'ink',C,32,parent=g);o.rotation_euler.x=math.pi/2
  k.box('MUSIC_AcousticBridge',(0,-.053,.12),(.095,.012,.025),'oak_dark',C,.004,parent=g)
  for j in range(6):k.tube('MUSIC_AcousticString',[(-.017+j*.0068,-.063,.12),(-.017+j*.0068,-.028,.96)],.0008,'gold',C,parent=g)
  for j in range(14):k.box('MUSIC_AcousticFret',(0,-.025,.45+j*.03),(.049,.003,.002),'metal',C,0,parent=g)
 # subtle real surface detail, not a substitute for constructed props
 for mat in bpy.data.materials:
  if not mat.use_nodes or not mat.name.startswith(('MAT_OAK','MAT_FLOOR')):continue
  nt=mat.node_tree;bs=nt.nodes.get('Principled BSDF')
  if not bs or bs.inputs['Normal'].is_linked:continue
  noise=nt.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=80;noise.inputs['Detail'].default_value=2
  bump=nt.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.12;bump.inputs['Distance'].default_value=.007
  nt.links.new(noise.outputs['Fac'],bump.inputs['Height']);nt.links.new(bump.outputs['Normal'],bs.inputs['Normal'])
 scene=bpy.context.scene;scene.render.resolution_x=1500;scene.render.resolution_y=1200;scene.cycles.samples=24
 scene['release_status']='review master; not runtime optimized or integrated'
 bpy.ops.wm.save_as_mainfile(filepath=str(OUT/(theme+'-review.blend')),compress=True)
 scene.render.filepath=str(PRE/(theme+'-review.png'));bpy.ops.render.render(write_still=True)
 cam=scene.camera;target={'atico-creativo':(.5,.95,1.25),'rincon-urbano':(1.70,1.7,1.65),'sala-control-gamer':(1.75,1.4,1.53),'habitacion-invernadero':(3.1,-.5,1.0),'estudio-musical':(1.05,1.9,1.70),'rincon-explorador':(-1.60,.5,1.8)}[theme]
 cam.location=Vector(target)+Vector((5,-7,4.2));look_at(cam,target);cam.data.ortho_scale=4.2
 scene.render.resolution_x=1000;scene.render.resolution_y=1000;scene.cycles.samples=20
 scene.render.filepath=str(PRE/(theme+'-detail.png'));bpy.ops.render.render(write_still=True)
 (OUT/(theme+'-review.json')).write_text(json.dumps({'theme':theme,'objects':len(scene.objects),'mesh_objects':sum(o.type=='MESH' for o in scene.objects),'status':'review master','app_integrated':False,'full_collision_audit':False},indent=2))
 print('FINAL_REVIEW_READY',theme,flush=True)
if __name__=='__main__':
 for name in sys.argv[sys.argv.index('--')+1:]:final(name)
