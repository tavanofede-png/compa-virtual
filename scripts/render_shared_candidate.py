"""Render both shared-room GLBs with identical lighting for visual regression review."""

import sys
from pathlib import Path

import bpy
from mathutils import Vector

root = Path(__file__).resolve().parents[1]
args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
if len(args) != 2 or args[1] not in {"source", "compact"}:
    raise SystemExit("Uso: blender -b --python scripts/render_shared_candidate.py -- <id> source|compact")
room_id, variant = args
if room_id not in {"living", "study", "library", "projects", "patio", "terrace"}:
    raise SystemExit("Sala desconocida")
path = (
    root / "work" / "shared-spaces-v2" / f"{room_id}-reduced.glb"
    if variant == "source"
    else root / "apps" / "web" / "public" / "selection" / "shared-spaces" / f"{room_id}-reduced.glb"
)
output = root / "work" / "shared-spaces-v2" / f"{room_id}-{variant}-review.png"
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(path))
scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1000
scene.render.resolution_y = 800
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = str(output)
if scene.world is None:
    scene.world = bpy.data.worlds.new("Review world")
scene.world.color = (0.75, 0.72, 0.68)

target = Vector((0, 0, 1.2))
camera_data = bpy.data.cameras.new("Review camera")
camera_data.type = "ORTHO"
camera_data.ortho_scale = 11.9
camera = bpy.data.objects.new("Review camera", camera_data)
scene.collection.objects.link(camera)
camera.location = (10, -13, 10.2)
camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
scene.camera = camera
for name, location, energy, size in [
    ("Key", (-3, -4, 8), 1200, 6),
    ("Fill", (5, -1, 6), 650, 5),
]:
    light_data = bpy.data.lights.new(name, "AREA")
    light_data.energy = energy
    light_data.shape = "DISK"
    light_data.size = size
    light = bpy.data.objects.new(name, light_data)
    scene.collection.objects.link(light)
    light.location = location
    light.rotation_euler = (target - light.location).to_track_quat("-Z", "Y").to_euler()
bpy.ops.render.render(write_still=True)
print("REVIEW_RENDER=" + str(output), flush=True)
