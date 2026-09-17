"""Build the remaining new reference companions as editable, isolated review masters."""
import bpy,sys,math,json
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[1];sys.path.insert(0,str(R/'scripts'));sys.path.insert(0,str(R/'tools/blender'))
from new_reference_roster import CHARACTERS_NEW
import build_companion_collection as B
import character_premium_pipeline as P
import premium_face_hair as H
import premium_garments as G
from premium_validation import validate_scene
from room_premium_common import RoomKit
from build_harper import material
OUT=R/'packages/assets/3d/source/new-reference-characters';PRE=R/'renders/new-reference-characters';OUT.mkdir(parents=True,exist_ok=True);PRE.mkdir(parents=True,exist_ok=True)

def extras(ctx):
 c=ctx.character;k=RoomKit();features=[]
 def box(n,p,d,key,slot='top',bone='spine',bevel=.002):return ctx.box(c.id+'_'+n,p,d,ctx.mat(key),slot,bone,bevel)
 def tube(n,pts,r,key,slot='top',bone='spine',closed=False):
  o=k.tube(c.id+'_'+n,pts,r,ctx.mat(key),'REFERENCE_CHARACTER_DETAIL',closed);return ctx.attach(o,slot,bone,c.id)
 def mesh(n,v,f,key,slot,bone):
  o=k.mesh(c.id+'_'+n,v,f,ctx.mat(key),'REFERENCE_CHARACTER_DETAIL',.001);return ctx.attach(o,slot,bone,c.id)
 def remove(prefix):
  for o in list(bpy.data.objects):
   if o.name.startswith(prefix):bpy.data.objects.remove(o,do_unlink=True)
 def flower(x,y,z,slot='top',bone='spine',size=.013):
  for j in range(5):
   a=j*math.tau/5;box('FlowerPetal',(x+size*math.cos(a),y,z+size*math.sin(a)),(size,.005,size),'white',slot,bone,.003)
  box('FlowerCenter',(x,y-.004,z),(size*.7,.005,size*.7),'accent',slot,bone)
 def pixel(pattern,x,z,size=.015,key='accent'):
  for row,line in enumerate(pattern):
   for col,p in enumerate(line):
    if p!=' ':box('PixelEmbroidery',(x+col*size,-.159,z-row*size),(size*.94,.005,size*.94),key)
 if c.id=='finn':
  pixel(['111 111','  1   1',' 1  111',' 1    1','1   111'],-.080,1.16,.024,'white')
  # Stripes inherit the actual continuous sleeve skin weights; no rigid strip bridges.
  for side in ('L','R'):
   src=bpy.data.objects.get('Premium_Top_ContinuousSleeve_'+side)
   if not src:continue
   verts=[];faces=[];weights=[]
   for row in range(len(src.data.vertices)//8):
    pts=[src.data.vertices[row*8+j].co.copy() for j in range(8)];mid=sum(pts,Vector())/8
    # Front-most two adjacent surface facets.
    j=min(range(8),key=lambda q:pts[q].y);a=pts[j];b=pts[(j+1)%8]
    for t in (.20,.34,.66,.80):verts.append(tuple(a.lerp(b,t)+Vector((0,-.002,0))))
    weights.extend([[(g.group,g.weight) for g in src.data.vertices[row*8+j].groups]]*4)
   for row in range(len(verts)//4-1):
    for j in (0,2):faces.append((row*4+j,row*4+j+1,(row+1)*4+j+1,(row+1)*4+j))
   o=mesh('AthleticSleeveStripes_'+side,verts,faces,'white','top','upper_arm.'+side)
   o.parent=ctx.rig;o.parent_type='OBJECT';o.parent_bone='';o.matrix_parent_inverse=src.matrix_parent_inverse.copy();o.matrix_basis=src.matrix_basis.copy()
   for g in src.vertex_groups:o.vertex_groups.new(name=g.name)
   for index,row in enumerate(weights):
    for group,w in row:o.vertex_groups[group].add([index],w,'REPLACE')
   mod=o.modifiers.new('Follow tailored sleeve','ARMATURE');mod.object=ctx.rig
  # Skate carried vertically beside the right hand, with deck, trucks, wheels and grip art.
  x=.54;y=-.10;z=.46
  box('SkateDeck',(x,y,z),(.20,.025,.72),'bottom','hand_prop','hand.R',.02)
  box('SkateGrip',(x,y-.017,z),(.186,.006,.685),'black','hand_prop','hand.R',.014)
  for zz in (.19,.73):
   box('SkateTruck',(x,y+.045,zz),(.14,.045,.03),'metal','hand_prop','hand.R')
   for dx in (-.105,.105):
    o=k.cylinder('FINN_SkateWheel',(x+dx,y+.046,zz),.039,.031,ctx.mat('white'),'REFERENCE_CHARACTER_DETAIL',20);o.rotation_euler.y=math.pi/2;ctx.attach(o,'hand_prop','hand.R','skate')
  for zz in (.37,.47):box('SkateGraphic',(x,y-.022,zz),(.10,.004,.025),'white','hand_prop','hand.R')
  features=['backwards cap','73 applique','skinned sleeve stripes','separate skateboard']
 elif c.id=='elise':
  # A real tiered skirt surface replaces trousers; separately skinned to hips/thighs.
  remove(('Premium_Pants','Bottom_','Premium_Bottom'))
  for tier,(top,bottom,r1,r2) in enumerate([(.87,.70,.23,.265),(.72,.53,.263,.305),(.55,.35,.30,.345),(.37,.18,.34,.38)]):
   verts=[];faces=[];n=64
   for row in range(5):
    t=row/4;z=top+(bottom-top)*t
    for j in range(n):
     a=j*math.tau/n;r=r1+(r2-r1)*t+.005*math.cos(j*math.pi/2)*(t+.2);verts.append((r*math.cos(a),r*.64*math.sin(a),z))
   for row in range(4):
    for j in range(n):faces.append((row*n+j,row*n+(j+1)%n,(row+1)*n+(j+1)%n,(row+1)*n+j))
   o=mesh('TieredSkirt%d'%tier,verts,faces,'bottom','bottom','hips')
   for j in range(64):
    a=j*math.tau/64;box('SkirtHemStitch',(r2*math.cos(a),r2*.64*math.sin(a),bottom+.009),(.007,.006,.012),'white','bottom','hips',.001)
  for sign in (-1,1):
   for j in range(5):flower(sign*(.11+j%2*.04),-.163,.95+j*.046)
   for j in range(4):flower(sign*.278,-.165,1.48+j*.080,'hair','head',.011)
  features=['tiered pleated skirt','floral cardigan','hair flowers'];ctx.rig['skirt_pose_validation_pending']=True
 elif c.id=='kai':
  # Shorten actual sleeve mesh and retain cuff/opening proportions for the tee.
  remove(('Premium_Top_TurnedCuff','Premium_Top_Cuff','Premium_Top_Hood'))
  for side in ('L','R'):
   o=bpy.data.objects.get('Premium_Top_ContinuousSleeve_'+side)
   if not o:continue
   # Keep first six sleeve rings with shoulder-only weighting.
   v=[tuple(p.co) for p in o.data.vertices[:48]];f=[tuple(reversed(range(8)))]+[(r*8+j,r*8+(j+1)%8,(r+1)*8+(j+1)%8,(r+1)*8+j) for r in range(5) for j in range(8)]
   bpy.data.objects.remove(o,do_unlink=True);mesh('ShortSleeve_'+side,v,f,'top','top','upper_arm.'+side)
  pixel(['   1   ','  11   ',' 111 1 ','111111 ','1111111',' 11111 ','  111  '],-.07,1.19,.021)
  for j in range(16):
   t=j/15;tube('HipChain',[(.20+.075*math.sin(t*math.pi),-.115,.78-t*.18),(.20+.075*math.sin((t+.04)*math.pi),-.118,.78-(t+.04)*.18)],.003,'metal','bottom','hips')
  features=['short tee sleeves','pixel flame','hip chain','headphones']
 elif c.id=='noa':
  for side in ('L','R'):
   sign=-1 if side=='L' else 1
   for bone,z0,z1 in [('thigh.'+side,.45,.80),('shin.'+side,.17,.43)]:
    for j in range(8):box('PlaidWeft',(sign*.135,-.113,z0+(z1-z0)*j/7),(.184,.003,.009),'top_light','bottom',bone,.0005)
    for j in range(5):box('PlaidWarp',(sign*.135-.072+j*.036,-.115,(z0+z1)/2),(.008,.003,z1-z0),'hair_light','bottom',bone,.0005)
  # Individually bound notebooks can be equipped in the hand slot.
  for j in range(3):
   y=-.225-j*.034
   box('NotebookPaper',(0,y,1.09),(.245,.023,.30),'paper','hand_prop','hand.L')
   for dy in (-.016,.016):box('NotebookCover',(0,y+dy,1.09),(.26,.004,.315),('top','accent','bottom')[j],'hand_prop','hand.L')
   box('NotebookSpine',(-.13,y,1.09),(.009,.033,.315),('top','accent','bottom')[j],'hand_prop','hand.L')
  features=['round glasses','ash bun','plaid trousers','three notebooks']
 elif c.id=='rem':
  pixel(['11   11','111 111',' 11111 ','  111  ',' 11111 ','11   11'],-.08,1.18,.025)
  for side in ('L','R'):
   for j,z in enumerate((.65,.55,.37)):
    bone=('thigh.' if z>.43 else 'shin.')+side;x=-.135 if side=='L' else .135
    box('DenimRip',(x,-.119,z),(.126,.005,.021),'white','bottom',bone,.001)
    for q in range(12):box('RipThread',(x-.056+q*.010,-.123,z),(.0015,.002,.029),'white','bottom',bone,.0002)
  tube('CrossbodyStrap',[(-.22,-.177,1.24),(.0,-.185,1.03),(.23,-.18,.84)],.013,'metal')
  box('CrossbodyBag',(.19,-.204,.85),(.23,.085,.17),'bottom','back','spine',.012)
  features=['copper hair and beanie','graphic hoodie','frayed denim','crossbody bag']
 elif c.id=='sage':
  remove(('PRM_Hair_Long','PRM_Hair_Loc'))
  for strand in range(22):
   a=strand*math.tau/22
   # Back and side locks, leaving the face open.
   if math.sin(a)<-.70:continue
   for j in range(22):
    z=1.77-j*.035;x=.275*math.cos(a)+.009*math.sin(j*math.pi);y=.21*math.sin(a)+.009*math.cos(j*math.pi)
    box('BraidedLock',(x,y,z),(.026,.031,.047),('hair_mid','hair_light')[j%2],'hair','head',.005)
  for j in range(22):
   a=math.pi+j*math.pi/21;box('GoldNecklace',(.105*math.cos(a),-.156,1.25+.041*math.sin(a)),(.014,.006,.014),'accent')
  features=['individual long braids','hoops','layered necklace','olive cardigan']
 elif c.id=='orion':
  # Sweater inset and hood under the open beige jacket.
  box('InnerHoodie',(0,-.167,1.08),(.205,.023,.35),'white')
  pixel(['   11   ','  1111  ',' 111111 ','11111111','11 11 11'],-.075,1.15,.020)
  for sign in (-1,1):
   tube('HoodDrawcord',[(sign*.067,-.185,1.27),(sign*.063,-.190,1.18)],.003,'white')
   box('JacketFlap',(sign*.166,-.164,1.06),(.080,.017,.10),'top_dark')
  features=['square glasses','beige layered jacket','inner mountain hoodie']
 return features

def build(c):
 built=B.build_character(c);rig=built['rig'];ctx=P.Context(rig,c);worlds={o:o.matrix_world.copy() for o in P.character_meshes(rig)};rig.scale=(1,1,1);bpy.context.view_layer.update()
 for o,w in worlds.items():o.matrix_world=w
 H.upgrade(ctx);G.upgrade(ctx);features=extras(ctx);P.finish_surfaces(ctx);bpy.context.view_layer.update()
 low,high=P.bounds(P.character_meshes(rig));rig.scale*=c.height/(high[2]-low[2]);bpy.context.view_layer.update();low,high=P.bounds(P.character_meshes(rig));rig.location.z-=low[2]
 P.studio(ctx);validation=validate_scene(rig);scene=bpy.context.scene;scene['reference_status']='tailored first pass; visual and clothing fit review pending'
 bpy.ops.wm.save_as_mainfile(filepath=str(OUT/(c.id+'-reference-v1.blend')),compress=True)
 P.render_image(PRE/(c.id+'-reference-v1.png'),scene.camera,1000,24)
 (OUT/(c.id+'-reference-v1.json')).write_text(json.dumps({'id':c.id,'features':features,'bones':len(rig.data.bones),'structural_validation':validation,'clothing_fit_verified':False,'app_integrated':False},indent=2))
 print('NEW_REFERENCE_READY',c.id,flush=True)
if __name__=='__main__':
 ids=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [c.id for c in CHARACTERS_NEW if c.id!='lux']
 for c in CHARACTERS_NEW:
  if c.id in ids:build(c)
