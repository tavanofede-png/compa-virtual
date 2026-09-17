"""Build the eight approved personal study images as editable Blender scenes.

Every furniture root retains identity; supported props retain their own roots.
The hero PNGs remain references. Renders produced here show the actual meshes.
Run Blender -b --python this.py -- library [--preview] [--export] [--views].
"""
import bpy, sys, math, json, random, time
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
import personal_study_assets as A
from personal_study_assets import I,E
OUT=ROOT/'design/personal-spaces-v1'
SOURCE=ROOT/'packages/assets/3d/source/personal-spaces/v1'
MODELS=OUT/'models'
for p in (SOURCE,MODELS,OUT/'images',OUT/'data'):p.mkdir(parents=True,exist_ok=True)
K=None;LAYOUT=None;ROOM=None
NAMES={'library':'Rincón de biblioteca','terrace':'Terraza al atardecer','pergola':'Pérgola de jardín','cafe':'Rincón de café','minimal':'Estudio minimalista','tech':'Estudio tecnológico','pavilion':'Pabellón del parque','loft':'Ático acogedor'}
DIMS={'library':(4.4,3.8),'terrace':(4.5,3.8),'pergola':(4.6,4.2),'cafe':(4.2,3.8),'minimal':(4.1,3.7),'tech':(4.3,3.9),'pavilion':(5.0,4.5),'loft':(4.4,3.9)}
def b(*args,**kw):return A.b(*args,**kw)
def c(*args,**kw):return A.c(*args,**kw)
def line(*args,**kw):return A.line(*args,**kw)
def own(name,definition,fn,pos=(0,0,0),yaw=0,parent=None,**kw):
    ob=A.asset(name,definition,fn,pos,yaw,**kw)
    if parent:ob.parent=parent;ob['support_id']=parent.get('placeable_id',parent.name)
    return ob
def tag_floor(ob,w,d,h,role='furniture',yaw=0):
    # Canonical editor coordinates: x right, z toward the open front.
    W,D=DIMS[ROOM];x,y,z=ob.location
    LAYOUT['items'].append({'id':ob['placeable_id'],'definitionId':ob['definition_id'],'name':ob.name,'x':round(x+W/2,4),'z':round(D/2-y,4),'w':w,'d':d,'h':h,'yaw':yaw,'role':role})
    ob['footprint']=json.dumps([w,d]);ob['height']=h;ob['role']=role
def floor(kind='wood'):
    W,D=DIMS[ROOM];rng=random.Random(819)
    b('Solid joined plinth',(0,0,-.12),(W+.14,D+.14,.24),'oak' if kind=='wood' else 'tile_gray',.018)
    for j in range(9):
        base=(.65,.44,.255) if kind=='wood' else ((.69,.66,.61) if kind=='stone' else (.65,.64,.65))
        delta=(j-4)*.018;K.material('floor_'+str(j),'#'+''.join(f'{round(max(0,min(1,v+delta))*255):02x}' for v in base),.8)
    step=.16 if kind=='wood' else .32
    rows=math.ceil(D/step);dy=D/rows
    for row in range(rows):
        y=-D/2+(row+.5)*dy;x=-W/2;length=.82 if kind=='wood' else .43
        first=length*(.45 if row%2 else 1)
        for j in range(math.ceil(W/length)+2):
            w=min(first if j==0 else length,W/2-x)
            if w<.001:break
            b('Oak floor individual plank' if kind=='wood' else 'Individually laid paver',(x+w/2,y,.012),(w-.006,dy-.005,.034),'floor_'+str(rng.randrange(9)),.002)
            if kind=='wood':
                for yy in (-.04,.04):
                    line('Fine floor grain',[(x+.025,y+yy,.030),(x+w*.6,y+yy+.004,.030),(x+w-.022,y+yy,.030)],.0007,'oak')
            x+=w
    for side in (-1,1):
        b('Floor front border',(0,side*(D/2-.027),.024),(W,.057,.05),'woodlight' if kind=='wood' else 'tile',.004)
        b('Floor side border',(side*(W/2-.027),0,.024),(.057,D,.05),'woodlight' if kind=='wood' else 'tile',.004)
def walls(height=2.72,material='plaster',cap='woodlight'):
    W,D=DIMS[ROOM]
    for name,p,d in [('Rear wall',(0,D/2+.045,height/2),(W+.16,.16,height)),('Left wall',(-W/2-.045,0,height/2),(.16,D+.16,height))]:
        ob=b(name,p,d,material,.008);ob['hide_for_edit']=True;ob['module']='wall'
    for z,th in [(.10,.14),(height,.15)]:
        b('Back framed wall moulding',(0,D/2-.05,z),(W+.17,.14,th),cap,.006)
        b('Side framed wall moulding',(-W/2+.05,-.075,z),(.14,D-.15,th),cap,.006)
    for x,y in [(-W/2,-D/2),(-W/2,D/2),(W/2,D/2)]:b('Corner timber joint',(x,y,height/2),(.13,.13,height),cap,.008)
def picture(name,text,p,w=.7,h=1,color='ivory',yaw=0):
    return own(name,'framed-print',A.frame,p,yaw,text=text,w=w,h=h,color=color)
def pot(name,p,size=.8,kind='fern',flowers=False,parent=None):return own(name,'table-plant' if size<1 else 'floor-plant',A.plant,p,parent=parent,size=size,kind=kind,flowers=flowers)
def vines(name,points,seed=1):
    def fn():
        rng=random.Random(seed)
        for branch in range(4):
            dx=(branch-1.5)*.055;pp=[(x+dx,y-.04*branch,z+.03*math.sin(branch)) for x,y,z in points]
            line(name+' stem',pp,.004,'leaf_deep')
            for a,bb in zip(pp,pp[1:]):
                steps=max(4,round((Vector(a)-Vector(bb)).length/.043))
                for j in range(steps):
                    p=Vector(a).lerp(Vector(bb),j/steps)
                    for side in (-1,1):
                        p2=p+Vector((side*rng.uniform(.025,.073),rng.uniform(-.03,.03),rng.uniform(-.028,.025)))
                        leaf=b('Small articulated ivy leaf',p2,(rng.uniform(.04,.068),.025,rng.uniform(.035,.065)),['leaf_deep','leaf_mid','leaf_fresh'][rng.randrange(3)],.006,rot=(rng.uniform(-.4,.4),rng.uniform(-.6,.6),rng.uniform(-.5,.5)))
    return own(name,'hanging-plant',fn)
