import bpy,sys,math,json
from pathlib import Path
from mathutils import Vector,Matrix
R=Path(__file__).resolve().parents[1];sys.path.insert(0,str(R/'tools/blender'))
from room_premium_common import RoomKit
from build_harper import look_at
bpy.ops.wm.open_mainfile(filepath=str(R/'packages/assets/3d/source/rooms/reference-rebuild/atico-creativo-v3.blend'))
k=RoomKit()
def drop(o):
 for c in list(o.children):drop(c)
 bpy.data.objects.remove(o,do_unlink=True)
for name in list(bpy.data.objects.keys()):
 o=bpy.data.objects.get(name)
 if o and name.startswith(('PRM_BOT_FloorMonstera','PRM_BOT_BedFootCalathea','PRM_BOT_Window','V2_BotanicalShelf','V2_ShelfBracket')):drop(o)
# A restrained 10% width increase instead of the overly large prior experiment.
S=Matrix.Translation((.6,0,0))@Matrix.Diagonal((1.10,1,1,1))@Matrix.Translation((-.6,0,0))
roots=[o for o in bpy.context.scene.objects if o.parent is None]
for o in roots:
 if o.get('compa_room_category') in {'ATTIC_STRUCTURE','ATTIC_SKYLIGHT','ATTIC_STAIR','ATTIC_LIGHTS'} or o.name.startswith(('V3_Oak','Attic_Floor','Premium_Garland')):o.matrix_world=S@o.matrix_world
# Explicit assembly membership prevents textiles, lamps, drawer fronts and books
# from being separated from the piece of furniture which supports them.
bed=('Bed_','Premium_Bed_','Detail_Bed','Premium_Bedside_','Storage_Nightstand','Detail_Nightstand','Premium_BedLamp','Light_Bedside','PRM_BOT_Bedside')
study=('Desk_','STUDY_','V3_Laptop','V3_Screen','V2_Cubby','Premium_Bookcase','Storage_FloatingShelf','Decor_FloatingBooks','PRM_BOT_Bookcase','PRM_BOT_Desk','PRM_BOT_MainShelf','PRM_BOT_ShelfHerb')
paint=('Attic_Easel','Attic_ArtCanvas','Attic_PaintJar','V2_EaselPainting','V2_Brush')
cart=('V2_PaintTrolley','V2_Trolley','V2_PaintTube','V2_PainterPalette','V2_PalettePaint')
for o in roots:
 if o.name.startswith(bed):o.location+=Vector((-.4,1.0,0))
 elif o.name.startswith(study):o.location+=Vector((.60,0,0))
 elif o.name.startswith(paint):o.location+=Vector((.60,-.90,0))
 elif o.name.startswith(cart):o.location+=Vector((1.30,-.15,0))
 elif o.name.startswith(('Premium_LeftShelf','PRM_BOT_LeftShelf')):o.location.x-=.37
# Position an entire prop by its world-space footprint, never by an assumed origin.
def bounds(o):
 pts=[]
 for ch in [o,*o.children_recursive]:
  if ch.type=='MESH':pts += [ch.matrix_world@Vector(c) for c in ch.bound_box]
 return [min(p[i] for p in pts) for i in range(3)],[max(p[i] for p in pts) for i in range(3)]
def place(name,x,y,z):
 bpy.context.view_layer.update();o=bpy.data.objects.get(name)
 if o:
  lo,hi=bounds(o);o.location+=Vector((x-(lo[0]+hi[0])/2,y-(lo[1]+hi[1])/2,z-lo[2]))
place('Premium_Personal_AcousticGuitar',-3.03,-1.07,.20)
place('Premium_Personal_Skateboard',-3.04,-.53,.20)
place('Premium_Personal_SchoolBackpack',3.50,.72,.20)
place('Premium_Lounge_ProjectCrate',2.00,-1.76,.20)
place('PRM_BOT_FloorFern',4.12,.40,.20)
place('PRM_BOT_FloorRubberPlant',4.50,.92,.20)
# Purpose-built guitar stand: feet, padded cradles, spine and visible metal fittings.
C='ATTIC_CRAFT_DETAIL'
for x in (-3.19,-2.87):
 k.tube('V6_GuitarStandFoot',[(x,-1.29,.20),(x,-.85,.20)],.018,'ink',C)
 k.tube('V6_GuitarPaddedCradle',[(x,-1.11,.25),(x,-1.0,.23),(x,-.97,.29)],.018,'ink',C)
k.tube('V6_GuitarStandSpine',[(-3.03,-.88,.20),(-3.03,-.88,.94)],.017,'ink',C)
# Visible bed joinery, drawer pulls and subtle edge inlays.
for x in (-2.91,-1.45):
 for y in (-.09,2.34):
  k.box('V6_BedPostCap',(x,y,.62),(.105,.105,.024),'attic_edge',C,.008)
  for z in (.38,.48):
   ob=k.cylinder('V6_BedPeg',(x,y-.054,z),.009,.008,'oak_dark',C,12);ob.rotation_euler[0]=math.pi/2
# Art workmat marks an actual unobstructed standing area in front of the canvas.
k.box('V6_ArtistWorkMat',(.52,.12,.192),(.96,.92,.015),'v2_oat',C,.008)
for x in (.06,.98):k.tube('V6_WorkMatSewnEdge',[(x,-.32,.202),(x,.56,.202)],.002,'cream',C)
# Keep the tableau proportions closer to the source reference; render and record.
bpy.context.view_layer.update()
g=bpy.data.objects.get('Premium_Personal_AcousticGuitar');lo,hi=bounds(g)
bedob=bpy.data.objects.get('Bed_Frame');bl,bh=bounds(bedob)
intersect=all(lo[i]<bh[i] and hi[i]>bl[i] for i in range(3))
assert not intersect,'Guitar intersects the bed envelope'
report={'guitar_bed_bounds_intersect':intersect,'guitar_bounds':[lo,hi],'bed_bounds':[bl,bh],'art_standing_area':{'x':[.04,1.00],'y':[-.34,.58]},'note':'Static layout checks; animated navigation requires new room map before integration.'}
(R/'work/attic-v6-layout-check.json').write_text(json.dumps(report,indent=2),encoding='utf8')
scene=bpy.context.scene;scene.camera.location=(10,-12,9);look_at(scene.camera,(.65,.1,1.45));scene.camera.data.ortho_scale=11.6
scene.render.resolution_x=1600;scene.render.resolution_y=1300;scene.cycles.samples=24
scene['layout_revision']='v6 assembly layout, bed against rear wall, dedicated clear guitar stand'
scene.render.filepath=str(R/'renders/reference-rooms/atico-creativo-v6.png')
bpy.ops.wm.save_as_mainfile(filepath=str(R/'packages/assets/3d/source/rooms/reference-rebuild/atico-creativo-v6.blend'),compress=True)
bpy.ops.render.render(write_still=True)
print('V6_RENDER_READY',flush=True)

