"""Read-only inventory and reversible mechanical probes for Compa production assets.

Run inside Blender. These checks establish geometry, linkage and rig invariants;
they never substitute for reviewing the beauty, close-up and deformation renders.
"""
from __future__ import annotations

import json
import math
from collections import Counter

import bpy
from mathutils import Matrix, Vector, Quaternion
from mathutils.bvhtree import BVHTree


EXPECTED_BONES = (
    "root", "hips", "spine", "neck", "head",
    "upper_arm.L", "forearm.L", "hand.L",
    "upper_arm.R", "forearm.R", "hand.R",
    "thigh.L", "shin.L", "foot.L", "thigh.R", "shin.R", "foot.R",
)


def _matrix(value):
    return [[float(number) for number in row] for row in value]


def _max_matrix_error(left, right):
    return max(abs(left[row][col] - right[row][col]) for row in range(4) for col in range(4))


def _finite(value):
    return all(math.isfinite(number) for row in value for number in row)


def _rna_properties(item):
    """Capture simple RNA settings, including constraint/modifier targets."""
    values = {}
    for prop in item.bl_rna.properties:
        key = prop.identifier
        if key == "rna_type":
            continue
        try:
            value = getattr(item, key)
            if prop.type in {"BOOLEAN", "INT", "FLOAT", "STRING", "ENUM"}:
                values[key] = list(value) if prop.is_array else value
                if isinstance(values[key], set):
                    values[key] = sorted(values[key])
            elif prop.type == "POINTER":
                values[key] = value.name if value is not None and hasattr(value, "name") else None
        except (AttributeError, TypeError, ValueError):
            continue
    return values


def _properties(obj):
    result = {}
    for key in obj.keys():
        try:
            value = obj[key]
            if hasattr(value, "to_list"):
                value = value.to_list()
            elif hasattr(value, "to_dict"):
                value = value.to_dict()
            json.dumps(value)
            result[key] = value
        except (TypeError, ValueError):
            result[key] = str(obj[key])
    return result


def _is_character(obj, rig):
    parent = obj
    while parent is not None:
        if parent == rig:
            return True
        parent = parent.parent
    return any(mod.type == "ARMATURE" and mod.object == rig for mod in obj.modifiers)


def _character_meshes(rig):
    return sorted((obj for obj in bpy.context.scene.objects if obj.type == "MESH" and _is_character(obj, rig)), key=lambda obj: obj.name)


def _world_mesh(obj, depsgraph):
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    try:
        vertices = [evaluated.matrix_world @ vertex.co for vertex in mesh.vertices]
        faces = [tuple(face.vertices) for face in mesh.polygons]
        return vertices, faces
    finally:
        evaluated.to_mesh_clear()


def _bounds(objects):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    points = []
    for obj in objects:
        vertices, _ = _world_mesh(obj, depsgraph)
        points.extend(vertices)
    if not points:
        return None
    minimum = [min(point[axis] for point in points) for axis in range(3)]
    maximum = [max(point[axis] for point in points) for axis in range(3)]
    return {
        "minimum": minimum, "maximum": maximum,
        "dimensionsMeters": [maximum[axis] - minimum[axis] for axis in range(3)],
        "heightMeters": maximum[2] - minimum[2],
        "includesHairAndFootwear": True,
    }


