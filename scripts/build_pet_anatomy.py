"""Anatomical pet revision: cohesive volumes, inset eyes and surface coat markings.

No fur particles, random tufts or human eyebrows. Coordinates are authored in
Blender Z-up and exported through the existing semantic animation contract.
Run with -- hamster orange-tabby, or -- all. Outputs stay in staging until QA.
"""
import bpy
import math
import json
import sys
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from build_pet_mvp import mat, make_rig, create_actions, export_selected, keyed, pose

STAGE = ROOT / 'renders/pet-anatomy-v2'
STAGE.mkdir(parents=True, exist_ok=True)
CAT_COLORS = {
    'orange-tabby': ((.57,.21,.048),(.91,.76,.52),(.22,.060,.014),(.29,.46,.15)),
    'black-cat': ((.027,.025,.033),(.055,.050,.065),(.012,.010,.016),(.75,.43,.075)),
    'siamese': ((.71,.58,.40),(.88,.78,.59),(.080,.047,.038),(.085,.38,.61)),
    'ragdoll': ((.56,.50,.45),(.90,.85,.74),(.18,.13,.12),(.15,.44,.64)),
    'british-shorthair': ((.21,.27,.34),(.35,.42,.48),(.095,.12,.16),(.75,.40,.075)),
    'maine-coon': ((.24,.14,.071),(.69,.55,.35),(.060,.034,.021),(.35,.49,.13)),
    'calico': ((.86,.79,.65),(.93,.88,.75),(.035,.029,.026),(.56,.46,.12)),
    'sphynx': ((.60,.33,.28),(.73,.48,.40),(.40,.18,.15),(.39,.47,.22)),
}


def mesh_object(name, vertices, faces, material):
    mesh = bpy.data.meshes.new(name + '-mesh')
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    mesh.materials.append(material)
    obj['pet_asset'] = True
    return obj


def bind(obj, rig, bone):
    # Skinning has a stable origin. Rotating a mesh around a distant world-space
    # origin was the cause of the displaced ears in the previous generator.
    bpy.context.view_layer.update()
    world = obj.matrix_world.copy()
    obj.parent = rig
    obj.matrix_world = world
    group = obj.vertex_groups.new(name=bone)
    group.add(list(range(len(obj.data.vertices))), 1, 'REPLACE')
    arm = obj.modifiers.new('Pet anatomical rig', 'ARMATURE')
    arm.object = rig
    obj['pet_asset'] = True
    return obj


def anatomical_rig(identifier):
    rig=make_rig()
    small=identifier=='hamster'
    bpy.context.view_layer.objects.active=rig
    bpy.ops.object.mode_set(mode='EDIT')
    positions={
        'root':((0,0,.035),(0,0,.12)),
        'spine':((0,.06,.24 if small else .40),(0,-.12,.32 if small else .54)),
        'head':((0,-.11,.38 if small else .65),(0,-.27,.42 if small else .74)),
        'tail.01':((0,.24,.16),(0,.30,.17)) if small else ((0,.42,.40),(.10,.62,.60)),
        'tail.02':((0,.30,.17),(0,.32,.18)) if small else ((.10,.62,.60),(0,.71,.79)),
    }
    for side,s in (('L',-1),('R',1)):
        positions['ear.'+side]=((s*.158,-.08,.52),(s*.17,-.08,.57)) if small else ((s*.18,-.31,.84),(s*.21,-.28,.99))
        for front,b,y in ((True,'F',-.18),(False,'B',.285)):
            if small:
                h=(s*.11,-.15,.275) if front else (s*.13,.04,.17)
                k=(s*.07,-.23,.245) if front else (s*.11,-.04,.06)
                tip=(s*.05,-.26,.24) if front else (s*.11,-.10,.03)
            else:
                h=(s*.145,y,.35);k=(s*.145,y,.17);tip=(s*.145,y-.065,.05)
            positions['leg.'+b+side]=(h,k);positions['paw.'+b+side]=(k,tip)
    for name,(a,b) in positions.items():
        bone=rig.data.edit_bones[name];bone.head=a;bone.tail=b
    bpy.ops.object.mode_set(mode='OBJECT')
    return rig


