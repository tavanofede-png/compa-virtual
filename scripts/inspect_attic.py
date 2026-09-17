import bpy,json
from pathlib import Path
r=Path.cwd();bpy.ops.wm.open_mainfile(filepath=str(r/'packages/assets/3d/source/rooms/reference-rebuild/atico-creativo-v1.blend'))
rows=[{'name':o.name,'parent':o.parent.name if o.parent else None,'loc':list(o.location)} for o in bpy.context.scene.objects if o.parent is None]
(r/'work/attic-roots.json').write_text(json.dumps(rows),encoding='utf8')
