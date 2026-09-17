"""Create a self-contained review/reproduction archive from verified real outputs."""
import hashlib
import json
import struct
import zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
REPORT=ROOT/'packages/assets/3d/source/cozy-modern-master-v2.report.json'
report=json.loads(REPORT.read_text(encoding='utf-8'))
images={}
for name,size in [('hero',(2400,1800)),('desk',(1600,1400)),('bed',(1600,1400)),('lounge',(1600,1400))]:
    path=ROOT/'renders/room-cozy-premium'/f'{name}.png'
    data=path.read_bytes()
    assert data[:8]==b'\x89PNG\r\n\x1a\n'
    dimensions=struct.unpack('>II',data[16:24]);assert dimensions==size,(name,dimensions)
    images[name]={'width':dimensions[0],'height':dimensions[1],'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
assert report.get('portability',{}).get('sourceOriginalUnchanged')
report['renderFilesVerified']=images
report['reviewStatus']='Rendered and visually reviewed: hero, desk, bed and lounge. Original source preserved.'
REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
files=[
    'room_cozy_premium.blend','scripts/room_premium_pipeline.py','docs/ROOM_COZY_PREMIUM_V2.md',
    'packages/assets/3d/source/cozy-modern-master-v1.blend',
    'packages/assets/3d/source/cozy-modern-master-v2.report.json',
    'packages/assets/3d/compa-harper-premium.glb',
    'tools/blender/build_harper.py','tools/blender/build_cozy_room.py',
    'tools/blender/review_room_delivery.py','tools/blender/package_room_delivery.py',
]
files.extend('tools/blender/room_premium_'+name+'.py' for name in ('common','architecture','textiles','study','botanicals','personal_props'))
files.extend('renders/room-cozy-premium/'+name+'.png' for name in images)
for relative in files:assert (ROOT/relative).is_file(),relative
manifest={relative:hashlib.sha256((ROOT/relative).read_bytes()).hexdigest() for relative in files}
output=ROOT/'deliverables/compa-virtual-cozy-v2.zip';output.parent.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(output,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
    for relative in files:archive.write(ROOT/relative,relative)
    archive.writestr('SHA256.json',json.dumps(manifest,indent=2))
    archive.writestr('LEEME.txt','Compa Virtual - Habitación Cozy v2\n\nAbrí room_cozy_premium.blend en Blender 5.2.\nLos renders están en renders/room-cozy-premium.\nEl maestro es editable y contiene a Harper en su propia colección.\nLas instrucciones y decisiones están en docs/ROOM_COZY_PREMIUM_V2.md.\nEl paquete incluye los scripts y los dos assets de entrada para reproducir la escena.\n')
with zipfile.ZipFile(output) as archive:assert archive.testzip() is None
print(json.dumps({'archive':str(output),'bytes':output.stat().st_size,'files':len(files)+2,'renders':images},indent=2))