def _mesh_inventory(obj, depsgraph):
    source = obj.data
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    try:
        mesh.calc_loop_triangles()
        edge_uses = Counter()
        for polygon in mesh.polygons:
            for edge_key in polygon.edge_keys:
                edge_uses[tuple(sorted(edge_key))] += 1
        evaluated_metrics = {
            "vertices": len(mesh.vertices), "edges": len(mesh.edges),
            "polygons": len(mesh.polygons), "triangles": len(mesh.loop_triangles),
            "nonFiniteVertices": sum(not all(math.isfinite(value) for value in vertex.co) for vertex in mesh.vertices),
            "zeroAreaPolygons": sum(polygon.area < 1e-12 for polygon in mesh.polygons),
            "boundaryEdges": sum(count == 1 for count in edge_uses.values()),
            "nonManifoldEdges": sum(count > 2 for count in edge_uses.values()),
        }
    finally:
        evaluated.to_mesh_clear()
    return {
        "name": obj.name, "meshDatablock": source.name,
        "sourceVertices": len(source.vertices), "sourceEdges": len(source.edges),
        "sourcePolygons": len(source.polygons), "evaluated": evaluated_metrics,
        "uvLayers": [{"name": uv.name, "activeRender": uv.active_render} for uv in source.uv_layers],
        "vertexGroups": [group.name for group in obj.vertex_groups],
        "weightedVertexCount": sum(bool(vertex.groups) for vertex in source.vertices),
        "weights": {
            "maxInfluences": max((len(vertex.groups) for vertex in source.vertices), default=0),
            "unnormalizedVertices": sum(bool(vertex.groups) and abs(sum(group.weight for group in vertex.groups) - 1.0) > 0.001 for vertex in source.vertices),
            "nonFiniteWeights": sum(not math.isfinite(group.weight) for vertex in source.vertices for group in vertex.groups),
        },
        "shapeKeys": [] if source.shape_keys is None else [
            {"name": key.name, "value": key.value, "vertices": len(key.data),
             "relativeKey": key.relative_key.name if key.relative_key else None}
            for key in source.shape_keys.key_blocks
        ],
        "materials": [material.name if material else None for material in source.materials],
        "modifiers": [_rna_properties(modifier) for modifier in obj.modifiers],
        "constraints": [_rna_properties(constraint) for constraint in obj.constraints],
        "parent": obj.parent.name if obj.parent else None,
        "parentType": obj.parent_type, "parentBone": obj.parent_bone,
        "matrixWorld": _matrix(obj.matrix_world),
        "matrixParentInverse": _matrix(obj.matrix_parent_inverse),
        "collections": sorted(collection.name for collection in obj.users_collection),
        "hideRender": obj.hide_render, "hideViewport": obj.hide_viewport,
        "properties": _properties(obj),
    }


def _bone_inventory(rig):
    return {
        bone.name: {
            "parent": bone.parent.name if bone.parent else None,
            "headLocal": list(bone.head_local), "tailLocal": list(bone.tail_local),
            "matrixLocal": _matrix(bone.matrix_local), "useConnect": bone.use_connect,
            "useDeform": bone.use_deform, "inheritScale": bone.inherit_scale,
            "constraints": [_rna_properties(item) for item in rig.pose.bones[bone.name].constraints],
        }
        for bone in rig.data.bones
    }


