import bpy,sys,math,json
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[1];sys.path.insert(0,str(R/'scripts'))
from build_distinct_reference_rooms import *

def shift(prefix,delta):
 for obj_name in list(bpy.context.scene.objects.keys()):
  o=bpy.data.objects.get(obj_name)
  if o is None:continue
  if o.parent is None and o.name.startswith(prefix):o.location+=Vector(delta)

def bounds(o):
 pts=[p.matrix_world@Vector(v) for p in [o,*o.children_recursive] if p.type=='MESH' for v in p.bound_box]
 return ([min(v[i] for v in pts) for i in range(3)],[max(v[i] for v in pts) for i in range(3)]) if pts else None

def floorprop(k,name,pos):
 # Individually ribbed terracotta planter with branching foliage.
 x,y,z=pos;r=.15
 k.cylinder(name+'Pot',(x,y,z+.14),r,.28,'terracotta',C,20,radius_top=r*1.16)
 k.cylinder(name+'Soil',(x,y,z+.286),r*.98,.02,'oak_dark',C,20)
 for a in [j*math.tau/18 for j in range(18)]:
  k.tube(name+'PotFlute',[(x+r*.88*math.cos(a),y+r*.88*math.sin(a),z+.035),(x+r*1.12*math.cos(a),y+r*1.12*math.sin(a),z+.26)],.005,'oak',C)
 for j in range(9):
  a=j*2.40;h=.32+j*.037;end=(x+.23*math.cos(a),y+.23*math.sin(a),z+.29+h)
  k.tube(name+'Stem',[(x,y,z+.28),(x+.06*math.cos(a),y+.06*math.sin(a),z+.4),end],.006,'leaf',C)
  o=k.sphere(name+'Leaf',end,(.10,.045,.15),('sage','leaf','sage_light')[j%3],C,10,6);o.rotation_euler=(.3*math.sin(a),.6*math.cos(a),a)

