"""Six distinct collaborative rooms, editable Blender sources and mobile GLBs.

Coordinates: metres, Blender Z-up. Exported anchors use Three.js Y-up.
No personal bedrooms are overwritten. Seat positions author the real furniture.
"""
import bpy,sys,math,json,random
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools/blender'))
from room_premium_common import RoomKit
OUT=ROOT/'apps/web/public/selection/shared-spaces'
SOURCE=ROOT/'packages/assets/3d/source/shared-spaces'
REVIEW=ROOT/'renders/shared-spaces'
for p in (OUT,SOURCE,REVIEW):p.mkdir(parents=True,exist_ok=True)
COLORS={'oak':(.43,.24,.10),'woodlight':(.65,.43,.23),'cream':(.85,.78,.64),'paper':(.93,.89,.77),'linen_shadow':(.59,.54,.44),'ink':(.036,.049,.066),'metal':(.09,.12,.14),'gold':(.79,.48,.10),'sage':(.19,.35,.20),'green':(.09,.24,.13),'leaf':(.33,.47,.12),'blue':(.15,.28,.39),'terracotta':(.54,.20,.09),'coral':(.68,.28,.16),'yellow':(.88,.57,.15),'purple':(.34,.25,.42),'stone':(.45,.43,.37),'wall':(.67,.60,.48),'glass':(.23,.39,.42),'light':(1,.75,.35),'city':(.17,.20,.34)}
NAMES={'living':'Living colaborativo','study':'Sala de estudio','library':'Biblioteca moderna','projects':'Sala de proyectos','patio':'Patio de estudio','terrace':'Terraza de aprendizaje'}
R=random.Random(420)

def p3(p):return [round(p[0],4),round(p[2],4),round(-p[1],4)]
def box(k,n,p,d,m,bevel=.015,parent=None):return k.box(n,p,d,m,'FURNITURE',bevel,parent=parent)
def beam(k,n,a,b,r=.024,m='metal'):
 return k.tube(n,[a,b],r,m,'ARCHITECTURE')
def plant(k,n,p,size=1,flowers=False):
 x,y,z=p
 k.cylinder(n+' pot',(x,y,z+.11*size),.15*size,.22*size,'terracotta','BOTANICALS',12,radius_top=.18*size)
 k.cylinder(n+' soil',(x,y,z+.22*size),.153*size,.018,'oak','BOTANICALS',14)
 for i in range(18):
  a=i*2.399;reach=(.10+.07*(i%3))*size;h=(.28+.07*(i%4))*size
  tip=(x+reach*math.cos(a),y+reach*math.sin(a),z+h)
  k.tube(n+' stem',[(x,y,z+.20*size),tip],.007*size,'green','BOTANICALS')
  leaf=k.sphere(n+' leaf',tip,(.055*size,.13*size,.035*size),'leaf' if i%3==0 else 'sage','BOTANICALS',8,4)
  leaf.rotation_euler=(.35*math.sin(a),.35*math.cos(a),a)
  if flowers and i%4==0:k.sphere(n+' blossom',(tip[0],tip[1],tip[2]+.06),(.065,.065,.045),'coral' if i%2 else 'yellow','BOTANICALS',8,4)
def lamp(k,n,p):
 x,y,z=p
 k.cylinder(n+' base',(x,y,z+.025),.12,.05,'metal','LIGHTS',16)
 beam(k,n+' neck',(x,y,z),(x,y,z+.36),.014,'gold')
 k.cylinder(n+' shade',(x,y,z+.43),.18,.21,'cream','LIGHTS',16,radius_top=.10)
 k.sphere(n+' bulb',(x,y,z+.36),(.06,.06,.05),'light','LIGHTS',10,6)
def bookstack(k,n,p,count=3):
 x,y,z=p
 for i in range(count):
  color=['blue','sage','coral','cream','purple'][i%5]
  box(k,n+' pages',(x,y,z+.025+i*.065),(.34,.24,.048),'paper',.002)
  for dz in (-.026,.026):box(k,n+' cover',(x,y,z+.025+i*.065+dz),(.36,.26,.009),color,.002)
  box(k,n+' spine',(x-.174,y,z+.025+i*.065),(.012,.26,.055),color,.003)
