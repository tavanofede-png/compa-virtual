import sys,bpy,bmesh,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
import wardrobe_pipeline as p
args=sys.argv[sys.argv.index('--')+1:]
if args[0]=='outfits':
    for ident,pose in [('nova',False),('nova',True),('milo',True)]:p.render(next(c for c in p.CHARACTERS if c.id==ident),pose)
elif args[0]=='sheets':
    for group in ['remeras','buzos','tejidos-camperas','pantalones-calzado','gorras-accesorios','objetos']:p.sheets(group)
elif args[0]=='updated-sheets':
    for group in ['buzos','tejidos-camperas','bolsos','gorras-accesorios']:p.sheets(group)
elif args[0]=='fit':
    for c in p.CHARACTERS:p.fitted(c)
elif args[0] in ('patch-raglan','patch-beanies','patch-items'):
    from wardrobe_geometry import build_item
    from premium_glb import optimize_skin_attributes
    bpy.ops.wm.open_mainfile(filepath=str(p.LIBRARY));rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
    identifiers=(['longsleeve-brown-raglan-star'] if args[0]=='patch-raglan' else [i['id'] for i in p.CATALOG if i['family']=='beanie'] if args[0]=='patch-beanies' else args[1:])
    created={}
    for ident in identifiers:
        coll=bpy.data.collections['ITEM__'+ident]
        for o in list(coll.objects):bpy.data.objects.remove(o,do_unlink=True)
        objs=build_item(p.ITEMS[ident]).finish(coll,rig);created[ident]=objs
        for o in objs:
            bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(o.data);bm.free()
    bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(p.LIBRARY),compress=True)
    catalog=json.loads((p.OUT/'catalog.json').read_text(encoding='utf-8'));catalog['sourceSha256']=p.hashfile(p.LIBRARY)
    for ident,objs in created.items():
        item=next(i for i in catalog['items'] if i['id']==ident);audit=p.skin_audit(objs,rig);assert audit['passed']
        item['vertices']=audit['vertices'];item['triangles']=sum(len(q.vertices)-2 for o in objs for q in o.data.polygons);item['skinAudit']=audit
        bpy.data.collections['ITEM__'+ident].hide_viewport=False;bpy.context.view_layer.update();bpy.ops.object.select_all(action='DESELECT')
        for o in [rig,*objs]:o.select_set(True)
        bpy.context.view_layer.objects.active=rig;path=p.OUT/item['glb']
        bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_animations=False,export_apply=True,export_extras=True)
        item['skinPacking']=optimize_skin_attributes(path);item['glbBytes']=path.stat().st_size;item['glbSha256']=p.hashfile(path)
    p.write(p.OUT/'catalog.json',catalog)
else:raise ValueError(args)
