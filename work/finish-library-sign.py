import sys,json
from pathlib import Path
import bpy,math
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
import build_shared_spaces_v2 as build
path=build.SOURCE/'library-master.blend'
bpy.ops.wm.open_mainfile(filepath=str(path))
for ob in bpy.context.scene.objects:
    if ob.name.startswith('Library large sign oak surround'):
        ob.location.y=-.60;ob.location.z=3.37;ob.scale.z=.46/.58
    elif ob.name.startswith('Library large sign dark face'):
        ob.location.y=-.653;ob.location.z=3.37;ob.scale.z=.39/.45
    elif ob.name.startswith('Library illuminated motto'):
        ob.location.y=-.670;ob.location.z=3.37;ob.data.size=.16
    elif ob.name.startswith('Library upper sign warm LED'):
        ob.location.y=-.65;ob.location.z=3.59
    elif ob.name=='Library front right low stack':
        ob.rotation_euler.z=math.pi/2
bpy.context.scene.cycles.samples=24
bpy.ops.wm.save_as_mainfile(filepath=str(path))
bpy.ops.render.render(write_still=True)
bpy.ops.wm.open_mainfile(filepath=str(path));full=build.export(build.STAGE/'library.glb')
bpy.ops.wm.open_mainfile(filepath=str(path));reduced=build.export(build.STAGE/'library-reduced.glb',True)
meta_path=build.STAGE/'library.json';meta=json.loads(meta_path.read_text());meta.update(triangles=full,reducedTriangles=reduced);meta_path.write_text(json.dumps(meta,indent=2))
print('LIBRARY_SIGN_FINISHED',flush=True)
