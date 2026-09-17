"""Species-authored small pets. Actual surfaces, not extra fur over the old models."""
import bpy, math, json, sys
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_pet_anatomy import (ROOT,STAGE,mat,ellipsoid,sculpt,bind,tube,ear,
    bead_eye,front_surface,soften_coat_boundaries,mesh_object)
from build_pet_mvp import make_rig,create_actions,export_selected

SPECIES={
 'rabbit':('rabbit',.49,-.20,.20), 'guinea-pig':('small-mammal',.26,-.17,.20),
 'ferret':('mustelid',.24,-.30,.31), 'hedgehog':('small-mammal',.23,-.19,.16),
 'turtle':('turtle',.22,-.23,.22), 'gecko':('gecko',.17,-.20,.22),
 'budgie':('avian',.44,-.10,.05),
}

def rig_for(identifier):
 family,h,front,back=SPECIES[identifier]
 rig=make_rig();rig.name='pet-'+family+'-rig';rig['rig_family']=family
 bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
 points={'root':((0,0,.02),(0,0,.08)),
 'spine':((0,.08,h*.72),(0,-.05,h)),
 'head':((0,front,h),(0,front-.09,h+.06)),
 'tail.01':((0,back,h*.7),(0,back+.13,h*.60)),
 'tail.02':((0,back+.13,h*.60),(0,back+.27,h*.45))}
 for side,s in (('L',-1),('R',1)):
  points['ear.'+side]=((s*.105,front,h+.12),(s*.115,front,h+.22))
  for b,y in (('F',front),('B',back)):
   x=s*(.08 if identifier=='budgie' else .14)
   points['leg.'+b+side]=((x,y,h*.65),(x,y,.075))
   points['paw.'+b+side]=((x,y,.075),(x,y-.08,.025))
 for n,(a,b) in points.items():rig.data.edit_bones[n].head=a;rig.data.edit_bones[n].tail=b
 bpy.ops.object.mode_set(mode='OBJECT')
 return rig

def volume(name,parts,m,rig,bone='spine',voxel=.007):
 obj=sculpt(name,parts,m,voxel);bind(obj,rig,bone);return obj

def palette(obj,materials,rule):
 obj.data.materials.clear()
 for m in materials:obj.data.materials.append(m)
 for face in obj.data.polygons:face.material_index=rule(face.center)

def nose_mouth(rig,y,z,width=.022):
 pink=mat('Natural nose leather',(.31,.11,.085),.6)
 dark=mat('Natural mouth line',(.08,.040,.025),.82)
 bind(ellipsoid('Small mammal nose',(0,y,z),(width,.012,width*.65),pink,32,20),rig,'head')
 tube('Philtrum',[(0,y-.002,z-.008),(0,y+.003,z-.024)],[.0015,.0013],dark,rig,'head',8)
 for s in (-1,1):
  tube('Closed mammal mouth',[(0,y+.003,z-.024),(s*.017,y+.008,z-.027)],[.0013,.0006],dark,rig,'head',8)

def toes(rig,x,y,z,bone,material,count=4,length=.045,splay=.016):
 for i in range(count):
  offset=(i-(count-1)/2)*splay
  points=[(x+offset*.6,y,z+.013),(x+offset,y-length*.55,z+.006),(x+offset*1.15,y-length,z)]
  tube('Anatomical digit',points,[.010,.008,.004],material,rig,bone,8)

def feet(rig,front,back,material,wide=.047,long=.074,z=.033):
 for side,s in (('L',-1),('R',1)):
  for b,y in (('F',front),('B',back)):
   x=s*.14
   bind(ellipsoid('Small foot '+b+side,(x,y-.025,z),(wide,long,z),material),rig,'paw.'+b+side)
   toes(rig,x,y-long*.65,z*.55,'paw.'+b+side,material,3,.03,.014)

