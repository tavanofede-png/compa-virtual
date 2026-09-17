"""Reusable authored assets for the eight approved personal study concepts.
Metres, Z up. Asset roots retain furniture identity and surface/seat metadata.
"""
import bpy, math, random, sys, types
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools/blender'))
sys.path.insert(0,str(ROOT/'scripts'))
from room_premium_common import RoomKit
import shared_space_interiors as I
import shared_space_exteriors as E
source=(ROOT/'scripts/build_shared_spaces.py').read_text(encoding='utf-8')
kit=types.ModuleType('personal_legacy_parts')
kit.__file__=str(ROOT/'scripts/build_shared_spaces.py')
exec(compile(source.split('selected=sys.argv[')[0],str(ROOT/'scripts/build_shared_spaces.py'),'exec'),kit.__dict__)
K=None
def init():
    global K
    K=RoomKit()
    for n,c in kit.COLORS.items():K.material(n,'#'+''.join(f'{round(x*255):02x}' for x in c),.7,.65 if n=='gold' else 0)
    I.materials(K);E._palette(K)
    for n,c in {'oak':'#895129','woodlight':'#BF874D','oak_end':'#AE7540','plaster':'#EEE5D5','ivory':'#F1E8D8','sage':'#697B50','rust':'#AF573C','navy':'#223447','graphite':'#242C35','purple':'#7657D2','cyan':'#3CBBFF','petal':'#F4E7D0','pink':'#D58F9D','soil':'#3D3023','leaf_deep':'#264626','leaf_mid':'#477038','leaf_fresh':'#7E9B3E','rug_cream':'#E3D4B7','fabric_sage':'#677748','fabric_ivory':'#EDE2CD','fabric_rust':'#A6533A','fabric_blue':'#314D66','glass_light':'#B7CFCD','tile':'#C9B59B','tile_gray':'#9E9DA5','tile_green':'#45765D','copper':'#8F5739','screen':'#17314C','screen_ink':'#A6C5D5'}.items():
        m=K.material(n,c,.72,.75 if n in ('copper',) else 0)
        # Existing helper materials are intentionally harmonized to this master palette.
        from build_harper import rgba
        m.diffuse_color=rgba(c);m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=rgba(c)
    for n,col in [('led_blue','#247BFF'),('led_purple','#914BFF'),('lamp_glow','#FFD38A')]:
        m=K.material(n,col,.4);p=m.node_tree.nodes['Principled BSDF'];p.inputs['Emission Color'].default_value=m.diffuse_color;p.inputs['Emission Strength'].default_value=3
    # Real glass and restrained fine grain. These do not replace modelled joins and seams.
    glass=K.mat('glass_light').node_tree.nodes['Principled BSDF'];glass.inputs['Transmission Weight'].default_value=.82;glass.inputs['Roughness'].default_value=.12;glass.inputs['IOR'].default_value=1.45
    for n in ('oak','woodlight','oak_end'):
        mat=K.mat(n);ns=mat.node_tree.nodes;links=mat.node_tree.links;p=ns['Principled BSDF'];tex=ns.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=5;tex.inputs['Detail'].default_value=3
        coord=ns.new('ShaderNodeTexCoord');mapping=ns.new('ShaderNodeVectorMath');mapping.operation='MULTIPLY';mapping.inputs[1].default_value=(2,75,8);links.new(coord.outputs['Generated'],mapping.inputs[0]);links.new(mapping.outputs[0],tex.inputs['Vector'])
        bump=ns.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.17;bump.inputs['Distance'].default_value=.002;links.new(tex.outputs['Fac'],bump.inputs['Height']);links.new(bump.outputs[0],p.inputs['Normal'])
        ramp=ns.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].position=.23;ramp.color_ramp.elements[1].position=.77
        ramp.color_ramp.elements[0].color=rgba('#59371D' if n=='oak' else '#85532C')
        ramp.color_ramp.elements[1].color=rgba('#A5753D' if n=='oak' else '#C49558')
        links.new(tex.outputs['Fac'],ramp.inputs['Fac']);links.new(ramp.outputs['Color'],p.inputs['Base Color'])
        bump.inputs['Strength'].default_value=.26;bump.inputs['Distance'].default_value=.0035
    for n in ('fabric_ivory','fabric_sage','fabric_rust','fabric_blue','rug_cream'):
        mat=K.mat(n);ns=mat.node_tree.nodes;links=mat.node_tree.links;p=ns['Principled BSDF'];tex=ns.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=180;tex.inputs['Detail'].default_value=2
        bump=ns.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.4;bump.inputs['Distance'].default_value=.002;links.new(tex.outputs['Fac'],bump.inputs['Height']);links.new(bump.outputs[0],p.inputs['Normal'])
    return K
