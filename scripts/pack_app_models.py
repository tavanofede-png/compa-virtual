"""Quantize normals only, retaining all positions and geometry. KHR_mesh_quantization.
The signed normal approximation has at most 1/127 error per component.
"""
import json,struct,hashlib,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];A=ROOT/'packages/assets/3d/app'
sys.path.insert(0,str(ROOT/'tools/blender'))
from premium_glb import optimize_skin_attributes

def pack(path):
    optimize_skin_attributes(path)
    raw=path.read_bytes();length=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+length]);binary=raw[28+length:]
    replacement={}
    for mesh in g['meshes']:
        for primitive in mesh['primitives']:
            index=primitive['attributes'].get('NORMAL')
            if index is None:continue
            a=g['accessors'][index];v=g['bufferViews'][a['bufferView']]
            if a['componentType']!=5126:continue
            assert not a.get('byteOffset',0) and not v.get('byteStride')
            values=struct.unpack_from('<'+'f'*a['count']*3,binary,v.get('byteOffset',0));data=bytearray()
            # 4-byte vertex stride keeps vertex attribute alignment valid.
            for i in range(0,len(values),3):data.extend(struct.pack('<bbbB',*(max(-127,min(127,round(x*127))) for x in values[i:i+3]),0))
            replacement[a['bufferView']]=data;v['byteStride']=4;a['componentType']=5120;a['normalized']=True;a.pop('min',None);a.pop('max',None)
    output=bytearray()
    for index,v in enumerate(g['bufferViews']):
        while len(output)%4:output.append(0)
        data=replacement.get(index,binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]);v['byteOffset']=len(output);v['byteLength']=len(data);output.extend(data)
    while len(output)%4:output.append(0)
    g['buffers'][0]['byteLength']=len(output)
    for key in ['extensionsUsed','extensionsRequired']:g[key]=list(dict.fromkeys(g.get(key,[])+['KHR_mesh_quantization']))
    enc=json.dumps(g,separators=(',',':')).encode();enc+=b' '*(-len(enc)%4)
    path.write_bytes(struct.pack('<4sII',b'glTF',2,28+len(enc)+len(output))+struct.pack('<I4s',len(enc),b'JSON')+enc+struct.pack('<I4s',len(output),b'BIN\0')+output)
    return {'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'positionsUnchanged':True,'normalComponentError':1/127}

manifest=json.loads((A/'all-export.json').read_text(encoding='utf-8'))
for record in manifest['characters']+manifest['rooms']:
    record.update(pack(A/record['file']));print(record['file'],record['bytes'])
(A/'all-export.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
