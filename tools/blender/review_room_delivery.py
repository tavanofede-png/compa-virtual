"""Verify portable room data and save the camera-friendly viewport state."""
import hashlib
import json
from pathlib import Path
import bpy

ROOT=Path(__file__).resolve().parents[2]
MASTER=ROOT/'room_cozy_premium.blend'
VERSION=ROOT/'packages/assets/3d/source/cozy-modern-master-v2.blend'
REPORT=ROOT/'packages/assets/3d/source/cozy-modern-master-v2.report.json'
bpy.ops.wm.open_mainfile(filepath=str(MASTER))
report=json.loads(REPORT.read_text(encoding='utf-8'))
blocker=bpy.data.objects['Studio_Ceiling_LightBlocker']
blocker.hide_set(True)
assert not blocker.hide_render
assert not blocker.visible_camera
assert bpy.context.scene.camera.name=='Camera_Cozy_Hero'
assert not list(bpy.data.libraries),'Delivery must be self-contained'
missing=[]
for img in bpy.data.images:
    if img.source=='FILE' and not img.packed_file and not Path(bpy.path.abspath(img.filepath)).is_file():missing.append(img.name)
assert not missing,missing
avatar=bpy.data.objects['Companion_RoomAnchor']
assert abs(avatar['compa_reference_height_m']-1.74)<.01
assert abs(avatar['compa_foot_contact_z']-.18)<.002
assert len(report['modules']['botanicals']['plants'])==18
original=ROOT/Path(report['sourceOriginal']['path'])
assert hashlib.sha256(original.read_bytes()).hexdigest()==report['sourceOriginal']['sha256']
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(VERSION),compress=True)
bpy.ops.wm.save_as_mainfile(filepath=str(MASTER),compress=True)
report['masterSha256']=hashlib.sha256(MASTER.read_bytes()).hexdigest()
report['blendBytes']=MASTER.stat().st_size
report['portability']={'linkedLibraries':0,'missingExternalImages':missing,'viewportRoofHidden':True,'sourceOriginalUnchanged':True}
REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print('ROOM_DELIVERY_PORTABLE',json.dumps(report['portability']),flush=True)