def b(n,p,d,m='woodlight',bevel=.007,parent=None,rot=(0,0,0)):return K.box(n,p,d,m,'CRAFTED_GEOMETRY',bevel,rot,parent)
def c(n,p,r,h,m='gold',v=16,top=None,parent=None):return K.cylinder(n,p,r,h,m,'CRAFTED_GEOMETRY',v,top,parent)
def line(n,points,r=.006,m='gold',parent=None,cyclic=False):return K.tube(n,points,r,m,'CRAFTED_GEOMETRY',cyclic,parent)
def asset(name,definition,fn,pos=(0,0,0),yaw=0,**kwargs):
    before=set(bpy.data.objects)
    fn(**kwargs)
    created=set(bpy.data.objects)-before
    root=K.group(name,pos,(0,0,yaw),'PLACEABLES');root['placeable_id']=name;root['definition_id']=definition;root['editable']=True
    for ob in created:
        if ob.parent not in created:ob.parent=root
        ob['placeable_owner']=name
    return root
def boxed_pot(name='Plant',size=1,flowers=False):
    b(name+' outer ceramic', (0,0,.11*size),(.27*size,.27*size,.22*size),'ivory',.015*size)
    b(name+' rooted soil',(0,0,.224*size),(.235*size,.235*size,.012*size),'soil',.002)
    for side in (-1,1):
        for j in range(9):b(name+' ribbed glaze',(side*.138*size,-.11*size+j*.0275*size,.11*size),(.012*size,.012*size,.20*size),'ivory',.003)
    E._shrub(K,name,(0,0,.23*size),.22*size,.4*size,seed=sum(map(ord,name)),flowers=flowers)
def plant(size=1,kind='fern',flowers=False):
    if kind=='monstera':
        c('Fluted ceramic planter',(0,0,.16*size),.18*size,.32*size,'ivory',20,top=.21*size)
        c('Planter top lip',(0,0,.323*size),.215*size,.033*size,'ivory',24)
        c('Planted dark soil',(0,0,.335*size),.19*size,.02*size,'soil',24)
        for j in range(30):
            a=j*math.tau/30;line('Fine pot fluting',[(.18*size*math.cos(a),.18*size*math.sin(a),.025*size),(.21*size*math.cos(a),.21*size*math.sin(a),.31*size)],.0025*size,'rug_cream')
        # Architectural fern: branching fronds, individual voxel leaflets, no inflated oval leaves.
        for j in range(17):
            a=j*2.399;reach=(.26+(j%4)*.044)*size;height=(.38+(j%5)*.09)*size
            pts=[(0,0,.32*size),(math.cos(a)*reach*.45,math.sin(a)*reach*.45,.32*size+height*.83),(math.cos(a)*reach,math.sin(a)*reach,.32*size+height)]
            line('Fern curving rachis',pts,.004*size,'leaf_deep')
            for n in range(10):
                t=(n+1)/11;center=Vector(pts[1]).lerp(Vector(pts[2]),t)
                for sign in (-1,1):
                    length=(.105*(1-t)+.035)*size
                    direction=Vector((math.cos(a+sign*1.16),math.sin(a+sign*1.16),.18))
                    start=center+direction*length*.48
                    E._leaf(K,'Separate fern pinna',start,length,a+sign*1.16,['leaf_deep','leaf_mid','leaf_fresh'][(j+n)%3],.25)
    elif kind=='square':boxed_pot(size=size,flowers=flowers)
    else:I.botanical(K,'Botanical '+kind,(0,0,0),size,flowers)
def book_stack(count=3):
    kit.bookstack(K,'Clothbound book stack',(0,0,0),count)
    for i in range(count):
        for j in range(7):b('Individual paper edges',(0,-.121,.014+i*.065+j*.006),(.326,.001,.0013),'linen_shadow',0)
        b('Foil spine title',(-.182,0,.027+i*.065),(.001,.11,.009),'gold',0)
