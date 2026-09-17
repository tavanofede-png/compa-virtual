"""Reference comparison correction: darker crafted wood and authored detail.

No generated reference image is baked onto furniture. Scenic art is limited to
the exterior view, all foreground silhouettes and small objects are geometry.
"""
import bpy,math,random
from mathutils import Vector
import personal_study_assets as A
from build_harper import rgba
from personal_study_assets import I,E

def delete_root(name):
    ob=bpy.data.objects.get(name)
    if not ob:return
    for child in list(ob.children_recursive):bpy.data.objects.remove(child,do_unlink=True)
    bpy.data.objects.remove(ob,do_unlink=True)

def wood_finish(K):
    palette={'oak':('#301B0F','#765036'),'woodlight':('#493020','#926743'),'oak_end':('#412717','#815835'),'ex_oak':('#352114','#744A2C'),'ex_oak_light':('#493120','#94623E'),'ex_oak_edge':('#352213','#835533')}
    for key,(lo,hi) in palette.items():
        mat=K.mat(key);nodes=mat.node_tree.nodes;links=mat.node_tree.links;p=nodes['Principled BSDF']
        mat.diffuse_color=rgba(hi);p.inputs['Base Color'].default_value=rgba(hi);p.inputs['Roughness'].default_value=.53
        for link in list(p.inputs['Base Color'].links):links.remove(link)
        for link in list(p.inputs['Normal'].links):links.remove(link)
        tex=nodes.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=3;tex.inputs['Detail'].default_value=4;tex.inputs['Roughness'].default_value=.7
        coord=nodes.new('ShaderNodeTexCoord');scale=nodes.new('ShaderNodeVectorMath');scale.operation='MULTIPLY';scale.inputs[1].default_value=(1.5,32,6)
        links.new(coord.outputs['Generated'],scale.inputs[0]);links.new(scale.outputs[0],tex.inputs['Vector'])
        ramp=nodes.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].position=.18;ramp.color_ramp.elements[0].color=rgba(lo);ramp.color_ramp.elements[1].position=.8;ramp.color_ramp.elements[1].color=rgba(hi)
        links.new(tex.outputs['Fac'],ramp.inputs[0]);links.new(ramp.outputs[0],p.inputs['Base Color'])
        bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.25;bump.inputs['Distance'].default_value=.0023;links.new(tex.outputs['Fac'],bump.inputs['Height']);links.new(bump.outputs[0],p.inputs['Normal'])
    K.material('grain_dark','#4B2E19',.8);K.material('grain_light','#A2784A',.67)
    # Modeled end-grain and long grain on broad visible timber parts.
    for ob in list(bpy.context.scene.objects):
        if ob.type!='MESH' or len(ob.data.vertices)!=8 or not ob.data.materials:continue
        if ob.data.materials[0].name not in ('MAT_OAK','MAT_WOODLIGHT','MAT_OAK_END','MAT_EX_OAK_LIGHT'):continue
        dims=ob.dimensions
        if max(dims)<.32 or 'Studio' in ob.name:continue
        rng=random.Random(ob.name);verts=[];faces=[]
        for poly in ob.data.polygons:
            pts=[ob.data.vertices[j].co.copy() for j in poly.vertices];u=pts[1]-pts[0];v=pts[3]-pts[0]
            if u.length<v.length:u,v=v,u
            if v.length<.038:continue
            n=u.cross(v).normalized();n=poly.normal.copy();length=u.length;width=v.length;count=min(14,max(3,int(width/.024)))
            for row in range(count):
                t=(row+.5)/count;start=rng.uniform(.02,.16);end=rng.uniform(.82,.98);base=len(verts)
                for j in range(15):
                    q=start+(end-start)*j/14;wiggle=.004*math.sin(q*17+row*3)+.0014*math.sin(q*42+row)
                    center=pts[0]+u*q+v*(t+wiggle/max(width,.1))+n*.001
                    verts.extend([center-v.normalized()*.00075,center+v.normalized()*.00075])
                for j in range(14):faces.append((base+j*2,base+j*2+1,base+j*2+3,base+j*2+2))
        if verts:
            obj=K.mesh('Visible carved wood grain '+ob.name,verts,faces,'grain_dark','CRAFTED_WOOD',0,parent=ob)
            if 'placeable_owner' in ob:obj['placeable_owner']=ob['placeable_owner']
        # Pegs and joinery follow the end of posts/rails, not arbitrary decoration.
        if max(dims)>.6 and min(dims)>.06:
            axis=max(range(3),key=lambda i:dims[i]);other=[i for i in range(3) if i!=axis]
            for sign in (-1,1):
                pos=[0,0,0];pos[axis]=sign*(dims[axis]/2-.045);pos[other[0]]=dims[other[0]]/2+.001
                size=[.008,.008,.008];size[other[0]]=.003
                peg=K.box('Inset endgrain dowel',pos,size,'oak','CRAFTED_WOOD',.001,parent=ob)
                if 'placeable_owner' in ob:peg['placeable_owner']=ob['placeable_owner']