def build_rabbit(rig):
 tan=mat('Rabbit warm fawn',(.48,.27,.12));white=mat('Rabbit ivory',(.87,.78,.63));pink=mat('Rabbit inner ear',(.62,.30,.27))
 body=volume('Rabbit arched back and powerful haunches',[( (0,.10,.29),(.23,.29,.26)),((0,-.09,.38),(.17,.20,.21)),((-.17,.16,.19),(.11,.18,.17)),((.17,.16,.19),(.11,.18,.17))],tan,rig)
 palette(body,[tan,white],lambda p:1 if p.y<-.05 and p.z<.30 else 0)
 head=volume('Rabbit tapering head',[( (0,-.205,.505),(.171,.145,.163)),((0,-.313,.446),(.11,.10,.085)),((-.053,-.343,.42),(.065,.052,.053)),((.053,-.343,.42),(.065,.052,.053))],tan,rig,'head')
 palette(head,[tan,white],lambda p:1 if (p.z<.465 and p.y<-.26) or (abs(p.x)<.022 and p.y<-.31) else 0)
 surface=front_surface(head)
 for side,s in (('L',-1),('R',1)):
  bead_eye('Rabbit eye '+side,s*.109,.523,surface,rig,.030)
  ear('Rabbit long ear '+side,(s*.084,-.171,.608),.105,.35,s*.075,tan,pink,rig,'ear.'+side)
  volume('Rabbit foreleg '+side,[((s*.105,-.18,.185),(.052,.064,.14))],white,rig,'leg.F'+side)
  bind(ellipsoid('Rabbit hind foot '+side,(s*.177,.08,.048),(.075,.16,.048),white),rig,'paw.B'+side)
  bind(ellipsoid('Rabbit forefoot '+side,(s*.105,-.227,.039),(.051,.095,.039),white),rig,'paw.F'+side)
 nose_mouth(rig,-.395,.439,.018)
 bind(ellipsoid('Rabbit short round tail',(0,.379,.25),(.074,.066,.074),white),rig,'tail.01')

def build_guinea(rig):
 brown=mat('Cobayo chestnut',(.31,.13,.054));cream=mat('Cobayo ivory',(.86,.76,.56));pink=mat('Cobayo skin',(.47,.27,.22));dark=mat('Cobayo dark coat',(.09,.046,.032))
 body=volume('Guinea pig barrel body',[( (0,.055,.24),(.229,.329,.211)),((0,-.15,.26),(.20,.16,.18))],brown,rig)
 palette(body,[brown,cream,dark],lambda p:1 if -.04<p.y<.13 else 2 if p.y>.26 else 0)
 head=volume('Guinea pig blunt sloped head',[((0,-.23,.275),(.182,.175,.154)),((0,-.365,.212),(.116,.072,.065))],brown,rig,'head')
 palette(head,[brown,cream],lambda p:1 if abs(p.x)<.045 or p.z<.235 else 0)
 surface=front_surface(head)
 for side,s in (('L',-1),('R',1)):
  bead_eye('Cobayo lateral eye '+side,s*.112,.304,surface,rig,.027)
  ear('Cobayo rounded ear '+side,(s*.157,-.17,.362),.094,.062,0,brown,pink,rig,'ear.'+side,True)
 nose_mouth(rig,-.436,.226,.017)
 feet(rig,-.17,.20,pink,.037,.066,.027)

def build_ferret(rig):
 sable=mat('Ferret sable',(.18,.095,.045));cream=mat('Ferret cream',(.74,.64,.47));mask=mat('Ferret facial mask',(.067,.037,.025));pink=mat('Ferret ear',(.42,.23,.18))
 volume('Ferret long flexible body',[( (0,.01,.236),(.141,.37,.141)),((0,.28,.225),(.155,.18,.13)),((0,-.26,.252),(.12,.16,.13))],sable,rig)
 head=volume('Ferret tapered wedge head',[( (0,-.38,.295),(.145,.145,.125)),((0,-.493,.247),(.084,.088,.066))],cream,rig,'head')
 palette(head,[cream,mask],lambda p:1 if .045<abs(p.x)<.132 and .273<p.z<.346 and p.y<-.395 else 0)
 surface=front_surface(head)
 for side,s in (('L',-1),('R',1)):
  bead_eye('Ferret eye '+side,s*.085,.304,surface,rig,.025)
  ear('Ferret small ear '+side,(s*.112,-.30,.381),.066,.069,0,sable,pink,rig,'ear.'+side,True)
  for b,y in (('F',-.30),('B',.31)):
   volume('Ferret short leg '+b+side,[((s*.12,y,.111),(.039,.044,.092))],sable,rig,'leg.'+b+side)
 feet(rig,-.30,.31,sable,.039,.06,.025)
 nose_mouth(rig,-.573,.26,.018)
 tube('Ferret tapered tail',[(0,.40,.23),(.05,.55,.20),(.10,.67,.16),(.14,.78,.12)],[.060,.051,.029,.003],sable,rig,'tail.01',18)