def notebook():
    b('Journal hardcover',(0,0,.012),(.34,.25,.022),'navy',.004)
    for side in (-1,1):
        b('Separate cream page block',(side*.084,0,.032),(.161,.235,.026),'paper',.003,rot=(0,side*.028,0))
        for i in range(8):b('Handwritten rule',(side*.084,-.088+i*.025,.047),(.12,.001,.0006),'screen_ink',0)
    line('Ribbon bookmark',[(0,.08,.05),(0,-.15,.049),(.025,-.17,.036)],.004,'rust')
    for i in range(10):
        y=-.1+i*.022
        line('Spiral brass binding',[(.016*math.cos(t),y+.008*math.sin(t),.034+.021*math.sin(t)) for t in [j*math.tau/14 for j in range(15)]],.0018,'gold')
    line('Study pen',[(.22,-.095,.027),(.22,.075,.027)],.006,'navy');c('Pen endcap',(.22,.08,.027),.006,.016,'gold',12)
def laptop():
    kit.laptop(K,'Notebook computer',(0,0,0))
    for side in (-1,1):
        for j in range(2):b('USB port',(side*.191,-.055+j*.045,.017),(.002,.025,.009),'ink',.002)
    b('Camera',(0,.098,.248),(.007,.002,.007),'ink',.001)
    for i in range(16):b('Screen interface row',(-.025,.096,.226-i*.01),(.15+(i%3)*.025,.001,.002),'screen_ink',0)
    for i in range(3):b('Screen sidebar icon',(-.145,.096,.218-i*.055),(.014,.001,.014),'cyan',.001)
def pencil_cup():E._pencil_cup(K,'Pen cup',(0,0,0))
def mug():I.mug(K,'Sage ceramic cup',(0,0,0),'sage')
def banker_lamp():
    b('Lamp weighted base',(0,0,.025),(.23,.18,.05),'gold',.018)
    line('Lamp upright',[(0,0,.05),(0,0,.37),(0,-.06,.4)],.012,'gold')
    # Curved hood with inner face and rolled ends.
    n=18;verts=[]
    for x in (-.16,.16):
        for j in range(n+1):
            a=.12+math.pi*j/n;verts.append((x,-.06+.09*math.cos(a),.4+.09*math.sin(a)))
    faces=[(j,j+1,j+n+2,j+n+1) for j in range(n)]
    hood=K.mesh('Green glass sculpted shade',verts,faces,'sage','LIGHTS',.003)
    sol=hood.modifiers.new('Glass shade wall thickness','SOLIDIFY');sol.thickness=.007
    b('Warm shade diffuser',(0,-.065,.402),(.29,.145,.008),'lamp_glow',.008)
    I.local_glow(K,'Desk lamp warm pool',(0,-.08,.39),5,.15)
def pleated_lamp(scale=.72):I.shade_lamp(K,'Pleated shade',(0,0,0),scale);I.local_glow(K,'Fabric shade glow',(0,0,.29*scale),14,.12)
def desk(w=1.6,d=.75,height=.76,style='oak',drawers=True):
    top='ivory' if style=='white' else 'woodlight';frame='graphite' if style in ('white','tech') else 'oak'
    for j in range(5):
        yy=-d/2+(j+.5)*d/5;b('Solid tabletop board',(0,yy,height-.025),(w,d/5-.003,.05),top,.005)
        if style=='oak':
            for x in (-w/2+.045,w/2-.045):c('Recessed tabletop peg',(x,yy,height+.001),.005,.002,'oak',8)
    # Full leg clearance is central; the pedestal only occupies the far right.
    for xx in (-w/2+.07,w/2-.07):
        for yy in (-d/2+.07,d/2-.07):b('Mortised leg',(xx,yy,(height-.05)/2),(.075,.075,height-.05),frame,.005)
    for yy in (-d/2+.055,d/2-.055):b('Apron rail',(0,yy,height-.095),(w-.12,.035,.095),frame,.004)
    if drawers:
        xx=w/2-.205;b('Drawer cabinet',(xx,.025,.345),(.30,d-.18,.64),top,.009)
        for j in range(3):
            z=.14+j*.19;b('Individual inset drawer',(xx,-d/2+.07,z),(.285,.034,.17),top,.004)
            b('Drawer raised field',(xx,-d/2+.049,z),(.238,.008,.126),top,.002)
            b('Brass handle inset',(xx,-d/2+.04,z+.012),(.09,.009,.033),'oak',.004)
            line('Brass drawer pull',[(xx-.034,-d/2+.025,z+.012),(xx+.034,-d/2+.025,z+.012)],.006,'gold')
    for xx in (-w/2+.072,w/2-.072):b('Endgrain corner joint',(xx,0,height-.08),(.032,d-.06,.05),frame,.003)