def lush_bush(K,name,p,r=.30,h=.55,seed=1,flowers=False):
    rng=random.Random(seed);vertices=[];faces=[];mids=[]
    for branch in range(11):
        a=branch*2.399;reach=r*rng.uniform(.30,.90);top=Vector((p[0]+math.cos(a)*reach,p[1]+math.sin(a)*reach,p[2]+h*rng.uniform(.55,1)))
        A.line(name+' branching stem',[p,(p[0],p[1],p[2]+h*.45),top],.006,'leaf_deep')
        for j in range(19):
            a=rng.random()*math.tau;rr=r*.44*math.sqrt(rng.random());center=top+Vector((rr*math.cos(a),rr*math.sin(a),rng.uniform(-h*.28,h*.16)))
            sx=rng.uniform(.034,.071);sy=sx*rng.uniform(.5,.85);sz=sx*.34;idx=len(vertices)
            vertices.extend([(center.x+dx*sx,center.y+dy*sy,center.z+dz*sz) for dx,dy,dz in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]])
            faces.extend([tuple(idx+i for i in f) for f in [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]]);mids.extend([rng.randrange(3)]*6)
        if flowers and branch%2==0:
            for j in range(4):E._flower(K,name+' clustered blossom',top+Vector((.04*math.cos(j*1.5),.04*math.sin(j*1.5),.04)),.053,'ex_petal_cream' if branch%3 else 'ex_petal_pink')
    ob=K.mesh(name+' dimensional foliage',vertices,faces,'leaf_deep','BOTANICALS',.004)
    ob.data.materials.append(K.mat('leaf_mid'));ob.data.materials.append(K.mat('leaf_fresh'))
    for face,idx in zip(ob.data.polygons,mids):face.material_index=idx

def brass_lantern(K,p,scale=1):
    E._lantern(K,'Warm framed lantern',p,scale)
    x,y,z=p
    for side in (-1,1):
        A.line('Lantern diagonal metalwork',[(x-.08*scale,y+side*.108*scale,z+.08*scale),(x+.08*scale,y+side*.108*scale,z+.30*scale)],.005*scale,'gold')

def cabinet_drawers(K,p,w=.62,h=.71,style='white'):
    col='ivory' if style=='white' else 'graphite';x,y,z=p
    A.b('Drawer cabinet carcass',(x,y,z+h/2),(w,.56,h),col,.008)
    for j in range(3):
        zz=z+.13+j*(h-.1)/3;A.b('Full width separate drawer',(x,y-.291,zz),(w-.027,.025,(h-.1)/3-.018),col,.005)
        A.b('Inset finger pull',(x,y-.307,zz+.063),(.18,.015,.027),'graphite' if style=='white' else 'metal',.005)
    A.b('Cabinet top cap',(x,y,z+h+.025),(w+.026,.59,.05),col,.009)
    for dx in (-w*.36,w*.36):A.b('Inset plinth feet',(x+dx,y,z-.01),(.08,.39,.06),'graphite',.004)

