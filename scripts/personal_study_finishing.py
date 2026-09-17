"""Silhouette, joinery, botanical and textile corrections for study masters.

This pass operates on authored Blender geometry, and remains reproducible from
the scene builder. Detail belongs to the same editable item as its support.
"""
import bpy, math, random, re, json
from mathutils import Vector, Matrix
import personal_study_assets as A
from personal_study_assets import E, I
from personal_study_fidelity import delete_root
from build_harper import rgba


def capture(K, root, fn):
    before=set(bpy.data.objects);fn()
    created=set(bpy.data.objects)-before
    for ob in created:
        if ob.parent not in created:ob.parent=root
        if root and 'placeable_id' in root:ob['placeable_owner']=root['placeable_id']


def curved_foliage(K,name,p,r,h,seed):
    """Layered faceted leaves with a curved midrib, tapered tips and varied lean."""
    rng=random.Random(seed);verts=[];faces=[];mats=[]
    for j in range(21):
        a=j*2.399;reach=r*rng.uniform(.55,1.15)
        end=Vector((p[0]+math.cos(a)*reach,p[1]+math.sin(a)*reach,p[2]+h*rng.uniform(.50,1)))
        start=Vector(p);mid=start.lerp(end,.50)+Vector((0,0,h*.10))
        A.line(name+' arching botanical stem',[start,mid,end],.0035,'leaf_deep')
        for level in range(3):
            t=.43+level*.23;anchor=mid.lerp(end,t)
            for side in (-1,1):
                theta=a+side*(1.15-level*.19)+rng.uniform(-.3,.3)
                length=r*rng.uniform(.42,.72)*(1-level*.13)
                axis=Vector((math.cos(theta),math.sin(theta),.25+level*.06)).normalized()
                cross=Vector((-math.sin(theta),math.cos(theta),0))
                width=length*.32;idx=len(verts)
                # Five cross-sections, folded around a pronounced central vein.
                for q in range(6):
                    f=q/5;ww=width*math.sin(math.pi*f)**.80
                    center=anchor+axis*length*f+Vector((0,0,length*.25*math.sin(f*math.pi)-length*.23*f*f))
                    verts.extend([center-cross*ww-Vector((0,0,ww*.18)),center+Vector((0,0,ww*.17)),center+cross*ww-Vector((0,0,ww*.18))])
                mi=rng.choices([0,1,2],[4,5,1])[0]
                for q in range(5):
                    for col in range(2):
                        faces.append((idx+q*3+col,idx+(q+1)*3+col,idx+(q+1)*3+col+1,idx+q*3+col+1));mats.append(mi)
    ob=K.mesh(name+' folded leaves',verts,faces,'leaf_deep','BOTANICALS',0)
    ob.data.materials.append(K.mat('leaf_mid'));ob.data.materials.append(K.mat('leaf_fresh'))
    for f,m in zip(ob.data.polygons,mats):f.material_index=m
    sol=ob.modifiers.new('Leaf thickness','SOLIDIFY');sol.thickness=.003


def improve_foliage(K):
    # Remove only the repetitive pancake leaf masses; retain containers, stems,
    # blossoms and original climbing plants. Each replacement has its own scale.
    names=[o.name for o in bpy.context.scene.objects if o.type=='MESH' and 'dimensional foliage' in o.name]
    for name in names:
        ob=bpy.data.objects.get(name)
        if not ob:continue
        parent=ob.parent;owner=ob.get('placeable_owner');matrix=ob.matrix_local.copy()
        points=[v.co for v in ob.data.vertices]
        lo=Vector(tuple(min(v[i] for v in points) for i in range(3)));hi=Vector(tuple(max(v[i] for v in points) for i in range(3)))
        center=(lo+hi)/2;r=max(hi.x-lo.x,hi.y-lo.y)*.46;h=max(.22,hi.z-lo.z)
        pos=(center.x,center.y,lo.z-h*.15)
        bpy.data.objects.remove(ob,do_unlink=True)
        before=set(bpy.data.objects);curved_foliage(K,name,pos,r,h,seed=sum(map(ord,name)))
        for new in set(bpy.data.objects)-before:
            new.parent=parent
            if owner:new['placeable_owner']=owner


