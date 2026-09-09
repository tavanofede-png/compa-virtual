from __future__ import annotations

import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_harper import ROOT, look_at, rgba


ROOM = ROOT / "packages" / "assets" / "3d" / "habitacion-cozy-premium.glb"
CHARACTER = ROOT / "packages" / "assets" / "3d" / "compa-harper-premium.glb"
OUTPUT = ROOT / "packages" / "assets" / "3d" / "previews" / "harper-in-cozy-room-scale-check.png"


def main() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1500
    scene.render.resolution_y = 1125
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = rgba("#DCD8D3")
    background.inputs["Strength"].default_value = 0.48

    bpy.ops.import_scene.gltf(filepath=str(ROOM))
    before = set(scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(CHARACTER))
    character_objects = [obj for obj in scene.objects if obj not in before]
    for obj in character_objects:
        if obj.parent is None:
            obj.location.x += 0.85
            obj.location.y -= 0.42
            obj.location.z += 0.20
            obj.rotation_euler[2] += 0.28

    for name, location, energy, size, color in (
        ("RoomCharacterKey", (7.0, -7.5, 7.0), 1750, 5.0, (1.0, 0.83, 0.68)),
        ("RoomCharacterFill", (-4.5, -3.0, 4.2), 950, 4.0, (0.70, 0.82, 1.0)),
        ("RoomCharacterWindow", (-1.0, 4.5, 4.0), 1150, 3.5, (0.78, 0.88, 1.0)),
    ):
        bpy.ops.object.light_add(type="AREA", location=location)
        light = bpy.context.object
        light.name = name
        light.data.energy = energy
        light.data.size = size
        light.data.color = color
        look_at(light, (0.6, 0.25, 1.1))

    bpy.ops.object.camera_add(location=(9.4, -11.4, 8.2))
    camera = bpy.context.object
    camera.name = "CameraRoomScaleCheck"
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 8.5
    look_at(camera, (0.60, 0.15, 1.18))
    scene.camera = camera
    scene.frame_set(1)
    scene.render.filepath = str(OUTPUT)
    bpy.ops.render.render(write_still=True)
    print(OUTPUT)


if __name__ == "__main__":
    main()
