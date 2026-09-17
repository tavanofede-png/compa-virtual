"""Lossless joint/index packing and normalized 8-bit skin weights, core glTF 2.0.

No compression extension or special loader is required. Position and normal
data are unchanged. Weight rounding distributes the remainder so each row sums
to exactly 255. Rigid weights are lossless; blended weights differ by < 1/255.
"""
import hashlib
import json
import struct
from pathlib import Path


def optimize_skin_attributes(path):
    path=Path(path)
    original=path.read_bytes()
    length=struct.unpack_from('<I',original,12)[0]
    gltf=json.loads(original[20:20+length])
    binary=original[28+length:]
    targets={}
    for mesh in gltf['meshes']:
        for primitive in mesh['primitives']:
            for semantic,index in primitive['attributes'].items():
                if semantic in ('JOINTS_0','WEIGHTS_0'):
                    targets[index]=semantic
            if 'indices' in primitive:targets[primitive['indices']]='indices'
    users={}
    for index,accessor in enumerate(gltf['accessors']):
        if 'bufferView' in accessor:users.setdefault(accessor['bufferView'],[]).append(index)
    replacements={}; changed=[]
    formats={5121:'B',5123:'H',5125:'I',5126:'f'}
    sizes={5121:1,5123:2,5125:4,5126:4}
    for index,semantic in targets.items():
        accessor=gltf['accessors'][index]
        view_id=accessor['bufferView']; view=gltf['bufferViews'][view_id]
        if len(users[view_id])!=1 or accessor.get('byteOffset',0)!=0 or 'byteStride' in view:
            continue
        component=accessor['componentType']
        if semantic in ('JOINTS_0','WEIGHTS_0') and component==5121:continue
        if semantic=='indices' and component!=5125:continue
        count=4 if accessor['type']=='VEC4' else 1
        start=view.get('byteOffset',0)
        values=struct.unpack_from('<'+formats[component]*(accessor['count']*count),binary,start)
        if semantic=='JOINTS_0':
            assert max(values)<256
            packed=bytes(values); new_component=5121
        elif semantic=='WEIGHTS_0':
            assert component==5126 and count==4
            packed=bytearray()
            for row in range(0,len(values),4):
                weights=values[row:row+4]; total=sum(weights)
                assert abs(total-1)<.0001
                scaled=[max(0,w)*255/total for w in weights]
                ints=[int(w) for w in scaled]
                residual=255-sum(ints)
                order=sorted(range(4),key=lambda k:scaled[k]-ints[k],reverse=True)
                for k in order[:residual]:ints[k]+=1
                assert sum(ints)==255
                packed.extend(ints)
            new_component=5121; accessor['normalized']=True
            accessor.pop('min',None);accessor.pop('max',None)
        else:
            if max(values)>=65536:continue
            packed=struct.pack('<'+'H'*len(values),*values);new_component=5123
        accessor['componentType']=new_component
        replacements[view_id]=packed
        changed.append({'accessor':index,'semantic':semantic,'from':component,'to':new_component})
    output=bytearray()
    for index,view in enumerate(gltf['bufferViews']):
        while len(output)%4:output.append(0)
        start=view.get('byteOffset',0)
        data=replacements.get(index,binary[start:start+view['byteLength']])
        view['byteOffset']=len(output);view['byteLength']=len(data)
        output.extend(data)
    while len(output)%4:output.append(0)
    gltf['buffers'][0]['byteLength']=len(output)
    encoded=json.dumps(gltf,separators=(',',':'),ensure_ascii=False).encode('utf-8')
    encoded+=b' '*((-len(encoded))%4)
    result=(struct.pack('<4sII',b'glTF',2,28+len(encoded)+len(output))+
            struct.pack('<I4s',len(encoded),b'JSON')+encoded+
            struct.pack('<I4s',len(output),b'BIN\0')+output)
    path.write_bytes(result)
    return {'bytesBefore':len(original),'bytesAfter':len(result),'packedAccessors':changed,
            'positionDataUnchanged':True,'maximumBlendWeightError':1/255,
            'compressionExtensionRequired':False}


if __name__=='__main__':
    root=Path(__file__).resolve().parents[2]
    assets=root/'packages/assets/3d'
    manifest_path=assets/'companion-collection.json'
    manifest=json.loads(manifest_path.read_text(encoding='utf-8'))
    for report in manifest['characters']:
        path=root/report['export']
        report['skinPacking']=optimize_skin_attributes(path)
        report['glbBytes']=path.stat().st_size
        report['glbSha256']=hashlib.sha256(path.read_bytes()).hexdigest()
        report_path=assets/f"source/{report['id']}-master-v4.report.json"
        report_path.write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')
        print('PACKED',report['id'],report['skinPacking']['bytesBefore'],report['glbBytes'])
    manifest_path.write_text(json.dumps(manifest,indent=2,ensure_ascii=False),encoding='utf-8')