def chunky_rug(K,root):
    old=next((ob for ob in root.children_recursive if ob.type=='MESH' and ob.name.startswith('Individual woven loops')),None)
    if not old:return
    verts=[v.co for v in old.data.vertices];w=max(v.x for v in verts)-min(v.x for v in verts);d=max(v.y for v in verts)-min(v.y for v in verts)
    scheme='blue' if 'blue' in root.name else 'cream' if 'minimal' in root.name or 'loft' in root.name else 'sage'
    circular='round' in root.get('definition_id','')
    bpy.data.objects.remove(old,do_unlink=True)
    def knit():
        vs=[];fs=[];ids=[];step=.042;nx=round(w/step);ny=round(d/step)
        for ix in range(nx):
            for iy in range(ny):
                x=-w/2+(ix+.5)*w/nx;y=-d/2+(iy+.5)*d/ny
                if circular and (x/(w/2))**2+(y/(d/2))**2>.97:continue
                mat=(int((x+w/2)/.37)+int((y+d/2)/.37))%2 if scheme=='sage' else 0
                idx=len(vs);angle=.28 if (ix+iy)%2 else -.28
                for ring in range(5):
                    t=ring*math.pi/4
                    for q in range(8):
                        a=q*math.tau/8;xx=.0195*math.sin(t)*math.cos(a);yy=.024*math.cos(t)
                        vs.append((x+xx*math.cos(angle)-yy*math.sin(angle),y+xx*math.sin(angle)+yy*math.cos(angle),.026+.013*math.sin(t)*math.sin(a)))
                for ring in range(4):
                    for q in range(8):fs.append((idx+ring*8+q,idx+ring*8+(q+1)%8,idx+(ring+1)*8+(q+1)%8,idx+(ring+1)*8+q));ids.append(mat)
        base='fabric_blue' if scheme=='blue' else 'rug_cream'
        ob=K.mesh('Dense handwoven interlocking wool',vs,fs,base,'TEXTILES',0)
        ob.data.materials.append(K.material('fabric_sage','#677748',.82))
        for f,i in zip(ob.data.polygons,ids):f.material_index=i
    capture(K,root,knit)


def refine_books(K):
    roots=[ob for ob in bpy.context.scene.objects if ob.type=='EMPTY' and any(re.search(r'_Spine(?:\.\d+)?$',c.name) for c in ob.children)]
    colors=['navy','binding_teal','binding_red','oak','sage','binding_blue']
    for j,root in enumerate(roots):
        spine=next(c for c in root.children if re.search(r'_Spine(?:\.\d+)?$',c.name))
        h=spine.dimensions.z;w=spine.dimensions.x;y=spine.location.y-.007
        label=next((c for c in root.children if '_SpineLabel' in c.name),None)
        if label:
            if j%5!=0:label.data.materials.clear();label.data.materials.append(spine.data.materials[0])
            else:label.scale.z=.50
        for c in root.children:
            if '_LabelLine_' in c.name:
                c.data.materials.clear();c.data.materials.append(K.mat('gold' if j%5 else 'ink'));c.scale.x=.75
        # Raised bound headbands and tooling stay on the cover, not on pages.
        for z in (.022,h-.022):
            ob=K.box('Leather binding raised headband',(0,y,z),(w*.87,.004,.004),'gold','BINDINGS',.0005,parent=root)
            if 'placeable_owner' in spine:ob['placeable_owner']=spine['placeable_owner']
        if j%7==0:
            text=K.text('Embossed volume number',str(j%24+1).zfill(2),(0,y-.004,h*.72),min(.021,w*.45),'gold','BINDINGS',(math.pi/2,0,0))
            text.parent=root
            if 'placeable_owner' in spine:text['placeable_owner']=spine['placeable_owner']
        root.location.y+=random.Random(root.name).uniform(-.015,.010)


def tailored_cushions(K):
    # Rebuild box-like decorative cushions with convex sewn shells.
    names=[ob.name for ob in bpy.context.scene.objects if ob.type=='MESH' and 'throw pillow' in ob.name and len(ob.data.vertices)==8]
    for name in names:
        ob=bpy.data.objects.get(name)
        if not ob:continue
        parent=ob.parent;p=ob.location.copy();rot=ob.rotation_euler.copy();dims=ob.dimensions.copy();owner=ob.get('placeable_owner')
        key=ob.data.materials[0].name.removeprefix('MAT_').lower()
        for child in list(ob.children_recursive):bpy.data.objects.remove(child,do_unlink=True)
        bpy.data.objects.remove(ob,do_unlink=True)
        before=set(bpy.data.objects);E._soft_cushion(K,'Sewn soft reading pillow',p,dims.x,dims.z,dims.y*1.30,key,parent=parent,rotation=rot)
        for new in set(bpy.data.objects)-before:
            if owner:new['placeable_owner']=owner
    for ob in list(bpy.context.scene.objects):
        if ob.type!='MESH':continue
        if 'underframe' in ob.name and 'reading' in ob.name:
            ob.scale.z=.53;ob.location.z-=.055
        if 'pillow woven accent' in ob.name:ob.hide_render=True;ob.hide_viewport=True
        if ob.name.startswith('Mortised leg'):
            ob.scale.x*=1.22;ob.scale.y*=1.22
        if ob.name.startswith('Solid tabletop board'):
            ob.scale.z=1.5;ob.location.z-=.0125
        if ob.name.startswith('Drawer cabinet') or ob.name.startswith('Individual inset drawer') or ob.name.startswith('Drawer raised field'):
            if ob.dimensions.x<.40:ob.scale.x*=1.20


