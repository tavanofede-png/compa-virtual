"""Geometry-first face/hair pass for the existing Compa humanoid masters.

All positions are canonical world metres. The caller owns backup, rig auditing,
export, and uniform final scaling. No bones, hierarchies or actions are changed.
"""
from __future__ import annotations

import math
import random

import bpy
from mathutils import Vector


STYLES = {
    "nova": "long", "jay": "curls", "milo": "messy", "zoe": "bun",
    "sky": "long", "harper": "tousled", "river": "locs", "aria": "ponytail",
}


def _mix_mat(ctx, name, base, accent, amount, roughness=None):
    existing = bpy.data.materials.get(name)
    if existing:
        return existing
    a, b = ctx.mat(base), ctx.mat(accent)
    mat = a.copy()
    mat.name = name
    pa = mat.node_tree.nodes.get("Principled BSDF")
    pb = b.node_tree.nodes.get("Principled BSDF")
    ca = tuple(pa.inputs["Base Color"].default_value)
    cb = tuple(pb.inputs["Base Color"].default_value)
    color = tuple(ca[i] * (1 - amount) + cb[i] * amount for i in range(3)) + (1.0,)
    pa.inputs["Base Color"].default_value = color
    mat.diffuse_color = color
    if roughness is not None:
        pa.inputs["Roughness"].default_value = roughness
    return mat