def build_hedgehog(rig):
 brown=mat('Hedgehog mantle',(.26,.145,.067));cream=mat('Hedgehog face',(.72,.56,.36));tip=mat('Hedgehog spine tips',(.55,.39,.22));black=mat('Hedgehog nose',(.022,.014,.008),.34)
 volume('Hedgehog compact teardrop body',[((0,.045,.242),(.232,.282,.207)),((0,-.17,.198),(.157,.16,.14))],brown,rig)
 head=volume('Hedgehog pointed face',[((0,-.245,.217),(.142,.12,.119)),((0,-.363,.151),(.068,.103,.048))],cream,rig,'head')
 surface=front_surface(head)
 for side,s in (('L',-1),('R',1)):
  bead_eye('Hedgehog small eye '+side,s*.086,.231,surface,rig,.022)
  ear('Hedgehog ear '+side,(s*.112,-.20,.307),.062,.058,0,cream,brown,rig,'ear.'+side,True)
 bind(ellipsoid('Hedgehog pointed nose',(0,-.458,.165),(.023,.020,.018),black),rig,'head')
 feet(rig,-.19,.16,cream,.032,.051,.021)
 # Spines are this species' defining anatomy: short tapered quills following
 # the mantle, never a random hair system hiding the silhouette.
 verts=[];faces=[]
 for row in range(11):
  theta=.10+row/10*1.30
  for k in range(28):
   phi=k*math.tau/28+(row%2)*.10
   y=.045+.275*math.sin(theta)*math.sin(phi)
   if y<-.18:continue
   p=Vector((.226*math.sin(theta)*math.cos(phi),y,.24+.200*math.cos(theta)))
   normal=Vector((p.x/.226**2,(p.y-.045)/.275**2,(p.z-.24)/.20**2)).normalized()
   u=normal.cross(Vector((0,1,0))).normalized();v=normal.cross(u)
   start=len(verts);rad=.009;length=.036+.009*((row+k)%3)
   verts.extend([p+rad*(math.cos(a*math.tau/5)*u+math.sin(a*math.tau/5)*v) for a in range(5)])
   verts.append(p+normal*length)
   faces.extend([(start+a,start+(a+1)%5,start+5) for a in range(5)])
 obj=mesh_object('Hedgehog anatomical quills',verts,faces,tip);bind(obj,rig,'spine')

def build_turtle(rig):
 green=mat('Tortoise olive skin',(.26,.33,.105));light=mat('Tortoise underside',(.46,.40,.19));shell=mat('Tortoise shell',(.16,.095,.037));panel=mat('Tortoise scutes',(.33,.23,.089));dark=mat('Tortoise nostrils',(.025,.023,.010))
 volume('Tortoise lower body',[((0,0,.141),(.248,.32,.105))],light,rig)
 volume('Tortoise domed carapace',[((0,.035,.245),(.28,.342,.209))],shell,rig)
 # Hexagonal scutes follow the ellipsoid surface, with narrow true grooves.
 for row in range(-2,3):
  for col in range(-2,3):
   cx=col*.112+(row%2)*.056;cy=row*.110
   if (cx/.26)**2+(cy/.32)**2>.72:continue
   def height(x,y):return .245+.211*math.sqrt(max(.01,1-(x/.281)**2-((y-.035)/.343)**2))
   vs=[(cx,cy,height(cx,cy)+.006)]
   for k in range(6):
    x=cx+.061*math.cos(k*math.tau/6);y=cy+.058*math.sin(k*math.tau/6)
    vs.append((x,y,height(x,y)+.003))
   obj=mesh_object('Carapace scute',vs,[(0,k+1,(k+1)%6+1) for k in range(6)],panel);bind(obj,rig,'spine')
 head=volume('Tortoise head and neck',[((0,-.323,.194),(.105,.152,.079)),((0,-.427,.207),(.119,.090,.084))],green,rig,'head')
 surface=front_surface(head)
 for s in (-1,1):
  bead_eye('Tortoise lateral eye',s*.08,.238,surface,rig,.020)
  bind(ellipsoid('Tortoise nostril',(s*.022,-.512,.219),(.004,.003,.004),dark,20,12),rig,'head')
 for side,s in (('L',-1),('R',1)):
  for b,y in (('F',-.23),('B',.22)):
   volume('Tortoise stout leg '+b+side,[((s*.221,y,.09),(.094,.100,.078))],green,rig,'leg.'+b+side)
   toes(rig,s*.24,y-.045,.021,'paw.'+b+side,light,4,.051,.022)
 tube('Tortoise tiny tail',[(0,.34,.10),(0,.408,.081)],[.020,.002],green,rig,'tail.01',12)

