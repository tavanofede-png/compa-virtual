"""Build the full illustrated catalog, export canonical GLBs, dress eight masters.

Blender --background --python scripts/wardrobe_pipeline.py -- build|export|fit|render|sheets [character]
The preserved v4 sources are read-only inputs. No runtime app is modified.
"""
import bpy,sys,json,math,hashlib,argparse,bmesh
from pathlib import Path
from mathutils import Matrix,Vector,Quaternion
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools/blender'))
from wardrobe_catalog import CATALOG,CELLS,FAMILIES,ITEMS
from wardrobe_geometry import build_item
from build_companion_collection import CHARACTERS,create_rig,reset_scene
from build_harper import material,look_at
OUT=ROOT/'packages/assets/3d/wardrobe';SOURCE=OUT/'source';RENDERS=ROOT/'renders/wardrobe'
LIBRARY=SOURCE/'compa-wardrobe-library.blend'
OUTFITS={
'nova':['tee/white/planet','cargo/denim/plain','sneaker/pink/panel','crossbody/pink/label','glasses/pink/round'],
'jay':['varsity/red/a','cargo/black/orange-stitch','sneaker/red/panel','backpack/black/smile','watch/gold/analog'],
'milo':['hoodie/ivory/better-days','cargo/black/plain','sneaker/yellow/panel','cap/yellow/smile','crossbody/black/cat'],
'zoe':['sweater/ivory/cable','shorts/olive/cargo','boot/brown/hiker','glasses/gold/round','backpack/purple/plain'],
'sky':['utility/black/purple','cargo/ivory/chain','sneaker/purple/panel','beanie/gray/label','crossbody/black/checker'],
'harper':['sweater/green/stripe','cargo/tan/plain','boot/olive/hiker','glasses/black/rect','backpack/olive/plain'],
'river':['tee/blue/double-stripe','sportshorts/black/piping','sneaker/blue/panel','headphones/blue/cat','cap/blue/label'],
'aria':['puffer/ivory/label','cargo/black/orange-stitch','boot/yellow/hiker','bucket/green/flower','backpack/pink/plain']}
OUTFITS={k:[v.replace('/','-') for v in vals] for k,vals in OUTFITS.items()}

def write(path,data):
    path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
