from __future__ import annotations

import json
import sys
from pathlib import Path

import bpy


def main() -> None:
    output = Path(sys.argv[-1]) if "--" in sys.argv else Path(bpy.data.filepath).with_suffix(".audit.json")
    rig = next((obj for obj in bpy.data.objects if obj.type == "ARMATURE"), None)
    if rig is None:
        raise RuntimeError("No armature found")
    meshes = [obj for obj in bpy.data.objects if obj.type == "MESH"]
    original_pose = {
        bone.name: {
            "rotation_mode": bone.rotation_mode,
            "rotation": tuple(bone.rotation_euler),
            "location": tuple(bone.location),
        }
        for bone in rig.pose.bones
    }
    probes = {}
    for bone_name in ("upper_arm.L", "upper_arm.R", "thigh.L", "head", "spine"):
        bone = rig.pose.bones.get(bone_name)
        if bone is None:
            continue
        followers = [obj for obj in meshes if obj.parent == rig and obj.parent_bone == bone_name]
        before = [tuple(round(v, 6) for row in obj.matrix_world for v in row) for obj in followers]
        bone.rotation_mode = "XYZ"
        bone.rotation_euler[1] += 0.12
        bpy.context.view_layer.update()
        after = [tuple(round(v, 6) for row in obj.matrix_world for v in row) for obj in followers]
        probes[bone_name] = {"followers": len(followers), "movesWithBone": before != after}
        saved = original_pose[bone_name]
        bone.rotation_mode = saved["rotation_mode"]
        bone.rotation_euler = saved["rotation"]
        bone.location = saved["location"]
        bpy.context.view_layer.update()

    report = {
        "file": bpy.data.filepath,
        "objects": len(bpy.data.objects),
        "meshes": len(meshes),
        "armature": rig.name,
        "bones": [bone.name for bone in rig.data.bones],
        "modifiers": {obj.name: [modifier.type for modifier in obj.modifiers] for obj in meshes if obj.modifiers},
        "materials": sorted({slot.material.name for obj in meshes for slot in obj.material_slots if slot.material}),
        "parenting": {
            "boneParentedMeshes": sum(1 for obj in meshes if obj.parent == rig and obj.parent_type == "BONE"),
            "unparentedMeshes": sum(1 for obj in meshes if obj.parent is None),
        },
        "vertexGroups": {obj.name: [group.name for group in obj.vertex_groups] for obj in meshes if obj.vertex_groups},
        "constraints": {bone.name: [constraint.type for constraint in bone.constraints] for bone in rig.pose.bones if bone.constraints},
        "rigScale": list(rig.scale),
        "cameras": [obj.name for obj in bpy.data.objects if obj.type == "CAMERA"],
        "lights": [obj.name for obj in bpy.data.objects if obj.type == "LIGHT"],
        "collections": [collection.name for collection in bpy.data.collections],
        "poseProbes": probes,
        "poseRestored": all(
            tuple(rig.pose.bones[name].rotation_euler) == tuple(saved["rotation"])
            and tuple(rig.pose.bones[name].location) == tuple(saved["location"])
            for name, saved in original_pose.items()
        ),
    }
    output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