def shelf(k,n,x,y,width=1.5,height=2.7,rows=5):
 box(k,n+' backing',(x,y+.13,height/2),(width,.07,height),'oak')
 for sign in (-1,1):box(k,n+' side',(x+sign*width/2,y,height/2),(.085,.39,height),'woodlight')
 for row in range(rows+1):
  z=.10+row*(height-.13)/rows
  box(k,n+' shelf',(x,y,z),(width,.42,.065),'woodlight')
  if row==rows:continue
  xpos=x-width/2+.12
  for i in range(int(width/.12)-1):
   h=.22+R.random()*.16;w=.055+R.random()*.035
   k.book(n+' bound volume',(xpos,y-.04,z+.037),w,h,.18,['sage','blue','coral','cream','purple'][i%5])
   xpos+=w+.017
 plant(k,n+' top plant',(x+width*.22,y-.03,height+.045),.7)
def laptop(k,n,p,angle=0):
 g=k.group(n,p,(0,0,angle),'STUDY_OBJECTS')
 box(k,n+' base',(0,0,.015),(.38,.28,.028),'metal',.010,g)
 box(k,n+' screen bezel',(0,.12,.145),(.38,.025,.25),'ink',.010,g)
 box(k,n+' screen',(0,.104,.145),(.335,.006,.21),'blue',.002,g)
 for r in range(4):box(k,n+' screen text',(-.02,.099,.21-r*.035),(.23 if r else .27,.003,.007),'paper',.001,g)
 for r in range(3):
  for c in range(10):box(k,n+' keyboard',(-.14+c*.031,-.018+r*.038,.034),(.024,.025,.006),'stone',.001,g)
 box(k,n+' trackpad',(0,-.098,.034),(.10,.05,.006),'stone',.003,g)
def notebook(k,n,p):
 x,y,z=p
 box(k,n+' cover',(x,y,z+.01),(.27,.34,.018),'sage',.005)
 box(k,n+' paper',(x,y,z+.022),(.25,.32,.012),'paper',.002)
 for i in range(9):box(k,n+' ruled line',(x,y-.115+i*.027,z+.030),(.20,.002,.001),'stone',0)
 beam(k,n+' pen',(x+.14,y-.13,z+.04),(x+.14,y+.07,z+.04),.006,'blue')
def desk(k,n,p,width=3.8,depth=1.3,height=.78):
 x,y,z=p
 box(k,n+' tabletop',(x,y,z+height),(width,depth,.10),'woodlight',.025)
 for dx in (-width*.42,width*.42):
  for dy in (-depth*.34,depth*.34):box(k,n+' leg',(x+dx,y+dy,z+height/2),(.11,.11,height),'oak',.012)
 beam(k,n+' brace',(x-width*.43,y,z+.23),(x+width*.43,y,z+.23),.035,'oak')
def chair(k,n,p,angle=0,color='blue',soft=False):
 g=k.group(n,p,(0,0,angle),'SEATS')
 box(k,n+' seat',(0,0,.46),(.63,.63,.13),color,.055,g)
 box(k,n+' back',(0,.26,.82),(.63,.13,.65),color,.055,g)
 for x in (-.235,.235):
  for y in (-.235,.235):box(k,n+' leg',(x,y,.21),(.05,.05,.42),'metal',.012,g)
 if soft:
  for x in (-.34,.34):box(k,n+' upholstered arm',(x,0,.63),(.14,.65,.23),color,.050,g)
  box(k,n+' back cushion',(0,.17,.84),(.55,.11,.42),'cream',.050,g)
def seat(seats,p,angle=0,kind='chair'):
 # Avatar forward is Three +Z = Blender -Y.
 i=len(seats)+1;x,y,z=p
 approach=(x+math.sin(angle)*.92,y-math.cos(angle)*.92,.015)
 seats.append({'id':f'SEAT_{i:02}','position':p3((x,y,.46)),'yaw':angle,'approach':p3(approach),'height':.46,'posture':'seated','kind':kind})