def apply(P):
    K=P.K;R=P.ROOM;W,D=P.DIMS[R];own=P.own;b=P.b;line=P.line
    # Replace the repeated spiky floor plants with layered, voxel leaf masses.
    plant_roots=[ob.name for ob in bpy.context.scene.objects if ob.type=='EMPTY' and ob.get('definition_id') in ('floor-plant','table-plant')]
    for name in plant_roots:
        root=bpy.data.objects.get(name)
        if not root:continue
        descendants=list(root.children_recursive)
        if not any('rachis' in ob.name for ob in descendants):continue
        pos=root.location.copy();scale=1
        pot=next((ob for ob in descendants if ob.name.startswith('Fluted ceramic')),None)
        if pot:scale=pot.dimensions.z/.32
        for ob in descendants:
            if any(key in ob.name for key in ('Fern curving rachis','Separate fern pinna')):bpy.data.objects.remove(ob,do_unlink=True)
        before=set(bpy.data.objects);lush_bush(K,'Layered fern '+root.name,(0,0,.34*scale),.27*scale,.60*scale,sum(map(ord,root.name)))
        for ob in set(bpy.data.objects)-before:ob.parent=root;ob['placeable_owner']=root['placeable_id']
    # Preserve reference-specific floor finish and rug colour.
    if R in ('minimal','loft'):
        for ob in bpy.context.scene.objects:
            if ob.type=='MESH' and 'woven' in ob.name.lower() and ob.get('placeable_owner') in ('loft-woven-rug','minimal-woven-rug'):
                ob.data.materials.clear();ob.data.materials.append(K.mat('fabric_ivory' if R=='loft' else 'rug_cream'))
                for poly in ob.data.polygons:poly.material_index=0
    if R=='library':
        for j,p in enumerate([(-1.78,-.78,2.75),(-1.65,1.28,2.72),(.53,1.53,2.72)]):
            own('Library upper lush plant '+str(j),'hanging-plant',lambda p=p,j=j:lush_bush(K,'Library lush crown '+str(j),p,.25,.27,30+j))
        for j,(p,s) in enumerate([((-1.70,-1.66,.03),1.05),((1.90,1.05,.65),.75)]):
            if j==0:
                delete_root('standing-reading-lamp');P.floorlamp(p)
            else:P.lamp('Library reading table lamp',p,'pleated',s)
        for j,p in enumerate([(-1.76,-.21,1.05),(-.78,1.44,1.90)]):
            # Small framed botanical subjects sit within deliberately reserved bays.
            P.picture('Botanical shelf image '+str(j),'LEAF',p,.20,.27)
        # Different bindings and foil rhythm avoid repeated white labels.
        for ob in bpy.context.scene.objects:
            if ob.type=='MESH' and '_SpineLabel' in ob.name and 'library volume' in ob.name:
                n=sum(map(ord,ob.name));ob.data.materials.clear();ob.data.materials.append(K.mat(['navy','binding_red','binding_parchment','sage'][n%4]))
    elif R=='terrace':
        delete_root('Terrace climbing branch 0')
        for j,p in enumerate([(-2.04,1.35,.52),(-1.26,1.52,.52),(-.36,1.57,.52),(.52,1.56,.52),(1.97,.64,.52)]):
            own('Terrace mature garden '+str(j),'floor-plant',lambda p=p,j=j:lush_bush(K,'Terrace mixed planting '+str(j),p,.33,.55,81+j,j%2==0))
        for j,p in enumerate([(-1.98,-1.19,.045),(-.42,.96,.045),(1.98,-.85,.045)]):brass_lantern(K,p,.92)
        # Timber planter facing on masonry has slats and metal corner brackets.
        for x,w in [(-1.43,1.26),(.20,1.2)]:
            for j in range(4):b('Outdoor cedar horizontal slat',(x,1.145,.10+j*.095),(w+.12,.029,.086),'woodlight',.004)
            for side in (-1,1):b('Planter iron strap',(x+side*w*.40,1.122,.25),(.028,.012,.38),'graphite',.003)
    elif R=='pergola':
        for j in range(10):delete_root('Hydrangea and fern '+str(j))
        for j in range(6):
            y=-1.4+j*.58
            for side in (-1,1):own(f'Garden substantial planting {side}-{j}','floor-plant',lambda y=y,side=side,j=j:lush_bush(K,'Garden leafy border',(side*1.96,y,.44),.35,.47+(j%3)*.1,151+j+side*9,True))
        for j in range(6):
            x=-1.55+j*.60;own('Rear garden leafy depth '+str(j),'hanging-plant',lambda x=x,j=j:lush_bush(K,'Trellis canopy',(x,1.79,1.70),.33,.57,178+j,True))
        # Irregular small moss growth is in paving joints, never in the access route.
        for j in range(58):
            rng=random.Random(902+j);x=rng.uniform(-1.65,1.65);y=rng.uniform(-1.8,1.4)
            if -.25<x<1.25 and y<.7:continue
            b('Moss in stone joint',(x,round(y/.32)*.32,.041),(.11+rng.random()*.1,.025,.008),'leaf_deep',.004)
        for p in [(-1.70,.80,1.90),(-.10,1.12,1.90),(1.67,.90,1.90)]:brass_lantern(K,p,.93);line('Lantern brass suspension',[(p[0],p[1],p[2]+.45),(p[0],p[1],2.72)],.008,'gold')
    elif R=='cafe':
        # Real stage below the larger pastry case, no floating display.
        ob=bpy.data.objects.get('pastry-display')
        if ob:ob.scale=(1.12,1.12,1.15);ob.location.z=.31
        for i,p in enumerate([(-1.64,1.52,2.60),(-1.79,-.48,2.39),(-1.78,-.90,.43),(1.77,1.52,.20)]):
            own('Cafe rich planting '+str(i),'table-plant',lambda p=p,i=i:lush_bush(K,'Cafe foliage',p,.24,.40,40+i))
        for j,p in enumerate([(-1.47,.20,.96),(-.86,1.44,1.62)]):
            for q in range(3):A.c('Stacked coffee saucer',(p[0]+q*.15,p[1],p[2]),.065,.011,'ivory',24)
        for ob in bpy.context.scene.objects:
            if ob.type=='MESH' and 'Espresso chassis' in ob.name:ob.data.materials.clear();ob.data.materials.append(K.mat('graphite'))
        b('Cafe menu hinge crossbar',(1.54,-1.0,1.30),(.66,.05,.045),'gold',.005)
        for x in (-.83,-.28,.27):
            for j in range(5):b('Banquette stitched channel',(x-.22+j*.105,1.304,.87),(.002,.002,.41),'fabric_seam',0)
    elif R=='minimal':
        own('Substantial white pedestal','rolling-drawers',lambda:cabinet_drawers(K,(0,0,0),.65,.68),(1.01,1.43,.035))
        # Actual peg-mounted objects, with small catalogue art panels.
        for j,(x,z) in enumerate([(-.02,1.90),(.37,1.83),(1.11,1.51)]):
            b('Planning art card',(x,D/2-.206,z),(.24,.01,.27),'paper',.002)
            b('Planning card landscape',(x,D/2-.214,z+.025),(.205,.003,.14),'sage' if j%2 else 'blue',.001)
            b('Card pin',(x,D/2-.22,z+.13),(.014,.012,.014),'gold',.003)
        for j in range(4):
            for x in (-.78,-.53):A.line('Scissor loop',[(x+.025*math.cos(q),D/2-.255,1.34+.04*math.sin(q)) for q in [n*math.tau/16 for n in range(17)]],.004,'metal')
        for p in [(-1.72,.14,1.52),(-1.72,.95,2.35)]:own('Minimal full shelf plant '+str(p),'table-plant',lambda p=p:lush_bush(K,'Minimal fern',p,.21,.22,40))
        P.vines('Minimal trailing shelf plant',[(-1.78,.61,2.03),(-1.71,.50,1.7),(-1.71,.44,1.26)],208)
        brass_lantern(K,(-1.57,-1.31,.04),.83)
    elif R=='tech':
        delete_root('Tech focus panel')
        P.picture('Tech gallery artwork','FOCUS',(-W/2+.11,-1.39,1.85),.61,.77,'navy',math.pi/2)
        own('Tech left workstation pedestal','rolling-drawers',lambda:cabinet_drawers(K,(0,0,0),.59,.67,'dark'),(-1.49,-.88,.045))
        own('Tech right workstation pedestal','rolling-drawers',lambda:cabinet_drawers(K,(0,0,0),.69,.67,'dark'),(1.42,1.32,.045))
        # Notebook and laptop in front of the monitors are moved aside for the keyboard.
        ob=bpy.data.objects.get('study-laptop')
        if ob:ob.location.x=-1.26;ob.location.y=.11;ob.scale=(.75,.75,.75)
        ob=bpy.data.objects.get('study-notebook')
        if ob:ob.location.x=-.94
        ob=bpy.data.objects.get('study-books')
        if ob:ob.location.x=-1.59
        for i,p in enumerate([(-1.82,-.40,1.98),(-1.83,.76,2.40),(1.70,1.78,1.89)]):
            own('Tech wall full fern '+str(i),'table-plant',lambda p=p,i=i:lush_bush(K,'Tech shelf plant',p,.22,.26,309+i))
        b('Right tech display shelf',(1.64,1.72,1.82),(.80,.33,.055),'graphite',.003)
        for j in range(3):b('Study journal in tech nook',(1.36+j*.075,1.68,2.01),(.058,.22,.31),'navy' if j%2 else 'ivory',.003)
        own('Visible student backpack','backpack',lambda:I.backpack(K,'Graphite backpack',(0,0,0),'fabric_blue'),(1.59,-1.11,.035),-.08)
        # Tilted smaller side monitors and varied focus interfaces.
        for j in range(3):
            ob=bpy.data.objects.get('Monitor '+str(j))
            if ob:ob.rotation_euler.z=[.16,0,-.16][j]
        for j in range(11):b('Monitor chart column',(-.46+j*.057,1.464,1.06+(j%5)*.012),(.021,.004,.06+(j%5)*.024),'cyan',.001)
    elif R=='pavilion':
        # Continuous dark roof underside closes gaps without reducing tile count.
        z=2.88;w=W-1.08;d=D-1.05;ww=w/2+.20;dd=d/2+.20
        K.mesh('Continuous pavilion roof sheathing',[(-ww,-dd,z),(-ww,dd,z),(ww,dd,z),(ww,-dd,z),(0,0,z+.835)],[(0,1,4),(1,2,4),(2,3,4),(3,0,4)],'oak','ARCHITECTURE',0)
        for x,y in [(-ww,-dd),(-ww,dd),(ww,dd),(ww,-dd)]:
            for j in range(12):
                t=(j+.5)/12;p=Vector((x,y,z)).lerp(Vector((0,0,z+.88)),t)
                b('Roof hip cap tile',p,(.20,.23,.064),'roof_dark',.012,rot=(0,0,math.atan2(y,x)))
        for j,p in enumerate([(-2.04,-1.18,.45),(-2.01,.22,.45),(2.01,-1.18,.45),(2.01,.35,.45)]):own('Pavilion rich garden '+str(j),'floor-plant',lambda p=p,j=j:lush_bush(K,'Park layered flowers',p,.40,.55,270+j,True))
        for j in range(2):
            ob=bpy.data.objects.get('Park canopy tree '+str(j))
            if ob:ob.scale=(1.22,1.22,1.1)
        for p in [(-1.64,1.10,1.86),(.87,1.09,1.86),(-1.69,-1.40,.44),(1.68,-1.4,.44)]:brass_lantern(K,p,.89)
    elif R=='loft':
        # Clip the actual scenic polygon and its UVs to the window aperture.
        ob=bpy.data.objects.get('Triangular loft sunset')
        if ob:
            mesh=bpy.data.meshes.new('True triangular window view');mesh.from_pydata([(-.88,0,-.58),(.88,0,-.58),(0,0,.67)],[],[(0,1,2)]);mesh.materials.append(ob.data.materials[0]);uv=mesh.uv_layers.new()
            for v,co in zip(uv.data,[(.05,.06),(.95,.06),(.5,.86)]):v.uv=co
            ob.data=mesh;ob.location.y=D/2-.12
        for ob in list(bpy.data.objects):
            if ob.name.startswith('Gable window mask'):bpy.data.objects.remove(ob,do_unlink=True)
        # Solid wall above and below now follows the true triangular gable silhouette.
        for j,p in enumerate([(-1.79,-.48,2.25),(-1.73,.84,2.32),(1.75,1.55,1.23)]):own('Loft lush plant '+str(j),'hanging-plant',lambda p=p,j=j:lush_bush(K,'Loft lush hanging crown',p,.24,.30,61+j))
        for z in (.18,.67,1.12):
            b('Loft right narrow open shelf',(1.83,.94,z),(.46,.64,.048),'woodlight',.004)
            for i in range(4):K.book('Loft folio',(1.65+i*.064,.91,z+.027),.048,.23,.21,['navy','sage','ivory','rust'][i])
        for x in (-1.86,-1.06,-.24):
            I.local_glow(K,'Loft library pool',(x,1.25,2.16),8,.14)
        P.picture('Loft lunar artwork','☾',(1.67,D/2-.09,1.84),.70,.86,'navy')
    wood_finish(K)