def audit_scene(rig):
    """Inventory the complete scene and measure evaluated character geometry."""
    if rig is None or rig.type != "ARMATURE":
        raise TypeError("audit_scene requires an armature object")
    bpy.context.view_layer.update()
    scene = bpy.context.scene
    depsgraph = bpy.context.evaluated_depsgraph_get()
    objects = sorted(scene.objects, key=lambda obj: obj.name)
    character_meshes = _character_meshes(rig)
    meshes = [_mesh_inventory(obj, depsgraph) for obj in objects if obj.type == "MESH"]
    character_names = {obj.name for obj in character_meshes}
    materials = []
    for material in sorted(bpy.data.materials, key=lambda mat: mat.name):
        nodes = material.node_tree.nodes if material.use_nodes else []
        materials.append({
            "name": material.name, "users": material.users,
            "baseColor": list(material.diffuse_color), "useNodes": material.use_nodes,
            "nodes": [{"name": node.name, "type": node.bl_idname,
                       "image": node.image.filepath if node.type == "TEX_IMAGE" and node.image else None}
                      for node in nodes],
            "proceduralTextureRequiresBakingForGltf": any(node.type in {"TEX_NOISE", "TEX_WAVE", "TEX_VORONOI"} for node in nodes),
        })
    declared_height = rig.get("compa_height_m")
    bounds = _bounds(character_meshes)
    mechanical_bindings = Counter()
    for obj in character_meshes:
        mechanical_bindings["rigidBoneParent" if obj.parent == rig and obj.parent_type == "BONE" else "armatureModifier" if any(mod.type == "ARMATURE" and mod.object == rig for mod in obj.modifiers) else "other"] += 1
    return {
        "schema": "compa-production-audit-v1", "blendFile": bpy.data.filepath,
        "blenderVersion": bpy.app.version_string,
        "scene": {"name": scene.name, "frame": scene.frame_current, "subframe": scene.frame_subframe,
                  "unitSystem": scene.unit_settings.system, "unitScale": scene.unit_settings.scale_length,
                  "renderEngine": scene.render.engine},
        "objects": [{"name": obj.name, "type": obj.type, "parent": obj.parent.name if obj.parent else None,
                     "matrixWorld": _matrix(obj.matrix_world), "constraints": [_rna_properties(item) for item in obj.constraints]}
                    for obj in objects],
        "meshes": meshes, "materials": materials,
        "collections": [{"name": col.name, "objects": sorted(obj.name for obj in col.objects),
                         "children": sorted(child.name for child in col.children)} for col in bpy.data.collections],
        "rig": {"name": rig.name, "dataName": rig.data.name, "bones": _bone_inventory(rig),
                "matrixWorld": _matrix(rig.matrix_world), "properties": _properties(rig),
                "posePosition": rig.data.pose_position, "poseBefore": _pose_json(rig),
                "action": rig.animation_data.action.name if rig.animation_data and rig.animation_data.action else None,
                "constraints": [_rna_properties(item) for item in rig.constraints]},
        "character": {"meshCount": len(character_meshes),
                      "sourceVertices": sum(mesh["sourceVertices"] for mesh in meshes if mesh["name"] in character_names),
                      "evaluatedTriangles": sum(mesh["evaluated"]["triangles"] for mesh in meshes if mesh["name"] in character_names),
                      "bounds": bounds, "declaredHeightMeters": declared_height,
                      "heightDifferenceMeters": bounds["heightMeters"] - declared_height if bounds and declared_height else None,
                      "bindings": dict(mechanical_bindings),
                      "slots": dict(Counter(obj.get("compa_slot", "unassigned") for obj in character_meshes)),
                      "uvComplete": all(obj.data.uv_layers for obj in character_meshes)},
        "limits": ["Geometry and numeric rig audit only; visual likeness and deformation quality require rendered review.",
                   "Declared height is compared with evaluated geometry including hairstyle and footwear.",
                   "Separate slot labels alone do not prove arbitrary garments fit or can be swapped in the app."],
    }


def _pose_json(rig):
    return {bone.name: {"rotationMode": bone.rotation_mode, "location": list(bone.location),
                        "rotationEuler": list(bone.rotation_euler), "rotationQuaternion": list(bone.rotation_quaternion),
                        "rotationAxisAngle": list(bone.rotation_axis_angle), "scale": list(bone.scale),
                        "matrixBasis": _matrix(bone.matrix_basis), "matrix": _matrix(bone.matrix)}
            for bone in rig.pose.bones}


def _pose_save(rig):
    return {bone.name: {"rotation_mode": bone.rotation_mode, "location": bone.location.copy(),
                        "rotation_euler": bone.rotation_euler.copy(), "rotation_quaternion": bone.rotation_quaternion.copy(),
                        "rotation_axis_angle": tuple(bone.rotation_axis_angle), "scale": bone.scale.copy()}
            for bone in rig.pose.bones}


def _pose_restore(rig, saved):
    for name, state in saved.items():
        bone = rig.pose.bones[name]
        bone.rotation_mode = state["rotation_mode"]
        for prop in ("location", "rotation_euler", "rotation_quaternion", "rotation_axis_angle", "scale"):
            setattr(bone, prop, state[prop])


def _neutral_pose(rig):
    for bone in rig.pose.bones:
        bone.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()


def _world_bones(rig):
    return {bone.name: rig.matrix_world @ bone.matrix for bone in rig.pose.bones}