def rug(k,p,width,depth):
 box(k,'Woven rug',(p[0],p[1],.016),(width,depth,.026),'cream',.008)
 for row in range(int(depth/.30)):
  for col in range(int(width/.36)):
   if (row+col)%3==0:box(k,'Rug woven motif',(p[0]-width/2+.18+col*.36,p[1]-depth/2+.15+row*.30,.032),(.32,.26,.005),'blue',.002)
def board(k,title,p,width=3.1):
 x,y,z=p
 box(k,'Whiteboard frame',p,(width,.095,1.30),'oak',.02)
 box(k,'Whiteboard face',(x,y-.057,z),(width-.09,.02,1.21),'paper',.008)
 k.text('Board heading',title,(x,y-.073,z+.39),.155,'ink',rotation=(math.pi/2,0,0))
 for i in range(4):
  xx=x-width*.33+i*width*.22
  box(k,'Board sticky note',(xx,y-.077,z-.015),(.27,.014,.24),['blue','yellow','sage','coral'][i],.005)
  for j in range(2):box(k,'Board note writing',(xx,y-.087,z+.03-j*.06),(.18,.003,.007),'ink',.001)
  if i<3:beam(k,'Board connecting arrow',(xx+.18,y-.088,z-.16),(xx+width*.20,y-.088,z-.16),.008,'stone')
def architecture(k,identifier):
 outdoor=identifier in ('patio','terrace')
 for ix in range(16):
  for iy in range(12):
   m='stone' if identifier=='projects' else 'woodlight'
   box(k,'Individual floor tile',(-3.75+ix*.50,-2.75+iy*.50,-.09),(.493,.493,.17),m,.006)
 for p,d in [((0,3.02,.14),(8.1,.13,.42)),((-4.02,0,.14),(.13,6.1,.42))]:box(k,'Platform edge',p,d,'oak')
 if not outdoor:
  box(k,'Back wall',(0,3.04,1.60),(8.15,.16,3.2),'wall')
  box(k,'Left wall',(-4.03,0,1.6),(.16,6.12,3.2),'wall')
  box(k,'Back skirting',(0,2.93,.09),(8,.045,.17),'woodlight')
  box(k,'Left skirting',(-3.93,0,.09),(.045,6,.17),'woodlight')
  for x in (-3,-1,1,3):
   box(k,'Sconce mounting',(x,2.93,2.91),(.15,.12,.15),'metal')
   k.sphere('Sconce bulb',(x,2.83,2.82),(.08,.08,.08),'light','LIGHTS',10,5)
  # Left wall window, layered frame, sill, city shapes and plants.
  box(k,'Window oak frame',(-3.917,.50,1.91),(.11,2.52,1.70),'oak')
  box(k,'Window blue glass',(-3.845,.50,1.91),(.013,2.35,1.53),'glass',.001)
  for y in (-.61,.50,1.61):box(k,'Window mullion',(-3.82,y,1.91),(.07,.047,1.55),'cream',.004)
  box(k,'Window horizontal bar',(-3.82,.50,1.91),(.07,2.32,.047),'cream',.004)
  box(k,'Window sill',(-3.69,.50,1.02),(.42,2.65,.09),'woodlight')
  for y in (-.32,1.22):plant(k,'Sill plant',(-3.62,y,1.075),.55)
  for i in range(5):
   box(k,'Window distant building',(-3.827,-.47+i*.43,1.62),(.01,.25,.62+(i%3)*.10),'city',.001)
  box(k,'Wall display shelf',(-3.76,-1.65,2.55),(.37,1.60,.07),'woodlight')
  plant(k,'Shelf trailing plant',(-3.70,-1.36,2.59),.64)
  for i in range(3):
   box(k,'Framed study artwork',(-3.91,-2.1+i*.45,1.91),(.075,.34,.42),'oak')
   box(k,'Art background',(-3.864,-2.1+i*.45,1.91),(.015,.28,.36),['sage','blue','coral'][i],.002)
