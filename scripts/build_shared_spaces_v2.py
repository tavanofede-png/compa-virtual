"""Reference-led shared environments. Native Blender/GLB geometry, staged for review.

Run with Blender --background --python scripts/build_shared_spaces_v2.py -- all.
The generated image panels become vertex-coloured scenery for decoder-free native
GLB loading. Objects, frames, foliage and furniture remain actual 3D geometry.
"""
import sys, math, json, random, types, importlib.util
from pathlib import Path
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
# Read the established geometry helpers without running its legacy export loop.
legacy=(ROOT/'scripts/build_shared_spaces.py').read_text(encoding='utf-8')
kit=types.ModuleType('shared_geometry');kit.__file__=str(ROOT/'scripts/build_shared_spaces.py')
exec(compile(legacy.split("selected=sys.argv[")[0],kit.__file__,'exec'),kit.__dict__)
STAGE=ROOT/'work/shared-spaces-v2'
RENDER=ROOT/'renders/shared-spaces-v2'
SOURCE=ROOT/'packages/assets/3d/source/shared-spaces/v2'
for p in (STAGE,RENDER,SOURCE):p.mkdir(parents=True,exist_ok=True)
TEXTURES=ROOT/'packages/assets/3d/textures/shared-spaces'

def scenic_panel(k,name,center,width,height,axis='back',kind='garden'):
    path=TEXTURES/(kind+'.png')
    if not path.exists():raise RuntimeError('Required authored backdrop is missing: '+str(path))
    img=bpy.data.images.load(str(path),check_existing=True)
    img.pack();img.use_fake_user=True
    sx,sy=img.size;pixels=list(img.pixels)
    # Shared vertices interpolate the source image instead of producing a
    # visibly pixelated checkerboard. No image decoder is needed in Expo.
    nx=512;ny=min(384,max(96,round(nx*height/width)))
    verts=[];faces=[];colors=[]
    x,y,z=center
    for row in range(ny+1):
        v=row/ny;py=min(sy-1,int(v*(sy-1)))
        for col in range(nx+1):
            u=col/nx;px=min(sx-1,int(u*(sx-1)));i=(py*sx+px)*4
            rgba=tuple(pixels[i:i+3])+(1,)
            h=u*width-width/2;vv=v*height-height/2
            verts.append((x+h,y,z+vv) if axis=='back' else (x,y+h,z+vv))
            colors.append(rgba)
    for row in range(ny):
        for col in range(nx):
            a=row*(nx+1)+col
            face=(a,a+1,a+nx+2,a+nx+1)
            faces.append(face if axis=='back' else tuple(reversed(face)))
    matname='Scenery vertex art'
    mat=bpy.data.materials.get(matname)
    if mat is None:
        mat=bpy.data.materials.new(matname);mat.use_nodes=True
        bsdf=mat.node_tree.nodes.get('Principled BSDF');attribute=mat.node_tree.nodes.new('ShaderNodeVertexColor');attribute.layer_name='COLOR_0'
        mat.node_tree.links.new(attribute.outputs['Color'],bsdf.inputs['Base Color'])
        mat.node_tree.links.new(attribute.outputs['Color'],bsdf.inputs['Emission Color'])
        bsdf.inputs['Emission Strength'].default_value=.38
        bsdf.inputs['Roughness'].default_value=1
    mesh=bpy.data.meshes.new(name+' coloured panorama');mesh.from_pydata(verts,[],faces);mesh.update()
    layer=mesh.color_attributes.new(name='COLOR_0',type='BYTE_COLOR',domain='POINT')
    for item,c in zip(layer.data,colors):item.color_srgb=c
    mesh.materials.append(mat)
    ob=bpy.data.objects.new(name,mesh);k.collection('DISTANT_WORLD').objects.link(ob)
    ob['scenic_panel']=True;ob['image_source']=path.name;ob['compa_room_category']='DISTANT_WORLD'
    return ob
kit.scenic_panel=scenic_panel

def floor(k,identifier):
    rng=random.Random(918)
    outdoor=identifier in ('patio','terrace')
    for i in range(9):
        if outdoor:base=(.56,.51,.43) if identifier=='patio' else (.40,.39,.44)
        elif identifier=='projects':base=(.53,.51,.47)
        else:base=(.64,.45,.27)
        delta=(i-4)*.019
        k.material('floor_'+str(i),'#'+''.join(f'{round(max(0,min(1,c+delta))*255):02x}' for c in base),.8)
    kit.box(k,'Foundation closed solid plinth',(0,0,-.13),(8.18,6.18,.25),'oak',.018)
    rows=24;depth=6/rows
    for row in range(rows):
        y=-3+(row+.5)*depth
        x=-4
        widths=[.45 if row%2 else 1.1]+[1.1]*8
        for w in widths:
            w=min(w,4-x)
            if w<=0:break
            name='Stone coursed paver' if outdoor or identifier=='projects' else 'Oak staggered floor plank'
            kit.box(k,name,(x+w/2,y,.006),(w-.008,depth-.007,.03),'floor_'+str(rng.randrange(9)),.004)
            if not outdoor and identifier!='projects':
                for j in range(2):
                    grainx=x+w*.18+rng.random()*w*.45
                    kit.box(k,'Fine timber grain',(grainx,y+(j-.5)*depth*.35,.022),(.10+rng.random()*.13,.0015,.0007),'oak',0)
            x+=w