def soften_coat_boundaries(obj):
    """Bake the surface palette to interpolated vertex colors, without textures."""
    if len(obj.data.materials)<2:return
    mesh=obj.data
    palette=[Vector(m.diffuse_color[:3]) for m in mesh.materials]
    colors=[Vector((0,0,0)) for _ in mesh.vertices];counts=[0]*len(colors)
    neighbors=[set() for _ in colors]
    for face in mesh.polygons:
        for index in face.vertices:
            colors[index]+=palette[face.material_index];counts[index]+=1
    for edge in mesh.edges:
        a,b=edge.vertices;neighbors[a].add(b);neighbors[b].add(a)
    colors=[c/max(n,1) for c,n in zip(colors,counts)]
    for _ in range(3):
        colors=[c*.4+sum((colors[j] for j in neighbors[i]),Vector())*(.6/max(1,len(neighbors[i]))) for i,c in enumerate(colors)]
    attr=mesh.color_attributes.new(name='CoatColor',type='FLOAT_COLOR',domain='POINT')
    for value,color in zip(attr.data,colors):value.color=(*color,1)
    material=mat('Interpolated coat surface',(1,1,1),.79)
    nodes=material.node_tree.nodes
    node=nodes.get('CoatColor') or nodes.new('ShaderNodeVertexColor')
    node.name='CoatColor';node.layer_name='CoatColor'
    material.node_tree.links.new(node.outputs['Color'],nodes['Principled BSDF'].inputs['Base Color'])
    mesh.materials.clear();mesh.materials.append(material)
    for face in mesh.polygons:face.material_index=0


def animal_actions(identifier,rig):
    if identifier!='hamster':
        create_actions(rig)
        return
    # A hamster crouches and sniffs. It must not inherit the dog's deep foreleg
    # fold or a 22 cm drop, which put its head and hands through the floor.
    idle=pose(head=(.02,0,0))
    alert=pose(head=(-.10,0,.12),**{'ear.L':(0,0,.10),'ear.R':(0,0,-.08)})
    rest=pose(spine=((.03,0,0),(0,0,-.025)),head=(.15,0,0))
    settings={
        'pet_idle':([0,2,4],[{},idle,{}],True),
        'pet_look':([0,.8,1.6,2.4],[{},alert,pose(head=(0,0,-.14)),{}],False),
        'pet_react':([0,.3,.8,1.2],[{},alert,idle,{}],False),
        'pet_sit_down':([0,.6,1.2],[{},idle,idle],False),
        'pet_seated':([0,2,4],[idle,{},idle],True),
        'pet_stand_up':([0,.6,1.2],[idle,idle,{}],False),
        'pet_lie_down':([0,.8,1.7],[{},idle,rest],False),
        'pet_rest':([0,2.5,5],[rest,{**rest,'head':((.17,0,0),(0,0,0))},rest],True),
        'pet_get_up':([0,.9,1.8],[rest,idle,{}],False),
        'pet_sniff':([0,.4,.8,1.6],[{},pose(head=(.13,0,0)),pose(head=(.17,0,.06)),{}],False),
        'pet_play':([0,.4,.9,1.8],[{},alert,pose(head=(.10,0,-.1)),{}],False),
        'pet_carry':([0,1,2],[{},idle,{}],True),
        'pet_celebrate':([0,.35,.7,1.2,1.8],[{},idle,pose(spine=((0,0,0),(0,0,.04)),head=(-.1,0,0)),idle,{}],False),
    }
    for name,(times,poses,loop) in settings.items():keyed(rig,name,times,poses,loop)
    for run in (False,True):
        poses=[]
        for i in range(9):
            w=math.sin(i/8*math.tau)
            poses.append(pose(**{'leg.BL':(.25*w,0,0),'leg.BR':(-.25*w,0,0),'spine':((0,0,0),(0,0,.009*abs(w)))}))
        keyed(rig,'pet_run' if run else 'pet_walk',[i/(10 if run else 6) for i in range(9)],poses,True)
    rig.animation_data.action=None