def _inside_bvh(point, tree):
    """Parity ray test for a closed shell. Test result is sampled, not proof."""
    direction = Vector((0.8317, 0.3719, 0.4123)).normalized()
    origin = point.copy()
    hits = 0
    for _ in range(96):
        location, normal, index, distance = tree.ray_cast(origin, direction, 20.0)
        if location is None:
            return bool(hits % 2)
        hits += 1
        origin = location + direction * 0.000003
    return None


def _sleeve_samples(meshes):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    results = []
    for side in ("L", "R"):
        limb_bones = {f"upper_arm.{side}", f"forearm.{side}"}
        skins = [obj for obj in meshes if obj.get("compa_slot") == "body" and obj.parent_bone in limb_bones and not obj.hide_render]
        garments = [obj for obj in meshes if obj.get("compa_slot") == "top" and (obj.parent_bone in limb_bones or any(group.name in limb_bones for group in obj.vertex_groups)) and not obj.hide_render]
        trees = []
        open_shells = []
        for garment in garments:
            points, faces = _world_mesh(garment, depsgraph)
            edges = Counter()
            for face in faces:
                for index, vertex in enumerate(face):
                    edges[tuple(sorted((vertex, face[(index + 1) % len(face)])))] += 1
            if any(count != 2 for count in edges.values()):
                open_shells.append(garment.name)
            elif points and faces:
                trees.append(BVHTree.FromPolygons(points, faces))
        samples = []
        for skin in skins:
            points, _ = _world_mesh(skin, depsgraph)
            step = max(1, math.ceil(len(points) / 160))
            samples.extend(points[::step])
        outside = []
        if trees:
            for sample in samples:
                if not any(_inside_bvh(sample, tree) for tree in trees):
                    outside.append(sample)
        results.append({
            "side": side, "skinObjects": [obj.name for obj in skins],
            "garmentObjects": [obj.name for obj in garments], "sampleCount": len(samples),
            "closedShellCount": len(trees), "openShellObjects": open_shells,
            "outsideClosedShellSamples": len(outside) if trees else None,
            "outsideExamplePositions": [list(point) for point in outside[:8]],
            "status": "sampled" if samples and trees else "not_evaluable",
            "meaning": "Sampled skin vertices outside the union of closed sleeve shells. Open garments and hidden body regions require visual inspection; this is not a collision-free guarantee.",
        })
    return results