def lamp(name,p,kind='pleated',scale=.8,parent=None):
    return own(name,'banker-lamp' if kind=='banker' else 'desk-lamp' if kind=='task' else 'table-lamp',A.banker_lamp if kind=='banker' else A.desk_lamp if kind=='task' else A.pleated_lamp,p,parent=parent,**({'scale':scale} if kind=='pleated' else {}))
def textile_grid(name,w,h,p,plane='xz',color='fabric_sage',spacing=.028):
    # Small raised yarn crossings, one mesh, useful in close-up without noise-only detail.
    vs=[];fs=[]
    for ix in range(int(w/spacing)):
        for iz in range(int(h/spacing)):
            x=-w/2+(ix+.5)*spacing;z=-h/2+(iz+.5)*spacing;k=len(vs);t=spacing*.36
            coords=[(x-t,0,z-t),(x+t,0,z-t),(x+t,-.002,z),(x+t,0,z+t),(x-t,0,z+t),(x-t,-.002,z)]
            vs.extend([(p[0]+a,p[1]+bb,p[2]+cc) if plane=='xz' else (p[0]+a,p[1]+cc,p[2]-bb) for a,bb,cc in coords]);fs.extend([(k,k+1,k+2,k+5),(k+5,k+2,k+3,k+4)])
    K.mesh(name,vs,fs,color,'TEXTILES',0)
def crafted_lounge(color='fabric_sage'):
    I.upholstered(K,'Upholstered reading chair',(0,0,0),color=color,cushion='fabric_ivory')
    textile_grid('Tailored woven back',.67,.43,(0,.101,.85),color=color)
    textile_grid('Woven seat',.68,.53,(0,-.10,.514),'xy',color)
def bookcase(w=2.0,h=2.62,cols=3,seed=2):
    # Bespoke cabinet base, varied upper bays; plants, lamps and book groups have distinct bays.
    rng=random.Random(seed)
    I.cabinet(K,'Library lower cabinetry',(0,0,.065),w,.45,cols,'woodlight')
    b('Tongue and groove rear',(0,.17,(h+.53)/2),(w,.07,h-.53),'oak',.005)
    for j in range(cols+1):b('Library mortised stile',(-w/2+j*w/cols,-.01,h/2),(.07,.43,h),'woodlight',.006)
    for z in (.57,1.00,1.43,1.86,2.29,h):
        if z>h:continue
        b('Shelf thick nosing',(0,-.015,z),(w-.07,.47,.057),'woodlight',.006)
        line('Shelf rounded lip',[(-w/2,-.26,z+.006),(w/2,-.26,z+.006)],.007,'oak_end')
    b('Crown shaped cornice',(0,0,h+.07),(w+.17,.55,.12),'woodlight',.012)
    for row,z in enumerate((.60,1.03,1.46,1.89,2.32)):
        if z>h-.12:continue
        for col in range(cols):
            left=-w/2+col*w/cols+.068;right=-w/2+(col+1)*w/cols-.065;mode=(row*3+col+seed)%7
            reserve=.26 if mode in (0,1,3) else 0
            x=left
            if mode==1:
                I.shade_lamp(K,'Niche pleated lamp',(left+.14,-.02,z),.48);I.local_glow(K,'Shelf warm light',(left+.14,-.12,z+.19),3,.10);x+=.31
            elif mode==3:
                I.botanical(K,'Niche fern',(left+.15,-.025,z),.5);x+=.30
            elif mode==0:
                for j in range(3):
                    b('Horizontal linen cover',(left+.12,-.03,z+.022+j*.045),(.24,.25,.043),['navy','rust','ivory'][j],.003)
                    b('Horizontal pages',(left+.12,-.163,z+.022+j*.045),(.21,.002,.032),'paper',.001)
                x+=.28
            index=0
            while x+.046<right:
                bw=.038+rng.random()*.033;bh=min(h-z-.04,.22+rng.random()*.14)
                K.book('Individually bound library volume',(x+bw/2,-.02,z),bw,bh,.26,['navy','binding_teal','binding_mustard','binding_red','binding_parchment','sage'][rng.randrange(6)],rotation=(0,-.055 if index%9==0 else 0,0),collection='LIBRARY_VOLUMES')
                x+=bw+.013;index+=1
    for j in range(cols+1):
        x=-w/2+j*w/cols
        for z in (.1,h):
            b('Forged joinery corner plate',(x,-.269,z),(.06,.007,.055),'oak',.003)
            for dz in (-.015,.015):
                screw=c('Brass recessed screw',(x,-.275,z+dz),.004,.003,'gold',8);screw.rotation_euler.x=math.pi/2
def study(p=(.5,-.2,0),w=1.75,d=.83,style='oak',chair='ivory',lampkind='banker',drawers=True,extras=True,angle=0):
    desk=own('desk','desk',A.desk,p,angle,w=w,d=d,style=style,drawers=drawers);tag_floor(desk,w,d,.76,'work-surface',-math.degrees(angle))
    sx=-.055;sy=-(d/2+.365);seatp=(p[0]+sx*math.cos(angle)-sy*math.sin(angle),p[1]+sx*math.sin(angle)+sy*math.cos(angle),.035)
    seat=own('chair','ergonomic-chair' if chair=='ergonomic' else 'wood-chair',A.study_chair,seatp,math.pi+angle,color='graphite' if chair=='ergonomic' else 'fabric_sage' if chair=='sage' else 'fabric_blue' if chair=='blue' else 'fabric_ivory',ergonomic=chair=='ergonomic');tag_floor(seat,.65,.60,.51,'study-seat',-math.degrees(angle))
    # Small apparatus use the back third; notebook is an allowed working object.
    own('study-laptop','laptop',A.laptop,(0,.12,.76),parent=desk)
    own('study-notebook','notebooks',A.notebook,(-.33,-.20,.76),parent=desk)
    own('study-books','books',A.book_stack,(-w/2+.25,.11,.76),parent=desk,count=3)
    own('study-mug','mug',A.mug,(.33,-.23,.76),parent=desk)
    own('study-pencils','pencil-holder',A.pencil_cup,(w/2-.34,.05,.76),parent=desk)
    lamp('study-lamp',(w/2-.14,.22,.76),lampkind,.75,parent=desk)
    if extras:pot('study-plant',(-w/2+.25,.27,.91),.42,'square',parent=desk)
    W,D=DIMS[ROOM]
    approach=(seatp[0]+math.sin(angle)*.60,seatp[1]-math.cos(angle)*.60,0)
    LAYOUT['studyZones'].append({'id':'primary-study','surfaceId':'desk','seatId':'chair','approach':[approach[0]+W/2,D/2-approach[1]],'workArea':{'x':0,'z':.0,'w':.65,'d':.4},'interaction':'study'})
    for name,pp in [('STUDY_SEAT',(seatp[0],seatp[1],.51)),('STUDY_APPROACH',approach),('STUDY_WORK',(p[0],p[1],.76))]:
        empty=K.group(name,pp,collection='INTERACTION_MAP');empty['interaction_anchor']=True
    return desk,seat