def room_additions(P):
    K=P.K;R=P.ROOM;own=P.own;W,D=P.DIMS[R]
    from personal_study_detail_pass import storage_box,jar,clock
    if R=='library':
        # A complete classical crown has distinct stepped mouldings and endgrain.
        for rootname in ('bookcase-left','bookcase-rear'):
            root=bpy.data.objects.get(rootname)
            if not root:continue
            crown=next(o for o in root.children_recursive if o.name.startswith('Crown shaped cornice'))
            width=crown.dimensions.x-.13;h=crown.location.z
            def cornice(width=width,h=h):
                for z,y,depth,thick in [(h-.085,-.045,.49,.035),(h+.066,.0,.57,.038),(h+.097,.0,.58,.018)]:A.b('Stepped library cornice',(0,y,z),(width+.13,depth,thick),'oak_end',.004)
                for x in (-width/2+.045,width/2-.045):
                    for z in (.14,h-.12):
                        A.b('Carpentry inset corner bracket',(x,-.277,z),(.077,.008,.085),'graphite',.003)
                        for dx in (-.020,.020):A.b('Slotted brass fastener',(x+dx,-.283,z),(.009,.004,.009),'gold',.001)
            capture(K,root,cornice)
        # No extra objects are put on top of the clear notebook work area.
        for j,(name,p) in enumerate([('Library postcard beside lamp',(1.66,1.06,.632)),('Library correspondence box',(-1.20,-1.35,.151))]):
            own(name,'storage-boxes',storage_box,p)
        for rootname in ['Library statement']:
            ob=bpy.data.objects.get(rootname)
            if ob:
                for c in ob.children_recursive:
                    if c.type=='FONT':c.data.size*=1.4
    elif R=='cafe':
        # Coffee service has real plumbing, gauges, handles and separate containers.
        root=bpy.data.objects.get('espresso-machine')
        if root:
            def details():
                for x in (-.10,.10):
                    o=A.c('Espresso pressure gauge',(x,-.159,.30),.030,.007,'ivory',24);o.rotation_euler.x=math.pi/2
                    A.line('Gauge indicator',[(x,-.165,.30),(x+.013,-.166,.314)],.002,'graphite')
                    A.line('Portafilter handle',[(x,-.14,.13),(x,-.27,.105)],.013,'graphite')
                A.line('Steam wand',[(-.19,-.08,.25),(-.23,-.11,.16),(-.22,-.16,.06)],.006,'metal')
                for j in range(10):A.b('Drip tray grate',(-.15+j*.033,-.145,.039),(.012,.13,.007),'metal',.002)
            capture(K,root,details)
        own('Café coffee sacks','storage-boxes',storage_box,(-1.52,-.82,.047))
        # Additional cups are on the rear wall service shelf, not floating.
        for x in (-1.02,-.77,-.52):
            I.mug(K,'Porcelain saucer service',(x,1.62,1.61),'ivory');A.c('Fine café saucer',(x,1.62,1.613),.085,.008,'ivory',24)
        # Repeated empty glass volume made pastry hard to read; show layers clearly.
        for ob in bpy.context.scene.objects:
            if ob.type=='MESH' and 'pastry' in ob.name.lower() and ob.data.materials and 'GLASS' in ob.data.materials[0].name:
                ob.hide_render=True
    elif R=='minimal':
        # Hooked scissors and pinboard mounts attach to the board rather than wall air.
        for ob in list(bpy.context.scene.objects):
            if ob.name.startswith('Scissor loop'):bpy.data.objects.remove(ob,do_unlink=True)
        for x in (-.03,.08):
            A.line('Pegboard scissor grip',[(x+.022*math.cos(q),D/2-.28,1.69+.034*math.sin(q)) for q in [j*math.tau/18 for j in range(19)]],.004,'graphite')
        for x in (-.03,.08):A.line('Pegboard scissor blade',[(x,D/2-.28,1.72),(.025,D/2-.28,1.84)],.006,'metal')
        A.b('Concealed warm batten fascia',(.91,D/2-.151,2.45),(2.06,.052,.065),'woodlight',.004)
        I.local_glow(K,'Batten wall wash',(.95,D/2-.22,2.40),18,.45)
        # Desk fan has a cage, blades, motor and weighted foot.
        def fan():
            A.b('Fan weighted base',(0,0,.014),(.19,.13,.028),'ivory',.008)
            A.b('Fan pedestal',(0,.03,.105),(.035,.045,.17),'ivory',.007)
            for r in (.13,.104,.077):A.line('Fan concentric cage',[(r*math.cos(t),-.015,.265+r*math.sin(t)) for t in [j*math.tau/36 for j in range(37)]],.004,'metal')
            for j in range(12):
                a=j*math.tau/12;A.line('Fan radial wire',[(.023*math.cos(a),-.02,.265+.023*math.sin(a)),(.13*math.cos(a),-.02,.265+.13*math.sin(a))],.003,'metal')
            for j in range(4):
                a=j*math.tau/4;A.b('Fan shaped blade',(.059*math.cos(a),.01,.265+.059*math.sin(a)),(.092,.016,.045),'ivory',.013,rot=(0,-a-.4,0))
            ob=A.c('Fan center cap',(0,-.024,.265),.026,.016,'gold',16);ob.rotation_euler.x=math.pi/2
        own('Quiet desktop fan','desk-fan',fan,(.18,1.47,.802))
        for rootname in ['Minimal floor plant']:
            ob=bpy.data.objects.get(rootname)
            if ob:ob.scale*=.87
    elif R=='tech':
        # Deep metal rails and circuit details inside the tempered computer case.
        root=bpy.data.objects.get('tempered-pc')
        if root:
            capture(K,root,lambda:(A.b('Motherboard',(.0,.05,.25),(.19,.016,.30),'navy',.002),A.b('Graphics card',(0,-.055,.18),(.18,.24,.048),'graphite',.005),A.b('GPU luminous accent',(0,-.179,.182),(.16,.01,.008),'led_blue',.002)))
        # The right floor backpack already exists. Remove the occluded duplicate.
        delete_root('tech-canvas-backpack')
        root=bpy.data.objects.get('Tech gallery artwork')
        if root:
            for c in root.children_recursive:
                if c.type=='FONT':c.data.materials.clear();c.data.materials.append(K.mat('cyan'));c.data.size*=1.25
    elif R=='loft':
        # Structural timbers have a rectangular sawn section and real joints.
        for ob in list(bpy.context.scene.objects):
            if ob.type!='CURVE' or not ob.name.startswith(('Gable structural rafter','Structural ridge','Exposed attic rafter')):continue
            paths=[[ob.matrix_world@Vector(pt.co[:3]) for pt in spl.points] for spl in ob.data.splines]
            bpy.data.objects.remove(ob,do_unlink=True)
            for points in paths:
                for a,b in zip(points,points[1:]):
                    delta=b-a;beam=A.b('Rectangular attic structural timber',(a+b)/2,(.15,.17,delta.length),'woodlight',.009)
                    beam.rotation_euler=delta.to_track_quat('Z','Y').to_euler()
                    for sign in (-1,1):
                        plate=K.box('Timber mortise shoulder',(0,0,sign*(delta.length/2-.075)),(.163,.179,.040),'oak','CARPENTRY',.004,parent=beam)
        # Fit the window frame precisely to the newly triangular scenic opening.
        for ob in list(bpy.context.scene.objects):
            if ob.name.startswith(('Triangular oak window frame','Window sill','Central window mullion')):bpy.data.objects.remove(ob,do_unlink=True)
        for side in (-1,1):
            A.line('Triangular window assembled jamb',[(0,D/2-.15,3.14),(side*.88,D/2-.15,1.89)],.047,'woodlight')
            A.line('Jamb inner rebate',[(0,D/2-.162,3.07),(side*.81,D/2-.162,1.94)],.013,'oak')
        A.b('Triangular window sill',(0,D/2-.18,1.86),(1.94,.20,.08),'woodlight',.012)
        A.line('Window vertical mullion',[(0,D/2-.17,1.90),(0,D/2-.17,3.12)],.025,'woodlight')
        own('Attic soft linen storage','storage-boxes',storage_box,(1.78,.87,.19))
    elif R=='pavilion':
        # Pillars and steps retain bevelled construction and explicit mortar joints.
        for x in (-1.96,1.96):
            for z in (.18,.35):A.b('Pavilion masonry cap detail',(x,-1.04,z),(.51,1.38,.036),'tile',.004)
        delete_root('Pavilion botanical sign')
        P.picture('Park quiet places print','Quiet\nplaces.\nBrighter\nthinking.',(1.82,.97,1.39),.64,.99)
    # Larger readable lettering on statement artwork, without changing small labels.
    for root in [o for o in bpy.context.scene.objects if o.type=='EMPTY' and o.get('definition_id')=='framed-print']:
        for ob in root.children_recursive:
            if ob.type=='FONT' and len(ob.data.body)>14 and 'Library' not in root.name:ob.data.size*=1.14


