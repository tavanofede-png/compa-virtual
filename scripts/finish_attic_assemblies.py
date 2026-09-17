import bpy,sys
from pathlib import Path
from mathutils import Vector,Matrix
R=Path(__file__).resolve().parents[1];sys.path.insert(0,str(R/'tools/blender'))
from build_harper import look_at
bpy.ops.wm.open_mainfile(filepath=str(R/'packages/assets/3d/source/rooms/reference-rebuild/atico-creativo-v6.blend'))
S=Matrix.Translation((.6,0,0))@Matrix.Diagonal((1.1,1,1,1))@Matrix.Translation((-.6,0,0))
for o in bpy.context.scene.objects:
 if o.parent:continue
 if o.name.startswith('Detail_HeadboardSlat'):o.location+=Vector((-.4,1,0))
 if o.name.startswith('Premium_Wall_'):o.matrix_world=S@o.matrix_world
scene=bpy.context.scene;scene.render.filepath=str(R/'renders/reference-rooms/atico-creativo-v7.png')
bpy.ops.wm.save_as_mainfile(filepath=str(R/'packages/assets/3d/source/rooms/reference-rebuild/atico-creativo-v7.blend'),compress=True)
bpy.ops.render.render(write_still=True)