def hashfile(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def collection(name,parent=None):
    c=bpy.data.collections.new(name);(parent or bpy.context.scene.collection).children.link(c);return c
def reset_pose(rig):
    if rig.animation_data:rig.animation_data_clear()
    for bone in rig.pose.bones:bone.matrix_basis=Matrix.Identity(4);bone.rotation_mode='XYZ'
    bpy.context.view_layer.update()
def skin_audit(objects,rig):
    invalid=[];total=0;minsum=2.;maxsum=0.;groups=set()
    for o in objects:
        names={g.index:g.name for g in o.vertex_groups};groups.update(names.values())
        for v in o.data.vertices:
            total+=1;s=sum(g.weight for g in v.groups);minsum=min(s,minsum);maxsum=max(s,maxsum)
            if not all(math.isfinite(float(n)) for n in v.co) or abs(s-1)>1e-5:invalid.append([o.name,v.index])
    missing=groups-set(rig.data.bones.keys())
    return {'vertices':total,'weightSumRange':[minsum,maxsum],'invalidVertices':invalid[:12],'unknownBones':sorted(missing),'passed':not invalid and not missing}
def build():
    SOURCE.mkdir(parents=True,exist_ok=True);reset_scene('CYCLES');bpy.context.preferences.filepaths.save_version=0
    rig=create_rig(next(c for c in CHARACTERS if c.id=='harper'),collection('RIG'));rig.scale=(1,1,1)
    root=collection(f'WARDROBE_{len(CATALOG)}_ITEMS');records=[]
    for i,item in enumerate(CATALOG):
        c=collection('ITEM__'+item['id'],root);builder=build_item(item);objects=builder.finish(c,rig)
        # Record deterministic data and correct normals without changing topology.
        for o in objects:
            bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(o.data);bm.free()
        audit=skin_audit(objects,rig)
        if not audit['passed']:raise RuntimeError(item['id']+' invalid skin')
        c.asset_mark();c.asset_data.description=f"Compa Virtual | {item['family']} | {item['color']} | {item['design']} | compa-humanoid-v2"
        for tag in (item['family'],item['slot'],'Compa Virtual','voxel'):c.asset_data.tags.new(tag)
        c['compa_item']=item['id'];c['compa_slot']=item['slot'];c.hide_render=True;c.hide_viewport=True
        record={**item,'meshObjects':len(objects),'vertices':audit['vertices'],'triangles':sum(len(p.vertices)-2 for o in objects for p in o.data.polygons),'components':[o['compa_component'] for o in objects],'skinAudit':audit,'glb':f"glb/{item['id']}.glb",'sourceCollection':c.name}
        records.append(record)
        print('WARDROBE_ITEM',i+1,len(CATALOG),item['id'],record['vertices'],flush=True)
    # Friendly initial view contains an actual complete outfit; other assets stay in asset browser.
    for ident in OUTFITS['harper']:
        c=bpy.data.collections['ITEM__'+ident];c.hide_render=False;c.hide_viewport=False
    rig.show_in_front=False;studio((0,0,1.0),2.3)
    bpy.ops.wm.save_as_mainfile(filepath=str(LIBRARY),compress=True)
    manifest={'version':1,'rigSchema':'compa-humanoid-v2','uniqueItems':len(records),'illustratedCells':len(CELLS),'families':FAMILIES,'coverage':CELLS,'items':records,'sourceSha256':hashfile(LIBRARY),'units':'meters','bindRigScale':1,'frontAxis':'-Y','gltfFrontAxis':'+Z','runtimeIntegrated':False,'fitCharacters':[c.id for c in CHARACTERS],
    'layerRules':{'oneItemPerSlot':True,'outerwear':'Masks top torso, sleeves, hood and collar; outer garment includes its own construction. Keep top hem only if not clipping.','headwear':'Use fitted-hair collection, preserves lower fringe. Bun/ponytail portions above the band are compressed into the crown.','neck':'Headphones and necklace share a slot. Headphones are neck-worn to accommodate every hairstyle.','back':'Long rear hair uses a shoulder-length compressed back volume to clear backpack.','prop':'Independent meter-based props, default origin at supporting surface; only hand-size props may use hand.R mount.'},
    'bodyMasks':{'top':['Body_UpperArm_* except short-sleeve exposed section'],'bottom':['Body_Thigh_* except shorts exposed section'],'shoes':['feet'],'note':'Covered source limb geometry is hidden in fitted masters; visible elbow/forearm/shin remains for short clothes.'}}
    write(OUT/'catalog.json',manifest)
    print('WARDROBE_LIBRARY_DONE',len(records),flush=True)

def studio(target=(0,0,1),scale=2.25):
    scene=bpy.context.scene
    for o in list(scene.objects):
        if o.type in ('CAMERA','LIGHT') or o.name.startswith('WARDROBE_STUDIO'):bpy.data.objects.remove(o,do_unlink=True)
    # Hide legacy studio meshes while preserving character geometry.
    for o in scene.objects:
        if o.type=='MESH' and not o.get('compa_slot'):o.hide_render=True;o.hide_set(True)
    c=collection('WARDROBE_STUDIO')
    mat=material('WARDROBE_STUDIO_WARM','#DDD5CE',.85)
    mesh=bpy.data.meshes.new('WardrobeStudioFloor');mesh.from_pydata([(-100,-100,0),(100,-100,0),(100,100,0),(-100,100,0)],[],[(0,1,2,3)])
    o=bpy.data.objects.new('WARDROBE_STUDIO_FLOOR',mesh);c.objects.link(o);mesh.materials.append(mat);o.location.z=-.007
    camera=bpy.data.objects.new('WARDROBE_CAMERA',bpy.data.cameras.new('WardrobeCamera'));c.objects.link(camera)
    camera.location=Vector(target)+Vector((3,-7,2.25));camera.data.type='ORTHO';camera.data.ortho_scale=scale;look_at(camera,target);scene.camera=camera
    for name,loc,power,size,color in [('KEY',(-3,-4,5),500,4,(1,.83,.67)),('FILL',(4,-2,3),350,3,(.74,.85,1)),('RIM',(2,3,4),700,3,(1,.82,.64))]:
        data=bpy.data.lights.new('WARDROBE_'+name,'AREA');data.energy=power;data.shape='DISK';data.size=size;data.color=color
        ob=bpy.data.objects.new(data.name,data);c.objects.link(ob);ob.location=loc;look_at(ob,target)
    scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.30,.32,.38,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.30
    scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True;scene.cycles.max_bounces=5
    scene.view_settings.look='AgX - Medium High Contrast';scene.render.image_settings.file_format='PNG'
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=='VIEW_3D':area.spaces.active.region_3d.view_perspective='CAMERA'

def export():
    bpy.ops.wm.open_mainfile(filepath=str(LIBRARY));rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');reset_pose(rig)
    (OUT/'glb').mkdir(parents=True,exist_ok=True);manifest=json.loads((OUT/'catalog.json').read_text(encoding='utf-8'))
    for c in bpy.data.collections:
        if c.name.startswith('ITEM__'):c.hide_viewport=True;c.hide_render=True
    bpy.context.view_layer.update();bpy.ops.object.select_all(action='DESELECT')
    for i,item in enumerate(manifest['items']):
        selected_collection=bpy.data.collections[item['sourceCollection']];selected_collection.hide_viewport=False
        bpy.context.view_layer.update();objects=list(selected_collection.objects)
        for o in [rig,*objects]:o.hide_set(False);o.select_set(True)
        bpy.context.view_layer.objects.active=rig;path=OUT/item['glb']
        bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_animations=False,export_extras=True,export_apply=True,export_yup=True)
        from premium_glb import optimize_skin_attributes
        item['skinPacking']=optimize_skin_attributes(path)
        for o in [rig,*objects]:o.select_set(False)
        selected_collection.hide_viewport=True
        item['glbBytes']=path.stat().st_size;item['glbSha256']=hashfile(path)
        print('EXPORTED_WARDROBE',i+1,len(manifest['items']),item['id'],flush=True)
    write(OUT/'catalog.json',manifest)

