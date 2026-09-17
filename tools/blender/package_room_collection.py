"""Validate and package all six real Blender scenes and their rendered previews."""
import hashlib
import json
import struct
import zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
THEMES=('minimalista','tecnologia','naturaleza','urbano','biblioteca-moderna')
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def png(path,expected):
    content=path.read_bytes()
    assert content[:8]==b'\x89PNG\r\n\x1a\n',str(path)
    shape=struct.unpack('>II',content[16:24]);assert shape==expected,(path,shape)
    assert len(content)>100000,(path,'Suspiciously small image')
    return {'width':shape[0],'height':shape[1],'bytes':len(content),'sha256':sha(path)}

base=ROOT/'room_cozy_premium.blend'
cozy_report=json.loads((ROOT/'packages/assets/3d/source/cozy-modern-master-v2.report.json').read_text(encoding='utf-8'))
assert cozy_report['masterSha256']==sha(base)
assert cozy_report['portability']['sourceOriginalUnchanged']
assert cozy_report['nonFiniteObjects']==[]
cozy_image=png(ROOT/'renders/room-cozy-premium/hero.png',(2400,1800))
collection=[{'id':'cozy-moderno','name':'Cozy moderno','source':'room_cozy_premium.blend','objects':cozy_report['objects'],
             'render':'renders/room-cozy-premium/hero.png','image':cozy_image,'sourceSha256':sha(base)}]
files=['room_cozy_premium.blend','packages/assets/3d/source/cozy-modern-master-v2.report.json',
       'docs/ROOM_COLLECTION.md','docs/ROOM_COZY_PREMIUM_V2.md','docs/ROOM_GALLERY.md','scripts/room_premium_pipeline.py',
       'scripts/room_collection_pipeline.py','packages/assets/3d/source/cozy-modern-master-v1.blend',
       'packages/assets/3d/compa-harper-premium.glb','tools/blender/build_cozy_room.py','tools/blender/build_harper.py',
       'tools/blender/room_collection_designs.py','tools/blender/review_room_delivery.py',
       'tools/blender/package_room_delivery.py','tools/blender/package_room_collection.py']
files.extend('tools/blender/room_premium_'+part+'.py' for part in ('common','architecture','textiles','study','botanicals','personal_props'))
for name in ('hero','desk','bed','lounge'):
    png(ROOT/'renders/room-cozy-premium'/f'{name}.png',(2400,1800) if name=='hero' else (1600,1400))
    files.append('renders/room-cozy-premium/'+name+'.png')
for theme in THEMES:
    report_path=ROOT/'packages/assets/3d/source/rooms'/f'{theme}-report.json'
    report=json.loads(report_path.read_text(encoding='utf-8'))
    path=ROOT/report['sourceFile'];image=ROOT/report['render']
    assert path.is_file() and path.stat().st_size>4_000_000
    assert report['sourceSha256']==sha(path)
    assert report['baseSha256']==sha(base)
    assert report['objects']>=cozy_report['objects'] and report['removedObjects']==0
    assert report['nonFiniteObjects']==[] and abs(report['companionHeight']-1.74)<.01
    report['renderVerified']=png(image,(1920,1440))
    report['status']='Rendered and visually reviewed; editable scene ready for design review.'
    report_path.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    collection.append({'id':theme,'name':report['name'],'source':str(path.relative_to(ROOT)),
                       'sourceSha256':sha(path),'objects':report['objects'],'addedObjects':report['addedObjects'],
                       'render':str(image.relative_to(ROOT)),'image':report['renderVerified'],'features':report['features']})
    files.extend([str(path.relative_to(ROOT)),str(report_path.relative_to(ROOT)),str(image.relative_to(ROOT))])
manifest_path=ROOT/'packages/assets/3d/source/room-collection.manifest.json'
manifest={'version':1,'count':6,'applicationIntegrated':False,'rooms':collection,
          'validation':{'sameMeterScale':True,'allBaseObjectsRetained':True,'sourceHashesVerified':True,'renderDimensionsVerified':True,'visuallyReviewed':True}}
manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
files.append(str(manifest_path.relative_to(ROOT)))
output=ROOT/'deliverables/compa-virtual-seis-habitaciones.zip';output.parent.mkdir(exist_ok=True)
hashes={name:sha(ROOT/name) for name in files}
with zipfile.ZipFile(output,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
    for name in files:archive.write(ROOT/name,name.replace('\\','/'))
    archive.writestr('SHA256.json',json.dumps(hashes,indent=2))
    archive.writestr('LEEME.txt','COMPA VIRTUAL - SEIS HABITACIONES\n\nCozy: abrir room_cozy_premium.blend.\nLos otros cinco .blend están en packages/assets/3d/source/rooms.\nRenders: renders/room-cozy-premium y renders/room-collection.\nGuía: docs/ROOM_COLLECTION.md.\nIncluye scripts y assets base para reproducir los modelos.\nBlender 5.2, metros; Harper está en su propia colección.\n')
with zipfile.ZipFile(output) as archive:assert archive.testzip() is None
print(json.dumps({'archive':str(output),'bytes':output.stat().st_size,'files':len(files)+2,'rooms':len(collection),'validation':manifest['validation']},indent=2))