def study_chair(color='fabric_ivory',ergonomic=False):
    if ergonomic:
        c('Hydraulic piston',(0,0,.27),.035,.31,'metal',16)
        c('Seat swivel',(0,0,.405),.10,.07,'graphite',16)
        for j in range(5):
            a=j*math.tau/5;line('Chair castor spoke',[(0,0,.17),(.29*math.cos(a),.29*math.sin(a),.07)],.025,'graphite')
            wheel=c('Double caster',(.29*math.cos(a),.29*math.sin(a),.043),.035,.06,'ink',12);wheel.rotation_euler.x=math.pi/2
    else:
        for x in (-.22,.22):
            for y in (-.215,.215):b('Chair timber leg',(x,y,.21),(.056,.056,.42),'oak',.005)
        for x in (-.24,.24):b('Back frame upright',(x,.23,.68),(.052,.05,.83),'oak',.005)
        b('Seat timber frame',(0,0,.407),(.53,.53,.065),'oak',.008)
    b('Quilted seat cushion',(0,0,.458),(.51,.51,.105),color,.034)
    back=E._soft_cushion(K,'Tailored chair back',(0,.244,.84),.51,.40,.10,color)
    for x in (-.286,.286):
        b('Arm support',(x,.07,.556),(.039,.04,.25),'graphite' if ergonomic else 'oak',.006)
        b('Armrest',(x,0,.679),(.073,.47,.047),'graphite' if ergonomic else 'woodlight',.008)
    for x in (-.20,-.1,0,.1,.20):line('Back vertical seam',[(x,.190,.68),(x,.190,1)],.0018,'fabric_seam')
    if ergonomic:
        for j in range(4):b('Back support mechanism',(0,.303,.63+j*.085),(.30-j*.014,.08,.06),'graphite',.015)
        line('Seat adjust lever',[(.08,0,.37),(.22,-.12,.37)],.008,'metal')
def lounge():
    I.upholstered(K,'Reading armchair',(0,0,0),color='fabric_sage',cushion='fabric_ivory')
    for x in (-.43,.43):b('Oak sculpted arm cap',(x,0,.81),(.115,.79,.049),'woodlight',.013)
def shelf(w=1.8,h=2.6,columns=2,rows=5):
    I.rich_shelf(K,kit,'Library carpentry',(0,0,0),w,h,columns,rows)
    for x in (-w/2,w/2):
        for z in (.18,h-.1):
            for y in (-.05,.12):b('Timber joinery peg',(x,y,z),(.004,.014,.014),'oak',.002)
def cabinet(w=.6,h=.58):I.cabinet(K,'Storage cabinet',(0,0,.035),w,h,2)
def bench(w=1.8):
    E._bench(K,'Solid timber bench',(0,0,0),w)
    count=max(2,round(w/.6))
    for j in range(count):
        x=-w/2+(j+.5)*w/count
        b('Separate seat pad',(x,-.03,.516),(w/count-.018,.54,.10),'fabric_sage',.032)
        E._soft_cushion(K,'Back cushion',(x,.23,.85),w/count-.025,.46,.13,'fabric_sage')
    for x,mat in [(-w*.29,'fabric_ivory'),(w*.29,'fabric_rust')]:E._soft_cushion(K,'Loose embroidered pillow',(x,.08,.85),.35,.36,.15,mat,rotation=(.12,.0,.12))