def fit_hair(rig,use_hat,use_back):
    changed=0;inv=rig.matrix_world.inverted()
    # Shape a cap-compatible copy in canonical coordinates, never edit v4 source.
    for o in bpy.context.scene.objects:
        if o.type!='MESH' or o.get('compa_slot')!='hair':continue
        M=inv@o.matrix_world;back=M.inverted()
        if use_hat or use_back:
            o.data=o.data.copy()
            for v in o.data.vertices:
                p=M@v.co;original=p.copy()
                if use_hat and p.z>1.80:
                    p.z=1.80+(p.z-1.80)*.44
                    if abs(p.x)>.305:p.x=math.copysign(.305+(abs(p.x)-.305)*.25,p.x)
                    p.y=max(-.245,min(.23,p.y))
                if use_back and p.z<1.32 and p.y>.115:
                    p.z=1.32+(p.z-1.32)*.10;p.y=min(p.y,.145)
                if (p-original).length>1e-7:v.co=back@p;changed+=1
    return changed

def fitted(character,chosen=None,destination=None):
    path=ROOT/f'packages/assets/3d/source/{character.id}-master-v4.blend';sourcehash=hashfile(path)
    bpy.ops.wm.open_mainfile(filepath=str(path));rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');reset_pose(rig)
    original_rig=rig.name;rig.name='AVATAR_RIG_'+character.id
    for o in bpy.context.scene.objects:
        if o.type=='MESH' and o.get('compa_slot') not in ('body','hair'):
            o.hide_render=True;o.hide_set(True)
        if o.name.startswith(('Accessory_','Cap_','Beanie_')):o.hide_render=True;o.hide_set(True)
    # Harper's source left hand was sculpted around notebooks. A clothing preview
    # needs a neutral grip; mirror the already detailed right hand on hand.L.
    if character.id=='harper':
        handcoll=collection('WARDROBE_NEUTRAL_HAND');inv=rig.matrix_world.inverted()
        for o in list(bpy.context.scene.objects):
            if o.type!='MESH' or not o.name.startswith('Premium_Hand_'):continue
            if o.parent_bone=='hand.L':o.hide_render=True;o.hide_set(True)
            if o.parent_bone!='hand.R':continue
            mesh=o.data.copy();M=inv@o.matrix_world
            for v in mesh.vertices:
                p=M@v.co;p.x=-p.x;v.co=p
            for p in mesh.polygons:p.flip()
            dup=bpy.data.objects.new('Neutral_Left_'+o.name,mesh);handcoll.objects.link(dup);dup.parent=rig
            g=dup.vertex_groups.new(name='hand.L');g.add(list(range(len(mesh.vertices))),1,'REPLACE');mod=dup.modifiers.new('Neutral grip','ARMATURE');mod.object=rig;dup['compa_slot']='body'
    chosen=chosen or OUTFITS[character.id]
    if len(set(chosen))!=len(chosen) or any(i not in ITEMS for i in chosen):raise ValueError('Invalid wardrobe IDs')
    slots=[ITEMS[i]['slot'] for i in chosen if ITEMS[i]['slot']!='prop']
    if len(slots)!=len(set(slots)):raise ValueError('Choose one wearable per slot')
    if not ({'bottom','shoes'}<=set(slots) and ('top' in slots or 'outerwear' in slots)):
        raise ValueError('An outfit requires top or outerwear, bottom and shoes')
    with bpy.data.libraries.load(str(LIBRARY),link=False) as (src,dst):dst.collections=['ITEM__'+i for i in chosen]
    outfits=collection('WARDROBE_EQUIPPED')
    objects=[];orphan_rigs=set()
    for c in dst.collections:
        outfits.children.link(c);c.hide_viewport=False;c.hide_render=False
        for o in c.objects:
            if o.parent and o.parent!=rig:orphan_rigs.add(o.parent)
            o.parent=rig;o.matrix_parent_inverse=Matrix.Identity(4);o.matrix_basis=Matrix.Identity(4)
            for mod in o.modifiers:
                if mod.type=='ARMATURE':mod.object=rig
            o.hide_render=False;o.hide_set(False);objects.append(o)
    if 'outerwear' in slots and 'top' in slots:
        for o in objects:
            if o.get('compa_slot')=='top':o.hide_render=True;o.hide_set(True)
    for r in orphan_rigs:
        if r.type=='ARMATURE':bpy.data.objects.remove(r,do_unlink=True)
    # Remove native head accessories according to their stored slot, not name alone.
    for o in bpy.context.scene.objects:
        if o.type=='MESH' and o.get('compa_slot')=='face_accessory' and o not in objects:o.hide_render=True;o.hide_set(True)
    has_hat=any(ITEMS[i]['slot']=='headwear' for i in chosen);has_back=any(ITEMS[i]['slot']=='back' for i in chosen)
    changed=fit_hair(rig,has_hat,has_back)
    # True exposed limbs remain on tee/shorts outfits; long clothing masks only
    # the hidden old limb shells to guarantee no skin pokes through at joints.
    tee=any(ITEMS[i]['family']=='tee' for i in chosen);shorts=any(ITEMS[i]['family'] in ('shorts','sportshorts') for i in chosen)
    masks=[]
    for o in bpy.context.scene.objects:
        if o.type!='MESH' or o.get('compa_slot')!='body':continue
        covered=any(x in o.name for x in ('Body_UpperArm','Body_Forearm','Body_Thigh','Body_Shin'))
        if covered:o.hide_render=True;o.hide_set(True);masks.append(o.name)
    from wardrobe_body_fit import create_limb_shell
    skin_objects=create_limb_shell(character,rig,collection('WARDROBE_CONTINUOUS_BODY'))
    for o in skin_objects:
        bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(o.data);bm.free()
        if ('__arm_' in o.name and not tee) or ('__leg_' in o.name and not shorts):o.hide_render=True;o.hide_set(True)
    objects.extend(skin_objects)
    bpy.context.view_layer.update()
    audit=skin_audit(objects,rig)
    # Fit QA: all garment vertices are in rig bind space and use same 17 bones.
    measurement=json.loads((OUT/'body-measurements.json').read_text(encoding='utf-8'))[character.id]
    expected=Matrix(measurement['rigMatrix']);delta=max(abs(rig.matrix_world[i][j]-expected[i][j]) for i in range(4) for j in range(4))
    assert delta<1e-6 and audit['passed']
    pose_results=[]
    for pose,rotations in [('rest',{}),('elbows90',{'forearm.L':(-1.5708,0,0),'forearm.R':(-1.5708,0,0)}),('walk',{'thigh.L':(-.40,0,0),'thigh.R':(.4,0,0),'shin.R':(.75,0,0),'upper_arm.L':(.30,0,0),'upper_arm.R':(-.30,0,0)}),('reach',{'upper_arm.R':(.3,.18,-.65),'forearm.R':(-.8,0,0)})]:
        reset_pose(rig)
        for name,rot in rotations.items():rig.pose.bones[name].rotation_euler=rot
        bpy.context.view_layer.update();dep=bpy.context.evaluated_depsgraph_get();bad=0
        for o in objects:
            ev=o.evaluated_get(dep);mesh=ev.to_mesh()
            bad+=sum(not all(math.isfinite(float(x)) for x in v.co) for v in mesh.vertices)
            ev.to_mesh_clear()
        pose_results.append({'pose':pose,'finite':bad==0})
    reset_pose(rig);studio((0,0,character.height*.51),character.height*1.25)
    rig.show_in_front=False
    target=destination or SOURCE/f'{character.id}-wardrobe-fitted.blend';bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(target),compress=True)
    assert sourcehash==hashfile(path)
    report={'character':character.id,'outfit':chosen,'sourceUnchanged':True,'sourceSha256':sourcehash,'fitScale':list(rig.scale),'rigMatrixDelta':delta,'bones':len(rig.data.bones),'skin':audit,'poses':pose_results,'hatHairAdjustedVertices':changed,'bodyMasks':masks,'scope':'Bind alignment and normalized skin validated; visual pose review is separate. Arbitrary animation collision is not certified.','fittedMasterSha256':hashfile(target)}
    write(OUT/(f'fit/custom/{character.id}.json' if destination else f'fit/{character.id}.json'),report)
    print('FITTED_WARDROBE',character.id,flush=True)