def ellipsoid(name, center, radii, material, segments=40, rings=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.scale = radii
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    for face in obj.data.polygons:
        face.use_smooth = True
    obj['pet_asset'] = True
    return obj


def sculpt(name, volumes, material, voxel=.010):
    parts = [ellipsoid(name + '-volume', *volume, material, 32, 20) for volume in volumes]
    bpy.ops.object.select_all(action='DESELECT')
    for obj in parts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    remesh = obj.modifiers.new('Joined anatomical surface', 'REMESH')
    remesh.mode = 'VOXEL'
    remesh.voxel_size = voxel
    remesh.use_smooth_shade = True
    bpy.ops.object.modifier_apply(modifier=remesh.name)
    smooth = obj.modifiers.new('Sculpted transitions', 'SMOOTH')
    smooth.factor = 1.1
    smooth.iterations = 5
    bpy.ops.object.modifier_apply(modifier=smooth.name)
    dec = obj.modifiers.new('Even production topology', 'DECIMATE')
    dec.ratio = .55
    bpy.ops.object.modifier_apply(modifier=dec.name)
    for face in obj.data.polygons:
        face.use_smooth = True
    return obj


def tube(name, points, radii, material, rig, bone, sides=10):
    points = [Vector(p) for p in points]
    vertices, faces = [], []
    for i, point in enumerate(points):
        direction = (points[min(i+1,len(points)-1)] - points[max(0,i-1)]).normalized()
        ref = Vector((0,0,1)) if abs(direction.z)<.85 else Vector((0,1,0))
        u = direction.cross(ref).normalized()
        v = direction.cross(u).normalized()
        for k in range(sides):
            a = k*math.tau/sides
            vertices.append(point + radii[i]*(math.cos(a)*u + math.sin(a)*v))
    for i in range(len(points)-1):
        for k in range(sides):
            j = i*sides+k
            faces.append((j,i*sides+(k+1)%sides,(i+1)*sides+(k+1)%sides,j+sides))
    faces.extend([tuple(range(sides-1,-1,-1)),tuple((len(points)-1)*sides+k for k in range(sides))])
    obj = mesh_object(name, vertices, faces, material)
    for face in obj.data.polygons:
        face.use_smooth = True
    if rig:
        bind(obj, rig, bone)
    return obj


def ear(name, base, width, height, lean, outer, pink, rig, bone, round_ear=False):
    # A cupped double surface with a solid rolled edge; every vertex is in world
    # space and the rig performs rotations, never the distant object origin.
    bx,by,bz = base
    if round_ear:
        obj = ellipsoid(name, base, (width*.55,.034,height*.5), outer,40,24)
        bind(obj,rig,bone)
        inner = ellipsoid(name+'-concha',(bx,by-.028,bz+.003),(width*.37,.012,height*.32),pink,32,20)
        bind(inner,rig,bone)
        return
    outline=[(-.53,0),(-.53,.22),(-.35,.65),(-.06,1),(.09,.96),(.34,.54),(.51,.12),(.43,0)]
    verts=[]
    for depth in (0,.055):
        for x,z in outline:
            verts.append((bx+width*x+lean*z,by+depth+.05*z,bz+height*z))
    verts.append((bx+lean*.32,by+.045,bz+height*.32))
    verts.append((bx+lean*.32,by+.075,bz+height*.32))
    faces=[]
    for i in range(8):
        faces.extend(((16,i,(i+1)%8),(17,8+(i+1)%8,8+i),(i,8+i,8+(i+1)%8,(i+1)%8)))
    obj=mesh_object(name,verts,faces,outer)
    obj.data.materials.append(pink)
    for i,face in enumerate(obj.data.polygons):
        face.use_smooth=True
        face.material_index=1 if i%3==0 else 0
    bevel=obj.modifiers.new('Soft ear rim','BEVEL'); bevel.width=.012; bevel.segments=3
    bind(obj,rig,bone)
    rim=[]
    for x,z in outline+[outline[0]]:
        rim.append((bx+width*x+lean*z,by-.003+.05*z,bz+height*z))
    tube(name+'-rim',rim,[.009]*len(rim),outer,rig,bone)


def front_surface(obj):
    bpy.context.view_layer.update()
    tree = BVHTree.FromObject(obj,bpy.context.evaluated_depsgraph_get())
    def sample(x,z):
        hit,_,_,_=tree.ray_cast(Vector((x,-2,z)),Vector((0,1,0)),4)
        return hit.y if hit else -.5
    return sample


def cat_eye(name,x,z,surface,iris,black,rig,wide=.085,tall=.054):
    # An almond-shaped domed eye follows the facial surface. The socket is the
    # full fine outline, not a separate bar above the eye.
    count=48
    def disk(label,w,h,depth,material):
        verts=[(x,surface(x,z)-depth,z)]
        for ring in (.35,.7,1):
            for j in range(count):
                a=j*math.tau/count
                px=x+w*math.cos(a)*ring
                pz=z+h*math.sin(a)*(abs(math.sin(a))**.2)*ring
                verts.append((px,surface(px,pz)-.003-depth*(1-ring*ring),pz))
        faces=[(0,1+j,1+(j+1)%count) for j in range(count)]
        for r in range(2):
            for j in range(count):
                a=1+r*count+j;b=1+r*count+(j+1)%count
                faces.append((a,a+count,b+count,b))
        obj=mesh_object(label,verts,faces,material)
        for face in obj.data.polygons: face.use_smooth=True
        bind(obj,rig,'head')
    disk(name+'-socket',wide*1.035,tall*1.045,.010,black)
    disk(name+'-iris',wide,tall,.020,iris)
    # A gently rounded slit is feline without a cartoon black sphere on top.
    pupil=ellipsoid(name+'-pupil',(x,surface(x,z)-.023,z),(.014,.004,tall*.83),black,32,20)
    bind(pupil,rig,'head')
    glint=mat('Anatomy catchlights',(1,.98,.91),.16)
    bind(ellipsoid(name+'-spark',(x-.018,surface(x-.018,z+.02)-.023,z+.02),(.008,.003,.011),glint,24,12),rig,'head')


def bead_eye(name,x,z,surface,rig,size=.032):
    black=mat('Mammal black eyes',(.006,.004,.003),.20)
    eye=ellipsoid(name,(x,surface(x,z)-.004,z),(size,size*.52,size*1.04),black)
    bind(eye,rig,'head')
    glint=mat('Mammal eye glint',(.98,.97,.91),.18)
    bind(ellipsoid(name+'-glint',(x-size*.23,surface(x,z)-size*.48,z+size*.30),(size*.17,.002,size*.19),glint,20,12),rig,'head')


def mark_surface(obj,identifier,base,light,dark,part):
    obj.data.materials.clear()
    for material in (base,light,dark): obj.data.materials.append(material)
    orange=mat('Calico amber',(.55,.18,.035))
    if identifier=='calico': obj.data.materials.append(orange)
    for face in obj.data.polygons:
        p=face.center; x,y,z=p.x,p.y,p.z
        index=0
        if part=='head':
            if identifier in ('orange-tabby','maine-coon'):
                if z<.655 and y<-.47: index=1
                if z>.82 and y<-.40 and abs(x)<.155 and math.sin(x*62+z*12)>.3: index=2
                if abs(x)>.19 and .68<z<.79 and math.sin(z*95+y*4)>.15: index=2
            elif identifier=='siamese':
                if y<-.43 and (x/.23)**2+((z-.73)/.20)**2<1.4: index=2
            elif identifier=='ragdoll':
                index=1
                if y<-.43 and abs(x)>(.875-z)*.63 and z>.69: index=2
            elif identifier=='calico':
                if z>.73 and x<-.032: index=2
                elif z>.70 and x>.038: index=3
            elif identifier=='black-cat': index=0
        else:
            if identifier in ('orange-tabby','maine-coon'):
                if z<.36 or (y<-.17 and abs(x)<.15): index=1
                elif abs(x)>.14 and math.sin(y*31+z*7)>.53: index=2
            elif identifier=='ragdoll':
                index=1 if z<.48 or y<-.12 else 0
            elif identifier=='calico':
                if ((y-.1)/.22)**2+((z-.54)/.2)**2<1: index=2
                if ((y-.29)/.21)**2+((z-.55)/.23)**2<1 and x<.12: index=3
        face.material_index=index


def build_cat(identifier,rig):
    colors=CAT_COLORS[identifier]
    base,light,dark=[mat(identifier+'-'+name,color,.76) for name,color in zip(('base','cream','marks'),colors[:3])]
    iris=mat(identifier+'-iris',colors[3],.24)
    black=mat('Feline pupil',(.007,.005,.006),.27)
    pink=mat('Feline nose',(.47,.17,.17),.62)
    ear_pink=mat('Feline ear concha',(.54,.28,.25),.78)
    wide=1.12 if identifier in ('british-shorthair','ragdoll','maine-coon') else .95 if identifier=='sphynx' else 1
    length=1.12 if identifier=='maine-coon' else 1
    body=sculpt('Feline ribcage and shoulders',[
        ((0,.09,.405),(.22*wide,.345*length,.215)),
        ((0,-.155,.435),(.20*wide,.20,.215)),
        ((0,.31,.32),(.22*wide,.18,.20)),
        ((0,-.22,.535),(.15*wide,.155,.165)),
    ],base)
    mark_surface(body,identifier,base,light,dark,'body');bind(body,rig,'spine')
    skull=.255*wide
    head=sculpt('Feline sculpted head',[
        ((0,-.315,.725),(skull,.205,.224)),
        ((-.13*wide,-.423,.672),(.115,.098,.105)),
        ((.13*wide,-.423,.672),(.115,.098,.105)),
        ((0,-.420,.618),(.133,.087,.058)),
        ((-.053,-.512,.66),(.068,.065,.046)),
        ((.053,-.512,.66),(.068,.065,.046)),
    ],base,.007)
    mark_surface(head,identifier,base,light,dark,'head')
    surface=front_surface(head)
    for sign,side in ((-1,'L'),(1,'R')):
        cat_eye('Cat eye '+side,sign*.107,.769,surface,iris,black,rig,
                .066 if identifier=='sphynx' else .071,.046)
        ear_material=dark if identifier in ('siamese','ragdoll') else base
        ear('Cat ear '+side,(sign*.179*wide,-.333,.848),.17,.24 if identifier in ('sphynx','maine-coon') else .18,sign*.035,ear_material,ear_pink,rig,'ear.'+side)
        for front,y,b in ((True,-.18,'F'),(False,.285,'B')):
            x=sign*.145*wide
            leg=sculpt('Cat '+b+side+' limb',[
                ((x,y,.28),(.073,.080,.143)),
                ((x,y-.014,.17),(.049,.056,.115)),
            ],dark if identifier=='siamese' else base,.009)
            bind(leg,rig,'leg.'+b+side)
            paw=ellipsoid('Cat '+b+side+' paw',(x,y-.055,.050),(.065,.096,.050),light if identifier in ('ragdoll','calico','orange-tabby') else base)
            bind(paw,rig,'paw.'+b+side)
            for d in (-1,1):
                tube('Cat toe separation',[(x+d*.022,y-.144,.064),(x+d*.022,y-.130,.088)], [.0015,.0007],dark,rig,'paw.'+b+side,6)
    bind(head,rig,'head')
    # Short inverted triangular nose, philtrum and two restrained mouth curves.
    nose=mesh_object('Feline nose', [(-.028,-.578,.680),(.028,-.578,.680),(0,-.595,.658),(0,-.579,.675),(0,-.550,.675)],[(0,1,3),(0,3,2),(1,2,3),(0,4,1),(1,4,2),(2,4,0)],pink)
    bevel=nose.modifiers.new('Rounded nose leather','BEVEL');bevel.width=.004;bevel.segments=3
    bind(nose,rig,'head')
    tube('Feline philtrum',[(0,-.583,.660),(0,-.575,.642)], [.0018,.0015],dark,rig,'head',8)
    for sign in (-1,1):
        tube('Feline mouth',[(0,-.575,.642),(sign*.02,-.570,.636),(sign*.043,-.560,.643)],[.0016,.0016,.0006],dark,rig,'head',8)
        for k in range(3):
            tube('Feline whisker',[(sign*.092,-.553,.662-k*.016),(sign*.175,-.56,.661+(k-1)*.013),(sign*.257,-.54,.673+(k-1)*.029)],[.0018,.0012,.0003],light if identifier!='black-cat' else mat('Black cat whisker',(.33,.30,.34)),rig,'head',6)
    tail_points=[];radii=[]
    for i in range(25):
        t=i/24
        tail_points.append((.14*math.sin(t*math.pi),.42+.29*math.sin(t*1.65),.40+.49*t-.10*t*t))
        radii.append((.052 if identifier in ('ragdoll','maine-coon') else .037)*(1-t*.76))
    tail=tube('Continuous feline tail',tail_points,radii,dark if identifier in ('siamese','ragdoll') else base,None,None,14)
    bind(tail,rig,'tail.01')
    second=tail.vertex_groups.new(name='tail.02')
    first=tail.vertex_groups.get('tail.01')
    for v in tail.data.vertices:
        t=(v.co.z-.40)/.39
        w=max(0,min(1,(t-.35)/.40))
        first.add([v.index],1-w,'REPLACE');second.add([v.index],w,'REPLACE')
    if identifier in ('orange-tabby','maine-coon'):
        tail.data.materials.append(dark)
        for face in tail.data.polygons:
            face.material_index=1 if math.sin(face.center.z*53)>.45 else 0
    return head


def build_hamster(rig):
    amber=mat('Hamster natural amber',(.48,.225,.070),.78)
    cream=mat('Hamster ivory',(.89,.77,.57),.83)
    pink=mat('Hamster paws and ears',(.63,.33,.29),.72)
    nose_mat=mat('Hamster nose',(.47,.17,.16),.59)
    dark=mat('Hamster mouth',(.12,.057,.030),.8)
    body=sculpt('Hamster pear-shaped body',[
        ((0,.075,.238),(.228,.221,.224)),
        ((0,-.085,.302),(.197,.16,.175)),
        ((-.13,.08,.137),(.102,.145,.128)),
        ((.13,.08,.137),(.102,.145,.128)),
    ],amber,.008)
    body.data.materials.append(cream)
    for face in body.data.polygons:
        if face.center.y<-.06 and face.center.z<.35:face.material_index=1
    bind(body,rig,'spine')
    head=sculpt('Hamster cheeks and skull',[
        ((0,-.123,.401),(.208,.166,.172)),
        ((-.113,-.222,.338),(.108,.090,.102)),
        ((.113,-.222,.338),(.108,.090,.102)),
        ((0,-.28,.354),(.064,.055,.045)),
    ],amber,.006)
    head.data.materials.append(cream)
    for face in head.data.polygons:
        p=face.center
        if p.z<.386 and p.y<-.18:face.material_index=1
        if abs(p.x)<.024 and p.y<-.22:face.material_index=1
    surface=front_surface(head)
    for side,sign in (('L',-1),('R',1)):
        bead_eye('Hamster eye '+side,sign*.115,.425,surface,rig,.032)
        ear('Hamster ear '+side,(sign*.158,-.080,.531),.094,.092,0,amber,pink,rig,'ear.'+side,True)
        bind(ellipsoid('Hamster rear paw '+side,(sign*.113,-.075,.031),(.043,.073,.027),pink),rig,'paw.B'+side)
        bind(ellipsoid('Hamster little forearm '+side,(sign*.11,-.17,.242),(.042,.062,.053),cream),rig,'leg.F'+side)
        bind(ellipsoid('Hamster hand '+side,(sign*.052,-.257,.241),(.030,.026,.032),pink),rig,'paw.F'+side)
        for d in (-1,0,1):
            tube('Hamster fingertips',[(sign*.052+d*.009,-.275,.242),(sign*.049+d*.008,-.280,.257)],[.0045,.003],pink,rig,'paw.F'+side,8)
        for k in range(3):
            tube('Hamster whisker',[(sign*.071,-.315,.350-k*.008),(sign*.151,-.317,.35+(k-1)*.012),(sign*.201,-.298,.349+(k-1)*.021)],[.0012,.0008,.0002],cream,rig,'head',6)
    bind(head,rig,'head')
    bind(ellipsoid('Hamster soft triangular nose',(0,-.337,.366),(.022,.013,.015),nose_mat,32,20),rig,'head')
    tube('Hamster philtrum',[(0,-.334,.357),(0,-.33,.341)],[.0015,.0012],dark,rig,'head',8)
    for sign in (-1,1):
        tube('Hamster closed mouth',[(0,-.329,.341),(sign*.020,-.322,.339)],[.0013,.0005],dark,rig,'head',8)
    bind(ellipsoid('Hamster short tail',(0,.29,.15),(.019,.026,.02),pink),rig,'tail.01')
    seed_mat=mat('Sunflower seed husk',(.055,.043,.030),.63)
    seed=ellipsoid('Held sunflower seed',(0,-.272,.257),(.023,.013,.055),seed_mat,24,16)
    bind(seed,rig,'head')
    stripe_mat=mat('Sunflower seed stripe',(.69,.60,.41),.85)
    for x in (-.009,.009):
        tube('Seed fine stripe',[(x,-.286,.215),(x,-.289,.263),(x*.3,-.280,.299)],[.0008,.0014,.0003],stripe_mat,rig,'head',6)
    return head


def studio(identifier,rig):
    scene=bpy.context.scene
    scene.frame_set(1)
    scene.render.engine='CYCLES'
    scene.cycles.samples=32
    scene.cycles.use_denoising=True
    scene.cycles.device='CPU'
    scene.render.resolution_x=720;scene.render.resolution_y=720
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'
    scene.render.image_settings.color_mode='RGBA'
    scene.view_settings.view_transform='AgX'
    scene.view_settings.look='AgX - Medium High Contrast'
    scene.view_settings.exposure=0
    world=bpy.data.worlds.new('Anatomy neutral studio')
    world.use_nodes=True
    world.node_tree.nodes['Background'].inputs[0].default_value=(.48,.54,.64,1)
    world.node_tree.nodes['Background'].inputs[1].default_value=.3
    scene.world=world
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,0))
    plane=bpy.context.object;plane.name='Studio floor';plane.data.materials.append(mat('Anatomy warm floor',(.56,.51,.45),.83))
    def aim(obj,target):obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
    for name,location,energy,size,color in (
        ('Large warm key',(-2,-3,4),260,3,(1,.86,.72)),
        ('Cool fill',(2,-1,2),95,2.5,(.77,.85,1)),
        ('Rim',(1,2,3),300,2,(1,.91,.78)),
    ):
        bpy.ops.object.light_add(type='AREA',location=location)
        light=bpy.context.object;light.name=name;light.data.energy=energy;light.data.shape='DISK';light.data.size=size;light.data.color=color
        aim(light,(0,0,.4))
    bpy.ops.object.camera_add(location=(1.30,-2.55,1.16))
    camera=bpy.context.object;scene.camera=camera;camera.data.type='ORTHO'
    is_hamster=identifier=='hamster'
    camera.data.ortho_scale=.90 if is_hamster else 1.45
    target=(0,-.035,.295 if is_hamster else .47)
    aim(camera,target)
    camera.data.lens=70
    scene.render.filepath=str(STAGE/(identifier+'.png'))
    # Keep an editable studio in the .blend alongside the rig and geometry.
    bpy.ops.wm.save_as_mainfile(filepath=str(STAGE/(identifier+'-master.blend')))
    bpy.ops.render.render(write_still=True)
    if '--closeups' in sys.argv:
        camera.location=(.62,-2.5,.77 if is_hamster else 1.02)
        aim(camera,(0,-.18,.40 if is_hamster else .73))
        camera.data.ortho_scale=.62 if is_hamster else .83
        scene.render.filepath=str(STAGE/(identifier+'-face.png'))
        bpy.ops.render.render(write_still=True)


