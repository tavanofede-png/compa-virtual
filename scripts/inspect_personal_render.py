import bpy,json
from mathutils import Vector
s=bpy.context.scene;c=s.camera;W=s.render.resolution_x;H=s.render.resolution_y
for px,py in [(483,109),(521,77),(737,205),(758,291),(710,326),(212,305),(232,306),(400,216)]:
    origin=c.matrix_world@Vector(((px/W-.5)*c.data.ortho_scale,(.5-py/H)*c.data.ortho_scale*H/W,0))
    direction=c.matrix_world.to_quaternion()@Vector((0,0,-1))
    hit,p,n,face,ob,m=s.ray_cast(bpy.context.evaluated_depsgraph_get(),origin,direction)
    print('RAY',px,py,hit,ob.name if ob else '',list(p),list(n),[m.name for m in ob.data.materials] if ob and hasattr(ob.data,'materials') else [])
