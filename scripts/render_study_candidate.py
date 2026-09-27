"""Render source or reduced GLB with one fixed camera for visual comparison."""

import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

root = Path(__file__).resolve().parents[1]
args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
if len(args) != 2 or args[1] not in {"source", "reduced", "mobile", "compact"}:
    raise SystemExit("Uso: ... -- <id> source|reduced|mobile|compact")
space_id, variant = args
model = (
    root / "design" / "personal-spaces-v1" / "models" / f"{space_id}.glb"
    if variant == "source"
    else root / "work" / "study-runtime-candidates" / f"{space_id}-{variant}.glb"
)
destination = root / "work" / "study-runtime-candidates" / f"{space_id}-{variant}.png"
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(model))
scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1000
scene.render.resolution_y = 760
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = str(destination)
scene.render.film_transparent = False
if scene.world is None:
    scene.world = bpy.data.worlds.new("Review world")
scene.world.color = (0.75, 0.72, 0.68)

camera_data = bpy.data.cameras.new("Review camera")
camera_data.type = "ORTHO"
camera_data.ortho_scale = 9.5
camera = bpy.data.objects.new("Review camera", camera_data)
scene.collection.objects.link(camera)
camera.location = (8, -11, 7.4)
target = Vector((0, 0, 1.35))
camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
scene.camera = camera

for name, location, energy, size in [
    ("Key", (1, -4, 8), 1200, 7),
    ("Fill", (-5, -1, 5), 650, 5),
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
print("REVIEW_RENDER=" + str(destination), flush=True)
