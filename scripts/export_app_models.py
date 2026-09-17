"""Export visible Blender detail in material batches for the actual app.
Source masters stay unchanged. Bodies use the same bind space as wardrobe GLBs.
"""
import bpy,sys,json,hashlib
from pathlib import Path
from mathutils import Matrix
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'));sys.path.insert(0,str(ROOT/'tools/blender'))
import wardrobe_pipeline as p
from premium_glb import optimize_skin_attributes
OUT=ROOT/'packages/assets/3d/app';OUT.mkdir(exist_ok=True)

def batch(objects,rig=None):
    dep=bpy.context.evaluated_depsgraph_get();groups={};inverse=rig.matrix_world.inverted() if rig else Matrix.Identity(4)
    for obj in objects:
        slot=obj.get('compa_slot','room');component=obj.get('compa_component',slot)
        if slot=='body':
            component=component if component.startswith(('arm_','leg_')) else 'body'
        elif slot=='hair':component='hair'
        elif not rig:component='room'
        ev=obj.evaluated_get(dep);mesh=ev.to_mesh();M=inverse@obj.matrix_world
        names={g.index:g.name for g in obj.vertex_groups}
        weights=[]
        for v in mesh.vertices:
            if obj.parent_type=='BONE':weights.append({obj.parent_bone:1})
            else:weights.append({names[g.group]:g.weight for g in v.groups if g.group in names})
        bymat={}
        for poly in mesh.polygons:bymat.setdefault(poly.material_index,[]).append(poly)
        for index,polys in bymat.items():
            evaluated_material=mesh.materials[index] if mesh.materials else None
            # Evaluated materials can be invalidated by to_mesh_clear().
            mat=bpy.data.materials.get(evaluated_material.name) if evaluated_material else None
            key=(component,mat.name if mat else 'default')
            data=groups.setdefault(key,{'verts':[],'faces':[],'weights':[],'mat':mat})
            used=sorted({i for poly in polys for i in poly.vertices});offset=len(data['verts']);mapping={old:offset+i for i,old in enumerate(used)}
            data['verts'].extend(tuple(M@mesh.vertices[i].co) for i in used)
            if rig:data['weights'].extend(weights[i] for i in used)
            data['faces'].extend(tuple(mapping[i] for i in poly.vertices) for poly in polys)
        ev.to_mesh_clear()
    result=[]
    coll=p.collection('APP_EXPORT_BATCHES')
    for (component,material),data in groups.items():
        mesh=bpy.data.meshes.new(component+'_'+material);mesh.from_pydata(data['verts'],[],data['faces']);mesh.update()
        if data['mat']:mesh.materials.append(data['mat'])
        o=bpy.data.objects.new(mesh.name,mesh);coll.objects.link(o);o['compa_component']=component
        if rig:
            o.parent=rig;o.matrix_parent_inverse=Matrix.Identity(4);o.matrix_basis=Matrix.Identity(4)
            for bone in rig.data.bones:
                group=o.vertex_groups.new(name=bone.name)
                for idx,w in enumerate(data['weights']):
                    if w.get(bone.name,0)>0:group.add([idx],w[bone.name],'REPLACE')
            mod=o.modifiers.new('App skin','ARMATURE');mod.object=rig
        result.append(o)
    return result

def export_file(path,objects,rig=None):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in [*objects,*([rig] if rig else [])]:obj.hide_set(False);obj.hide_render=False;obj.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_animations=False,export_extras=True,export_apply=True)
    if rig:optimize_skin_attributes(path)
    return {'file':path.name,'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'batches':len(objects)}

def character(c):
    # No hat or backpack in this base: runtime derives hair fits from the original.
    p.fitted(c,['tee-white-planet','shorts-olive-cargo','sneaker-red-panel'],OUT/(c.id+'-base-editable.blend'))
    rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
    sources=[o for o in bpy.context.scene.objects if o.type=='MESH' and not o.hide_render and o.get('compa_slot') in ('body','hair')]
    batches=batch(sources,rig);record=export_file(OUT/(c.id+'-body.glb'),batches,rig)
    record.update({'id':c.id,'rigScale':list(rig.scale),'height':c.height})
    print('APP_BODY',json.dumps(record),flush=True);return record

def room(id):
    source=ROOT/'room_cozy_premium.blend' if id=='cozy' else ROOT/f'packages/assets/3d/source/rooms/{id}-master-v1.blend'
    bpy.ops.wm.open_mainfile(filepath=str(source));anchor=bpy.data.objects.get('Companion_RoomAnchor')
    excluded=set(anchor.children_recursive) if anchor else set()
    sources=[o for o in bpy.context.scene.objects if o.type=='MESH' and not o.hide_render and o not in excluded and not o.name.startswith(('Studio','STUDIO','Ground','Backdrop'))]
    batches=batch(sources);record=export_file(OUT/(id+'-room.glb'),batches)
    record.update({'id':id,'objects':len(sources),'anchorBlender':list(anchor.location) if anchor else [0,0,.18]})
    print('APP_ROOM',json.dumps(record),flush=True);return record

if __name__=='__main__':
    args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['all']
    report={}
    if args[0] in ('all','characters'):report['characters']=[character(c) for c in p.CHARACTERS]
    if args[0] in ('all','rooms'):report['rooms']=[room(id) for id in ['cozy','minimalista','tecnologia','naturaleza','urbano','biblioteca-moderna']]
    (OUT/(args[0]+'-export.json')).write_text(json.dumps(report,indent=2),encoding='utf-8')
