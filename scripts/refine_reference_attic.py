"""Attic v2: reference correction, bespoke art, supporting surfaces, craft details."""
import bpy,sys,math,random,json
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[1];sys.path.insert(0,str(R/'tools/blender'))
from room_premium_common import RoomKit
from build_harper import look_at,rgba
bpy.ops.wm.open_mainfile(filepath=str(R/'packages/assets/3d/source/rooms/reference-rebuild/atico-creativo-v1.blend'))
k=RoomKit();rng=random.Random(451)
def remove(prefixes):
 for name in list(bpy.data.objects.keys()):
  o=bpy.data.objects.get(name)
  if o and name.startswith(prefixes):bpy.data.objects.remove(o,do_unlink=True)
def shift(name,delta):
 o=bpy.data.objects.get(name)
 if o:o.location+=Vector(delta)
# All floor plants leave the stair opening. Each remains intact and supported.
shift('PRM_BOT_FloorMonstera',(-5.55,.30,0))
shift('PRM_BOT_FloorFern',(-2.0,3.9,0))
shift('PRM_BOT_FloorRubberPlant',(.10,2.55,0))
# Former window plants now rest on a newly built solid shelf, not in mid-air.
k.box('V2_BotanicalShelf',(-1.71,2.30,1.195),(1.65,.44,.06),'attic_edge','ATTIC_FURNITURE')
for x in (-2.3,-1.1):
 k.box('V2_ShelfBracket',(x,2.43,1.08),(.06,.21,.21),'attic_wood','ATTIC_FURNITURE')
# Replace the tall bookcase with knee-height cubbies, retaining the detailed books.
remove(('Storage_Bookcase','Storage_Box','STUDY_StorageBox','Attic_LowCubby','Attic_ArtReferenceBook','Attic_Inspiration','Attic_PhotoMotif','Attic_PaintedMosaic','Premium_Lounge_Rug','Premium_Lounge_Table'))
C='ATTIC_FURNITURE'
for z in (.22,.69,1.16):k.box('V2_CubbyShelf',(3.55,2.04,z),(1.47,.72,.055),'attic_edge',C)
for x in (2.82,3.55,4.28):k.box('V2_CubbySide',(x,2.04,.69),(.065,.72,.97),'attic_wood',C)
k.box('V2_CubbyBack',(3.55,2.38,.69),(1.52,.045,1.0),'attic_wood',C)
books=[o for o in bpy.context.scene.objects if o.parent is None and o.name.startswith(('STUDY_ShelfBook','STUDY_ShelfStack','Premium_Bookcase_TopJournals'))]
for i,o in enumerate(books):
 row=i//18;col=i%18
 if row<2:o.location=(2.91+col*.071,1.96,.25+row*.47)
 else:o.location=(3.0+(i%6)*.16,2.08,1.19)
remove(('STUDY_Bookend',))
for name,dest in [('STUDY_Trophy',(3.90,2.05,1.19)),('STUDY_Globe',(3.39,2.03,1.19)),('STUDY_ShelfFriendPhoto',(2.93,2.09,1.19))]:
 o=bpy.data.objects.get(name)
 if o:o.location=dest
shift('PRM_BOT_BookcaseTopPothos',(0,0,-1.56));shift('PRM_BOT_BookcaseMiddlePilea',(-.20,0,-1.06));shift('PRM_BOT_BookcaseTinyAloe',(0,0,-1.085))
# Rectangular art-room rug: woven backing, geometric motifs and actual fringes.
k.material('v2_rust','#BA6650',.94);k.material('v2_oat','#E8CFAB',.96)
k.box('V2_WovenRug',(0,-.75,.218),(2.43,2.13,.036),'v2_oat',C,.025)
for side in (-1,1):
 for i in range(54):
  x=-1.17+i*.044;y=-.75+side*1.09
  k.tube('V2_RugTassel',[(x,y,.22),(x+.01,y+side*.06,.20),(x-.005,y+side*.105,.19)],.004,'v2_oat',C)
for row in range(5):
 for col in range(6):
  x=-1.0+col*.4;y=-1.57+row*.4
  verts=[(x-.16,y,.24),(x,y-.14,.24),(x+.16,y,.24),(x,y+.14,.24)]
  k.mesh('V2_RugWovenDiamond',verts,[(0,1,2,3)],'v2_rust' if (row+col)%2 else 'sage',C,0)
for i in range(130):k.tube('V2_RugWeft',[(-1.18,-1.77+i*.0158,.241),(1.18,-1.77+i*.0158,.241)],.0013,'v2_oat',C)
# Square two-tier table as in the art attic, with joinery and retained tabletop props.
for z in (.35,.725):
 for i in range(5):k.box('V2_TableBoard',(.21+i*.17,-.8,z),(.163,.73,.055),'attic_edge',C,.008)