def lounge(k,seats,terrace=False):
 rug(k,(0,-.10),5.3,3.5)
 couch='cream' if not terrace else 'blue'
 box(k,'Continuous upholstered sofa base',(0,1.52,.29),(4.63,.88,.34),couch,.10)
 box(k,'Continuous sofa back',(0,1.91,.77),(4.63,.19,.91),couch,.075)
 for x in (-2.32,2.32):box(k,'Sofa outside arm',(x,1.52,.57),(.18,.91,.57),couch,.065)
 for x in (-1.70,-.56,.56,1.70):
  box(k,'Individual sofa seat cushion',(x,1.46,.48),(1.08,.75,.16),couch,.075)
  box(k,'Sofa back cushion',(x,1.82,.85),(1.06,.20,.62),couch,.07)
  pillow=box(k,'Decorative sofa pillow',(x+.23,1.62,.81),(.39,.20,.39),['sage','yellow','blue','coral'][len(seats)%4],.08)
  pillow.rotation_euler=(.12,.06,.10)
  seat(seats,(x,1.52,0),0,'sofa')
 for i,(x,y) in enumerate([(-2.60,-.78),(2.60,-.78)]):
  a=-.72 if x<0 else .72
  chair(k,'Reading armchair',(x,y,0),a,'coral' if i==0 else 'sage',True);seat(seats,(x,y,0),a,'armchair')
 desk(k,'Low coffee table',(0,-.25,0),2.50,1.0,.43)
 bookstack(k,'Coffee table books',(-.78,-.24,.49));plant(k,'Table plant',(.46,-.22,.49),.55)
 laptop(k,'Shared laptop',(.80,-.30,.49),.15)
 for x in (-3.40,3.40):
  desk(k,'Side table',(x,1.67,0),.59,.59,.55);lamp(k,'Reading lamp',(x,1.67,.61))
 if not terrace:
  shelf(k,'Living library',2.60,2.63,1.90,2.75)
  board(k,'Ideas que compartimos',(-1.2,2.92,2.05),3.3)
  for x in (-3.20,-.1):plant(k,'Living foliage',(x,2.4,0),1.7)