def rug(w=2.2,d=1.8,round_shape=False,scheme='sage'):
    if round_shape:
        backing=c('Round woven backing',(0,0,.011),w/2,.021,'rug_cream',96);backing.scale.y=d/w
    else:b('Woven backing',(0,0,.011),(w,d,.021),'rug_cream',.004)
    verts=[];faces=[];ids=[];step=.038
    for ix in range(int(w/step)):
        x=-w/2+(ix+.5)*step
        for iy in range(int(d/step)):
            y=-d/2+(iy+.5)*step
            if round_shape and (x/(w/2))**2+(y/(d/2))**2>1:continue
            mat=1 if scheme=='blue' else int((int((x+w/2)/.36)+int((y+d/2)/.36))%2==0)
            base=len(verts)
            # Thick oval yarn cross-section instead of a flat ribbon.
            for row in range(5):
                a=row*math.pi/4;center=(x,y-step*.40*math.cos(a),.021+step*.28*math.sin(a))
                for t in range(6):
                    q=t*math.tau/6;verts.append((center[0]+step*.30*math.cos(q),center[1]+.005*math.sin(q),center[2]+.005*math.sin(q)))
            for row in range(4):
                for t in range(6):faces.append((base+row*6+t,base+row*6+(t+1)%6,base+(row+1)*6+(t+1)%6,base+(row+1)*6+t));ids.append(mat)
    ob=K.mesh('Individual woven loops',verts,faces,'rug_cream','TEXTILES',0);ob.data.materials.append(K.mat('fabric_blue' if scheme=='blue' else 'fabric_sage'))
    for p,m in zip(ob.data.polygons,ids):p.material_index=m
    if not round_shape:
        for x in (-w/2+.015,w/2-.015):line('Rug bound edge',[(x,-d/2,.024),(x,d/2,.024)],.01,'fabric_seam')
        for j in range(int(w/.035)):
            for sign in (-1,1):line('Tied fringe',[(-w/2+j*.035,sign*d/2,.024),(-w/2+j*.035+.008,sign*(d/2+.05),.017)],.003,'rug_cream')
def pouf(color='fabric_rust',r=.44):
    K.sphere('Puff stuffed core',(0,0,.235),(r,r,.235),color,'TEXTILES',32,18)
    # Dense knitted gores contour the rounded cushion, modelled as joined loops.
    verts=[];faces=[]
    for row in range(19):
        theta=.10+(math.pi-.20)*row/18;rr=r*math.sin(theta);z=.235+.235*math.cos(theta)
        n=max(14,round(math.tau*rr/.029))
        for j in range(n):
            a=j*math.tau/n;start=len(verts)
            # Two thick interlocked stitches, raised off the spherical core.
            for q in range(8):
                t=q*math.tau/8;aa=a+.010/max(rr,.10)*math.cos(t);rz=rr+.012
                for section in range(6):
                    u=section*math.tau/6;radial=rz+.007*math.cos(u)
                    verts.append((radial*math.cos(aa),radial*math.sin(aa),z+.020*math.sin(t)+.007*math.sin(u)))
            for q in range(8):
                for section in range(6):faces.append((start+q*6+section,start+q*6+(section+1)%6,start+((q+1)%8)*6+(section+1)%6,start+((q+1)%8)*6+section))
    K.mesh('Knitted interlocking yarn',verts,faces,color,'TEXTILES',0)
def frame(text='Ideas\nque crecen',w=.65,h=.95,color='ivory'):
    root=K.group('Frame assembly',(0,0,0))
    longest=max(map(len,text.split('\n')));size=min((w-.18)/max(1,longest)*1.45,(h-.20)/len(text.split('\n'))*.67)
    I.panel(K,'Framed editorial art',root,0,0,w,h,text,color,size)
def lantern(scale=1):E._lantern(K,'Crafted lantern',(0,0,0),scale)
def cart():
    for j in range(3):
        z=.13+j*.25;b('Cart oak tray',(0,0,z),(.53,.32,.035),'woodlight',.004)
        for x in (-.265,.265):b('Cart tray end',(x,0,z+.058),(.023,.32,.12),'graphite',.004)
        for n in range(5):
            book=K.book('Cart bound volume',(-.17+n*.068,.015,z+.026),.05,.18+(n%3)*.025,.22,['navy','sage','rust','ivory'][n%4]);
    for x in (-.27,.27):
        for y in (-.165,.165):
            b('Cart corner leg',(x,y,.4),(.025,.025,.72),'graphite',.003)
            wheel=c('Cart caster',(x,y,.06),.045,.035,'ink');wheel.rotation_euler.x=math.pi/2
    line('Cart push handle',[(-.27,.165,.77),(-.27,.165,.86),(.27,.165,.86),(.27,.165,.77)],.017,'graphite')
