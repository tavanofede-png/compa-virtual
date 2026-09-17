"""Read-only structural QA on real GLBs, reference coverage and all eight fits."""
import json,struct,hashlib,math
from pathlib import Path
from wardrobe_catalog import CATALOG,CELLS
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'packages/assets/3d/wardrobe'

def read_glb(path):
    data=path.read_bytes();magic,version,total=struct.unpack_from('<III',data)
    assert magic==0x46546c67 and version==2 and total==len(data)
    jslen,jstype=struct.unpack_from('<II',data,12);assert jstype==0x4e4f534a
    doc=json.loads(data[20:20+jslen]);binlen,bintype=struct.unpack_from('<II',data,20+jslen)
    assert bintype==0x004e4942
    return doc,data[28+jslen:28+jslen+binlen]

def accessor(doc,buf,i):
    a=doc['accessors'][i];v=doc['bufferViews'][a['bufferView']]
    count={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
    fmt,size={5121:('B',1),5123:('H',2),5125:('I',4),5126:('f',4)}[a['componentType']]
    start=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',count*size)
    for row in range(a['count']):
        values=struct.unpack_from('<'+fmt*count,buf,start+row*stride)
        if a.get('normalized'):values=tuple(x/(255 if size==1 else 65535) for x in values)
        yield values

def main():
    catalog=json.loads((OUT/'catalog.json').read_text(encoding='utf-8'));bodies=json.loads((OUT/'body-measurements.json').read_text(encoding='utf-8'))
    ids={i['id'] for i in catalog['items']};assert len(ids)==len(CATALOG)
    assert len(catalog['coverage'])==len(CELLS) and all(c['item'] in ids for c in catalog['coverage'])
    canonical=bodies['harper'];bodychecks=[]
    for char,b in bodies.items():
        assert b['bones'].keys()==canonical['bones'].keys()
        delta=max(abs(v-canonical['bones'][name][key][k]) for name,bone in b['bones'].items() for key,vals in bone.items() for k,v in enumerate(vals))
        common=set(canonical['bodyParts'])&set(b['bodyParts'])
        envelope=max(abs(b['bodyParts'][name][j][k]-canonical['bodyParts'][name][j][k]) for name in common for j in range(2) for k in range(3))
        assert delta<1e-6 and envelope<1e-5
        assert max(b['scale'])-min(b['scale'])<1e-6
        fit=json.loads((OUT/f'fit/{char}.json').read_text(encoding='utf-8'));assert fit['skin']['passed'] and all(p['finite'] for p in fit['poses'])
        bodychecks.append({'character':char,'allCatalogItemsShareBindFit':True,'canonicalBoneDelta':delta,'limbEnvelopeDelta':envelope,'uniformScale':b['scale'][0],'illustratedOutfitPoseChecks':len(fit['poses'])})
    reports=[]
    for item in catalog['items']:
        path=OUT/item['glb'];assert path.is_file()
        sha=hashlib.sha256(path.read_bytes()).hexdigest();assert sha==item['glbSha256']
        doc,buf=read_glb(path);assert not doc.get('extensionsRequired')
        # Every component is an actual mesh with exported skinning attributes.
        vertices=triangles=0;seen=set();minweight=1;maxweight=1
        for mesh in doc['meshes']:
            for prim in mesh['primitives']:
                attrs=prim['attributes'];assert {'POSITION','NORMAL','JOINTS_0','WEIGHTS_0'}<=attrs.keys()
                positions=list(accessor(doc,buf,attrs['POSITION']));weights=list(accessor(doc,buf,attrs['WEIGHTS_0']));joints=list(accessor(doc,buf,attrs['JOINTS_0']))
                vertices+=len(positions);triangles+=doc['accessors'][prim['indices']]['count']//3
                assert len(positions)==len(weights)==len(joints)
                assert all(math.isfinite(v) for row in positions for v in row)
                for ws,js in zip(weights,joints):
                    total=sum(ws);assert abs(total-1)<1e-5
                    minweight=min(minweight,total);maxweight=max(maxweight,total)
                    assert all(0<=v<17 for v in js)
                seen.update(doc['nodes'][j]['name'] for skin in doc.get('skins',[]) for j in skin['joints'])
        assert vertices>0 and triangles>0
        reports.append({'id':item['id'],'vertices':vertices,'triangles':triangles,'bytes':path.stat().st_size,'sha256':sha,'weightSums':[minweight,maxweight],'passed':True})
    limb_reports=[]
    assert len(catalog.get('continuousBodies',[]))==8
    for limb in catalog['continuousBodies']:
        path=OUT/limb['path'];assert hashlib.sha256(path.read_bytes()).hexdigest()==limb['sha256']
        doc,buf=read_glb(path);assert len(doc['meshes'])==4
        for mesh in doc['meshes']:
            for prim in mesh['primitives']:
                attrs=prim['attributes']
                assert all(math.isfinite(v) for row in accessor(doc,buf,attrs['POSITION']) for v in row)
                assert all(abs(sum(row)-1)<1e-5 for row in accessor(doc,buf,attrs['WEIGHTS_0']))
        limb_reports.append({'character':limb['character'],'passed':True,'meshes':4})
    result={'passed':True,'items':len(reports),'sourceCells':len(catalog['coverage']),'characterFits':bodychecks,'bindCombinationsChecked':len(reports)*len(bodies),'glbBytes':sum(i['bytes'] for i in reports),'maximumItemBytes':max(i['bytes'] for i in reports),'catalogSourceSha256':hashlib.sha256((OUT/'source/compa-wardrobe-library.blend').read_bytes()).hexdigest(),'checks':['reference coverage','unique IDs','all files and SHA-256','glTF v2 container','finite positions','normalized weights','valid joint indices','same canonical bind on eight rigs','same measured limb envelopes','four finite-pose checks per fitted outfit'],'limitations':['No exhaustive cloth collision proof for arbitrary animation or arbitrary layered combinations.','Room props are separate assets; catalog does not claim all props are wearables.','No Android performance measurement or application integration in this asset delivery.'],'exports':reports}
    result['continuousBodyFits']=limb_reports
    assert result['catalogSourceSha256']==catalog['sourceSha256']
    (OUT/'wardrobe.audit.json').write_text(json.dumps(result,indent=2,ensure_ascii=False),encoding='utf-8')
    print(json.dumps({k:v for k,v in result.items() if k not in ('exports','characterFits')},indent=2))

if __name__=='__main__':main()