def layout_corrections(P):
    """Correct measured furniture footprints and the matching source geometry."""
    path=P.OUT/'data'/f'{P.ROOM}-model-layout.json'
    layout=P.LAYOUT if P.LAYOUT else json.loads(path.read_text(encoding='utf-8'))
    if not bpy.context.scene.get('study_layout_revision'):
        if P.ROOM=='library':
            ob=bpy.data.objects.get('bookcase-rear');ob.location.y-=.07
            next(i for i in layout['items'] if i['id']=='bookcase-rear')['z']+=.07
        elif P.ROOM=='loft':
            ob=bpy.data.objects.get('attic-left-bookcase');ob.location.x+=.04
            next(i for i in layout['items'] if i['id']=='attic-left-bookcase')['x']+=.04
        elif P.ROOM=='terrace':
            for name in ('desk','chair','STUDY_SEAT','STUDY_APPROACH','STUDY_WORK'):
                ob=bpy.data.objects.get(name)
                if ob:ob.location.x-=.10
            for i in layout['items']:
                if i['id'] in ('desk','chair'):i['x']-=.10
            layout['studyZones'][0]['approach'][0]-=.10
        elif P.ROOM=='pergola':
            ob=bpy.data.objects.get('Garden border 2');ob.scale.x*=3.52/3.8
            next(i for i in layout['items'] if i['id']=='Garden border 2')['w']=3.52
        bpy.context.scene['study_layout_revision']=1
    if P.LAYOUT:P.LAYOUT=layout
    path.write_text(json.dumps(layout,ensure_ascii=False,indent=2),encoding='utf-8')