def study(k,seats,library=False,projects=False):
 if projects:
  for x in (-1.15,1.15):desk(k,'Project workbench',(x,0,0),2.18,1.65,.80)
 else:desk(k,'Shared study table',(0,-.05,0),4.6 if not library else 3.7,1.65,.78)
 for side,y,a in [('front',-1.30,math.pi),('back',1.25,0)]:
  for x in (-1.65,0,1.65):
   if library and abs(x)>1 and side=='back':continue
   chair(k,'Work chair',(x,y,0),a,'coral' if projects else 'blue');seat(seats,(x,y,0),a)
   laptop(k,'Individual study laptop',(x,-.53 if y<0 else .45,.855),math.pi if y<0 else 0)
   notebook(k,'Individual notebook',(x+.41,-.46 if y<0 else .43,.86))
 if library:
  for x in (-2.88,2.88):chair(k,'Library armchair',(x,1.62,0),0,'sage',True);seat(seats,(x,1.62,0),0,'armchair')
  for x in (-2.80,-1.0,.80,2.60):shelf(k,'Tall reading library',x,2.65,1.70,2.85)
 else:
  board(k,'Pensar · probar · compartir' if projects else 'Un paso, juntos',(0,2.9,1.9),4.6)
  for x in (-3.14,3.14):shelf(k,'Resources shelving',x,2.59,1.30,2.6)
 plant(k,'Table centre',(0,0,.865),.60)
 if projects:
  for i in range(10):box(k,'Prototype blocks',(-1.4+(i%5)*.14,-.04+(i//5)*.20,.91),(.11,.11,.11),['yellow','blue','sage'][i%3])
  for x in (-3.15,3.15):
   desk(k,'Mobile supplies cart',(x,-.7,0),.74,.53,.75)
   for z in (.25,.50):box(k,'Cart shelf',(x,-.7,z),(.78,.56,.04),'metal')
   for j in range(3):box(k,'Project supply tray',(x,-.7,.28+j*.23),(.60,.38,.13),['coral','blue','sage'][j])
 else:
  bookstack(k,'Reserve books',(-3.23,-1.1,.04),5)
 for x in (-3.46,3.46):plant(k,'Study room plant',(x,-2.15,0),1.35)
def patio(k,seats):
 # Open pergola and two distinct study zones instead of recolouring an interior.
 for x in (-3.3,3.3):
  for y in (-2.2,2.4):box(k,'Pergola post',(x,y,1.5),(.15,.15,3.0),'oak')
 for y in (-2.2,2.4):box(k,'Pergola lintel',(0,y,3.02),(6.9,.19,.20),'woodlight')
 for x in [-3+i*.55 for i in range(12)]:box(k,'Pergola rafters',(x,.10,3.17),(.10,4.9,.14),'woodlight')
 k.cylinder('Round group table',(-1.30,-.25,.77),.86,.10,'woodlight','FURNITURE',32)
 k.cylinder('Round table pedestal',(-1.30,-.25,.38),.16,.76,'oak','FURNITURE',16)
 for a in (0,math.pi/2,math.pi,math.pi*1.5):
  p=(-1.30+math.sin(a)*1.33,-.25-math.cos(a)*1.33,0)
  rot=a+math.pi;chair(k,'Garden chair',p,rot,'sage');seat(seats,p,rot)
 desk(k,'Garden bench table',(1.92,.10,0),1.35,.75,.77)
 for x in (1.48,2.34):chair(k,'Pergola bench seat',(x,1.1,0),0,'woodlight');seat(seats,(x,1.1,0),0,'bench')
 plant(k,'Patio table flowers',(-1.3,-.25,.83),.6,True)
 laptop(k,'Garden laptop',(1.94,.15,.83));notebook(k,'Garden notebook',(1.94,-.20,.83))
 for x in (-3.65,3.65):
  for y in (-2,0,2):plant(k,'Garden borders',(x,y,0),1.5,True)
 for x in (-2.4,-.8,.8,2.4):plant(k,'Pergola hanging foliage',(x,2.41,2.70),.65)
 board(k,'Aqui tambien se aprende',(1.72,2.72,1.89),2.2)
def terrace(k,seats):
 lounge(k,seats,True)
 for x in [-3.7+i*.50 for i in range(16)]:beam(k,'Terrace railing post',(x,2.89,.15),(x,2.89,1.20),.026)
 beam(k,'Terrace handrail',(-3.8,2.89,1.20),(3.8,2.89,1.20),.033)
 for x in (-3.7,3.7):beam(k,'String light mast',(x,2.7,0),(x,2.7,3.25),.035)
 points=[(-3.7+i*.37,2.70,3.25-.42*math.sin(i/20*math.pi)) for i in range(21)]
 k.tube('Suspended lights cable',points,.008,'ink','LIGHTS')
 for i,p in enumerate(points):
  if i%2==0:k.sphere('Terrace warm string bulb',(p[0],p[1],p[2]-.065),(.055,.055,.075),'light','LIGHTS',10,6)
 for x in (-3.50,3.5):plant(k,'Terrace planter',(x,.4,0),1.4)
 # Inexpensive original skyline made from depth-layered geometry.
 for i in range(18):
  x=-4.3+i*.51;h=.7+R.random()*1.7;y=3.60+(i%3)*.22
  box(k,'Distant city building',(x,y,h/2+.4),(.42,.42,h),'city',.005)
  for row in range(int(h/.20)):
   for col in range(2):
    if (row+col+i)%3:box(k,'City lit window',(x-.10+col*.19,y-.216,.50+row*.20),(.066,.006,.092),'light',.002)

def optimize_export(path,reduced=False):
 vertices=[];faces=[];indices=[];materials=[];material_ids={}
 deps=bpy.context.evaluated_depsgraph_get()
 for obj in list(bpy.context.scene.objects):
  if obj.type not in ('MESH','CURVE','FONT') or obj.name=='Studio floor':continue
  evaluated=obj.evaluated_get(deps);mesh=evaluated.to_mesh();offset=len(vertices)
  vertices.extend([evaluated.matrix_world@v.co for v in mesh.vertices])
  local=[]
  for material in mesh.materials:
   if material.name not in material_ids:material_ids[material.name]=len(materials);materials.append(material)
   local.append(material_ids[material.name])
  for face in mesh.polygons:
   faces.append(tuple(offset+i for i in face.vertices));indices.append(local[face.material_index] if local else 0)
  evaluated.to_mesh_clear()
 mesh=bpy.data.meshes.new('Merged environment');mesh.from_pydata(vertices,[],faces);mesh.update()
 for material in materials:mesh.materials.append(material)
 for face,idx in zip(mesh.polygons,indices):face.material_index=idx
 model=bpy.data.objects.new('Shared space environment',mesh);bpy.context.scene.collection.objects.link(model)
 bpy.ops.object.select_all(action='DESELECT');model.select_set(True);bpy.context.view_layer.objects.active=model
 if reduced:
  mod=model.modifiers.new('Mobile simplification','DECIMATE');mod.ratio=.48
  bpy.ops.object.modifier_apply(modifier=mod.name)
 bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_animations=False,export_extras=True)
 return sum(len(p.vertices)-2 for p in model.data.polygons)

selected=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else list(NAMES)
if 'all' in selected:selected=list(NAMES)
for identifier in selected:
 bpy.ops.wm.read_factory_settings(use_empty=True);R.seed(420+list(NAMES).index(identifier));k=RoomKit()
 for name,color in COLORS.items():
  hex_color='#'+''.join(f'{round(max(0,min(1,c))*255):02x}' for c in color)
  material=k.material(name,hex_color,.74,.25 if name=='gold' else 0)
  if name=='light':material.node_tree.nodes['Principled BSDF'].inputs['Emission Color'].default_value=(*color,1);material.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value=.65
 architecture(k,identifier);seats=[]
 if identifier=='living':lounge(k,seats)
 elif identifier in ('study','library','projects'):study(k,seats,identifier=='library',identifier=='projects')
 elif identifier=='patio':patio(k,seats)
 else:terrace(k,seats)
 assert len(seats)==6,(identifier,len(seats))
 for anchor in seats:
  e=bpy.data.objects.new(anchor['id'],None);bpy.context.collection.objects.link(e)
  x,z,ny=anchor['position'];e.location=(x,-ny,z);e['shared_anchor']=json.dumps(anchor)
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=28
 scene.render.resolution_x=1100;scene.render.resolution_y=900;scene.render.resolution_percentage=100
 scene.render.image_settings.file_format='PNG';scene.view_settings.look='AgX - Medium High Contrast'
 world=bpy.data.worlds.new('Shared space atmosphere');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.52,.58,.70,1);world.node_tree.nodes['Background'].inputs[1].default_value=.35;scene.world=world
 bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.20));bpy.context.object.name='Studio floor';bpy.context.object.data.materials.append(k.mat('cream'))
 def aim(o,target):o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
 for p,energy,size,color in [((-3,-4,8),1800,7,(1,.85,.65)),((4,-1,6),1000,6,(.77,.84,1)),((0,5,7),1300,5,(1,.74,.45))]:
  bpy.ops.object.light_add(type='AREA',location=p);o=bpy.context.object;o.data.energy=energy;o.data.size=size;o.data.color=color;aim(o,(0,0,0))
 bpy.ops.object.camera_add(location=(9,-12,10));camera=bpy.context.object;scene.camera=camera;camera.data.type='ORTHO';camera.data.ortho_scale=11.6;aim(camera,(0,0,1.0))
 scene.render.filepath=str(REVIEW/(identifier+'.png'))
 source=SOURCE/(identifier+'-master.blend');bpy.ops.wm.save_as_mainfile(filepath=str(source))
 bpy.ops.render.render(write_still=True)
 bpy.ops.wm.open_mainfile(filepath=str(source));triangles=optimize_export(OUT/(identifier+'.glb'))
 bpy.ops.wm.open_mainfile(filepath=str(source));reduced=optimize_export(OUT/(identifier+'-reduced.glb'),True)
 metadata={'id':identifier,'name':NAMES[identifier],'version':1,'units':'metres','capacity':6,'bounds':[-3.9,-2.9,3.9,2.9],'anchors':seats,'camera':{'position':[9,10,12],'target':[0,1,0],'orthoScale':11.6},'triangles':triangles,'reducedTriangles':reduced,'source':source.name}
 (OUT/(identifier+'.json')).write_text(json.dumps(metadata,indent=2),encoding='utf-8')
 print('SHARED_SPACE_READY',identifier,triangles,reduced,flush=True)