def desk_lamp():
    b('Lamp weighted foot',(0,0,.02),(.17,.13,.04),'graphite',.012)
    points=[(0,0,.04),(.03,0,.24),(-.10,.0,.39)]
    for i in range(2):
        for y in (-.014,.014):line('Parallel lamp arm',[(points[i][0],y,points[i][2]),(points[i+1][0],y,points[i+1][2])],.006,'graphite')
    for x,y,z in points:c('Articulation screw',(x,y,z),.015,.028,'gold')
    shade=c('Directional shade',(-.11,0,.37),.085,.10,'graphite',12,top=.045);shade.rotation_euler.y=-.3
    c('Tasklamp diffuser',(-.12,0,.321),.073,.009,'lamp_glow',12);I.local_glow(K,'Task light',(-.12,0,.31),4,.1)
def planter(w=1.2,d=.45,flowers=True):E._planter(K,'Flower border',(0,0,0),w,d,seed=round(w*100+d*25),flowers=flowers)
def tree(h=2.6,r=.7):E._tree(K,'Park tree',(0,0,0),h,r,28)
def monitor(w=.55):
    b('Monitor foot',(0,0,.012),(.22,.16,.025),'graphite',.006);b('Monitor support',(0,.04,.16),(.035,.04,.27),'graphite',.005)
    b('Monitor bevelled bezel',(0,.045,.39),(w,.032,.34),'graphite',.01);b('Monitor active display',(0,.026,.39),(w-.035,.002,.305),'screen',.002)
    for i in range(15):b('Readable interface rhythm',(-w*.12,.024,.52-i*.018),(w*(.35+.05*(i%4)),.001,.0028),'screen_ink',0)
    for i in range(4):b('Study content panels',(w*.32,.024,.49-i*.072),(w*.17,.001,.05),'blue',.002)
def pc():
    b('Computer chassis',(0,0,.23),(.23,.40,.46),'graphite',.016);b('Glass side',(0,-.204,.23),(.201,.008,.415),'glass_light',.009)
    for z in (.11,.24,.37):
        ring=c('Fan ring',(0,-.212,z),.072,.012,'led_blue',32);ring.rotation_euler.x=math.pi/2
        core=c('Fan motor',(0,-.225,z),.026,.018,'graphite',16);core.rotation_euler.x=math.pi/2
        for j in range(7):
            a=j*math.tau/7;b('Fan blade',(.042*math.cos(a),-.231,z+.042*math.sin(a)),(.037,.006,.016),'metal',.004,rot=(0,-a,0))
    for i in range(9):b('Vent slots',(.117,-.14+i*.035,.36),(.002,.02,.15),'ink',.002)
def speakers():
    for x in (-.115,.115):
        b('Speaker oak cabinet',(x,0,.12),(.18,.16,.24),'oak',.008)
        for z,r in [(.08,.056),(.18,.025)]:
            d=c('Driver surround',(x,-.084,z),r,.018,'ink',24);d.rotation_euler.x=math.pi/2
            d=c('Driver cone',(x,-.097,z),r*.62,.018,'metal',20);d.rotation_euler.x=math.pi/2
def coffee_machine():
    b('Espresso chassis',(0,0,.18),(.36,.27,.36),'metal',.022);b('Steel front',(0,-.14,.21),(.32,.025,.23),'ivory',.012)
    for x in (-.1,.1):
        dial=c('Control knob',(x,-.162,.27),.024,.025,'graphite',16);dial.rotation_euler.x=math.pi/2
        line('Portafilter',[(x,-.16,.16),(x,-.27,.16)],.012,'graphite')
    b('Removable drip tray',(0,-.13,.04),(.33,.17,.035),'graphite',.006)
    for i in range(13):b('Drain tray slots',(-.14+i*.023,-.15,.059),(.008,.13,.002),'metal',.001)
    line('Steam wand',[(.17,-.14,.18),(.21,-.19,.13),(.21,-.24,.08)],.007,'gold')
    for x in (-.085,.085):I.mug(K,'Espresso cup',(x,0,.36),'ivory')