def refine(theme):
 global C
 bpy.ops.wm.open_mainfile(filepath=str(OUT/(theme+'-v1.blend')));k=RoomKit();C='REFERENCE_REFINEMENTS'
 # Execute the rug-design block shared with the fresh builder.
 src=(R/'scripts/build_distinct_reference_rooms.py').read_text();block=src.split(' # Each reference has a different rug construction, rather than a recolored circle.')[1].split(' scene=bpy.context.scene;scene.camera=')[0]
 exec('\n'.join(line[1:] if line.startswith(' ') else line for line in block.splitlines()),globals(),locals())
 # Remove unwanted potted plants from the circulation, keeping themed planting areas.
 remove(('PRM_BOT_BedFoot','PRM_BOT_FloorFern'))
 if theme in ('estudio-musical','sala-control-gamer'):
  remove(('PRM_BOT_FloorMonstera','PRM_BOT_FloorRubberPlant','PRM_BOT_MainShelf','PRM_BOT_ShelfHerb','PRM_BOT_BookcaseTop'))
 # Replace inherited circular coffee-table construction with a square shelf table.
 remove(('Premium_Lounge_TableTop','Premium_Lounge_TableRim','Premium_Lounge_TableInset','Premium_Lounge_TableLowerShelf','Premium_Lounge_TableSplayedLeg','Premium_Lounge_TableFoot','Premium_Lounge_TableGrain'))
 for z in (.35,.685):k.box('REF_SquareTableShelf',(.60,-.77,z),(.82,.72,.065),'oak_light',C,.013)
 for x in (.26,.94):
  for y in (-1.06,-.48):k.box('REF_TableLeg',(x,y,.44),(.045,.045,.46),'oak_dark',C,.005)
 if theme=='rincon-urbano':
  # No shelf suspended across the corner glass.
  for obj_name in list(bpy.context.scene.objects.keys()):
   o=bpy.data.objects.get(obj_name)
   if o is None:continue
   if o.parent or o.name.startswith(('CITY_',)):continue
   bb=bounds(o)
   if bb and bb[0][1]>2.1 and bb[0][2]>2.20 and bb[1][2]<2.95 and bb[0][0]>-.8 and bb[1][0]<1.9:o.location.x+=.80
  remove(('Storage_BookcaseBack','CITY_PosterCaption'))
  for o in bpy.context.scene.objects:
   if o.type=='MESH' and o.name.startswith(('Storage_BookcaseSide','Storage_BookcaseShelf','Desk_')):o.data.materials.clear();o.data.materials.append(k.mat('ink'))
  k.box('CITY_QuoteFrame',(2.43,2.495,2.58),(.48,.035,.65),'ink',C,.008)
  k.text('CITY_Quote','A\nBRIGHTER\nYOU',(2.43,2.466,2.73),.085,'cream',C,(math.pi/2,0,0))
  for j in range(14):
   a=j*math.tau/14;k.tube('CITY_SecondPoufSeam',[(1.67+.27*math.cos(a),-1.67+.27*math.sin(a),.25),(1.67+.32*math.cos(a),-1.67+.32*math.sin(a),.44),(1.67+.22*math.cos(a),-1.67+.22*math.sin(a),.59)],.004,'cream',C)
  k.sphere('CITY_SecondPouf',(1.67,-1.67,.40),(.32,.32,.22),'dusk',C,24,12)
 elif theme=='estudio-musical':
  # Free the whole instrument wall from the original floating shelf and plants.
  for obj_name in list(bpy.context.scene.objects.keys()):
   o=bpy.data.objects.get(obj_name)
   if o is None:continue
   if o.parent or o.name.startswith(('MUSIC_','Architecture_')):continue
   bb=bounds(o)
   if bb and bb[0][1]>2.08 and bb[0][2]>2.20 and bb[1][2]<2.96 and bb[0][0]>-.85 and bb[1][0]<1.95:drop(o)
  remove(('MUSIC_NeonTitle','Premium_LeftShelf','PRM_BOT_LeftShelf'))
  glow=D.glow(k,'review_music_neon','#FF6251',4)
  k.text('MUSIC_ClearNeon','Better Music\nBrighter Days',(-2.94,-.45,2.54),.15,glow,C,(math.pi/2,0,math.pi/2))
  # Vinyl records, labels and sleeves on left acoustic wall.
  for i in range(3):
   y=-1.4+i*.61;o=k.cylinder('MUSIC_WallVinyl',(-2.94,y,1.95),.20,.018,'ink',C,48);o.rotation_euler.y=math.pi/2
   o=k.cylinder('MUSIC_VinylLabel',(-2.925,y,1.95),.065,.021,('pink_dark','gold','cream')[i],C,32);o.rotation_euler.y=math.pi/2
  # Speaker cabinet with recessed grille, corner protectors and handle.
  g=trunk(k,'MUSIC_AmplifierCase',-1.63,-1.45,.82,.44,.50)
  k.box('MUSIC_AmpGrille',(-1.63,-1.687,.46),(.69,.012,.32),'ink',C,.004)
  for i in range(22):k.box('MUSIC_AmpGrilleWire',(-1.95+i*.030,-1.70,.46),(.003,.003,.30),'metal',C,0)
  # Relocate the microphone out of the central table.
  shift(('MUSIC_Microphone','MUSIC_MicGrille'),(1.55,-.25,0))
 elif theme=='sala-control-gamer':
  remove(('Premium_LeftShelf','PRM_BOT_LeftShelf'))
  # Offset collector shelves create a full gaming display wall.
  for row in range(2):
   z=1.72+row*.44;k.box('GAMER_DisplayLedge',(-2.79,.27,z),(.32,1.53,.045),'ink',C,.006)
   for j in range(9):k.box('GAMER_GameCase',(-2.76,-.39+j*.14,z+.14),(.15,.10,.24),('dusk','cream','pink_dark')[j%3],C,.005)
  # The return monitor now has a chassis and stand rather than a floating plane.
  k.box('GAMER_ReturnMonitorBack',(3.26,.91,1.58),(.045,.92,.55),'ink',C,.015)
  k.box('GAMER_ReturnMonitorFoot',(3.24,.91,1.085),(.31,.37,.028),'ink',C,.012)
  beam(k,'GAMER_ReturnMonitorStem',(3.25,.91,1.09),(3.25,.91,1.38),.04,'ink')
  trunk(k,'GAMER_EquipmentChest',-1.75,-1.55,.97,.49,.41)
  for j in range(2):
   x=-1.98+j*.40;k.sphere('GAMER_Controller',(x,-1.55,.69),(.15,.095,.040),'cream',C,16,8)
   for d in (-1,1):k.cylinder('GAMER_Stick',(x+d*.065,-1.55,.73),.019,.018,'ink',C,12)
  D.lamp(k,'GAMER_RGB_Wash',(1.9,2.17,2.67),65,(.24,.11,1),1.4,(1.3,1,1))
 elif theme=='habitacion-invernadero':
  # Cutaway roof avoids beams bisecting the foreground furnishings in the hero view.
  for obj_name in list(bpy.context.scene.objects.keys()):
   o=bpy.data.objects.get(obj_name)
   if o is None:continue
   if o.name.startswith('GARDEN_RoofRafter') and o.location.y<.1:drop(o)
  for n in ('GARDEN_LeftExterior','GARDEN_RearExterior'):
   o=bpy.data.objects.get(n)
   if o:o.scale.z=.88;o.location.z=1.71
  # Additional plant diversity is actual geometry, not scenery printed on the walls.
  for j,pos in enumerate([(-2.74,-1.85,.18),(-2.75,-1.12,.18),(3.89,-1.92,.18),(2.95,-1.84,.18),(2.87,.60,.18),(-.59,2.02,1.18)]):floorprop(k,'GARDEN_Specimen%d_'%j,pos)
  for i,(x,y,z) in enumerate([(-2.72,-1.45,2.75),(-2.72,.0,2.86),(1.10,2.33,2.96)]):D.clone_tree(k,'PRM_BOT_LeftShelfIvyA','GARDEN_TrailingIvy%d'%i,(-2.73,.83,2.63),(x,y,z),1)
 elif theme=='rincon-explorador':
  # Clear the atlas; no shelf or dangling ivy across the map.
  remove(('Premium_LeftShelf','PRM_BOT_LeftShelf'))
  # Preserve reader circulation by moving chair away from the bedside cabinet.
  shift(('EXP_Reading',),(.20,-.34,0))
  # A detailed armillary globe on the library, meridian and equatorial rings.
  k.sphere('EXP_Globe',(3.40,1.90,3.06),(.20,.20,.20),'dusk',C,24,12)
  for i in range(6):
   a=i*1.91;k.sphere('EXP_GlobeLand',(3.4+.178*math.cos(a),1.9+.178*math.sin(a),3.06+.07*math.sin(i*2)),(.07,.05,.06),'gold',C,10,6)
  for axis in (0,1):k.tube('EXP_GlobeMeridian',[(3.4+.235*math.cos(a),1.9+(.235*math.sin(a) if axis else 0),3.06+(0 if axis else .235*math.sin(a))) for a in [j*math.tau/64 for j in range(64)]],.009,'gold',C,True)
  k.cylinder('EXP_GlobeStand',(3.4,1.90,2.79),.12,.06,'oak_dark',C,24)
 scene=bpy.context.scene;scene.cycles.samples=32;scene.render.filepath=str(PRE/(theme+'-v2.png'))
 scene['release_status']='editable review scene; app integration pending'
 bpy.ops.wm.save_as_mainfile(filepath=str(OUT/(theme+'-v2.blend')),compress=True)
 
 if not globals().get('SKIP_RENDER',False):bpy.ops.render.render(write_still=True)
 print('REFINED',theme,flush=True)
if __name__=='__main__':
 for name in sys.argv[sys.argv.index('--')+1:]:refine(name)