def _mesh(ctx, name, verts, faces, materials, slot="hair", bone="head", bevel=.001):
    mesh = bpy.data.meshes.new(name + "_Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    ctx.collection(slot).objects.link(obj)
    for material in materials:
        mesh.materials.append(material)
    # Broad planes remain flat, only the tiny bevels catch studio highlights.
    for poly in mesh.polygons:
        poly.use_smooth = False
    if bevel:
        mod = obj.modifiers.new("Micro edge bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        mod.affect = "EDGES"
        mod.limit_method = "ANGLE"
    ctx.attach(obj, slot, bone, item="premium_face_hair")
    return obj


def _octagon(w, d, corner):
    x, y, c = w / 2, d / 2, corner
    return [(-x+c,-y),(x-c,-y),(x,-y+c),(x,y-c),
            (x-c,y),(-x+c,y),(-x,y-c),(-x,-y+c)]


def _lock(ctx, name, center, dims, mats, rotation=(0,0,0), drift=0.0):
    """A single designed lock: stepped/tapered voxel planes, not a sphere.

    Six cross sections create a primary mass, a projecting middle layer and a
    narrower terminal. The short ledges give actual depth at macro and close-up.
    """
    w, d, length = dims
    rings = [(0,.74,.76),(.11,.94,.90),(.47,.94,.90),
             (.47,1,1),(.82,1,1),(1,.82,.88)]
    verts = []
    for t, sw, sd in rings:
        dx = drift * (t - .5)
        for x, y in _octagon(w * sw, d * sd, min(w,d) * .095):
            verts.append((x + dx,y,(t-.5)*length))
    faces = [tuple(reversed(range(8)))]
    for r in range(len(rings)-1):
        for k in range(8):
            faces.append((r*8+k,r*8+(k+1)%8,(r+1)*8+(k+1)%8,(r+1)*8+k))
    faces.append(tuple(range((len(rings)-1)*8,len(rings)*8)))
    # Set world transform before attaching so it is preserved by the caller.
    mesh = bpy.data.meshes.new(name + "_Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    ctx.collection("hair").objects.link(obj)
    obj.location = center
    obj.rotation_euler = rotation
    for mat in mats:
        mesh.materials.append(mat)
    for p in mesh.polygons:
        p.use_smooth = False
        # Related shades follow planes, never a random checkerboard.
        p.material_index = 1 if p.index == len(faces)-1 else (2 if p.index % 8 == 4 else 0)
    bevel = obj.modifiers.new("Voxel hair edge glints", "BEVEL")
    bevel.width = min(w,d)*.015
    bevel.segments = 2
    bevel.limit_method = "ANGLE"
    ctx.attach(obj, "hair", "head", item=STYLES.get(ctx.character_id,ctx.character.hair_style))
    return obj


def _strand(ctx, name, points, width, depth, mats):
    """Connected stepped long lock, retaining the original long/braided style."""
    verts = []
    for i, (x,y,z) in enumerate(points):
        taper = .72 if i == len(points)-1 else (1 if i%2 == 0 else .90)
        for px,py in _octagon(width*taper,depth*taper,min(width,depth)*.09):
            verts.append((x+px,y+py,z))
    faces = [tuple(range(8))]
    for i in range(len(points)-1):
        for j in range(8):
            faces.append((i*8+j,(i+1)*8+j,(i+1)*8+(j+1)%8,i*8+(j+1)%8))
    faces.append(tuple(reversed(range((len(points)-1)*8,len(points)*8))))
    obj = _mesh(ctx,name,verts,faces,mats,bevel=.0008)
    for p in obj.data.polygons:
        p.material_index = 1 if p.index%8 in (1,2) else 0
    return obj


def _bar(ctx,name,a,b,width,depth,mat,slot="body"):
    start, end = Vector(a), Vector(b)
    delta = end-start
    obj = ctx.box(name,tuple((start+end)*.5),(width,depth,delta.length),mat,
                  slot,"head",bevel=min(width,depth)*.12,
                  rotation=tuple(delta.to_track_quat("Z","Y").to_euler()))
    return obj


def _ring(ctx,name,x,y,z,outer,inner,depth,mat,rounded=False):
    if rounded:
        n = 24
        outlines = [[(math.cos(t*2*math.pi/n)*w/2,math.sin(t*2*math.pi/n)*h/2)
                     for t in range(n)] for w,h in (outer,inner)]
    else:
        outlines = [_octagon(w,h,.012) for w,h in (outer,inner)]
        n = 8
    verts=[]
    for oy in (-depth/2,depth/2):
        for outline in outlines:
            for ox,oz in outline:
                verts.append((x+ox,y+oy,z+oz))
    faces=[]
    for i in range(n):
        j=(i+1)%n
        faces.extend([(i,j,n+j,n+i),(2*n+i,3*n+i,3*n+j,2*n+j),
                      (i,2*n+i,2*n+j,j),(n+i,n+j,3*n+j,3*n+i)])
    return _mesh(ctx,name,verts,faces,[mat],"face_accessory",bevel=.0014)


def _lens(ctx,name,x,y,z,w,h,mat,rounded=False):
    outline = ([(math.cos(t*2*math.pi/24)*w/2,math.sin(t*2*math.pi/24)*h/2)
                for t in range(24)] if rounded else _octagon(w,h,.012))
    n=len(outline)
    verts=[(x+ox,y+oy,z+oz) for oy in (-.00065,.00065) for ox,oz in outline]
    faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]
    faces.extend([(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)])
    return _mesh(ctx,name,verts,faces,[mat],"face_accessory",bevel=.00025)


def upgrade(ctx):
    style = STYLES.get(ctx.character_id,ctx.character.hair_style)
    before = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    before_vertices=sum(len(o.data.vertices) for o in before)
    remove=[]
    for obj in list(bpy.context.scene.objects):
        if obj.type != "MESH":
            continue
        name=obj.name
        if name.startswith(("Hair_","Face_","Glasses_","Body_Ear_","Detail_Ear_","PRM_Hair_","PRM_Face_","PRM_Glasses_")) or name in ("Body_Head","Body_FacePlane","Body_JawPlane"):
            remove.append(name)
            ctx.remove(obj)

    prefix="MAT_"+ctx.character_id.upper()+"_PREMIUM_"
    cheek=_mix_mat(ctx,prefix+"CHEEK","skin_light","blush",.16,.54)
    skin_transition=_mix_mat(ctx,prefix+"SKIN_TRANSITION","skin","skin_light",.64,.53)
    ear_inner=_mix_mat(ctx,prefix+"EAR_INNER","skin","skin_shadow",.38,.57)
    mouth=_mix_mat(ctx,prefix+"SMILE","skin_shadow","eye",.27,.60)
    iris_light=_mix_mat(ctx,prefix+"IRIS_AMBER","eye","skin_light",.20,.26)
    hair_warm=_mix_mat(ctx,prefix+"HAIR_WARM","hair","hair_mid",.52,.39)
    hair_lit=_mix_mat(ctx,prefix+"HAIR_LIT","hair_mid","hair_light",.32,.36)
    hair_sets=[(ctx.mat("hair"),hair_warm,ctx.mat("hair")),
               (hair_warm,ctx.mat("hair_mid"),ctx.mat("hair")),
               (ctx.mat("hair_mid"),hair_lit,hair_warm)]

    def box(name,loc,dims,mat,bevel=.002,rotation=(0,0,0),slot="body"):
        return ctx.box("PRM_"+name,loc,dims,mat,slot,"head",bevel=bevel,rotation=rotation)

    # The same primary head silhouette, with restrained stepped facial planes.
    # One watertight head with a designed jaw/chin, rather than plaques on a cube.
    head_verts=[]
    profiles=[(1.315,.350,.311,.041),(1.337,.410,.350,.035),
              (1.385,.468,.387,.034),(1.440,.491,.405,.034),
              (1.565,.493,.407,.034),(1.689,.480,.395,.040),
              (1.750,.428,.359,.048)]
    for z,w,d,c in profiles:
        head_verts.extend((x,y-.012,z) for x,y in _octagon(w,d,c))
    head_faces=[tuple(reversed(range(8)))]
    for row in range(len(profiles)-1):
        for k in range(8):
            head_faces.append((row*8+k,row*8+(k+1)%8,(row+1)*8+(k+1)%8,(row+1)*8+k))
    head_faces.append(tuple(range(48,56)))
    head=_mesh(ctx,'PRM_Face_Head',head_verts,head_faces,[skin_transition,ctx.mat('skin')],'body','head',.003)
    for p in head.data.polygons:
        p.material_index=0 if p.index>0 and (p.index-1)%8 in (0,1,7) else 1
    for side, sign in (("L",-1),("R",1)):
        x=sign*.267
        box("Face_EarOuter_"+side,(x,.000,1.535),(.077,.071,.143),ctx.mat("skin"),.013)
        box("Face_EarHelix_"+side,(x,-.035,1.545),(.054,.013,.092),skin_transition,.007)
        box("Face_EarConcha_"+side,(x+sign*.003,-.043,1.542),(.033,.009,.057),ear_inner,.006)
        box("Face_EarFold_"+side,(x-sign*.009,-.049,1.523),(.019,.009,.032),ctx.mat("skin"),.004)
        box("Face_EarLobe_"+side,(x,-.019,1.481),(.050,.044,.032),skin_transition,.006)
        box("Face_CheekWarmth_"+side,(sign*.174,-.216,1.466),(.049,.0018,.014),cheek,.002)

    for side,x in (("L",-.118),("R",.118)):
        sign=-1 if side=="L" else 1
        box("Face_EyeSocket_"+side,(x,-.224,1.558),(.149,.011,.116),ear_inner,.020)
        box("Face_Sclera_"+side,(x,-.232,1.558),(.137,.019,.103),ctx.mat("eye_white"),.019)
        ix=x-sign*.007
        box("Face_IrisLimbal_"+side,(ix,-.245,1.556),(.070,.010,.088),ctx.mat("eye_dark"),.012)
        box("Face_Iris_"+side,(ix,-.251,1.555),(.061,.010,.078),ctx.mat("eye"),.011)
        box("Face_IrisLower_"+side,(ix,-.257,1.533),(.049,.003,.025),iris_light,.007)
        box("Face_Pupil_"+side,(ix,-.258,1.557),(.031,.009,.057),ctx.mat("eye_dark"),.006)
        box("Face_Catchlight_"+side,(ix-.011,-.264,1.580),(.016,.006,.020),ctx.mat("eye_white"),.0015)
        box("Face_CatchlightPin_"+side,(ix+.016,-.265,1.539),(.006,.005,.007),ctx.mat("eye_white"),.001)
        # Two subtly angled lid portions, not a flat horizontal face decal.
        _bar(ctx,"PRM_Face_UpperLidInner_"+side,(x-sign*.001,-.247,1.611),(x-sign*.067,-.238,1.602),.009,.010,ctx.mat("hair"))
        _bar(ctx,"PRM_Face_UpperLidOuter_"+side,(x-sign*.001,-.247,1.611),(x+sign*.067,-.238,1.605),.009,.010,ctx.mat("hair"))
        _bar(ctx,"PRM_Face_LowerLid_"+side,(x-.051,-.236,1.505),(x+.051,-.236,1.505),.006,.006,skin_transition)
        _bar(ctx,"PRM_Face_BrowInner_"+side,(x-sign*.052,-.230,1.653),(x+sign*.008,-.235,1.660),.020,.015,ctx.mat("hair"))
        _bar(ctx,"PRM_Face_BrowOuter_"+side,(x+sign*.008,-.235,1.660),(x+sign*.060,-.229,1.650),.016,.014,hair_warm)

    box("Face_NoseBridge",(0,-.224,1.504),(.029,.026,.065),skin_transition,.007)
    box("Face_NoseTip",(0,-.245,1.480),(.045,.025,.030),ctx.mat("skin"),.006)
    box("Face_NoseLight",(-.007,-.260,1.487),(.023,.004,.012),skin_transition,.002)
    box("Face_NoseUnderside",(0,-.247,1.467),(.028,.018,.007),ear_inner,.002)
    smile=[(-.048,-.234,1.427),(-.035,-.238,1.417),(-.015,-.241,1.412),(.009,-.241,1.412),(.034,-.238,1.420),(.047,-.234,1.432)]
    for i in range(len(smile)-1):
        _bar(ctx,"PRM_Face_Smile_%02d"%i,smile[i],smile[i+1],.006,.006,mouth)
    _bar(ctx,"PRM_Face_LowerLipSoft",(-.018,-.237,1.405),(.021,-.237,1.408),.005,.004,cheek)

    # Fully rebuilt connected voxel hair: roots, directional locks and silhouette.
    box("Hair_RootCrown",(0,.012,1.747),(.496,.403,.172),ctx.mat("hair"),.020,slot="hair")
    box("Hair_RootDome",(0,.022,1.824),(.377,.307,.082),ctx.mat("hair"),.015,slot="hair")
    box("Hair_RootBack",(0,.177,1.607),(.450,.081,.281),ctx.mat("hair"),.014,slot="hair")
    rng=random.Random(9817+sum(map(ord,ctx.character_id)))
    hair_count=0
    def lock(name,center,dims,shade=0,rotation=(0,0,0),drift=0):
        nonlocal hair_count
        hair_count+=1
        return _lock(ctx,"PRM_Hair_"+name,center,dims,hair_sets[shade],rotation,drift)

    # Four overlapping crown bands follow one designed parting/sweep.
    for row,y in enumerate((-.158,-.085,-.012,.061,.134,.190)):
        for col,x in enumerate((-.222,-.167,-.110,-.055,.002,.060,.116,.170,.224)):
            edge=abs(x)/.23
            z=1.809+.066*(1-edge**1.8)-.040*(abs(y)/.20)**1.7
            wave=.022*math.sin(col*1.3+row*.6)
            curl=style in ("curls","bun","ponytail")
            length=.074 if curl else .095
            lock("Crown_%d_%d"%(row,col),(x+rng.uniform(-.004,.004),y,z+wave),
                 (.063 if curl else .071,.092,length),1 if row>=1 else 0,
                 (.09*(row-2),-.27+.050*col,.20*math.sin(col*.7+row*.4)),.015 if not curl else -.006)
            if curl and (row+col)%2==0:
                lock("CrownCurlTip_%d_%d"%(row,col),(x-.012,y-.016,z+length*.37),(.044,.052,.057),2,(.12,.15,-.20))

    # Fringe is asymmetrical and layered; longer pieces gather to the sides.
    for i,x in enumerate((-.224,-.172,-.122,-.070,-.018,.040,.097,.157,.218)):
        if style=='long' and abs(x)<.15:
            continue
        if style=="long":
            z=1.743-.040*abs(x)/.23
            length=.129 if abs(x)>.09 else .090
            ry=-math.copysign(.25,x or 1)
        elif style in ("curls","bun","ponytail"):
            z=1.728+.014*math.sin(i*1.7)
            length=.102
            ry=.1*math.sin(i)
        else:
            z=1.724+.024*math.sin(i*.90+.20)
            length=.121+.016*math.cos(i*1.2)
            ry=-.22+.065*i
        lock("Fringe_%02d"%i,(x,-.191-.008*math.cos(i),z),(.069,.088,length),1 if i<5 else 0,(.05,ry,-.035),.012)
        if i not in (0,8):
            lock("FringeLayer_%02d"%i,(x+.012,-.239,z+.026),(.042,.020,length*.62),1 if i<4 else 0,(0,ry,-.02),.006)

    for side,sign in (("L",-1),("R",1)):
        for row,z in enumerate((1.744,1.676,1.613)):
            for col,y in enumerate((-.112,-.032,.048,.125,.195)):
                lock("SideLayer_%s_%d_%d"%(side,row,col),(sign*(.250+.006*math.sin(col)),y,z+.009*math.sin(col+row)),
                     (.077,.094,.101),1 if row==0 else 0,(.05,-sign*.08,sign*.06),sign*.006)
        for j,(z,y) in enumerate(((1.699,-.070),(1.625,.015),(1.554,.074),(1.492,.105))):
            lock("Temple_%s_%d"%(side,j),(sign*(.251+.006*(j%2)),y,z),(.065,.096,.112),0 if j>1 else 1,
                 (.06,-sign*.10,sign*.07),sign*.008)
        for row,z in enumerate((1.742,1.664,1.584,1.510)):
            for col,x in enumerate((-.16,-.078,0,.079,.16)):
                # One back pass; loop ownership prevents duplicate meshes.
                if side=="R":
                    continue
                lock("Back_%d_%d"%(row,col),(x,.197+.009*math.sin(col),z+.008*math.cos(col)),
                     (.090,.064,.113),1 if row<2 else 0,(.06,.05*math.sin(col),0),.006)

    if style=="long":
        for side,sign in (("L",-1),("R",1)):
            for strand in range(5):
                points=[]
                for j in range(9):
                    z=1.61-j*.081-(strand%2)*.009
                    points.append((sign*(.242+.011*strand+.012*math.sin(j*.8+strand*.5)),
                                   -.151+strand*.073+.011*math.sin(j*.65),z))
                _strand(ctx,"PRM_Hair_Long_%s_%d"%(side,strand),points,.055,.061,hair_sets[1 if strand in (1,3) else 0])
                hair_count+=1
        # Back lengths complete the 360-degree silhouette without a flat curtain.
        for strand,x in enumerate((-.185,-.112,-.038,.040,.115,.187)):
            points=[(x+.013*math.sin(j*.6+strand),.195+.009*math.cos(j),1.59-j*.077) for j in range(8)]
            _strand(ctx,"PRM_Hair_LongBack_%d"%strand,points,.080,.052,hair_sets[0])
            hair_count+=1
    elif style=="locs":
        for side,sign in (("L",-1),("R",1)):
            for strand in range(4):
                points=[(sign*(.26+.012*math.sin(j+strand)),.005+strand*.043,1.70-j*.064) for j in range(6+strand%2)]
                _strand(ctx,"PRM_Hair_Loc_%s_%d"%(side,strand),points,.057,.070,hair_sets[1 if strand==1 else 0])
                hair_count+=1
    elif style in ("bun","ponytail"):
        center=(.065,.114,1.943 if style=="bun" else 1.873)
        box("Hair_TiedCore",center,(.186,.168,.176),ctx.mat("hair"),.012,slot="hair")
        for band in range(3):
            for i in range(7):
                a=i*2*math.pi/7+band*.19
                x=center[0]+math.cos(a)*.095
                y=center[1]+math.sin(a)*.087
                z=center[2]+(band-1)*.061
                lock("Tied_%d_%d"%(band,i),(x,y,z),(.061,.070,.084),1 if band==2 else 0,(.12*math.sin(a),.20*math.cos(a),a),.006)
        if style=="ponytail":
            for strand in range(4):
                points=[(.06+.040*strand+.012*math.sin(j*.8+strand),.215+.025*math.sin(j*.55),1.83-j*.069) for j in range(7)]
                _strand(ctx,"PRM_Hair_Pony_%d"%strand,points,.064,.069,hair_sets[strand%2])
                hair_count+=1

    accessory=ctx.character.accessory
    if accessory in ('cap','beanie'):
        for obj in list(bpy.data.objects):
            if obj.name.startswith('Headwear_'):ctx.remove(obj)
        hatmat=ctx.mat('accent') if accessory=='cap' else ctx.mat('top')
        vertices=[]
        profiles=[(1.772,.562,.444),(1.806,.582,.462),(1.875,.564,.448),(1.929,.467,.363),(1.955,.260,.232)]
        for z,w,d in profiles:
            vertices.extend((x,y+.023,z) for x,y in _octagon(w,d,.064))
        faces=[tuple(reversed(range(8)))]
        for row in range(4):
            faces.extend((row*8+k,row*8+(k+1)%8,(row+1)*8+(k+1)%8,(row+1)*8+k) for k in range(8))
        faces.append(tuple(range(32,40)))
        _mesh(ctx,'PRM_Headwear_TailoredCrown',vertices,faces,[hatmat],'face_accessory','head',.003)
        box('Headwear_TurnedRim',(0,.023,1.798),(.585,.466,.053),hatmat,.008,slot='face_accessory')
        if accessory=='cap':
            box('Headwear_BackwardsBrim',(0,.304,1.802),(.316,.207,.026),hatmat,.006,slot='face_accessory')
            box('Headwear_AdjustmentBand',(0,-.214,1.802),(.136,.009,.021),ctx.mat('black'),.002,slot='face_accessory')
            for i in range(5):
                box('Headwear_AdjustmentHole_'+str(i),(-.046+i*.020,-.220,1.802),(.007,.002,.007),hatmat,.001,slot='face_accessory')
        else:
            for i in range(35):
                box('Headwear_KnitRib_'+str(i),(-.260+i*.0153,-.212,1.799),(.002,.002,.036),ctx.mat('hair'),.0003,slot='face_accessory')
            box('Headwear_PinkBadge',(.172,-.219,1.824),(.046,.009,.030),ctx.mat('accent'),.001,slot='face_accessory')
    if accessory=='hoops':
        for obj in list(bpy.data.objects):
            if obj.name.startswith('Earring_'):ctx.remove(obj)
        for side,sign in (('L',-1),('R',1)):
            _ring(ctx,'PRM_Earring_Hoop_'+side,sign*.278,-.035,1.454,(.067,.100),(.049,.082),.008,ctx.mat('metal'),True)

    glasses=ctx.character.accessory in ("square_glasses","round_glasses")
    if glasses:
        rounded=ctx.character.accessory=="round_glasses"
        for side,sign in (("L",-1),("R",1)):
            x=sign*.121
            outer=(.183,.154) if rounded else (.177,.146)
            inner=(.161,.132) if rounded else (.151,.120)
            _ring(ctx,"PRM_Glasses_Frame_"+side,x,-.282,1.560,outer,inner,.020,ctx.mat("black"),rounded)
            _lens(ctx,"PRM_Glasses_Lens_"+side,x,-.280,1.560,*inner,ctx.mat("glass"),rounded)
            box("Glasses_Hinge_"+side,(sign*.218,-.269,1.599),(.015,.025,.024),ctx.mat("black"),.002,slot="face_accessory")
            _bar(ctx,"PRM_Glasses_TempleFront_"+side,(sign*.215,-.273,1.593),(sign*.266,-.077,1.590),.013,.016,ctx.mat("black"),"face_accessory")
            _bar(ctx,"PRM_Glasses_TempleHook_"+side,(sign*.266,-.077,1.590),(sign*.268,.014,1.549),.013,.014,ctx.mat("black"),"face_accessory")
            box("Glasses_HingePin_"+side,(sign*.217,-.285,1.600),(.005,.004,.006),ctx.mat("metal"),.0006,slot="face_accessory")
        _bar(ctx,"PRM_Glasses_Bridge_L",(-.034,-.282,1.578),(0,-.286,1.584),.011,.012,ctx.mat("black"),"face_accessory")
        _bar(ctx,"PRM_Glasses_Bridge_R",(0,-.286,1.584),(.034,-.282,1.578),.011,.012,ctx.mat("black"),"face_accessory")

    after=[o for o in bpy.context.scene.objects if o.type=="MESH"]
    added=[o for o in after if o.name.startswith(("PRM_Hair_","PRM_Face_","PRM_Glasses_"))]
    return {
        "module":"premium_face_hair", "style":style,
        "removedMeshes":remove, "addedMeshes":[o.name for o in added],
        "hairLocks":hair_count, "beforeMeshCount":len(before), "afterMeshCount":len(after),
        "beforeRawVertices":before_vertices,
        "afterRawVertices":sum(len(o.data.vertices) for o in after),
        "notes":["Geometric stepped locks, layered eyes, ear anatomy, multi-segment smile.",
                 "All additions preserve the existing head bone and modular slot parenting.",
                 "Visual and pose QA are performed by the calling pipeline, not asserted here."],
    }