for x in (.21,.89):
 for y in (-1.11,-.49):
  k.box('V2_TableLeg',(x,y,.46),(.065,.065,.57),'attic_wood',C,.009)
  k.cylinder('V2_TablePeg',(x,y-.037,.63),.009,.008,'oak_dark',C,12).rotation_euler[0]=math.pi/2
for i in range(4):k.book('V2_TableArtBook',(.34+i*.115,-.88,.39),.09,.20,.13,('sage','pink','attic_blue','cream')[i],collection=C)
# Expressive handmade art/photo collage. Different sizes and mounts, original textures.
texpath=R/'packages/assets/3d/textures/attic-art-atlas.png'
if not texpath.exists():raise RuntimeError('Original art atlas is required before rendering')
im=bpy.data.images.load(str(texpath));im.pack()
mat=bpy.data.materials.new('V2_OriginalArtworkAtlas');mat.use_nodes=True
nodes=mat.node_tree.nodes;tex=nodes.new('ShaderNodeTexImage');tex.image=im
mat.node_tree.links.new(tex.outputs['Color'],nodes.get('Principled BSDF').inputs['Base Color']);nodes.get('Principled BSDF').inputs['Roughness'].default_value=.83
A='ATTIC_ORIGINAL_ART'
def artwork(name,x,y,z,w,h,index,framed=True,angle=0):
 group=k.group(name,(x,y,z),(0,angle,0),A)
 k.box(name+'_Backing',(0,0,0),(w+.035,.027,h+.035),'attic_wood' if framed else 'paper',A,.003,parent=group)
 if framed:
  for xx in (-w/2,w/2):k.box(name+'_FrameSide',(xx,-.021,0),(.025,.04,h+.03),'attic_edge',A,.004,parent=group)
  for zz in (-h/2,h/2):k.box(name+'_FrameEnd',(0,-.021,zz),(w,.04,.025),'attic_edge',A,.004,parent=group)
 ob=k.mesh(name+'_Art',[(-w/2,-.025,-h/2),(w/2,-.025,-h/2),(w/2,-.025,h/2),(-w/2,-.025,h/2)],[(0,1,2,3)],mat,A,0,parent=group)
 uv=ob.data.uv_layers.new();u=(index%4)/4;v=1-(index//4+1)/4
 coords=[(u+.003,v+.003),(u+.247,v+.003),(u+.247,v+.247),(u+.003,v+.247)]
 for li,c in enumerate(coords):uv.data[li].uv=c
 if not framed:
  for xx in (-w*.33,w*.33):k.box(name+'_Tape',(xx,-.043,h/2),(.07,.005,.055),'v2_oat',A,.001,rotation=(0,.10,0),parent=group)
 return group
layout=[(-2.67,2.00,.32,.40,0),(-2.22,2.08,.36,.27,8),(-1.78,1.98,.26,.36,5),(-1.36,2.03,.36,.28,9),(-2.66,2.59,.40,.49,3),(-2.11,2.57,.29,.39,1),(-1.68,2.55,.38,.32,6),(-1.23,2.53,.27,.40,12),(-2.13,3.10,.42,.30,14),(-1.53,3.15,.44,.43,2),(-.96,3.19,.30,.36,10),(-.51,3.00,.26,.29,13)]
for i,(x,z,w,h,ix) in enumerate(layout):artwork('V2_Collage_%02d'%i,x,2.47,z,w,h,ix,i%3==0,(-.06,.025,.07,0)[i%4])
artwork('V2_EaselPainting',-.08,1.805,1.50,.77,.95,15,False)
# Paintbrushes have separate handles, metal ferrules and tapered bristles.
for i in range(9):
 x=-.4+i*.072;y=1.61;z=1.16+(i%3)*.015
 k.cylinder('V2_BrushHandle',(x,y,z),.006,.22,'attic_wood',A,10)
 k.cylinder('V2_BrushFerrule',(x,y,z+.12),.008,.032,'gold',A,10)
 k.cylinder('V2_BrushBristles',(x,y,z+.15),.009,.033,('attic_blue','v2_rust','sage')[i%3],A,10,radius_top=.002)
# Painter trolley, sketchbooks, palette, pencils, jars and stretched canvases.
for z in (.30,.62,.94):k.box('V2_PaintTrolleyTray',(-.12,.97,z),(.64,.42,.045),'attic_edge',A)
for x in (-.40,.16):
 for y in (.79,1.14):
  k.box('V2_TrolleyUpright',(x,y,.58),(.036,.036,.88),'attic_wood',A)
  k.sphere('V2_TrolleyCaster',(x,y,.20),(.037,.028,.037),'ink',A)
for i in range(5):k.book('V2_TrolleySketchbook',(-.30+i*.09,.96,.34),.072,.22,.16,('cream','sage','pink')[i%3],collection=A)
for i in range(8):
 k.cylinder('V2_PaintTube',(-.36+i*.07,.91,.99),.018,.085,('attic_blue','v2_rust','sage','cream')[i%4],A,12)
 k.cylinder('V2_PaintTubeCap',(-.36+i*.07,.91,1.036),.012,.013,'ink',A,12)
k.sphere('V2_PainterPalette',(-.02,1.01,.97),(.17,.105,.012),'attic_edge',A)
for i in range(6):k.sphere('V2_PalettePaint',(-.12+i*.042,1.00,.987),(.015,.02,.004),('attic_blue','v2_rust','sage','pink','cream','gold')[i],A)
# Floor pillows placed clear of circulation and stairs.
for i in range(3):
 ob=k.box('V2_FloorCushion',(-1.48+i*.38,-2.07,.27),(.35,.45,.15),('sage','v2_rust','cream')[i],C,.055,rotation=(0,0,(i-1)*.12))
 for sign in (-1,1):k.tube('V2_CushionStitch',[(-1.48+i*.38+sign*.14,-2.24,.34),(-1.48+i*.38+sign*.14,-1.90,.34)],.003,'linen',C)
# More roof construction: actual slats, end-grain, fasteners and shorter cutaway edge.
for i in range(17):
 x=-3.0+i*.44;z=4.48-abs(x-.6)*2.08/3.8
 k.box('V2_RoofUndersideSlat',(x,2.31,z-.09),(.42,.36,.065),'attic_edge','ATTIC_STRUCTURE',.006,rotation=(0,math.copysign(math.atan2(2.08,3.8),x-.6),0))
 for y in (2.20,2.42):k.sphere('V2_RafterIronPin',(x,y,z-.14),(.017,.017,.008),'ink','ATTIC_STRUCTURE',8,4)
remove(('Attic_EaveTimber',))
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
# Wood grain and nails are small modeled details on the plank floor.
for o in list(bpy.context.scene.objects):
 if o.name.startswith('Attic_IndividualFloorboard'):
  x,y,z=o.location
  for side in (-1,1):
   k.cylinder('V2_FloorNail',(x+side*.095,y+.20,z+.024),.003,.0015,'oak_dark',C,8)
  points=[(x-.07+.006*math.sin(i*.7+y),y-.21+i*.03,z+.025) for i in range(15)]
  k.tube('V2_FloorGrain',points,.0007,'oak_dark',C)

# Tone textiles to the illustrated olive/rust layering, keep all actual cloth folds/seams.
for key,color in [('textile_rose','#B58061'),('textile_rose_shadow','#875D49'),('pink','#DBBDA1'),('pink_light','#E9D0B5'),('textile_sage','#657A4D')]:
 m=bpy.data.materials.get('MAT_'+key.upper())
 if m:m.diffuse_color=rgba(color);m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=rgba(color)
# Standalone delivery: leave app and its old collision maps unchanged pending fit review.
scene=bpy.context.scene;scene.camera.location=(10,-12,9);look_at(scene.camera,(.5,.15,1.42));scene.camera.data.ortho_scale=10.8
scene.cycles.samples=48;scene.render.resolution_x=1800;scene.render.resolution_y=1500
scene['review_status']='v2 bespoke detail pass; not yet app-integrated'
out=R/'packages/assets/3d/source/rooms/reference-rebuild/atico-creativo-v2.blend'
bpy.ops.wm.save_as_mainfile(filepath=str(out),compress=True)
scene.render.filepath=str(R/'renders/reference-rooms/atico-creativo-v2.png');bpy.ops.render.render(write_still=True)
for name,loc,target,scale in [('arte',(.3,-4,3.8),(-.65,1.95,2.0),4.2),('escalera',(7,-7,5),(2.95,-.75,.30),4.3)]:
 scene.camera.location=loc;look_at(scene.camera,target);scene.camera.data.ortho_scale=scale
 scene.render.resolution_x=1200;scene.render.resolution_y=1200;scene.cycles.samples=32
 scene.render.filepath=str(R/('renders/reference-rooms/atico-v2-detalle-'+name+'.png'));bpy.ops.render.render(write_still=True)
print('ATTIC_V2_FINISHED',str(out),flush=True)
