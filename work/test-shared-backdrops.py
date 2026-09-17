import sys,bpy
from pathlib import Path
root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/'scripts'))
import build_shared_spaces_v2 as v2
bpy.ops.wm.read_factory_settings(use_empty=True)
k=v2.kit.RoomKit();v2.prepare_materials(k)
v2.scenic_panel(k,'Sunset test',(0,0,1.75),8,3.5,kind='sunset')
tri=v2.export(root/'work/shared-spaces-v2/scenery-test.glb')
print('SCENERY_EXPORT_OK',tri)
