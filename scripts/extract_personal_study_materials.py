"""Capture the baked fallback colours from the approved Blender master.

Procedural wood grain does not export to glTF; the master also contains modeled
grain, so the runtime GLB keeps its geometry and uses the exact authored base
colour rather than glTF's accidental white default.
"""

import json
import sys
from pathlib import Path

import bpy

root = Path(__file__).resolve().parents[1]
ids = {"library", "terrace", "pergola", "cafe", "minimal", "tech", "pavilion", "loft"}
args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
if len(args) != 1 or args[0] not in ids:
    raise SystemExit("Uso: Blender -b --python scripts/extract_personal_study_materials.py -- <id>")

space_id = args[0]
master = root / "packages/assets/3d/source/personal-spaces/v1" / f"{space_id}-master.blend"
bpy.ops.wm.open_mainfile(filepath=str(master))
names = {"MAT_OAK", "MAT_WOODLIGHT", "MAT_OAK_END", "MAT_EX_OAK_LIGHT", "MAT_EX_OAK"}
colors = {}
for name in sorted(names):
    material = bpy.data.materials.get(name)
    if material is None:
        continue
    colors[name] = [round(float(value), 8) for value in material.diffuse_color]
output = root / "design/personal-spaces-v1/data" / f"{space_id}-material-colors.json"
output.write_text(json.dumps({"id": space_id, "source": master.relative_to(root).as_posix(), "colors": colors}, indent=2) + "\n", encoding="utf-8")
print("MATERIAL_COLORS=" + str(output), flush=True)