def validate_scene(rig, baseline=None):
    """Check structure and seven poses, restoring pose/action/NLA/frame in finally."""
    if rig is None or rig.type != "ARMATURE":
        raise TypeError("validate_scene requires an armature object")
    scene = bpy.context.scene
    bpy.context.view_layer.update()
    meshes = _character_meshes(rig)
    errors = []
    warnings = []
    names = set(rig.data.bones.keys())
    if names != set(EXPECTED_BONES):
        errors.append({"type": "bone_schema", "missing": sorted(set(EXPECTED_BONES) - names), "extra": sorted(names - set(EXPECTED_BONES))})
    if baseline:
        previous_bones = baseline["rig"]["bones"]
        current_bones = _bone_inventory(rig)
        if current_bones != previous_bones:
            errors.append({"type": "rest_rig_changed", "message": "Bone rest matrices, hierarchy, settings or constraints changed."})
    invalid_bindings = []
    for obj in meshes:
        if obj.parent == rig and obj.parent_type == "BONE" and obj.parent_bone not in names:
            invalid_bindings.append(obj.name)
        if not _finite(obj.matrix_world) or any(not all(math.isfinite(value) for value in vertex.co) for vertex in obj.data.vertices):
            errors.append({"type": "non_finite_mesh", "object": obj.name})
        if any(mod.type == "ARMATURE" and mod.object == rig for mod in obj.modifiers):
            invalid_weight_vertices = [vertex.index for vertex in obj.data.vertices if not vertex.groups or abs(sum(group.weight for group in vertex.groups) - 1.0) > 0.001]
            if invalid_weight_vertices:
                errors.append({"type": "invalid_armature_weights", "object": obj.name, "vertexCount": len(invalid_weight_vertices), "exampleIndices": invalid_weight_vertices[:12]})
        if obj.get("compa_slot") in {"back", "hand_prop"}:
            expected = {"spine"} if obj.get("compa_slot") == "back" else {"hand.L", "hand.R"}
            weighted = {group.name for group in obj.vertex_groups}
            if obj.parent_bone not in expected and not (weighted & expected):
                warnings.append({"type": "accessory_attachment", "object": obj.name, "slot": obj.get("compa_slot"), "bone": obj.parent_bone, "expected": sorted(expected)})
    if invalid_bindings:
        errors.append({"type": "invalid_bone_parent", "objects": invalid_bindings})
    poses = {
        "raised_arm": {"upper_arm.L": (0, 0, -1.10), "upper_arm.R": (0, 0, 1.10)},
        "elbow_90": {"forearm.L": (-math.pi / 2, 0, 0), "forearm.R": (-math.pi / 2, 0, 0)},
        "knee_70": {"shin.L": (1.22, 0, 0), "shin.R": (1.22, 0, 0)},
        "head_turn": {"head": (0.16, 0, 0.60)},
        "walking": {"thigh.L": (-0.50, 0, 0), "thigh.R": (0.50, 0, 0), "shin.L": (0.45, 0, 0), "upper_arm.L": (0.35, 0, 0), "upper_arm.R": (-0.35, 0, 0)},
        "hand_book_hold": {"forearm.L": (-1.10, 0, 0), "hand.L": (0.15, 0.35, 0.18)},
        "spine_backpack": {"spine": (0.30, 0.12, 0.15)},
    }
    # World-Y lift converted to mirrored local axes; local Z swings arms back.
    for side,angle in (('L',1.1),('R',-1.1)):
        name='upper_arm.'+side
        rest=rig.data.bones[name].matrix_local.to_quaternion()
        poses['raised_arm'][name]=tuple((rest.inverted() @ Quaternion((0,1,0),angle) @ rest).to_euler())
    saved_pose = _pose_save(rig)
    saved_json = _pose_json(rig)
    saved_basis = rig.matrix_basis.copy()
    saved_frame, saved_subframe = scene.frame_current, scene.frame_subframe
    saved_position = rig.data.pose_position
    animation = rig.animation_data
    saved_action = animation.action if animation else None
    saved_slot = getattr(animation, "action_slot", None) if animation else None
    nla_states = [(track, track.mute) for track in animation.nla_tracks] if animation else []
    pose_reports = []
    restoration = {}
    try:
        if animation:
            animation.action = None
            for track, _ in nla_states:
                track.mute = True
        rig.data.pose_position = "POSE"
        _neutral_pose(rig)
        neutral_bones = _world_bones(rig)
        neutral_objects = {obj.name: obj.matrix_world.copy() for obj in meshes}
        neutral_skin = _sleeve_samples(meshes)
        for label, changes in poses.items():
            _neutral_pose(rig)
            for bone_name, rotation in changes.items():
                if bone_name not in rig.pose.bones:
                    continue
                bone = rig.pose.bones[bone_name]
                bone.rotation_mode = "XYZ"
                bone.rotation_euler = rotation
            bpy.context.view_layer.update()
            posed_bones = _world_bones(rig)
            failures = []
            rigid_tested = 0
            moved = 0
            maximum_error = 0.0
            for obj in meshes:
                if not _finite(obj.matrix_world):
                    failures.append({"object": obj.name, "reason": "non_finite_transform"})
                if obj.parent == rig and obj.parent_type == "BONE" and obj.parent_bone in posed_bones:
                    rigid_tested += 1
                    expected = posed_bones[obj.parent_bone] @ neutral_bones[obj.parent_bone].inverted_safe() @ neutral_objects[obj.name]
                    difference = _max_matrix_error(expected, obj.matrix_world)
                    maximum_error = max(maximum_error, difference)
                    if difference > 0.00003:
                        failures.append({"object": obj.name, "reason": "rigid_follower_transform_mismatch", "maximumMatrixError": difference})
                    if _max_matrix_error(neutral_objects[obj.name], obj.matrix_world) > 0.0001:
                        moved += 1
            nonfinite_bones = [name for name, matrix in posed_bones.items() if not _finite(matrix)]
            if nonfinite_bones:
                failures.append({"reason": "non_finite_bone_transform", "bones": nonfinite_bones})
            if not moved and rigid_tested:
                failures.append({"reason": "no_rigid_followers_moved"})
            pose_reports.append({"pose": label, "anglesRadians": changes, "rigidFollowersTested": rigid_tested,
                                 "rigidFollowersMoved": moved, "maximumFollowerMatrixError": maximum_error,
                                 "passed": not failures, "failures": failures,
                                 "sleeveContainmentSamples": _sleeve_samples(meshes) if label in {"raised_arm", "elbow_90", "hand_book_hold"} else []})
            if failures:
                errors.append({"type": "pose_probe_failed", "pose": label, "failures": failures})
    finally:
        if animation:
            animation.action = saved_action
            if saved_slot is not None:
                animation.action_slot = saved_slot
            for track, muted in nla_states:
                track.mute = muted
        rig.data.pose_position = saved_position
        scene.frame_set(saved_frame, subframe=saved_subframe)
        rig.matrix_basis = saved_basis
        _pose_restore(rig, saved_pose)
        bpy.context.view_layer.update()
        current_json = _pose_json(rig)
        maximum_restoration_error = max((_max_matrix_error(state["matrixBasis"], current_json[name]["matrixBasis"]) for name, state in saved_json.items()), default=0.0)
        restoration = {
            "poseMatrixBasisMaxError": maximum_restoration_error,
            "rotationModesRestored": all(state["rotationMode"] == current_json[name]["rotationMode"] for name, state in saved_json.items()),
            "frameRestored": scene.frame_current == saved_frame and abs(scene.frame_subframe - saved_subframe) < 1e-6,
            "actionRestored": not animation or animation.action == saved_action,
            "actionSlotRestored": not animation or saved_slot is None or animation.action_slot == saved_slot,
            "nlaRestored": all(track.mute == muted for track, muted in nla_states),
            "posePositionRestored": rig.data.pose_position == saved_position,
            "rigTransformMaxError": _max_matrix_error(rig.matrix_basis, saved_basis),
        }
        if maximum_restoration_error > 0.000001 or not all(value for key, value in restoration.items() if key.endswith("Restored")):
            errors.append({"type": "state_restore_failed", "details": restoration})
    bounds = _bounds(meshes)
    declared = rig.get("compa_height_m")
    if bounds and declared and abs(bounds["heightMeters"] - declared) > 0.025:
        warnings.append({"type": "declared_height_differs_from_geometry", "declaredHeightMeters": declared, "measuredHeightMeters": bounds["heightMeters"], "differenceMeters": bounds["heightMeters"] - declared})
    slots = Counter(obj.get("compa_slot", "unassigned") for obj in meshes)
    if not slots.get("hand_prop"):
        warnings.append({"type": "missing_hand_prop_geometry", "message": "A declared hand_prop slot does not currently contain any geometry."})
    return {
        "schema": "compa-mechanical-validation-v1", "passed": not errors,
        "errors": errors, "warnings": warnings, "poses": pose_reports,
        "neutralSleeveContainmentSamples": neutral_skin, "stateRestoration": restoration,
        "measuredCharacterBounds": bounds, "slotObjectCounts": dict(slots),
        "rigIdentityPreserved": baseline is None or not any(error["type"] == "rest_rig_changed" for error in errors),
        "visualReviewStillRequired": True,
        "scope": "Finite transforms, 17-bone schema, unchanged rest rig, exact rigid follower motion, sampled closed-shell sleeve coverage, measured dimensions and state restoration. Weighted skin deformation and all collision-free garment combinations require separate visual and export validation.",
    }
