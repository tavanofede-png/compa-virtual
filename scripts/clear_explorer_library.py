import bpy
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[1];p=R/'packages/assets/3d/source/rooms/reference-rebuild/rincon-explorador-v1.blend'
bpy.ops.wm.open_mainfile(filepath=str(p))
if not bpy.context.scene.get('bedside_relocated_for_library'):
 for o in list(bpy.context.scene.objects):
  if not o.parent and o.name.startswith(('Premium_Bedside_Right','Premium_Bedside_CurrentBooks','PRM_BOT_BedsideCalathea')):o.location+=Vector((-1.97,-2.80,0))
 bpy.context.scene['bedside_relocated_for_library']=True
 bpy.ops.wm.save_as_mainfile(filepath=str(p),compress=True)