def side_table(name,p):
    def fn():
        for x in (-.20,.20):
            for y in (-.20,.20):b('Side table legs',(x,y,.24),(.052,.052,.48),'oak',.005)
        for z in (.11,.48):b('Side table slab',(0,0,z),(.49,.49,.048),'woodlight',.006)
    return own(name,'side-table',fn,p)
def floorlamp(p):
    def fn():
        c('Weighted brass foot',(0,0,.028),.17,.056,'gold',28);c('Standing lamp shaft',(0,0,.69),.016,1.36,'gold',16)
        I.shade_lamp(K,'Reading shade',(0,0,1.1),.80);I.local_glow(K,'Reading glow',(0,0,1.4),9,.17)
    return own('standing-reading-lamp','floor-lamp',fn,p)
def scenic(name,p,w,h,kind='garden',yaw=0):
    # Existing licensed/generated landscape is only the view beyond the frame.
    path=ROOT/'packages/assets/3d/textures/shared-spaces'/f'{kind}.png'
    img=bpy.data.images.load(str(path),check_existing=True);img.pack()
    mat=bpy.data.materials.new(name+' scenic art');mat.use_nodes=True;nodes=mat.node_tree.nodes;links=mat.node_tree.links;shader=nodes.get('Principled BSDF');tex=nodes.new('ShaderNodeTexImage');tex.image=img
    links.new(tex.outputs['Color'],shader.inputs['Base Color']);links.new(tex.outputs['Color'],shader.inputs['Emission Color']);shader.inputs['Emission Strength'].default_value=.38;shader.inputs['Roughness'].default_value=1
    mesh=bpy.data.meshes.new(name);mesh.from_pydata([(-w/2,0,-h/2),(w/2,0,-h/2),(w/2,0,h/2),(-w/2,0,h/2)],[],[(0,1,2,3)]);mesh.materials.append(mat);uv=mesh.uv_layers.new()
    for loop,co in zip(uv.data,[(0,0),(1,0),(1,1),(0,1)]):loop.uv=co
    ob=bpy.data.objects.new(name,mesh);K.link(ob,'DISTANT_WORLD');ob.location=p;ob.rotation_euler.z=yaw;ob['scenic_panel']=True;ob['image_source']=str(path.relative_to(ROOT));return ob
def stringlights(points,name='String lights',count=12):
    line(name+' insulated cable',points,.009,'graphite')
    for i in range(count):
        t=(i+.5)/count;f=t*(len(points)-1);a=math.floor(f);u=f-a;p=Vector(points[a]).lerp(Vector(points[min(a+1,len(points)-1)]),u)
        c(name+' brass socket',(p.x,p.y,p.z-.035),.02,.07,'gold',12)
        b(name+' faceted warm bulb',(p.x,p.y,p.z-.104),(.055,.055,.082),'lamp_glow',.009)
        if i%3==0:I.local_glow(K,name+' glow',(p.x,p.y,p.z-.12),2,.09)
def library():
    W,D=DIMS[ROOM];floor();walls()
    left=own('bookcase-left','bookshelf-large',bookcase,(-W/2+.26,.10,0),math.pi/2,w=D-.60,cols=4,seed=2);tag_floor(left,.50,D-.60,2.75)
    rear=own('bookcase-rear','bookshelf-large',bookcase,(-.15,D/2-.23,0),w=2.87,cols=3,seed=4);tag_floor(rear,3.01,.54,2.75)
    picture('Library statement','Good\nBooks\nBrighter\nDays',(1.65,D/2-.05,1.85),.88,1.32)
    b('Library art brass light',(1.65,D/2-.23,2.60),(.51,.09,.048),'gold',.012)
    b('Art light diffuser',(1.65,D/2-.23,2.57),(.47,.07,.007),'lamp_glow',.004)
    I.local_glow(K,'Art pool',(1.65,D/2-.24,2.51),6,.14)
    arm=own('reading-armchair','lounge-chair',crafted_lounge,(-.99,-.55,.025));tag_floor(arm,1.0,.9,1.12)
    floorlamp((-1.61,-1.70,.02));pot('front-left-fern',(-1.98,-1.72,.02),.83,'monstera')
    table=side_table('reading-side-table',(-1.20,-1.35,.02));own('reading-book-stack','books',A.book_stack,(0,0,.51),parent=table,count=4)
    own('checker-woven-rug','rug-medium',A.rug,(.12,-.64,.034),w=3.14,d=2.22)
    study((.70,-.16,.025),w=1.80,d=.85)
    cart=own('rolling-book-cart','book-cart',A.cart,(1.90,-.80,.025));tag_floor(cart,.56,.4,.91)
    pot('right-floor-fern',(1.88,.21,.025),1.05,'monstera')
    for i,(x,y,z) in enumerate([(-1.78,.7,2.73),(-1.10,1.42,2.71),(.60,1.42,2.70),(-1.78,-1.10,1.84)]):
        pot('Trailing pot '+str(i),(x,y,z),.65,'square')
        vines('Trailing ivy '+str(i),[(x,y,z+.10),(x+.08,y-.10,z-.28),(x-.05,y-.18,z-.75),(x+.08,y-.17,z-1.1)],10+i)
    lamp('side-cabinet-lamp',(1.80,1.02,.62),'pleated',.8)
    base=own('rear-side-cabinet','rolling-drawers',A.cabinet,(1.79,1.13,.02),w=.55,h=.54);tag_floor(base,.60,.56,.65)
