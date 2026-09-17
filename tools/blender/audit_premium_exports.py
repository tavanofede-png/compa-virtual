"""Reimport the shipped GLBs into fresh Blender scenes; measure the actual files."""
import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
ASSETS=ROOT/'packages/assets/3d'
sys.path.insert(0,str(ROOT/'tools/blender'))
from build_companion_collection import CHARACTERS

results=[]
for character in CHARACTERS:
    path=ASSETS/f'compa-{character.id}-premium.glb'
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    scene=bpy.context.scene
    scene.frame_set(1)
    # Blender's importer adds an Icosphere as a bone display shape; it is not
    # geometry from the GLB. Only authored nodes carry the wardrobe metadata.
    meshes=[o for o in scene.objects if o.type=='MESH' and o.get('compa_slot')]
    rigs=[o for o in scene.objects if o.type=='ARMATURE']
    assert len(rigs)==1, f'{character.id}: expected one rig'
    rig=rigs[0]
    assert len(rig.data.bones)==17, f'{character.id}: wrong bone count'
    def bounds():
        dep=bpy.context.evaluated_depsgraph_get()
        points=[]
        for obj in meshes:
            evaluated=obj.evaluated_get(dep)
            mesh=evaluated.to_mesh()
            points.extend(evaluated.matrix_world @ v.co for v in mesh.vertices)
            evaluated.to_mesh_clear()
        assert all(all(math.isfinite(v) for v in p) for p in points)
        low=[min(p[i] for p in points) for i in range(3)]
        high=[max(p[i] for p in points) for i in range(3)]
        return {'minimum':low,'maximum':high,'heightMeters':high[2]-low[2]}
    measured=bounds()
    assert abs(measured['heightMeters']-character.height)<.01,(character.id,measured)
    assert abs(measured['minimum'][2])<.01,(character.id,'floor')
    invalid_weights=0;blended_vertices=0;slots={};weighted_sleeves=[]
    for obj in meshes:
        slot=obj.get('compa_slot')
        assert slot in ('body','hair','face_accessory','top','bottom','shoes','back','hand_prop'),obj.name
        slots[slot]=slots.get(slot,0)+1
        for vertex in obj.data.vertices:
            weights=[g.weight for g in vertex.groups if g.weight>1e-6]
            if not weights or abs(sum(weights)-1)>1e-4:invalid_weights+=1
            if len(weights)>1:blended_vertices+=1
        if obj.get('compa_weighted_garment'):weighted_sleeves.append(obj.name)
    assert invalid_weights==0,(character.id,invalid_weights)
    assert len(weighted_sleeves)==2,(character.id,weighted_sleeves)
    assert blended_vertices>0,(character.id,'lost sleeve blending')
    frames=[]
    for frame in (1,24,48,72,96):
        scene.frame_set(frame)
        frames.append({'frame':frame,**bounds()})
    record={'id':character.id,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
            'rigs':1,'bones':17,'meshCount':len(meshes),'slots':slots,
            'measuredBounds':measured,'declaredHeightMeters':character.height,
            'invalidWeightVertices':invalid_weights,'blendedVertices':blended_vertices,
            'weightedSleeves':weighted_sleeves,'animationFrames':frames,'passed':True}
    results.append(record)
    print('ROUND_TRIP_OK',character.id,round(measured['heightMeters'],5),blended_vertices,flush=True)
out=ASSETS/'source/collection-v4-export.audit.json'
out.write_text(json.dumps({'schema':'compa-export-roundtrip-v1','characters':results},indent=2),encoding='utf-8')
print('EXPORT_AUDIT_SAVED',out,flush=True)