def prepare_materials(k):
    for name,color in kit.COLORS.items():
        k.material(name,'#'+''.join(f'{round(c*255):02x}' for c in color),.68,.45 if name=='gold' else .03)
    for name,h in {'warm_white':'#ede6d7','linen':'#d6c8b3','brick':'#beb3a0','brick_dark':'#9a9285','navy':'#31475b','moss':'#677845','walnut':'#65452d','rust':'#bc6b3f','plum':'#605768','sky':'#a6c7d9','rose':'#cc8680'}.items():k.material(name,h,.77)
    for prefix,base in [('leaf',(.23,.39,.10)),('oak',(.53,.32,.13)),('paper',(.85,.80,.69))]:
        for i in range(6):
            delta=(i-2)*.035
            k.material(prefix+'_variant_'+str(i),'#'+''.join(f'{round(max(0,min(1,c+delta))*255):02x}' for c in base),.83)
    p=k.mat('light').node_tree.nodes.get('Principled BSDF');p.inputs['Emission Color'].default_value=(1,.68,.24,1);p.inputs['Emission Strength'].default_value=2.3

def bake_contact_tint(mesh):
    """Local, static ambient contact shading survives decoder-free GLB loading.

    Vertex colour stores only occlusion, not direct illumination; runtime lights
    still illuminate the material. A short radius avoids darkening entire walls.
    """
    points=[v.co.copy() for v in mesh.vertices]
    normals=[v.normal.copy().normalized() for v in mesh.vertices]
    tree=BVHTree.FromPolygons(points,[tuple(p.vertices) for p in mesh.polygons])
    layer=mesh.color_attributes.new(name='COLOR_0',type='BYTE_COLOR',domain='POINT')
    cache={};up=Vector((0,0,1));side=Vector((0,1,0));radius=.44
    rays=[(.32,0,.948),(-.32,0,.948),(0,.55,.835),(0,-.55,.835),(.61,.55,.57),(-.61,-.55,.57)]
    colours=[]
    for index,(p,n) in enumerate(zip(points,normals)):
        key=tuple(round(c/step) for seq,step in [(p,.012),(n,.20)] for c in seq)
        if key not in cache:
            t=n.cross(up if abs(n.z)<.95 else side).normalized();b=n.cross(t)
            origin=p+n*.008;occlusion=0
            for xx,yy,zz in rays:
                hit=tree.ray_cast(origin,(t*xx+b*yy+n*zz).normalized(),radius)
                if hit[0] is not None:occlusion+=1-hit[3]/radius
            cache[key]=max(.60,1-.40*occlusion/len(rays))
        c=cache[key];colours.extend((c,c,c,1))
    layer.data.foreach_set('color',colours)
    print('CONTACT_TINT_READY',len(points),len(cache),flush=True)

def export(path,reduced=False):
    scene=bpy.context.scene;deps=bpy.context.evaluated_depsgraph_get()
    verts=[];faces=[];matids=[];mats=[];lookup={};scenery=[]
    for ob in list(scene.objects):
        if ob.get('scenic_panel'):scenery.append(ob);continue
        if ob.type not in ('MESH','CURVE','FONT') or ob.name=='Studio floor':continue
        ev=ob.evaluated_get(deps);me=ev.to_mesh();offset=len(verts)
        verts.extend([ev.matrix_world@v.co for v in me.vertices]);local=[]
        for mat in me.materials:
            if mat.name not in lookup:lookup[mat.name]=len(mats);mats.append(mat)
            local.append(lookup[mat.name])
        for face in me.polygons:faces.append(tuple(offset+i for i in face.vertices));matids.append(local[face.material_index] if local else 0)
        ev.to_mesh_clear()
    mesh=bpy.data.meshes.new('Detailed environment');mesh.from_pydata(verts,[],faces);mesh.update()
    for m in mats:mesh.materials.append(m)
    for face,idx in zip(mesh.polygons,matids):face.material_index=idx
    model=bpy.data.objects.new('Shared environment v2',mesh);scene.collection.objects.link(model)
    bpy.ops.object.select_all(action='DESELECT');model.select_set(True);bpy.context.view_layer.objects.active=model
    if reduced:
        mod=model.modifiers.new('Mobile preserve silhouette','DECIMATE');mod.ratio=.62
        bpy.ops.object.modifier_apply(modifier=mod.name)
    bake_contact_tint(model.data)
    for ob in scenery:ob.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_animations=False,export_extras=True,export_vertex_color='NAME',export_vertex_color_name='COLOR_0',export_all_vertex_colors=False)
    return sum(len(p.vertices)-2 for ob in [model]+scenery for p in ob.data.polygons)