def terrace():
    W,D=DIMS[ROOM];floor('stone')
    scenic('Sunset city beyond terrace',(0,D/2+.04,1.82),W+.10,2.75,'sunset')
    for side in ('rear','left'):
        ln=W if side=='rear' else D;center=(0,D/2,.24) if side=='rear' else (-W/2,0,.24);dims=(ln,.15,.48) if side=='rear' else (.15,ln,.48);b('Stone parapet',center,dims,'tile_gray',.005)
        for j in range(6):
            pos=(-ln/2+j*ln/5,D/2-.015,.84) if side=='rear' else (-W/2+.015,-ln/2+j*ln/5,.84);b('Railing upright',pos,(.036,.036,.77),'graphite',.005)
        a=(-W/2,D/2,1.24) if side=='rear' else (-W/2,-D/2,1.24);bb=(W/2,D/2,1.24) if side=='rear' else (-W/2,D/2,1.24);line('Metal top rail',[a,bb],.028,'graphite')
    E._brick_panel(K,'Sun emblem pier',(W/2-.4,D/2-.025),.90,2.7,.21)
    picture('Terrace sun','☀',(W/2-.42,D/2-.14,1.93),.62,.76,'graphite')
    # Geometric sun emblem stays clear in export even if the font lacks this glyph.
    ring=[(W/2-.42+.15*math.cos(t),D/2-.284,1.93+.15*math.sin(t)) for t in [j*math.tau/48 for j in range(49)]];line('Sun brass ring',ring,.012,'gold')
    for j in range(8):
        a=j*math.tau/8;line('Sun ray',[(W/2-.42+.21*math.cos(a),D/2-.284,1.93+.21*math.sin(a)),(W/2-.42+.27*math.cos(a),D/2-.284,1.93+.27*math.sin(a))],.014,'gold')
    for x,y in [(-W/2+.1,1.22),(.94,D/2-.2)]:b('Festoon timber post',(x,y,1.43),(.10,.10,2.85),'oak',.006)
    stringlights([(-2.15,1.22,2.8),(-1.4,1.15,2.60),(-.6,1.20,2.48),(.15,1.40,2.55),(.94,1.70,2.80)],count=12)
    own('terrace-reading-chair','lounge-chair',crafted_lounge,(-1.38,.1,.03),color='fabric_ivory')
    t=side_table('terrace-side-table',(-1.85,-.57,.03));pot('side-potted-flowers',(0,0,.51),.45,'square',True,t)
    own('terrace-woven-rug','rug-medium',A.rug,(.30,-.72,.03),w=3.13,d=1.8,scheme='blue')
    puff=own('rust-knitted-puff','knit-pouf',A.pouf,(-.73,-1.05,.04));tag_floor(puff,.9,.9,.48)
    study((.84,-.10,.025),w=1.8,d=.85,chair='sage',lampkind='pleated')
    for j,(p,w,d) in enumerate([((-1.43,1.40,.02),1.26,.45),((.2,1.52,.02),1.2,.45),((1.91,.52,.02),.43,1.17)]):
        ob=own('Terrace planter '+str(j),'planter-large',A.planter,p,w=w,d=d);tag_floor(ob,w,d,.8)
    for j,p in enumerate([(-1.89,-1.17,.03),(-.46,.99,.03),(1.93,-.80,.03)]):own('Terrace lantern '+str(j),'ambient-lantern',A.lantern,p,scale=.65)
    pot('Olive tree pot',(1.67,1.15,.05),1.3,'monstera')
def garden_frame(w,d,h=2.72,roof=False):
    for x in (-w/2,w/2):
        for y in (-d/2,d/2):
            b('Stone post footing',(x,y,.22),(.37,.37,.44),'tile',.012)
            for z in (.13,.30):
                b('Mortar course',(x,y,z),(.374,.374,.008),'tile_gray',.001)
            b('Tenoned oak support',(x,y,(h+.36)/2),(.16,.16,h-.36),'woodlight',.008)
            for sign in (-1,1):
                line('Diagonal knee brace',[(x,y,h-.48),(x-sign*.36,y,h-.09)],.06,'oak')
            for yy in (-.094,.094):b('Black post shoe',(x,y+yy,.47),(.19,.016,.18),'graphite',.003)
    for y in (-d/2,d/2):b('Main carrying beam',(0,y,h),(w+.34,.19,.22),'woodlight',.009)
    for x in (-w/2,w/2):b('Side carrying beam',(x,0,h),(.19,d+.34,.22),'woodlight',.009)
    for j in range(9):
        x=-w/2+j*w/8;b('Notched overhead rafter',(x,0,h+.16),(.11,d+.42,.15),'oak_end',.005)
    for j in range(7):
        y=-d/2+j*d/6;b('Pergola crossed lattice',(0,y,h+.26),(w+.34,.05,.07),'woodlight',.003)
    for i,(x,y) in enumerate([(-w/2,-d/2),(-w/2,d/2),(w/2,d/2),(w/2,-d/2)]):
        if roof:continue
        vines('Climbing post flowers '+str(i),[(x,y,.4),(x+.06,y,1.0),(x-.06,y+.06,1.6),(x,y,2.3),(x+.18,y,h+.28)],31+i)
    if not roof:
        for j in range(6):
            y=-d/2+j*d/5
            vines('Flowering overhead vine '+str(j),[(-w/2,y,h+.30),(-w/4,y+.06,h+.35),(0,y,h+.28),(w/4,y-.06,h+.35),(w/2,y,h+.3)],60+j)
            for i in range(9):E._flower(K,'White climbing blossom',(-w/2+.08+i*w/9,y+.05,h+.36),.058,'ex_petal_cream' if i%3 else 'ex_petal_pink')