def apply(P):
    K=P.K
    layout_corrections(P)
    if not bpy.context.scene.get('study_contact_revision'):
        if P.ROOM=='minimal':
            for ob in bpy.context.scene.objects:
                if ob.name.startswith(('Warm framed lantern','Lantern diagonal metalwork')):ob.location.y-=.34
        elif P.ROOM=='tech':
            # Route signal cables behind the monitors, not through the work area.
            for ob in bpy.context.scene.objects:
                if ob.type=='CURVE' and ob.name.startswith('Braided signal cable'):
                    for spline in ob.data.splines:
                        for point in spline.points:point.co.y=1.575 if point.co.z>.9 else 1.675
            root=bpy.data.objects.get('study-notebook');support=bpy.data.objects.get('left-desk-return')
            if root and support:root.parent=support;root.location=(-.62,0,.76);root.rotation_euler=(0,0,0);root['support_id']=support['placeable_id']
            pots=[ob for ob in bpy.context.scene.objects if ob.type=='EMPTY' and ob.name.startswith('Tech wall plant ')]
            for j,pot in enumerate(pots):
                pot.location=(-1.25,1.67,1.92) if j==0 else (1.79,1.25,.795)
            # A cantilevered shelf has a real wall plate, brackets and fasteners.
            A.b('Tech upper wall display shelf',(-1.25,1.69,1.898),(.55,.35,.044),'graphite',.006)
            for x in (-1.42,-1.08):
                A.b('Shelf wall mount',(x,1.835,1.826),(.042,.029,.17),'metal',.004)
                A.line('Shelf steel triangular bracket',[(x,1.814,1.745),(x,1.55,1.875),(x,1.814,1.875)],.009,'metal')
        elif P.ROOM=='pavilion':
            W,D=P.DIMS[P.ROOM];w=W+.15;h=2.30;cy=D/2+.23;cz=1.62
            for x in (-w/2,w/2):
                A.b('Park panorama structural jamb',(x,cy,cz),(.090,.13,h+.09),'oak',.010)
                A.b('Park panorama inner rebate',(x+(.023 if x<0 else -.023),cy-.071,cz),(.018,.018,h),'gold',.003)
            for z in (cz-h/2,cz+h/2):A.b('Park panorama inset horizontal frame',(0,cy,z),(w+.08,.13,.09),'oak',.010)
            for x in (-w/2,w/2):A.b('Panorama timber support foot',(x,cy,.22),(.13,.18,.47),'oak',.010)
        bpy.context.scene['study_contact_revision']=1
    if P.ROOM=='pavilion':
        for ob in bpy.context.scene.objects:
            if ob.name.startswith('Panorama timber support foot'):
                ob.location.z=.10;ob.dimensions.z=.73
    if P.ROOM=='loft':delete_root('Loft lunar artwork')
    if P.ROOM=='tech':
        if not bpy.context.scene.get('study_peripheral_revision'):
            import personal_study_detail_pass as D
            root=bpy.data.objects.get('Dedicated mechanical keyboard')
            if root:
                for child in list(root.children_recursive):bpy.data.objects.remove(child,do_unlink=True)
                capture(K,root,D.keyboard)
            def mouse():
                A.b('Stitched desk mouse pad',(0,0,.002),(.17,.21,.004),'fabric_blue',.012)
                A.b('Mouse shaped shell',(0,0,.020),(.066,.106,.036),'ivory',.019)
                A.b('Mouse divided buttons',(0,.024,.038),(.002,.047,.003),'graphite',.0005)
                A.b('Mouse textured scroll wheel',(0,.024,.041),(.008,.022,.006),'graphite',.002)
                for j in range(6):A.b('Scroll wheel grip',(0,.015+j*.0035,.044),(.008,.0009,.0006),'metal',.0002)
            P.own('Wireless study mouse','computer-mouse',mouse,(.62,1.04,.801))
            bpy.context.scene['study_peripheral_revision']=1
        bars=[o for o in bpy.context.scene.objects if o.name.startswith('Monitor chart column')]
        for j,ob in enumerate(bars):
            ob.location.x=-.245+j*.047;ob.location.y=1.485
            ob.location.z=1.17+(j%5)*.012
    for key in ('oak','woodlight','oak_end','ex_oak','ex_oak_light','ex_oak_edge'):
        mat=bpy.data.materials.get('MAT_'+key.upper())
        if not mat:continue
        ramps=[n for n in mat.node_tree.nodes if n.type=='VALTORGB']
        if ramps:
            ramp=ramps[-1].color_ramp;mid=tuple((ramp.elements[0].color[i]+ramp.elements[-1].color[i])*.5 for i in range(4))
            mat.diffuse_color=mid;mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=mid
    if bpy.context.scene.get('study_finishing_revision')==2:return
    improve_foliage(K);refine_books(K);tailored_cushions(K)
    for root in [o for o in bpy.context.scene.objects if o.type=='EMPTY' and o.get('definition_id') in ('rug-medium','rug-round')]:chunky_rug(K,root)
    room_additions(P)
    # A restrained walnut/oak family: clear grain with a darker, non-orange finish.
    for key in ('oak','woodlight','oak_end','ex_oak','ex_oak_light','ex_oak_edge'):
        mat=bpy.data.materials.get('MAT_'+key.upper())
        if not mat:continue
        p=mat.node_tree.nodes.get('Principled BSDF')
        for node in mat.node_tree.nodes:
            if node.type=='VALTORGB':
                for elem in node.color_ramp.elements:
                    c=elem.color[:];elem.color=(c[0]*.80,c[1]*.85,c[2]*.89,c[3])
                mid=tuple((node.color_ramp.elements[0].color[i]+node.color_ramp.elements[-1].color[i])*.5 for i in range(4))
                p.inputs['Base Color'].default_value=mid;mat.diffuse_color=mid
        p.inputs['Roughness'].default_value=.47
    # Cloth lamps visibly transmit their warm light. Keep the task visible in daylight.
    mat=bpy.data.materials.get('MAT_LAMP_FABRIC')
    if mat:mat.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value=.75
    for ob in bpy.context.scene.objects:
        if ob.type=='LIGHT' and ob.data.type=='POINT':ob.data.energy*=1.5
        if ob.type=='LIGHT' and ob.data.type=='AREA' and ob.name.startswith('Studio area'):
            ob.data.energy*=.84;ob.data.size*=.82
    bpy.context.scene['study_finishing_revision']=2
