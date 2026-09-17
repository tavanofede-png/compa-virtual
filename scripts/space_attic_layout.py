import bpy,sys,json
from pathlib import Path
from mathutils import Vector,Matrix
R=Path(__file__).resolve().parents[1];sys.path.insert(0,str(R/'tools/blender'))
from room_premium_common import RoomKit
from build_harper import look_at
bpy.ops.wm.open_mainfile(filepath=str(R/'packages/assets/3d/source/rooms/reference-rebuild/atico-creativo-v3.blend'))
k=RoomKit()
# Remove whole named props, including descendants. The guitar stays.
remove=('PRM_BOT_FloorMonstera','PRM_BOT_BedFootCalathea','PRM_BOT_WindowPilea','PRM_BOT_WindowAloe','PRM_BOT_WindowCenterPilea','V2_BotanicalShelf','V2_ShelfBracket')
names=set()
def collect(o):
 names.add(o.name)
 for ch in o.children:collect(ch)
for o in list(bpy.data.objects):
 if o.name.startswith(remove):collect(o)
for name in names:
 o=bpy.data.objects.get(name)
 if o:bpy.data.objects.remove(o,do_unlink=True)
# Enlarge the architectural shell only; furniture dimensions remain unchanged.
arch={'ATTIC_STRUCTURE','ATTIC_SKYLIGHT','ATTIC_STAIR','ATTIC_LIGHTS'}
S=Matrix.Translation(Vector((.6,0,0)))@Matrix.Diagonal((1.30,1.12,1,1))@Matrix.Translation(Vector((-.6,0,0)))
roots=[o for o in bpy.context.scene.objects if o.parent is None]
for o in roots:
 cat=o.get('compa_room_category','')
 if cat in arch or o.name.startswith(('V3_Oak','Attic_Floor')):
  o.matrix_world=S@o.matrix_world
# Move complete assemblies together using the existing object naming contracts.
right=('Desk_','STUDY_','V3_Laptop','V3_Screen','V2_Cubby','Premium_Bookcase','Storage_Box','PRM_BOT_Bookcase','PRM_BOT_Desk','PRM_BOT_FloorRubber','Storage_FloatingShelf','Decor_FloatingBooks','PRM_BOT_MainShelf','PRM_BOT_ShelfHerb','STUDY_Floating')
left=('Bed_','Premium_Bed','Detail_Bed','Premium_Textile','PRM_BOT_Bedside')
art=('Attic_Easel','Attic_ArtCanvas','Attic_PaintJar','V2_EaselPainting','V2_Brush')
for o in roots:
 if o.name not in bpy.data.objects:continue
 if o.name.startswith(right):o.location+=Vector((1.15,.10,0))
 elif o.name.startswith(left):pass
 elif o.name.startswith(art):o.location+=Vector((.25,-.45,0))
 elif o.name.startswith(('V2_PaintTrolley','V2_Trolley','V2_PaintTube','V2_PainterPalette','V2_PalettePaint')):o.location+=Vector((.82,.15,0))
# Do not leave the extra fern under the desk/artist's feet.
o=bpy.data.objects.get('PRM_BOT_FloorFern')
if o:o.location+=Vector((3.8,-1.0,0))
# Left-wall items follow the widened wall, not the bed.
for o in roots:
 if o.name.startswith(('Premium_Wall_','Premium_Garland','PRM_BOT_LeftShelf')):
  if o.name.startswith('Premium_Garland'):o.matrix_world=S@o.matrix_world
  else:o.location.x-=1.10
# Render, editable master and explicit record of removed plants.
scene=bpy.context.scene;scene['layout_revision']='v5 enlarged; guitar clear; no plants or shelf behind bed'
scene.camera.location=(12,-14,10);look_at(scene.camera,(.7,.15,1.5));scene.camera.data.ortho_scale=12.8
scene.render.resolution_x=1600;scene.render.resolution_y=1300;scene.cycles.samples=24
out=R/'packages/assets/3d/source/rooms/reference-rebuild/atico-creativo-v5.blend'
scene.render.filepath=str(R/'renders/reference-rooms/atico-creativo-v5.png')
bpy.ops.wm.save_as_mainfile(filepath=str(out),compress=True)
(R/'work/attic-v5-layout.json').write_text(json.dumps({'removed_prefixes':remove,'shell_width_factor':1.3,'shell_depth_factor':1.12,'furniture_scaled':False,'desk_translation':[1.15,.1,0],'art_station_translation':[.25,-.45,0],'app_integrated':False},indent=2),encoding='utf8')
bpy.ops.render.render(write_still=True)
print('V5_RENDER_READY',flush=True)