def render(character,pose=False):
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE/f'{character.id}-wardrobe-fitted.blend'))
    scene=bpy.context.scene;rig=next(o for o in scene.objects if o.type=='ARMATURE');reset_pose(rig)
    if pose:
        rig.pose.bones['forearm.R'].rotation_euler=(-1.4,0,0);rig.pose.bones['upper_arm.R'].rotation_euler=(.12,0,-.3)
        rig.pose.bones['shin.L'].rotation_euler=(.45,0,0);bpy.context.view_layer.update()
    scene.render.resolution_x=1000;scene.render.resolution_y=1200;scene.render.resolution_percentage=100
    scene.cycles.samples=24;scene.render.filepath=str(RENDERS/(character.id+('-pose' if pose else '')+'.png'));RENDERS.mkdir(parents=True,exist_ok=True)
    bpy.ops.render.render(write_still=True)
    print('WARDROBE_RENDERED',character.id,pose,flush=True)

def sheets(group):
    groups={
    'remeras':['tee','longsleeve'],'buzos':['hoodie','sweatshirt'],'tejidos-camperas':['sweater','varsity','puffer','denimjacket','shearling','utility'],
    'pantalones-calzado':['cargo','trackpants','shorts','sportshorts','sneaker','boot'],'bolsos':['backpack','crossbody'],
    'gorras-accesorios':['cap','beanie','bucket','glasses','headphones','watch','bracelet','necklace','belt','wristband','pin','carabiner','charm','keyring','ring'],
    'objetos':['books','laptop','frame','mug','bottle','phone','camera','pouch','plant','lamp','trophy','tablet','planner','pen','postits','penholder','clock','gamepad','console','soccer','basketball','keyboard','sketchbook','skateboard','guitar','medal']}
    selected=[i for i in CATALOG if i['family'] in groups[group]]
    bpy.ops.wm.open_mainfile(filepath=str(LIBRARY));rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');reset_pose(rig)
    for c in bpy.data.collections:
        if c.name.startswith('ITEM__'):c.hide_viewport=False;c.hide_render=True
    stage=collection('WARDROBE_SHEET');cols=6;rows=math.ceil(len(selected)/cols)
    for idx,item in enumerate(selected):
        objs=list(bpy.data.collections['ITEM__'+item['id']].objects)
        points=[v.co for o in objs for v in o.data.vertices];low=Vector(tuple(min(p[j] for p in points) for j in range(3)));high=Vector(tuple(max(p[j] for p in points) for j in range(3)));center=(low+high)/2
        size=high-low;scale=min(.82/max(size.x,.001),.82/max(size.z,.001))
        # Preserve each item's proportions; display scale is editorial only.
        x=(idx%cols-(cols-1)/2)*1.1;z=(rows-1-idx//cols)*1.18+.65
        turn=math.pi-.16 if item['family']=='backpack' else -.16
        M=Matrix.Translation((x,0,z))@Matrix.Rotation(turn,4,'Z')@Matrix.Scale(scale,4)@Matrix.Translation(-center)
        for o in objs:
            dup=bpy.data.objects.new('SHEET_'+o.name,o.data);stage.objects.link(dup);dup.matrix_world=M;dup['compa_slot']='display'
        font=bpy.data.curves.new('Caption','FONT');font.body=item['id'].replace('-',' ').upper();font.align_x='CENTER';font.size=min(.042,.96/max(1,len(font.body))*.90);font.extrude=0
        text=bpy.data.objects.new('CAPTION_'+item['id'],font);stage.objects.link(text);text.location=(x,-.05,z-.53);text.rotation_euler=(math.pi/2,0,0)
        font.materials.append(material('CAPTION_INK','#302E36',.9))
    studio((0,0,rows*.59),max(6.95,rows*1.18+.2))
    backdrop=bpy.data.meshes.new('SheetBackdrop');backdrop.from_pydata([(-8,2,-1),(8,2,-1),(8,2,rows*1.3+3),(-8,2,rows*1.3+3)],[],[(3,2,1,0)])
    ob=bpy.data.objects.new('SHEET_BACKDROP',backdrop);stage.objects.link(ob);backdrop.materials.append(material('SHEET_WARM','#DDD5CE',.88))
    # studio hides only untagged meshes, while copied product meshes are tagged.
    cam=bpy.context.scene.camera;cam.location=(0,-16,rows*.59+.05);look_at(cam,(0,0,rows*.59));cam.data.ortho_scale=max(6.85,rows*1.18)
    scene=bpy.context.scene;scene.render.resolution_x=2400;scene.render.resolution_y=round(2400*rows*1.18/6.85);scene.render.resolution_percentage=100;scene.cycles.samples=16
    if '--eevee' in sys.argv:
        scene.render.engine='BLENDER_EEVEE';scene.eevee.taa_render_samples=32;scene.eevee.use_raytracing=False
    scene.frame_set(2);bpy.context.view_layer.update()
    scene.render.filepath=str(RENDERS/(group+'.png'));RENDERS.mkdir(parents=True,exist_ok=True)
    bpy.ops.render.render(write_still=True)
    write(RENDERS/(group+'.json'),{'group':group,'items':[i['id'] for i in selected],'pixels':[scene.render.resolution_x,scene.render.resolution_y],'engine':scene.render.engine})
    print('SHEET_DONE',group,flush=True)

if __name__=='__main__':
    args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
    command=args[0];ident=args[1] if len(args)>1 else 'all'
    if command=='build':build()
    elif command=='export':export()
    elif command=='sheets':
        for group in (['remeras','buzos','tejidos-camperas','pantalones-calzado','bolsos','gorras-accesorios','objetos'] if ident=='all' else [ident]):sheets(group)
    else:
        for c in CHARACTERS:
            if ident in ('all',c.id):
                if command=='fit':fitted(c)
                elif command=='render':render(c)
                elif command=='pose':render(c,True)
                else:raise ValueError(command)
