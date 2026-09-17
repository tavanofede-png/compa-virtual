"""Five structurally distinct reference rooms, isolated from the released assets."""
import bpy,math,sys,random,json
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[1];sys.path.insert(0,str(R/'tools/blender'))
from room_premium_common import RoomKit
from build_cozy_room import PALETTE
from build_harper import look_at
import room_collection_designs as D
OUT=R/'packages/assets/3d/source/rooms/reference-rebuild';PRE=R/'renders/reference-rooms'
def drop(o):
 for c in list(o.children):drop(c)
 bpy.data.objects.remove(o,do_unlink=True)
def remove(prefixes):
 for n in list(bpy.data.objects.keys()):
  o=bpy.data.objects.get(n)
  if o and n.startswith(prefixes):drop(o)
def panel(k,name,pos,w,h,cell,rotation=0):
 mat=bpy.data.materials.get('REF_ATLAS')
 if not mat:
  mat=bpy.data.materials.new('REF_ATLAS');mat.use_nodes=True
  tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(R/'packages/assets/3d/textures/room-world-atlas.png'));tex.image.pack()
  bs=mat.node_tree.nodes.get('Principled BSDF');mat.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color']);bs.inputs['Roughness'].default_value=.86
 ob=k.mesh(name,[(-w/2,0,-h/2),(w/2,0,-h/2),(w/2,0,h/2),(-w/2,0,h/2)],[(0,1,2,3)],mat,'REFERENCE_ART',0)
 ob.location=pos;ob.rotation_euler.z=rotation
 uv=ob.data.uv_layers.new();u=(cell%2)*.5;v=.5-(cell//2)*.5
 for i,c in enumerate([(u+.003,v+.003),(u+.497,v+.003),(u+.497,v+.497),(u+.003,v+.497)]):uv.data[i].uv=c
 return ob
def beam(k,name,a,b,r=.045,key='metal'):
 a,b=Vector(a),Vector(b);o=k.box(name,(a+b)/2,(r,r,(b-a).length),key,'NEW_STRUCTURE',.005);o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return o
def trunk(k,name,x,y,w=.70,d=.45,h=.40):
 g=k.group(name,(x,y,.20),collection='EXPLORER_LUGGAGE')
 k.box(name+'_LeatherBody',(0,0,h/2),(w,d,h),'oak_dark','EXPLORER_LUGGAGE',.045,parent=g)
 k.box(name+'_Lid',(0,0,h),(w+.01,d+.01,.06),'oak','EXPLORER_LUGGAGE',.025,parent=g)
 for xx in (-w*.32,w*.32):
  k.box(name+'_Strap',(xx,-d/2-.006,h/2),(.04,.018,h),'gold','EXPLORER_LUGGAGE',.004,parent=g)
  k.box(name+'_Buckle',(xx,-d/2-.020,h*.65),(.073,.024,.059),'gold','EXPLORER_LUGGAGE',.008,parent=g)
 for xx in (-w/2,w/2):
  for yy in (-d/2,d/2):
   for zz in (.05,h-.04):k.sphere(name+'_CornerStud',(xx,yy,zz),(.026,.026,.025),'gold','EXPLORER_LUGGAGE',8,4,parent=g)
 k.tube(name+'_Handle',[(-.08,-d/2-.02,h*.45),(-.08,-d/2-.055,h*.55),(.08,-d/2-.055,h*.55),(.08,-d/2-.02,h*.45)],.015,'ink','EXPLORER_LUGGAGE',parent=g)
 return g
def keyboard(k,x,y,z):
 k.box('MUSIC_SynthHousing',(x,y,z),(.98,.35,.08),'ink','MUSIC_STATION',.018)
 for i in range(28):
  xx=x-.45+i*.033
  k.box('MUSIC_IvoryKey',(xx,y-.02,z+.046),(.031,.25,.016),'cream','MUSIC_STATION',.002)
  if i%7 not in (2,6):k.box('MUSIC_BlackKey',(xx+.018,y+.05,z+.065),(.020,.13,.025),'black','MUSIC_STATION',.002)
 for i in range(8):k.cylinder('MUSIC_SynthKnob',(x-.4+i*.1,y+.145,z+.062),.012,.024,'gold','MUSIC_STATION',12)
def electric(k,x,y,z,color):
 g=k.group('MUSIC_ElectricGuitar',(x,y,z),collection='MUSIC_INSTRUMENTS')
 verts=[];outline=[(-.15,0),(-.21,.13),(-.14,.31),(-.08,.35),(-.06,.23),(.05,.23),(.14,.37),(.21,.26),(.19,.09),(.11,0)]
 for yy in (-.032,.032):verts.extend((xx,yy,zz) for xx,zz in outline)
 n=len(outline);faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
 k.mesh('MUSIC_GuitarContouredBody',verts,faces,color,'MUSIC_INSTRUMENTS',.022,g)
 k.box('MUSIC_GuitarNeck',(0,0,.60),(.052,.042,.69),'oak_dark','MUSIC_INSTRUMENTS',.006,parent=g)
 k.box('MUSIC_GuitarHeadstock',(.015,0,.99),(.086,.05,.15),'oak','MUSIC_INSTRUMENTS',.012,parent=g)
 for i in range(18):k.box('MUSIC_GuitarFret',(0,-.026,.30+i*.035),(.052,.003,.002),'gold','MUSIC_INSTRUMENTS',0,parent=g)
 for i in range(6):
  xx=-.018+i*.0072;k.tube('MUSIC_GuitarString',[(xx,-.041,.07),(xx,-.029,1.02)],.0007,'gold','MUSIC_INSTRUMENTS',parent=g)
  k.sphere('MUSIC_GuitarTuner',(-.054 if i%2 else .065,0,.93+(i//2)*.04),(.017,.012,.01),'gold','MUSIC_INSTRUMENTS',8,4,parent=g)
 for zz in (.12,.20):k.box('MUSIC_GuitarPickup',(0,-.044,zz),(.10,.016,.025),'cream','MUSIC_INSTRUMENTS',.003,parent=g)
def build(theme):
 bpy.ops.wm.open_mainfile(filepath=str(R/'room_cozy_premium.blend'));k=RoomKit()
 for key,c in PALETTE.items():k.material(key,c)
 for key,c in [('dusk','#506F88'),('berry','#A2585D'),('thread','#DACBA9'),('black','#171A20'),('terracotta','#B87F52')]:k.material(key,c)
 palette={'rincon-urbano':'minimalista','sala-control-gamer':'tecnologia','habitacion-invernadero':'naturaleza','estudio-musical':'urbano','rincon-explorador':'biblioteca-moderna'}[theme]
 D.recolor(palette)
 remove(('Architecture_BackWall','Architecture_LeftWall','Architecture_Window','Premium_Window','Premium_Curtain','Premium_Outside','Companion_RoomAnchor','Studio_Ceiling','Premium_Wall_','Premium_Garland','PRM_BOT_Window','Decor_Clock'))
 # The reference bed is against the rear wall. Move every member of the assembly.
 for o in list(bpy.context.scene.objects):
  if o.parent is None and o.name.startswith(('Bed_','Detail_Headboard','Detail_Bed','Premium_Bed','Storage_Nightstand','Detail_Nightstand','Light_Bedside','PRM_BOT_Bedside')):o.location.y+=1.0
 # Reuse rich props without putting them in the circulation zone.
 for n,delta in [('PRM_BOT_FloorMonstera',(1.10,1.50,0)),('PRM_BOT_FloorFern',(-2.0,0,0)),('PRM_BOT_FloorRubberPlant',(.15,2.10,0))]:
  o=bpy.data.objects.get(n)
  if o:o.location+=Vector(delta)
 remove(('Premium_Personal_AcousticGuitar','Premium_Personal_Skateboard'))
 C='NEW_STRUCTURE';features=[]
 if theme=='rincon-urbano':
  # Genuine two-sided glazed corner, not the former window in a colored wall.
  panel(k,'CITY_LeftPanorama',(-3.17,0,1.82),5.23,3.22,0,math.pi/2)
  panel(k,'CITY_RearPanorama',(-1.60,2.70,1.82),3.10,3.22,0)
  k.box('CITY_DeskWall',(2.30,2.64,1.78),(4.05,.18,3.20),'wall',C)
  for y in (-2.57,-1.26,.05,1.36,2.58):beam(k,'CITY_LeftMullion',(-3.07,y,.18),(-3.07,y,3.47),.06,'ink')
  for x in (-3.08,-1.54,.03):beam(k,'CITY_RearMullion',(x,2.54,.18),(x,2.54,3.47),.06,'ink')
  for z in (.20,3.45):
   beam(k,'CITY_LeftFrame',(-3.07,-2.6,z),(-3.07,2.6,z),.08,'ink');beam(k,'CITY_RearFrame',(-3.1,2.54,z),(.03,2.54,z),.08,'ink')
  # Platform bed with three visible storage niches and drawers.
  for i in range(3):
   y=.18+i*.69;k.box('CITY_BedStorageBox',(-.90,y,.40),(.22,.61,.31),'oak_light',C,.008)
   k.box('CITY_BedDrawerInset',(-.775,y,.40),(.012,.54,.22),'oak_dark',C,.002)
   k.box('CITY_BedDrawerHandle',(-.76,y,.43),(.025,.20,.025),'metal',C,.002)
  panel(k,'CITY_StudyPoster',(1.4,2.51,2.50),.72,.91,0)
  k.text('CITY_PosterCaption','A BRIGHTER\nYOU',(2.50,2.50,2.55),.16,'ink',C,(math.pi/2,0,0))
  features=['corner panoramic glazing','city vista','platform-bed storage','urban framed art']
 elif theme=='sala-control-gamer':
  for n,loc,dims in [('Left',(-3.07,0,1.75),(.20,5.35,3.15)),('Rear',(.6,2.63,1.75),(7.55,.20,3.15))]:k.box('GAMER_'+n+'Wall',loc,dims,'wall',C)
  D.tecnologia(k);remove(('TECH_Robot','TECH_Console','TECH_Robotics'))
  # Return desk creates an actual L-shaped command station.
  k.box('GAMER_ReturnWorktop',(3.11,.91,1.02),(.79,2.40,.08),'oak_dark',C,.014)
  for yy in (-.17,1.99):k.box('GAMER_ReturnLeg',(3.12,yy,.59),(.65,.065,.80),'metal',C,.008)
  panel(k,'GAMER_LandscapeMonitor',(1.17,1.84,1.59),.69,.40,3)
  screen=panel(k,'GAMER_ReturnDisplay',(3.24,.91,1.58),.88,.51,3,math.pi/2)
  glow=D.glow(k,'gamer_neon','#685AFF',4)
  for y in (-.15,2.1):k.box('GAMER_ReturnRGB',(3.11,y,.97),(.73,.02,.025),glow,C,.003)
  k.text('GAMER_NeonPoster','GOOD\nSTUDY\nGOOD\nGAME',(-2.947,-.80,2.15),.19,glow,C,(math.pi/2,0,math.pi/2))
  # Figurines have separate heads, eyes, torsos and limbs; no repeated colored blocks.
  for i in range(9):
   x=-.28+i*.26;z=2.42
   k.box('GAMER_CollectibleBody',(x,2.23,z+.07),(.075,.06,.10),('pink','sage','cream')[i%3],C,.008)
   k.sphere('GAMER_CollectibleHead',(x,2.23,z+.16),(.054,.045,.055),'cream',C,10,6)
   for d in (-1,1):
    k.sphere('GAMER_CollectibleEye',(x+d*.018,2.188,z+.17),(.006,.003,.008),'ink',C,8,4)
    k.box('GAMER_CollectibleBoot',(x+d*.024,2.215,z),(.035,.07,.027),'ink',C,.005)
  features=['L-shaped workstation','multiple displays','lit PC internals','RGB edge lights','game collectibles']
 elif theme=='habitacion-invernadero':
  # Glass conservatory walls and gabled roof skeleton.
  panel(k,'GARDEN_LeftExterior',(-3.23,0,1.85),5.3,3.3,2,math.pi/2);panel(k,'GARDEN_RearExterior',(.6,2.78,1.85),7.55,3.3,2)
  glass=k.material('conservatory_glass','#DBF0EE',.12);bs=glass.node_tree.nodes.get('Principled BSDF');bs.inputs['Transmission Weight'].default_value=.95;bs.inputs['IOR'].default_value=1.08
  for y in (-2.60,-1.56,-.52,.52,1.56,2.60):
   beam(k,'GARDEN_LeftStile',(-3.07,y,.2),(-3.07,y,3.20),.06,'cream')
   beam(k,'GARDEN_RoofRafter',(-3.07,y,3.20),(.6,y,4.40),.055,'cream');beam(k,'GARDEN_RoofRafter',(.6,y,4.40),(4.30,y,3.20),.055,'cream')
  for x in (-3.07,-1.84,-.62,.60,1.82,3.05,4.30):beam(k,'GARDEN_RearStile',(x,2.60,.20),(x,2.60,3.20),.06,'cream')
  for z in (.25,1.65,3.20):
   beam(k,'GARDEN_LeftRail',(-3.07,-2.6,z),(-3.07,2.6,z),.05,'cream');beam(k,'GARDEN_RearRail',(-3.07,2.60,z),(4.30,2.60,z),.05,'cream')
  # Rear roof panes leave the front cutaway open, as in the illustration.
  for side in (-1,1):
   for i in range(3):
    x=.6+side*(i+.5)*1.2;z=4.4-(i+.5)*1.2*1.2/3.7
    k.box('GARDEN_RoofGlass',(x,2.08,z),(1.27,1.04,.014),glass,C,.001,rotation=(0,side*math.atan2(1.2,3.7),0))
  D.naturaleza(k)
  for i,(x,y,z) in enumerate([(-2.7,-1.8,2.95),(-2.7,-.4,3.10),(-2.7,1.15,3.2),(.4,2.25,3.25),(2.3,2.25,2.90)]):
   D.clone_tree(k,'PRM_BOT_MainShelfPothos','GARDEN_Hanging_%d'%i,(-.35,2.25,2.415),(x,y,z),.85)
   beam(k,'GARDEN_HangingCord',(x,y,z),(x,y,3.80),.009,'thread')
  # Tiered fountain, independent basins, water and spill streams.
  water=k.material('garden_water','#6FC8D8',.15,0)
  for z,r in ((.30,.41),(.66,.28),(.99,.16)):
   k.cylinder('GARDEN_FountainBasin',(3.70,-1.39,z),r,.10,'cream',C,40)
   k.cylinder('GARDEN_FountainWater',(3.70,-1.39,z+.057),r*.87,.012,water,C,40)
   k.cylinder('GARDEN_FountainPillar',(3.70,-1.39,z+.16),.05,.30,'dusk',C,20)
  for a in (0,2.1,4.2):k.tube('GARDEN_FountainStream',[(3.7+.1*math.cos(a),-1.39+.1*math.sin(a),1.04),(3.7+.24*math.cos(a),-1.39+.24*math.sin(a),.73),(3.7+.30*math.cos(a),-1.39+.30*math.sin(a),.36)],.009,water,C)
  features=['glasshouse roof and framing','garden glazing','hanging plants','potting station','tiered fountain']
 elif theme=='estudio-musical':
  for n,loc,dims in [('Left',(-3.07,0,1.75),(.2,5.35,3.15)),('Rear',(.6,2.63,1.75),(7.55,.2,3.15))]:k.box('MUSIC_'+n+'Wall',loc,dims,'wall',C)
  D.urbano(k);remove(('URB_LeftWall','URB_Basket','URB_Ball'))
  for j in range(4):
   cx=-1.95+j*1.50
   k.box('MUSIC_AcousticBacking',(cx,2.50,2.25),(1.12,.08,1.20),'ink',C,.008)
   for i in range(11):k.box('MUSIC_AcousticFin',(cx-.50+i*.1,2.42,2.25),(.045,.16,1.16),'oak_dark',C,.004)
  for i in range(4):electric(k,-2.12+i*.86,2.29,1.69,('pink_dark','oak','cream','pink')[i])
  keyboard(k,1.18,1.73,1.10)
  # Record player and individual sleeves come from the detailed music prop kit.
  k.cylinder('MUSIC_MicrophoneFoot',(.18,-1.40,.225),.19,.045,'ink',C,32)
  beam(k,'MUSIC_MicrophonePole',(.18,-1.4,.25),(.18,-1.4,1.42),.021,'metal')
  beam(k,'MUSIC_MicrophoneBoom',(.18,-1.4,1.32),(.50,-1.4,1.53),.018,'metal')
  mic=k.cylinder('MUSIC_Microphone',(.53,-1.4,1.55),.033,.17,'ink',C,20);mic.rotation_euler.y=-.9
  for i in range(7):k.tube('MUSIC_MicGrille',[(.53+.034*math.cos(a),-1.4+.034*math.sin(a),1.49+i*.015) for a in [j*math.tau/20 for j in range(20)]],.0014,'metal',C,True)
  for x in (.36,2.07):
   k.box('MUSIC_StudioSpeaker',(x,2.15,1.39),(.24,.25,.47),'ink',C,.016)
   for zz,rr in ((1.30,.075),(1.52,.035)):
    o=k.cylinder('MUSIC_SpeakerCone',(x,2.011,zz),rr,.024,'gold',C,28);o.rotation_euler.x=math.pi/2
  glow=D.glow(k,'music_neon','#FF705D',3)
  k.text('MUSIC_NeonTitle','Better\nMusic\nBrighter\nDays',(2.58,2.28,2.41),.14,glow,C,(math.pi/2,0,0))
  features=['acoustic baffles','four detailed electric guitars','keyboard with individual keys','record console','microphone and studio speakers']
 elif theme=='rincon-explorador':
  for n,loc,dims in [('Left',(-3.07,0,1.75),(.2,5.35,3.15)),('Rear',(.6,2.63,1.75),(7.55,.2,3.15))]:k.box('EXP_'+n+'Wall',loc,dims,'wall',C)
  # A library wall around an oversized cartographic focal point.
  D.bookcase(k,'EXP_CornerLibrary',(-2.80,1.80,.18),1.25,2.87,.25,'left',7,811)
  D.bookcase(k,'EXP_RearLibrary',(-.35,2.10,.18),.78,2.87,.53,'back',7,120)
  panel(k,'EXP_WorldMap',(-2.941,-.65,2.26),2.4,1.48,1,math.pi/2)
  for y in (-1.87,.57):beam(k,'EXP_MapFrame',(-2.90,y,1.50),(-2.90,y,3.03),.065,'oak_dark')
  for z in (1.50,3.03):beam(k,'EXP_MapFrame',(-2.90,-1.9,z),(-2.90,.6,z),.065,'oak_dark')
  panel(k,'EXP_WindowGarden',(1.28,2.50,2.18),1.47,1.55,2)
  for x in (.50,1.27,2.05):beam(k,'EXP_WindowMullion',(x,2.47,1.36),(x,2.47,3),.045,'oak_light')
  for z in (1.36,3):beam(k,'EXP_WindowFrame',(.5,2.47,z),(2.05,2.47,z),.06,'oak_light')
  trunk(k,'EXP_FootTravelTrunk',-1.73,-1.71,1.24,.51,.49)
  trunk(k,'EXP_StackedSuitcase',-2.64,-1.13,.56,.41,.36)
  trunk(k,'EXP_TravelCase',-2.65,-1.12,.49,.36,.25).location.z+=.40
  # Telescopic brass tube, objective lens, focusing ring and tripod.
  scope=k.cylinder('EXP_Telescope',(2.37,2.05,1.54),.06,.49,'gold',C,32);scope.rotation_euler=(.5,1.1,0)
  for p in [(2.18,1.89,1.06),(2.62,1.88,1.06),(2.37,2.27,1.06)]:beam(k,'EXP_TelescopeTripod',p,(2.37,2.05,1.44),.017,'oak_dark')
  k.box('EXP_ReadingSeat',(.03,.69,.58),(.75,.72,.21),'cream',C,.07)
  k.box('EXP_ReadingBack',(.03,.99,.94),(.76,.15,.64),'cream',C,.07)
  for x in (-.40,.46):k.box('EXP_ReadingArm',(x,.73,.82),(.10,.64,.12),'oak',C,.025)
  for x in (-.26,.31):
   for y in (.43,.97):k.box('EXP_ReadingLeg',(x,y,.32),(.06,.06,.32),'oak',C,.008)
  for i in range(3):k.box('EXP_EntranceStep',(3.3,-2.65-i*.18,.13-i*.055),(1.55,.22,.12),'floor_light',C,.009)
  features=['floor-to-ceiling library','oversized world map','travel trunks with hardware','telescope','reading chair','entrance steps']
 # Each reference has a different rug construction, rather than a recolored circle.
 if theme!='habitacion-invernadero':
  remove(('Premium_Lounge_Rug',))
  if theme=='rincon-urbano':
   remove(('Premium_LeftShelf','PRM_BOT_LeftShelf'))
   k.box('CITY_RectangularWovenRug',(.50,-.78,.21),(2.50,1.95,.032),'dusk',C,.018)
   for inset in (.04,.11,.18):k.tube('CITY_RugBorder',[(-.75+inset,-1.755+inset,.235),(1.75-inset,-1.755+inset,.235),(1.75-inset,.195-inset,.235),(-.75+inset,.195-inset,.235)],.005,'cream',C,True)
  elif theme=='sala-control-gamer':
   for row in range(5):
    for col in range(5):
     x=-.60+col*.45;y=-1.70+row*.45;key='pink_dark' if (row+col)%2 else 'ink'
     k.box('GAMER_PuzzleMatPiece',(x,y,.22),(.442,.442,.033),key,C,.005)
     if col<4:k.cylinder('GAMER_PuzzleMatTab',(x+.224,y,.24),.065,.018,key,C,24)
  elif theme=='estudio-musical':
   k.box('MUSIC_OrientalRug',(.5,-.78,.215),(2.70,1.95,.033),'pink_dark',C,.018)
   for row in range(7):
    for col in range(11):
     x=-.70+col*.24;y=-1.62+row*.28
     k.mesh('MUSIC_RugDiamond',[(x-.055,y,.235),(x,y-.085,.235),(x+.055,y,.235),(x,y+.085,.235)],[(0,1,2,3)],'cream' if row in (0,6) or col in (0,10) else 'oak',C,0)
   for rr in (.22,.28,.36):k.tube('MUSIC_RugMedallion',[(.5+rr*math.cos(a),-.78+rr*math.sin(a),.24) for a in [i*math.tau/64 for i in range(64)]],.009,'cream',C,True)
  else:
   k.cylinder('EXP_CompassRug',(.50,-.78,.22),1.35,.035,'cream',C,96)
   for rad in (1.04,1.13,1.27):k.tube('EXP_CompassCircle',[(.5+rad*math.cos(a),-.78+rad*math.sin(a),.24) for a in [i*math.tau/100 for i in range(100)]],.009,'oak_dark',C,True)
   for i in range(16):
    a=i*math.tau/16;r=1.03 if i%2==0 else .65
    k.mesh('EXP_CompassRay',[(.5,-.78,.241),(.5+r*math.cos(a),-.78+r*math.sin(a),.241),(.5+.18*math.cos(a+.25),-.78+.18*math.sin(a+.25),.241)],[(0,1,2)],'oak_dark',C,0)
 scene=bpy.context.scene;scene.camera=bpy.data.objects.get('Camera_Cozy_Hero') or scene.camera
 scene.camera.location=(10,-12,9);look_at(scene.camera,(.55,.12,1.45));scene.camera.data.ortho_scale=10.7 if theme!='habitacion-invernadero' else 11.5
 scene.render.resolution_x=1500;scene.render.resolution_y=1200;scene.cycles.samples=24;scene.cycles.use_denoising=True
 scene['reference_room']=theme;scene['release_status']='first structural/detail pass; visual QA required; not app integrated'
 bpy.ops.wm.save_as_mainfile(filepath=str(OUT/(theme+'-v1.blend')),compress=True)
 (OUT/(theme+'-v1.json')).write_text(json.dumps({'features':features,'objects':len(scene.objects),'app_integrated':False,'status':'awaiting visual review'},indent=2),encoding='utf8')
 scene.render.filepath=str(PRE/(theme+'-v1.png'));bpy.ops.render.render(write_still=True)
 print('REFERENCE_ROOM_READY',theme,flush=True)
if __name__=='__main__':
 names=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['rincon-urbano','sala-control-gamer','habitacion-invernadero','estudio-musical','rincon-explorador']
 for name in names:build(name)