def main():
 selected=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['hamster','orange-tabby']
 if 'all' in selected:selected=['hamster',*CAT_COLORS]
 for identifier in selected:
    if identifier.startswith('--'):continue
    bpy.ops.wm.read_factory_settings(use_empty=True)
    rig=anatomical_rig(identifier)
    rig.name='pet-small-mammal-rig' if identifier=='hamster' else 'pet-feline-rig'
    rig['rig_family']='small-mammal' if identifier=='hamster' else 'feline'
    if identifier=='hamster':build_hamster(rig)
    else:build_cat(identifier,rig)
    for obj in bpy.context.scene.objects:
        if obj.get('pet_asset') and obj.type=='MESH' and not obj.name.startswith(('Cat ear ', 'Hamster ear ')):
            soften_coat_boundaries(obj)
    animal_actions(identifier,rig)
    rig.animation_data.action=None
    for bone in rig.pose.bones:
        bone.location=(0,0,0);bone.rotation_euler=(0,0,0)
    bpy.context.scene.frame_set(1)
    bpy.context.view_layer.update()
    parts=[o for o in bpy.context.scene.objects if o.get('pet_asset')]
    for obj in parts:
        if obj.type=='MESH' and not obj.vertex_groups:
            raise RuntimeError('Unbound mesh '+obj.name)
    export_selected(STAGE/('pet-'+identifier+'.glb'),[rig]+parts)
    manifest={'id':identifier,'schema':'compa-pet-v2','revision':'anatomy-v2','rig':rig['rig_family'],'meshCount':len(parts),'vertices':sum(len(o.data.vertices) for o in parts if o.type=='MESH'),'noFurSystem':True,'noEyebrows':True}
    (STAGE/(identifier+'-manifest.json')).write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    studio(identifier,rig)
    print('ANATOMY_READY',identifier,flush=True)

if __name__=='__main__':main()