def render_setup(k,identifier):
    # Strong editorial wall lettering stays legible at room scale.
    fontpath=Path('C:/Windows/Fonts/arialbd.ttf')
    if fontpath.exists():
        font=bpy.data.fonts.load(str(fontpath),check_existing=True)
        for ob in bpy.context.scene.objects:
            if ob.type=='FONT':ob.data.font=font
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
    scene.render.resolution_x=1500;scene.render.resolution_y=1200;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.view_settings.look='AgX - Medium High Contrast'
    world=bpy.data.worlds.new('Warm miniature daylight');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.52,.58,.69,1);world.node_tree.nodes['Background'].inputs[1].default_value=.30 if identifier!='terrace' else .17;scene.world=world
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.265));bpy.context.object.name='Studio floor';bpy.context.object.data.materials.append(k.mat('cream'))
    def aim(o,target):o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
    for pos,power,size,col in [((-3,-4,8),1600,6,(1,.88,.73)),((5,-1,6),850,5,(.75,.85,1)),((0,5,7),1250,4,(1,.72,.43))]:
        bpy.ops.object.light_add(type='AREA',location=pos);o=bpy.context.object;o.data.energy=power*(.70 if identifier=='terrace' else 1);o.data.size=size;o.data.color=col;aim(o,(0,0,.5))
    bpy.ops.object.camera_add(location=(10,-13,10.2));cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=11.9;aim(cam,(0,0,1.2))
    return scene

def main():
    modules=dict(living='interiors',study='interiors',library='interiors',projects='projects',patio='exteriors',terrace='exteriors')
    builders=modules
    selected=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else list(builders)
    resume='--resume' in selected
    selected=[x for x in selected if x!='--resume']
    if 'all' in selected:selected=list(builders)
    for identifier in selected:
        source=SOURCE/(identifier+'-master.blend')
        if resume and identifier in ('living','projects') and source.exists():
            bpy.ops.wm.open_mainfile(filepath=str(source));seats=[json.loads(o['shared_anchor']) for o in bpy.context.scene.objects if o.get('shared_anchor')];seats.sort(key=lambda x:x['id'])
            inventory={}
            for ob in bpy.context.scene.objects:
                if ob.type in ('MESH','CURVE','FONT') and ob.name!='Studio floor':
                    key=ob.get('compa_room_category','ENVIRONMENT');inventory[key]=inventory.get(key,0)+1
            triangles=export(STAGE/(identifier+'.glb'))
            bpy.ops.wm.open_mainfile(filepath=str(source));reduced=export(STAGE/(identifier+'-reduced.glb'),True)
            meta={'id':identifier,'name':kit.NAMES[identifier],'version':2,'units':'metres','capacity':6,'bounds':[-3.9,-2.9,3.9,2.9],'anchors':seats,'triangles':triangles,'reducedTriangles':reduced,'source':str(source.relative_to(ROOT)),'inventory':inventory}
            (STAGE/(identifier+'.json')).write_text(json.dumps(meta,indent=2),encoding='utf-8')
            print('SHARED_SPACE_V2_READY',identifier,triangles,reduced,flush=True)
            continue
        bpy.ops.wm.read_factory_settings(use_empty=True);k=kit.RoomKit();prepare_materials(k);kit.R.seed(420+list(builders).index(identifier))
        module=__import__('shared_space_'+modules[identifier],fromlist=['build_'+identifier])
        floor(k,identifier);seats=[];getattr(module,'build_'+identifier)(k,seats,kit)
        if len(seats)!=6:raise RuntimeError(f'{identifier} must have exactly six authored anchors')
        for a in seats:
            ob=bpy.data.objects.new(a['id'],None);bpy.context.collection.objects.link(ob);x,z,ny=a['position'];ob.location=(x,-ny,z);ob['shared_anchor']=json.dumps(a)
        scene=render_setup(k,identifier);scene.render.filepath=str(RENDER/(identifier+'.png'))
        source=SOURCE/(identifier+'-master.blend')
        inventory={}
        for ob in scene.objects:
            if ob.type in ('MESH','CURVE','FONT') and ob.name!='Studio floor':
                key=ob.get('compa_room_category','ENVIRONMENT');inventory[key]=inventory.get(key,0)+1
        bpy.ops.wm.save_as_mainfile(filepath=str(source));bpy.ops.render.render(write_still=True)
        bpy.ops.wm.open_mainfile(filepath=str(source));triangles=export(STAGE/(identifier+'.glb'))
        bpy.ops.wm.open_mainfile(filepath=str(source));reduced=export(STAGE/(identifier+'-reduced.glb'),True)
        meta={'id':identifier,'name':kit.NAMES[identifier],'version':2,'units':'metres','capacity':6,'bounds':[-3.9,-2.9,3.9,2.9],'anchors':seats,'triangles':triangles,'reducedTriangles':reduced,'source':str(source.relative_to(ROOT)),'inventory':inventory}
        (STAGE/(identifier+'.json')).write_text(json.dumps(meta,indent=2),encoding='utf-8')
        print('SHARED_SPACE_V2_READY',identifier,triangles,reduced,flush=True)

if __name__=='__main__':main()
