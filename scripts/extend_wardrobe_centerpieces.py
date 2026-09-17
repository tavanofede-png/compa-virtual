"""Add the five distinct outfits/accessories worn by the central reference figures."""
import sys,bpy,bmesh,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
import wardrobe_pipeline as p
from wardrobe_geometry import build_item
from premium_glb import optimize_skin_attributes
bpy.ops.wm.open_mainfile(filepath=str(p.LIBRARY));rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
root=next(c for c in bpy.data.collections if c.name.startswith('WARDROBE_') and c.name.endswith('_ITEMS'));root.name=f'WARDROBE_{len(p.CATALOG)}_ITEMS'
catalog=json.loads((p.OUT/'catalog.json').read_text(encoding='utf-8'));existing={i['id'] for i in catalog['items']};added=[]
for item in p.CATALOG:
    if item['id'] in existing:continue
    coll=p.collection('ITEM__'+item['id'],root);objects=build_item(item).finish(coll,rig)
    for o in objects:
        bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(o.data);bm.free()
    audit=p.skin_audit(objects,rig);assert audit['passed']
    coll.asset_mark();coll.asset_data.description=f"Compa Virtual | {item['family']} | central reference figure"
    for tag in (item['family'],item['slot'],'Compa Virtual'):coll.asset_data.tags.new(tag)
    coll['compa_item']=item['id'];coll['compa_slot']=item['slot'];coll.hide_render=True;coll.hide_viewport=True
    record={**item,'meshObjects':len(objects),'vertices':audit['vertices'],'triangles':sum(len(q.vertices)-2 for o in objects for q in o.data.polygons),'components':[o['compa_component'] for o in objects],'skinAudit':audit,'glb':f"glb/{item['id']}.glb",'sourceCollection':coll.name}
    catalog['items'].append(record);added.append((record,coll,objects))
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(p.LIBRARY),compress=True)
catalog.update({'uniqueItems':len(p.CATALOG),'illustratedCells':len(p.CELLS),'coverage':p.CELLS,'families':p.FAMILIES,'sourceSha256':p.hashfile(p.LIBRARY)})
for record,coll,objects in added:
    coll.hide_viewport=False;bpy.context.view_layer.update();bpy.ops.object.select_all(action='DESELECT')
    for o in [rig,*objects]:o.select_set(True)
    bpy.context.view_layer.objects.active=rig;path=p.OUT/record['glb']
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_animations=False,export_apply=True,export_extras=True)
    record['skinPacking']=optimize_skin_attributes(path);record['glbBytes']=path.stat().st_size;record['glbSha256']=p.hashfile(path)
    coll.hide_viewport=True
p.write(p.OUT/'catalog.json',catalog);print('CENTRAL_FIGURE_ITEMS_ADDED',len(added),'TOTAL',len(catalog['items']),flush=True)