def build_gecko(rig):
 yellow=mat('Leopard gecko ochre',(.66,.37,.08));ivory=mat('Leopard gecko belly',(.83,.73,.49));brown=mat('Leopard gecko markings',(.19,.072,.024));iris=mat('Gecko iris',(.52,.42,.18));black=mat('Gecko pupil',(.009,.007,.004),.25)
 body=volume('Gecko low torso',[((0,.02,.15),(.115,.26,.086)),((0,-.18,.17),(.103,.10,.070))],yellow,rig)
 head=volume('Gecko broad tapered head',[((0,-.271,.18),(.16,.15,.087)),((0,-.372,.147),(.117,.083,.054))],yellow,rig,'head')
 for obj in (body,head):
  palette(obj,[yellow,ivory,brown],lambda p:1 if p.z<.12 else 2 if math.sin(p.x*73+math.cos(p.y*48))*math.cos(p.y*62)> .65 else 0)
 surface=front_surface(head)
 from build_pet_anatomy import cat_eye
 for s in (-1,1):cat_eye('Gecko lateral eye',s*.111,.211,surface,iris,black,rig,.033,.034)
 for side,s in (('L',-1),('R',1)):
  for b,y in (('F',-.20),('B',.22)):
   tube('Gecko splayed limb',[(s*.08,y,.15),(s*.18,y+.04,.085),(s*.23,y-.02,.034)],[.026,.023,.013],yellow,rig,'leg.'+b+side,12)
   toes(rig,s*.23,y-.015,.018,'paw.'+b+side,ivory,5,.065,.014)
 points=[(0,.24,.155),(.035,.36,.143),(.053,.47,.124),(.057,.59,.094),(.036,.69,.074),(0,.77,.067)]
 tail=tube('Gecko fleshy tapered tail',points,[.065,.071,.056,.037,.017,.002],yellow,rig,'tail.01',22)
 palette(tail,[yellow,brown],lambda p:1 if math.sin(p.y*57)>.45 else 0)

def build_budgie(rig):
 blue=mat('Budgie sky blue',(.10,.38,.65));pale=mat('Budgie pale blue',(.45,.68,.77));yellow=mat('Budgie yellow mask',(.92,.72,.20));navy=mat('Budgie wing markings',(.036,.074,.14));pink=mat('Budgie feet',(.47,.28,.21));beak=mat('Budgie horn beak',(.43,.36,.19));cere=mat('Budgie blue cere',(.16,.40,.66))
 volume('Budgie slender breast',[((0,.012,.308),(.140,.124,.226)),((0,-.025,.451),(.125,.113,.126))],blue,rig)
 head=volume('Budgie rounded head',[((0,-.076,.563),(.13,.113,.135))],yellow,rig,'head')
 surface=front_surface(head)
 for side,s in (('L',-1),('R',1)):
  bead_eye('Budgie side eye '+side,s*.090,.586,surface,rig,.019)
  bind(ellipsoid('Budgie cheek patch',(s*.085,-.155,.512),(.026,.010,.015),blue),rig,'head')
  # Layered folded flight feathers form the wing outline, not a hair coat.
  wing=volume('Budgie folded wing '+side,[((s*.116,.029,.325),(.052,.123,.177))],pale,rig,'leg.F'+side)
  palette(wing,[pale,navy],lambda p:1 if math.sin(p.z*100+p.y*21)>.20 else 0)
  for k in range(5):
   points=[(s*(.115+k*.004),.015+k*.016,.39-k*.018),(s*(.128+k*.004),.101+k*.016,.26-k*.018),(s*.10,.173+k*.009,.159-k*.010)]
   tube('Budgie folded primary',points,[.018,.014,.002],navy if k%2==0 else pale,rig,'leg.F'+side,10)
  tube('Budgie shank',[(s*.068,.003,.14),(s*.068,-.018,.066)],[.012,.010],pink,rig,'leg.B'+side,10)
  toes(rig,s*.068,-.015,.024,'paw.B'+side,pink,2,.07,.022)
  for dx in (-.01,.012):tube('Budgie rear toe',[(s*.068+dx,-.013,.025),(s*.068+dx,.041,.019)],[.007,.003],pink,rig,'paw.B'+side,8)
 tube('Budgie hooked upper beak',[(0,-.18,.549),(0,-.217,.516),(0,-.200,.487)],[.027,.022,.002],beak,rig,'head',18)
 bind(ellipsoid('Budgie cere',(0,-.179,.552),(.033,.018,.013),cere),rig,'head')
 for s in (-1,1):
  bind(ellipsoid('Budgie nostril',(s*.013,-.195,.556),(.004,.002,.003),navy,20,12),rig,'head')
 for k in (-1,0,1):tube('Budgie long tail feather',[(k*.016,.082,.24),(k*.023,.242,.132),(k*.012,.397,.060)],[.024,.017,.0015],navy if k else blue,rig,'tail.01',12)