def pergola():
    W,D=DIMS[ROOM];floor('stone');garden_frame(W-.55,D-.55)
    # Timber lattice provides an actual background instead of an empty room corner.
    for x in [-W/2+.32+i*.30 for i in range(14)]:b('Rear trellis upright',(x,D/2-.32,1.60),(.035,.04,1.80),'oak',.003)
    for z in [.7+i*.26 for i in range(8)]:b('Rear trellis rail',(0,D/2-.32,z),(W-.58,.04,.04),'woodlight',.003)
    for j,(p,w,d) in enumerate([((-W/2+.26,0,0),.48,D-.25),((W/2-.26,0,0),.48,D-.25),((0,D/2-.26,0),W-.8,.48)]):
        ob=own('Garden border '+str(j),'planter-large',A.planter,p,w=w,d=d);tag_floor(ob,w,d,.95)
    bench=own('garden-cushioned-bench','bench',A.bench,(-.45,1.09,.035),w=1.9);tag_floor(bench,2.0,.8,1.1)
    study((.50,-.27,.028),w=1.73,d=.83,chair='sage',drawers=False)
    picture('Botanical framed art','Ideas\nque\nflorecen',(1.70,1.72,1.72),.75,1.05)
    for j,p in enumerate([(-1.65,-1.53,.46),(1.65,-1.53,.46),(-1.5,1.1,2.24),(.15,1.1,2.25),(1.50,.50,2.24)]):own('Garden hanging lantern '+str(j),'ambient-lantern',A.lantern,p,scale=.65)
    for j in range(10):
        x=(-1 if j%2 else 1)*1.38;y=-1.45+(j//2)*.65;pot('Hydrangea and fern '+str(j),(x,y,.43),.65,'square',True)
def pendant(name,p):
    def fn():
        c('Pendant brass crown',(0,0,.12),.037,.14,'gold',16)
        c('Faceted black metal shade',(0,0,-.02),.17,.23,'graphite',18,top=.08)
        c('Pendant warm diffuser',(0,0,-.138),.15,.015,'lamp_glow',24)
        I.local_glow(K,'Pendant practical',(0,0,-.16),11,.13)
    return own(name,'pendant',fn,p)
def cafe():
    W,D=DIMS[ROOM];floor('tile');walls(cap='graphite')
    # White wall tiles have grout relief; coffee station occupies the left wall.
    for z in range(14):
        for y in range(18):b('Hand laid ceramic backsplash',(-W/2+.094,-D/2+.12+y*.21,.10+z*.19),(.018,.203,.184),'ivory',.002)
    scenic('Cafe window garden',(1.04,D/2-.07,1.65),1.88,1.88,'garden')
    for x in (.09,1.02,1.99):b('Window black mullion',(x,D/2-.12,1.65),(.055,.08,1.97),'graphite',.004)
    for z in (.7,1.61,2.60):b('Window transom',(1.04,D/2-.12,z),(1.96,.08,.055),'graphite',.004)
    cabinet=own('coffee-cabinet','rolling-drawers',A.cabinet,(-1.53,.14,.035),w=.68,h=.85);tag_floor(cabinet,.78,.57,.95)
    own('espresso-machine','coffee-machine',A.coffee_machine,(0,0,.91),parent=cabinet)
    own('coffee-grinder','coffee-grinder',A.grinder,(.22,.06,1.27),parent=cabinet)
    case=own('pastry-display','pastry-case',A.pastry_case,(-1.53,-.82,.30));tag_floor(case,.74,.45,1.1)
    b('Pastry oak lower cabinet',(-1.53,-.82,.18),(.73,.45,.36),'woodlight',.008)
    for z in (1.40,1.82,2.24):
        b('Coffee wall oak shelf',(-1.80,-.68,z),(.47,.98,.056),'woodlight',.005)
        for j in range(4):
            I.mug(K,'Glazed coffee cup',(-1.72,-1.00+j*.22,z+.03),'ivory' if j%2 else 'graphite')
    picture('Coffee chalkboard','Good\nIdeas\nBetter\nPeople',(-1.93,.79,1.99),.90,1.23,'graphite',math.pi/2)
    # White lettering on real board.
    for ob in bpy.data.objects:
        if ob.type=='FONT' and 'Coffee chalkboard' in str(ob.get('placeable_owner','')):ob.data.materials.clear();ob.data.materials.append(K.mat('ivory'))
    back=own('cafe-banquette','bench',A.bench,(-.32,1.08,.03),w=1.9);tag_floor(back,1.98,.72,1.1)
    study((.35,-.17,.035),w=1.83,d=.82,style='oak',chair='blue',lampkind='task',drawers=False)
    own('student-backpack','backpack',lambda:I.backpack(K,'Canvas student backpack',(0,0,0),'fabric_sage'),(-.68,-1.22,.035),-.15)
    for j,p in enumerate([(-1.48,.44,2.43),(-.54,1.45,2.42),(.57,1.42,2.42)]):
        pendant('Cafe pendant '+str(j),p);line('Pendant suspension',[(p[0],p[1],p[2]+.15),(p[0],p[1],2.72)],.010,'graphite')
    def menu():
        for y,ang in [(-.04,-.14),(.34,.14)]:b('A frame hinged panel',(0,y,.64),(.65,.06,1.16),'oak',.008,rot=(ang,0,0))
        b('Recessed menu chalk face',(0,-.12,.72),(.55,.018,.9),'graphite',.003)
        K.text('Menu writing','COFFEE\nSTUDY\nREPEAT',(0,-.135,.75),.095,'ivory','WALL_STORY',(math.pi/2,0,0))
        line('Menu chain',[(-.22,.0,.4),(-.22,.30,.4)],.006,'gold')
    own('cafe-menu','menu-board',menu,(1.54,-1.09,.035))
    pot('Window large fern',(1.72,.71,.035),1.2,'monstera');pot('Pastry greenery',(-1.93,-1.31,.04),.8,'monstera')
    for j,p in enumerate([(-1.75,1.55,2.66),(-1.84,-.9,2.42),(.02,1.67,2.64)]):
        pot('Cafe shelf plant '+str(j),p,.55,'square');vines('Cafe trailing leaves '+str(j),[p,(p[0]+.1,p[1]-.08,p[2]-.4),(p[0]-.05,p[1]-.12,p[2]-.8)],81+j)
def minimal():
    W,D=DIMS[ROOM];floor('tile');walls(cap='ivory')
    for j in range(29):b('Architectural vertical oak batten',(.02+j*.065,D/2-.11,1.61),(.033,.055,2.08),'woodlight',.003)
    line('Hidden warm linear light',[(-.08,D/2-.10,2.45),(1.94,D/2-.10,2.45)],.014,'lamp_glow')
    study((-1.29,.10,.03),w=2.60,d=.78,style='white',chair='ergonomic',lampkind='task',extras=False,angle=math.pi/2)
    own('minimal-L-return','compact-desk',A.desk,(.08,1.43,.03),w=2.03,d=.70,style='white')
    own('minimal-pegboard','pinboard',A.pegboard,(.64,D/2-.17,1.67),w=1.60,h=.82)
    for j,(x,y,z) in enumerate([(-1.74,.05,1.50),(-1.74,.6,1.93),(-1.74,1.05,2.32)]):
        b('Floating shelf', (x,y,z),(.47,.91,.047),'ivory',.003)
        for q in range(2):pot('Floating shelf fern '+str(j)+'-'+str(q),(x,y+(q-.5)*.40,z+.03),.38,'square')
    picture('Minimal focus print','Less\nnoise.\nMore\nyou.',(-W/2+.10,-.80,1.85),.82,1.15,'ivory',math.pi/2)
    picture('Focus rhythm print','Plan\nFocus\nStudy\nImprove\nRepeat',(1.65,D/2-.12,1.72),.61,1.45)
    own('minimal-woven-rug','rug-medium',A.rug,(.11,-.51,.04),w=2.68,d=2.19,scheme='blue')
    own('ivory-lounge-pouf','beanbag',A.pouf,(1.36,-1.16,.045),r=.49,color='fabric_ivory')
    pot('Minimal floor plant',(-1.67,-1.28,.03),1.2,'monstera')
def tech():
    W,D=DIMS[ROOM];floor('tile');walls(material='navy',cap='graphite')
    for j in range(30):b('Acoustic felt rib',(-W/2+.11,-D/2+.06+j*.126,1.6),(.033,.055,2.1),'graphite',.002)
    line('Blue room cove',[(-W/2+.13,-D/2+.1,2.51),(-W/2+.13,D/2-.12,2.51),(W/2-.1,D/2-.12,2.51)],.014,'led_blue')
    desk,seat=study((.08,1.30,.035),w=3.75,d=.85,style='tech',chair='ergonomic',lampkind='task',extras=False)
    # The L return is a separate cabinet module, with cable tray and clear chair approach.
    ret=own('left-desk-return','compact-desk',A.desk,(-1.50,-.18,.035),math.pi/2,w=2.10,d=.65,style='tech',drawers=True);tag_floor(ret,.65,2.10,.78)
    for j in range(3):own('Monitor '+str(j),'monitor-set',A.monitor,(-.87+j*.80,.17,.76),parent=desk,w=.77)
    own('tempered-pc','pc-case',A.pc,(1.45,.05,.76),parent=desk)
    own('studio-speakers','speakers',A.speakers,(-.80,-.20,.76),parent=desk)
    own('headphones-rest','headphones',A.headphones,(0,0,.76),parent=ret)
    line('Under desk cable raceway',[(-.73,1.15,.63),(.44,1.15,.63),(1.39,1.15,.63)],.028,'graphite')
    for j in range(4):line('Braided signal cable',[(-.5+j*.33,1.0,1.10),(-.5+j*.33,1.15,.75),(-.5+j*.33,1.15,.64)],.005,'graphite')
    for j in range(7):
        x=.29+(j%3)*.32;z=1.85+(j//3)*.28;ob=c('Hexagonal programmable light',(x,D/2-.11,z),.19,.045,'led_purple' if j%2 else 'led_blue',6);ob.rotation_euler.x=math.pi/2
    picture('Tech focus panel','Discipline\ncreates\nfreedom',(-W/2+.10,.09,1.90),1.25,.88,'graphite',math.pi/2)
    for ob in bpy.data.objects:
        if ob.type=='FONT' and 'Tech focus' in str(ob.get('placeable_owner','')):ob.data.materials.clear();ob.data.materials.append(K.mat('cyan'))
    own('blue-braided-rug','rug-round',A.rug,(.42,-.70,.04),w=2.02,d=2.02,round_shape=True,scheme='blue')
    line('Rug inset light',[(.42+1.01*math.cos(a),-.7+1.01*math.sin(a),.05) for a in [j*math.tau/100 for j in range(101)]],.008,'led_blue')
    own('tech-canvas-backpack','backpack',lambda:I.backpack(K,'Navy study backpack',(0,0,0),'fabric_blue'),(1.71,-.23,.04))
    pot('Desk corner succulent',(-1.69,-.52,.83),.55,'square')
    for p in ((.30,1.50,2.40),(1.70,1.51,2.30)):pot('Tech wall plant '+str(p),p,.44,'square')
def hip_roof(w,d,z=2.88):
    # Individually overlapping green tile courses on four hipped slopes.
    K.material('roof_mid','#35654D',.79);K.material('roof_dark','#315B47',.79)
    height=.84;over=.20
    for side in range(4):
        along=w if side%2==0 else d;span=d/2+over if side%2==0 else w/2+over
        for row in range(12):
            t0=row/12;t1=min(.97,(row+1.08)/12);count=max(2,round((along+2*over)*(1-t0)/.20))
            for j in range(count):
                mat=['tile_green','roof_mid','roof_dark'][(j+row*2)%3];verts=[]
                for off in (0,.047):
                    for u,t in [(j/count+.005,t0),((j+1)/count-.005,t0),((j+1)/count-.005,t1),(j/count+.005,t1)]:
                        xx=(u-.5)*(along+2*over)*(1-t);yy=span*(1-t);zz=z+height*t+off
                        verts.append((xx,yy,zz) if side==0 else (-xx,-yy,zz) if side==2 else (yy,-xx,zz) if side==1 else (-yy,xx,zz))
                ob=K.mesh('Mitered overlapping green roof tile',verts,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],mat,'ARCHITECTURE',.005);ob['hide_for_edit']=True;ob['module']='roof'
    b('Roof ridge tile',(0,0,z+height),(.72,.48,.075),'tile_green',.025)
    c('Roof finial',(0,0,z+height+.11),.06,.20,'gold',12,top=.02)
def pavilion():
    W,D=DIMS[ROOM];floor('stone')
    scenic('Lake park beyond pavilion',(0,D/2+.23,1.62),W+.15,2.30,'garden')
    garden_frame(W-1.08,D-1.05,2.72,True);hip_roof(W-1.08,D-1.05)
    for j,p in enumerate([(-W/2+.22,1.30,0),(W/2-.22,1.30,0)]):own('Park canopy tree '+str(j),'floor-plant',A.tree,p,h=3.02,r=.66)
    for j,(p,w,d) in enumerate([((-1.98,-.88,0),.46,1.50),((1.98,-.85,0),.46,1.52),((0,1.85,0),2.8,.35)]):own('Pavilion flowers '+str(j),'planter-large',A.planter,p,w=w,d=d)
    bench=own('pavilion-reading-bench','bench',A.bench,(-.65,1.0,.035),w=1.85);tag_floor(bench,1.92,.73,1.1)
    study((.55,-.20,.03),w=1.77,d=.86,chair='sage',lampkind='pleated',drawers=False)
    own('pavilion-woven-mat','rug-medium',A.rug,(.14,-.80,.033),w=2.53,d=1.86)
    for j,p in enumerate([(-1.75,-1.62,.43),(1.75,-1.62,.43),(-1.37,1.1,2.23),(.74,.9,2.23)]):own('Pavilion hanging lantern '+str(j),'ambient-lantern',A.lantern,p,scale=.7)
    for step in range(3):b('Pavilion entry stone step',(0,-D/2-.09-step*.14,-.09-step*.065),(1.25,.29,.10),'tile',.008)
    own('pavilion-backpack','backpack',lambda:I.backpack(K,'Outdoor study backpack',(0,0,0),'fabric_sage'),(1.60,-.50,.04))
def loft():
    W,D=DIMS[ROOM];floor();walls(height=2.42)
    # Back gable, open front roof cutaway; pitched rafters and individual boards.
    verts=[(-W/2,D/2,2.42),(W/2,D/2,2.42),(0,D/2,3.48)]
    K.mesh('Gable plaster tympanum',verts,[(0,1,2)],'plaster','ARCHITECTURE',0)
    scenic('Triangular loft sunset',(0,D/2-.085,2.47),1.95,1.66,'sunset')
    # The plaster side masks crop the panorama into a triangular opening.
    for side in (-1,1):
        xx=side*.99
        K.mesh('Gable window mask',[(xx,D/2-.105,1.68),(xx,D/2-.105,3.30),(0,D/2-.105,3.3)],[(0,1,2)],'plaster','ARCHITECTURE',0)
        line('Triangular oak window frame',[(0,D/2-.10,3.24),(side*.94,D/2-.10,1.80)],.055,'woodlight')
    line('Window sill',[(-.94,D/2-.10,1.8),(.94,D/2-.10,1.8)],.06,'woodlight')
    line('Central window mullion',[(0,D/2-.10,1.8),(0,D/2-.10,3.24)],.025,'woodlight')
    for y in (D/2,):
        line('Gable structural rafter',[(-W/2,y,2.44),(0,y,3.48),(W/2,y,2.44)],.085,'oak')
    line('Structural ridge',[(0,-D/2,3.48),(0,D/2,3.48)],.08,'woodlight')
    for i in range(7):
        y=-D/2+i*D/6
        line('Exposed attic rafter',[(-W/2,y,2.44),(-.30,y,3.34)],.065,'woodlight')
        # Leave the roof facing the camera open, so furniture can be reviewed.
    for ix in range(10):
        x=-W/2+(ix+.5)*(W/2-.30)/10;z=2.44+(x+W/2)*1.04/(W/2)
        ob=b('Sloped individual ceiling board',(x,1.60,z),((W/2-.30)/10-.002,.60,.035),'woodlight',.003,rot=(0,-math.atan2(1.04,W/2),0));ob['hide_for_edit']=True;ob['module']='roof'
    shelves=own('attic-left-bookcase','bookshelf-large',bookcase,(-W/2+.26,.0,.03),math.pi/2,w=D-.40,h=2.23,cols=4,seed=8);tag_floor(shelves,.53,D-.4,2.35)
    bench=own('window-seat','bench',A.bench,(.12,1.17,.03),w=1.68);tag_floor(bench,1.8,.74,1.1)
    study((-.08,-.23,.03),w=1.65,d=.78,chair='ivory',lampkind='pleated')
    own('loft-woven-rug','rug-medium',A.rug,(.1,-.71,.038),w=2.97,d=2.0)
    own('burgundy-knitted-puff','knit-pouf',A.pouf,(1.45,-1.03,.04),r=.49,color='fabric_rust')
    trunk=own('loft-oak-trunk','storage-boxes',A.cabinet,(1.75,.24,.03),w=.67,h=.43);tag_floor(trunk,.75,.57,.54)
    own('trunk-books','books',A.book_stack,(0,0,.50),parent=trunk,count=3)
    picture('Loft framed moon','Small\nsteps.\nBig\nchanges.',(1.63,D/2-.08,1.73),.79,1.14)
    for i,p in enumerate([(-1.84,-1.25,2.36),(-1.82,1.1,2.32),(1.79,1.3,.58)]):pot('Attic plant '+str(i),p,.55,'square')
    stringlights([(-W/2+.15,-.7,2.47),(-1.5,-.7,2.81),(-.75,-.7,3.1),(0,-.7,3.4)],count=9)

def setup_render(preview=False):
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24 if preview else 64;scene.cycles.use_denoising=True
    scene.render.resolution_x=1056 if preview else 1800;scene.render.resolution_y=704 if preview else 1200;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG'
    scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=-.25
    world=bpy.data.worlds.new('Warm studio world');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.64,.68,.77,1);world.node_tree.nodes['Background'].inputs[1].default_value=.17 if ROOM!='tech' else .075;scene.world=world
    b('Studio floor',(0,0,-.29),(200,200,.05),'ivory',0)
    def aim(ob,p):ob.rotation_euler=(Vector(p)-ob.location).to_track_quat('-Z','Y').to_euler()
    for p,energy,size,col in [((-3,-4,7),1100,5,(1,.87,.71)),((5,-2,5),650,4,(.80,.88,1)),((0,4,6),850,3,(1,.76,.48))]:
        data=bpy.data.lights.new('Studio area','AREA');data.energy=energy*(.4 if ROOM=='tech' else 1);data.shape='DISK';data.size=size;data.color=col;ob=bpy.data.objects.new('Studio area',data);scene.collection.objects.link(ob);ob.location=p;aim(ob,(0,0,1))
    data=bpy.data.cameras.new('Review camera');cam=bpy.data.objects.new('Review camera',data);scene.collection.objects.link(cam);scene.camera=cam;cam.data.type='ORTHO'
    W,D=DIMS[ROOM];cam.location=(8,-11,7.4 if ROOM!='pavilion' else 6.8);aim(cam,(0,0,1.35 if ROOM!='pavilion' else 1.55));cam.data.ortho_scale=max(W,D)*1.96
    fontpath=Path('C:/Windows/Fonts/arial.ttf')
    if fontpath.exists():
        font=bpy.data.fonts.load(str(fontpath),check_existing=True)
        for ob in scene.objects:
            if ob.type=='FONT':ob.data.font=font
    return scene
