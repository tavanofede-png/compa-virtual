"""Build a non-destructive planar-dissolved runtime candidate from a study GLB.

Blender -b --factory-startup --python scripts/optimize_personal_study.py -- tech
The approved master and its source GLB remain untouched. Inspect the candidate
against the master before promoting it to web or Android assets.
"""

import json
import sys
import time
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[1]
IDS = {"library", "terrace", "pergola", "cafe", "minimal", "tech", "pavilion", "loft"}
args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
if len(args) not in {1, 2} or args[0] not in IDS or (len(args) == 2 and args[1] != "mobile"):
    raise SystemExit("Uso: Blender -b --python scripts/optimize_personal_study.py -- <id> [mobile]")

space_id = args[0]
profile = args[1] if len(args) == 2 else "runtime"
source = ROOT / "design" / "personal-spaces-v1" / "models" / f"{space_id}.glb"
candidate_dir = ROOT / "work" / "study-runtime-candidates"
candidate_dir.mkdir(parents=True, exist_ok=True)
destination = candidate_dir / f"{space_id}-{'mobile' if profile == 'mobile' else 'reduced'}.glb"

bpy.ops.wm.read_factory_settings(use_empty=True)
started = time.monotonic()
bpy.ops.import_scene.gltf(filepath=str(source))
meshes = [obj for obj in bpy.data.objects if obj.type == "MESH"]
colors_path = ROOT / "design/personal-spaces-v1/data" / f"{space_id}-material-colors.json"
if not colors_path.exists():
    raise SystemExit(f"Falta la paleta aprobada del master: {colors_path}")
colors = json.loads(colors_path.read_text(encoding="utf-8"))["colors"]
for name, color in colors.items():
    material = bpy.data.materials.get(name)
    if material is None:
        raise SystemExit(f"Material del master ausente en el GLB: {name}")
    material.diffuse_color = color
    principled = next((node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None)
    if principled is None:
        raise SystemExit(f"El GLB no conserva Principled BSDF: {name}")
    principled.inputs["Base Color"].default_value = color


def metrics():
    return {
        "objects": len(meshes),
        "vertices": sum(len(obj.data.vertices) for obj in meshes),
        "triangles": sum(sum(len(poly.vertices) - 2 for poly in obj.data.polygons) for obj in meshes),
        "materials": len(bpy.data.materials),
    }


before = metrics()
for index, obj in enumerate(meshes, 1):
    if len(obj.data.vertices) < 30:
        continue
    bpy.context.view_layer.objects.active = obj
    weld = obj.modifiers.new("Runtime exact seam weld", "WELD")
    weld.merge_threshold = 0.00001
    bpy.ops.object.modifier_apply(modifier=weld.name)
    dissolve = obj.modifiers.new("Runtime planar dissolve", "DECIMATE")
    dissolve.decimate_type = "DISSOLVE"
    dissolve.angle_limit = 0.005
    dissolve.delimit = {"MATERIAL", "SEAM", "SHARP", "UV"}
    bpy.ops.object.modifier_apply(modifier=dissolve.name)
    if profile == "mobile":
        name = obj.name.lower()
        triangles = sum(len(poly.vertices) - 2 for poly in obj.data.polygons)
        ratio = 1.0
        if "rug" in name or "carpet" in name:
            ratio = 0.6
        elif any(word in name for word in ("foliage", "fern", "plant", "flower", "vine", "tree", "leaves")):
            ratio = 0.48
        elif "keyboard" in name or "books" in name:
            ratio = 0.58
        elif triangles > 30000:
            ratio = 0.78
        if ratio < 1 and triangles > 500:
            collapse = obj.modifiers.new("Mobile density reduction", "DECIMATE")
            collapse.decimate_type = "COLLAPSE"
            collapse.ratio = ratio
            bpy.ops.object.modifier_apply(modifier=collapse.name)
    if index % 10 == 0:
        print(f"Optimized {index}/{len(meshes)} meshes", flush=True)

after = metrics()
bpy.ops.export_scene.gltf(
    filepath=str(destination),
    export_format="GLB",
    export_animations=False,
    export_extras=True,
    export_cameras=False,
    export_lights=False,
    export_yup=True,
)
report = {
    "id": space_id,
    "profile": profile,
    "source": str(source.relative_to(ROOT)),
    "candidate": str(destination.relative_to(ROOT)),
    "source_bytes": source.stat().st_size,
    "candidate_bytes": destination.stat().st_size,
    "before": before,
    "after": after,
    "elapsed_seconds": round(time.monotonic() - started, 1),
    "status": "candidate-needs-visual-and-device-review",
}
(candidate_dir / f"{space_id}-{'mobile' if profile == 'mobile' else 'reduced'}.json").write_text(
    json.dumps(report, indent=2) + "\n", encoding="utf-8"
)
print("RUNTIME_CANDIDATE=" + json.dumps(report), flush=True)