BUILDERS={'rabbit':build_rabbit,'guinea-pig':build_guinea,'ferret':build_ferret,'hedgehog':build_hedgehog,'turtle':build_turtle,'gecko':build_gecko,'budgie':build_budgie}

def render(identifier,rig):
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=28
 scene.render.resolution_x=720;scene.render.resolution_y=720;scene.render.resolution_percentage=100
 scene.render.image_settings.file_format='PNG';scene.view_settings.look='AgX - Medium High Contrast'
 world=bpy.data.worlds.new('Species studio');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.48,.54,.64,1);world.node_tree.nodes['Background'].inputs[1].default_value=.3;scene.world=world
 def aim(obj,target):obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
 bpy.ops.mesh.primitive_plane_add(size=200);bpy.context.object.name='Studio floor';bpy.context.object.data.materials.append(mat('Warm stage',(.56,.51,.45),.83))
 for loc,power,size,color in [((-2,-3,4),260,3,(1,.86,.72)),((2,-1,2),95,2.5,(.77,.85,1)),((1,2,3),300,2,(1,.91,.78))]:
  bpy.ops.object.light_add(type='AREA',location=loc);light=bpy.context.object;light.data.energy=power;light.data.size=size;light.data.color=color;aim(light,(0,0,.3))
 bpy.ops.object.camera_add(location=(1.30,-2.55,1.16));camera=bpy.context.object;scene.camera=camera;camera.data.type='ORTHO'
 h=1.0 if identifier=='rabbit' else .73 if identifier=='budgie' else .52
 camera.data.ortho_scale=1.28 if identifier=='rabbit' else 1.18 if identifier in ('ferret','gecko') else .94
 aim(camera,(0,-.03,h*.48))
 bpy.ops.wm.save_as_mainfile(filepath=str(STAGE/(identifier+'-master.blend')))
 scene.render.filepath=str(STAGE/(identifier+'.png'));bpy.ops.render.render(write_still=True)
 target=rig.data.bones['head'].tail_local
 camera.location=(.6,-2.5,target.z+.40);aim(camera,target);camera.data.ortho_scale=.56
 scene.render.filepath=str(STAGE/(identifier+'-face.png'));bpy.ops.render.render(write_still=True)

selected=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else list(SPECIES)
if 'all' in selected:selected=list(SPECIES)
for identifier in selected:
 if identifier.startswith('--'):continue
 bpy.ops.wm.read_factory_settings(use_empty=True)
 rig=rig_for(identifier);BUILDERS[identifier](rig)
 for obj in bpy.context.scene.objects:
  if obj.get('pet_asset') and obj.type=='MESH' and not ('ear' in obj.name.lower() or 'quill' in obj.name.lower()):soften_coat_boundaries(obj)
 create_actions(rig);rig.animation_data.action=None
 for bone in rig.pose.bones:bone.location=(0,0,0);bone.rotation_euler=(0,0,0)
 bpy.context.scene.frame_set(1);bpy.context.view_layer.update()
 parts=[o for o in bpy.context.scene.objects if o.get('pet_asset')]
 export_selected(STAGE/('pet-'+identifier+'.glb'),[rig]+parts)
 (STAGE/(identifier+'-manifest.json')).write_text(json.dumps({'id':identifier,'schema':'compa-pet-v2','revision':'anatomy-v2','rig':rig['rig_family'],'meshCount':len(parts),'noFurSystem':True,'noEyebrows':True},indent=2),encoding='utf-8')
 render(identifier,rig);print('SPECIES_READY',identifier,flush=True)