def render_views(source,preview=False,views=False):
    bpy.ops.wm.open_mainfile(filepath=str(source));scene=bpy.context.scene
    if preview:scene.cycles.samples=24;scene.render.resolution_x=1056;scene.render.resolution_y=704
    else:scene.cycles.samples=64;scene.render.resolution_x=1800;scene.render.resolution_y=1200
    scene.render.filepath=str(OUT/'images'/f'{ROOM}-model-hero.png');bpy.ops.render.render(write_still=True)
    if not views:return
    cam=scene.camera;W,D=DIMS[ROOM]
    cam.location=(5,-10,10);cam.rotation_euler=(Vector((0,0,.95))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=max(W,D)*1.85
    scene.render.filepath=str(OUT/'images'/f'{ROOM}-alternate.png');bpy.ops.render.render(write_still=True)
    desk=bpy.data.objects.get('desk');target=desk.location+Vector((0,0,.68)) if desk else Vector((0,0,.8))
    cam.location=target+Vector((3,-4,3.4));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=3.3
    scene.render.filepath=str(OUT/'images'/f'{ROOM}-detail.png');bpy.ops.render.render(write_still=True)
def export_modular(source):
    bpy.ops.wm.open_mainfile(filepath=str(source));scene=bpy.context.scene;deps=bpy.context.evaluated_depsgraph_get();groups={}
    for ob in list(scene.objects):
        if ob.type not in ('MESH','CURVE','FONT') or ob.name=='Studio floor' or ob.hide_render:continue
        owner=ob.get('placeable_owner','architecture');groups.setdefault(owner,[]).append(ob)
    exports=[];metrics=[]
    for owner,objects in groups.items():
        verts=[];faces=[];matids=[];mats=[];lookup={};uvs=[];hasuv=False
        root=bpy.data.objects.get(owner);matrix=root.matrix_world if root and root.type=='EMPTY' else None;inv=matrix.inverted() if matrix else None
        for ob in objects:
            ev=ob.evaluated_get(deps);mesh=ev.to_mesh();offset=len(verts);world=ev.matrix_world
            verts.extend([(inv@world@v.co) if inv else (world@v.co) for v in mesh.vertices]);local=[]
            for mat in mesh.materials:
                if mat.name not in lookup:lookup[mat.name]=len(mats);mats.append(mat)
                local.append(lookup[mat.name])
            for face in mesh.polygons:
                faces.append(tuple(offset+i for i in face.vertices));matids.append(local[face.material_index] if local else 0)
                for li in face.loop_indices:
                    uv=mesh.uv_layers.active.data[li].uv[:] if mesh.uv_layers.active else (0,0);uvs.append(uv)
                if mesh.uv_layers.active:hasuv=True
            ev.to_mesh_clear()
        mesh=bpy.data.meshes.new(owner+' merged by editable item');mesh.from_pydata(verts,[],faces);mesh.update()
        for mat in mats:mesh.materials.append(mat)
        for face,idx in zip(mesh.polygons,matids):face.material_index=idx
        if hasuv:
            uv=mesh.uv_layers.new()
            for item,co in zip(uv.data,uvs):item.uv=co
        ob=bpy.data.objects.new('asset-'+owner,mesh);scene.collection.objects.link(ob)
        if root and matrix:
            ob.matrix_world=matrix
            for key in ('placeable_id','definition_id','support_id','footprint','height','role'): 
                if key in root:ob[key]=root[key]
        exports.append(ob);metrics.append({'id':owner,'triangles':sum(len(p.vertices)-2 for p in mesh.polygons),'materials':len(mats)})
    bpy.ops.object.select_all(action='DESELECT')
    for ob in exports:ob.select_set(True)
    bpy.context.view_layer.objects.active=exports[0]
    path=MODELS/f'{ROOM}.glb';bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_animations=False,export_extras=True,export_yup=True)
    result={'room':ROOM,'source':str(source.relative_to(ROOT)),'editableItems':metrics,'triangles':sum(m['triangles'] for m in metrics),'bytes':path.stat().st_size,'status':'authored-model-not-native-performance-approved'}
    (MODELS/f'{ROOM}.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print('MODULAR_EXPORT',ROOM,result['triangles'],result['bytes'],flush=True)
def main():
    global K,ROOM,LAYOUT
    args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['library'];preview='--preview' in args;export='--export' in args;views='--views' in args;resume='--resume' in args;no_render='--no-render' in args
    selected=[a for a in args if not a.startswith('--')]
    if not selected or 'all' in selected:selected=list(NAMES)
    for ROOM in selected:
        started=time.time();source=SOURCE/f'{ROOM}-master.blend'
        if not resume:
            bpy.ops.wm.read_factory_settings(use_empty=True);K=A.init();A.kit.R.seed(100+list(NAMES).index(ROOM));W,D=DIMS[ROOM]
            LAYOUT={'id':ROOM,'name':NAMES[ROOM],'width':W,'depth':D,'kind':'solo-study','pets':False,'units':'meters','spawn':[W/2,D-.26],'geometryStatus':'authored-model-layout-needs-route-validation','items':[],'studyZones':[]}
            globals()[ROOM]()
            import personal_study_detail_pass
            personal_study_detail_pass.apply(sys.modules[__name__])
            import personal_study_fidelity
            personal_study_fidelity.apply(sys.modules[__name__])
            scene=setup_render(preview);scene['personal_space_id']=ROOM;scene['reference_image']=f'{ROOM}-hero.png';scene['canonical_units']='meters';scene['pets_allowed']=False
            import personal_study_finishing
            personal_study_finishing.apply(sys.modules[__name__])
            spawn=K.group('COMPANION_SPAWN',(0,-D/2+.26,0),collection='INTERACTION_MAP');spawn['interaction_anchor']=True
            inventory={}
            for ob in scene.objects:
                if ob.type in ('MESH','CURVE','FONT') and ob.name!='Studio floor':key=ob.get('placeable_owner','architecture');inventory[key]=inventory.get(key,0)+1
            (OUT/'data'/f'{ROOM}-model-layout.json').write_text(json.dumps(LAYOUT,indent=2,ensure_ascii=False),encoding='utf-8')
            (OUT/'data'/f'{ROOM}-model-inventory.json').write_text(json.dumps(inventory,indent=2),encoding='utf-8')
            bpy.ops.wm.save_as_mainfile(filepath=str(source));print('MASTER_SAVED',ROOM,len(scene.objects),flush=True)
        if not no_render:render_views(source,preview,views)
        if export:export_modular(source)
        print('PERSONAL_SPACE_READY',ROOM,round(time.time()-started,1),flush=True)
if __name__=='__main__':main()