def grinder():
    b('Grinder base',(0,0,.065),(.16,.18,.13),'graphite',.013)
    c('Bean hopper',(0,0,.25),.075,.22,'glass_light',16,top=.09);c('Hopper lid',(0,0,.37),.092,.015,'graphite',16)
    for i in range(28):
        a=i*2.399;r=.057*math.sqrt((i+.5)/28);K.sphere('Individual coffee bean',(r*math.cos(a),r*math.sin(a),.2+(i%5)*.023),(.014,.008,.009),'oak','COFFEE',8,4)
    b('Grinder dispensing nozzle',(0,-.105,.15),(.06,.09,.06),'metal',.005)
def pastry_case():
    b('Display base',(0,0,.075),(.69,.41,.15),'woodlight',.012)
    for x in (-.34,.34):
        for y in (-.2,.2):b('Metal glazed corner',(x,y,.41),(.025,.025,.68),'graphite',.005)
    for z in (.18,.4,.62):
        b('Glass pastry shelf',(0,0,z),(.66,.37,.01),'glass_light',.003)
        b('Front shelf trim',(0,-.20,z),(.69,.026,.029),'graphite',.003)
        for i in range(3):
            x=-.22+i*.22
            b('Serving plate',(x,0,z+.023),(.19,.22,.018),'ivory',.008)
            if i==0:
                for j in range(7):
                    a=-1+j/3;K.sphere('Croissant buttery fold',(x+a*.058,-.008+.035*a*a,z+.07),(.04-.012*abs(a),.045,.035),'woodlight','COFFEE',10,6)
            elif i==1:
                c('Muffin wrapper',(x,0,z+.057),.048,.055,'oak_end',12,top=.057);K.sphere('Muffin top',(x,0,z+.089),(.066,.065,.035),'woodlight','COFFEE',12,7)
                for j in range(5):K.sphere('Chocolate chip',(x+.028*math.cos(j),.028*math.sin(j),z+.113),(.007,.007,.005),'oak','COFFEE',8,4)
            else:
                b('Layered cake',(x,0,z+.074),(.11,.11,.086),'ivory',.008);b('Cake filling',(x,0,z+.073),(.113,.113,.014),'pink',.002);K.sphere('Berry garnish',(x,0,z+.136),(.02,.02,.022),'rust','COFFEE',10,6)
    b('Glazed top',(0,0,.76),(.69,.41,.014),'glass_light',.004)
    for x in (-.347,.347):b('Glass end panel',(x,0,.46),(.009,.38,.6),'glass_light',.002)
def pegboard(w=1.25,h=.8):
    b('Pegboard substrate',(0,0,0),(w,.04,h),'ivory',.008)
    # Actual recess rims rather than a featureless white plane.
    for ix in range(round(w/.055)):
        for iz in range(round(h/.055)):
            hole=c('Peg hole',(-w/2+.034+ix*.055,-.022,-h/2+.035+iz*.055),.0045,.002,'oak',8);hole.rotation_euler.x=math.pi/2
    for x,z in [(-.4,.14),(.0,.10),(.37,.04)]:
        b('Peg pocket',(x,-.08,z),(.20,.13,.17),'graphite',.009)
        for j in range(4):line('Pen in peg pocket',[(x-.06+j*.04,-.10,z+.025),(x-.06+j*.04,-.10,z+.19+j*.01)],.004,'gold' if j%2 else 'navy')
    b('Pinned calendar',(-.32,-.026,-.2),(.22,.006,.24),'paper',.002)
    for j in range(5):b('Calendar line',(-.32,-.031,-.13-j*.03),(.17,.001,.001),'ink',0)
def headphones():
    points=[(.085*math.cos(t),0,.09+.12*math.sin(t)) for t in [j*math.pi/20 for j in range(21)]];line('Padded headband',points,.019,'graphite')
    for x in (-.086,.086):
        cup=c('Ear cup',(x,0,.072),.05,.035,'graphite',20);cup.rotation_euler.y=math.pi/2
        pad=c('Ear pad',(x*.80,0,.072),.044,.018,'ivory',20);pad.rotation_euler.y=math.pi/2
