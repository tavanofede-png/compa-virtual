"""Read-only geometry gate: six authored seats have actual supporting surfaces."""
import bpy,json,sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
IDS=['living','study','library','projects','patio','terrace']
results=[]
for identifier in IDS:
    metadata=json.loads((ROOT/'work/shared-spaces-v2'/f'{identifier}.json').read_text())
    bpy.ops.wm.open_mainfile(filepath=str(ROOT/metadata['source']))
    scene=bpy.context.scene;deps=bpy.context.evaluated_depsgraph_get()
    rows=[]
    for a in metadata['anchors']:
        x,height,neg_y=a['position']
        contacts=[]
        # A slatted bench legitimately has a gap under its exact centre. Test
        # the pelvis footprint, not a single infinitesimal point.
        for dx,dy in [(-.08,-.06),(.08,-.06),(-.08,.06),(.08,.06)]:
            hit,point,normal,index,obj,matrix=scene.ray_cast(deps,Vector((x+dx,-neg_y+dy,.94)),Vector((0,0,-1)),distance=1)
            if hit and .32<point.z<.73 and normal.z>.5:contacts.append({'surface':obj.name,'height':round(point.z,3)})
        valid=len(contacts)>=2
        rows.append({'seat':a['id'],'validSupport':valid,'contactCount':len(contacts),'contacts':contacts,'anchorHeight':height})
    result={'id':identifier,'valid':all(r['validSupport'] for r in rows),'seats':rows}
    results.append(result);print('SEAT_GEOMETRY',json.dumps(result),flush=True)
path=ROOT/'renders/shared-spaces-v2/geometry-validation.json'
path.write_text(json.dumps(results,indent=2),encoding='utf8')
if not all(r['valid'] for r in results):raise RuntimeError('A seat has no valid physical support; see '+str(path))
