"""Authored common-room interiors, metres/Z-up; furniture defines every seat.

These are three different compositions, not palette variants. Geometry is kept
editable, including stitched upholstery, cabinet joinery and individual volumes.
The caller owns the floor, lighting rig, export and scenic image materials.
"""
import math
import random
import bpy
from mathutils import Vector

TAU = math.tau
R = random.Random(1931)


def materials(k):
    palette = {
        'plaster_warm': '#E5D6BD', 'plaster_inset': '#CCBFA8',
        'brick_warm': '#D6C3A4', 'brick_pale': '#DED1BC',
        'walnut_dark': '#493325', 'oak_end': '#987043', 'oak_line': '#765232',
        'fabric_ivory': '#EFE4CD', 'fabric_seam': '#C8B898',
        'fabric_blue': '#385E76', 'fabric_blue_light': '#557C94',
        'fabric_sage': '#587254', 'fabric_moss': '#354C37',
        'fabric_ochre': '#DDA539', 'fabric_rust': '#B75C30',
        'fabric_rust_light': '#D67B41', 'rug_cream': '#D8CCB3',
        'rug_blue': '#536C7A', 'rug_blue_dark': '#354957',
        'binding_red': '#A44834', 'binding_blue': '#344E68',
        'binding_green': '#465F41', 'binding_teal': '#4E7C78',
        'binding_mustard': '#BA9040', 'binding_parchment': '#D0B58C',
        'binding_violet': '#6B596D', 'page_aged': '#C4B294',
        'zipper': '#B69355', 'ceramic_white': '#F4EBDB',
        'leaf_deep': '#24432A', 'leaf_fresh': '#5A7834',
        'leaf_gold': '#8D983E', 'screen_light': '#A0BBC2',
        'screen_paper': '#EAECE2', 'note_pink': '#DD908D',
        'binding_navy': '#253645', 'binding_oxblood': '#74372B',
        'binding_cobalt': '#3A6891', 'binding_chalk': '#DED2B6',
        'binding_coffee': '#654735', 'binding_salmon': '#C78265',
        'warm_diffuser': '#FFE3AB', 'warm_brass': '#D5A24E',
        'leaf_mid': '#3C6030', 'flower_white': '#F0DDAA',
    }
    for key, value in palette.items():
        k.material(key, value, .83 if key.startswith(('fabric', 'rug')) else .66)
    diffuse=k.mat('warm_diffuser').node_tree.nodes.get('Principled BSDF')
    if diffuse:
        diffuse.inputs['Emission Color'].default_value=(1,.57,.17,1)
        diffuse.inputs['Emission Strength'].default_value=1.65


def b(k, name, pos, size, mat, bevel=.012, parent=None, rotation=(0,0,0)):
    return k.box(name, pos, size, mat, 'INTERIOR_DETAIL', bevel, rotation, parent)


def tube(k, name, points, radius, mat, parent=None, cyclic=False):
    return k.tube(name, points, radius, mat, 'INTERIOR_DETAIL', cyclic, parent)


def wall_root(k, name, x, y, left=False):
    return k.group(name, (x,y,0), (0,0,math.pi/2 if left else 0), 'ARCHITECTURE')


def walls(k, room, window=None):
    """Window=(centre_x,width,base,height); back wall has a real opening."""
    height = 3.52
    b(k, room+' left plaster wall', (-4.035,0,height/2), (.17,6.10,height), 'plaster_warm', .018)
    if window:
        cx,w,z,h = window
        # Butt joins: overlapping equal-height top caps cause black z-fighting.
        for a,c in ((-3.950,cx-w/2),(cx+w/2,4.1)):
            if c>a: b(k,room+' back wall pier',((a+c)/2,3.04,height/2),(c-a,.17,height),'plaster_warm')
        b(k,room+' window apron',(cx,3.04,z/2),(w,.17,z),'plaster_warm')
        if z+h<height: b(k,room+' window lintel',(cx,3.04,(z+h+height)/2),(w,.17,height-z-h),'plaster_warm')
    else:
        b(k,room+' back plaster wall',(.075,3.04,height/2),(8.05,.17,height),'plaster_warm')
    for name,pos,size in [('Back floor moulding',(.058,2.926,.09),(7.905,.06,.18)),('Left floor moulding',(-3.925,0,.09),(.06,6.04,.18)),('Back cornice',(.070,2.925,3.47),(7.91,.08,.11)),('Left cornice',(-3.925,0,3.47),(.08,6.08,.11))]:
        b(k,room+' '+name,pos,size,'oak_end',.009)
    # Staggered cut-stone dado, stopped below furniture; grooves are real gaps.
    for wall in ('left','back'):
        for row in range(3):
            count=10 if wall=='back' else 8
            span=8.0 if wall=='back' else 6.0
            step=span/count
            for j in range(count):
                t=-span/2+(j+.5)*step
                if wall=='back':
                    b(k,room+' back dado block',(t,2.936,.20+row*.20),(step-.013,.018,.187),'brick_pale' if (j+row)%3 else 'brick_warm',.003)
                else:
                    b(k,room+' side dado block',(-3.936,t,.20+row*.20),(.018,step-.013,.187),'brick_pale' if (j+row)%3 else 'brick_warm',.003)


def panel(k,name,root,x,z,w,h,text,color='paper',size=.12):
    b(k,name+' wooden frame',(x,-.07,z),(w,.075,h),'oak',.014,root)
    b(k,name+' recessed print',(x,-.113,z),(w-.10,.014,h-.10),color,.003,root)
    k.text(name+' lettering',text,(x,-.125,z),size,'ink','WALL_STORY',(math.pi/2,0,0),root)
    for xx in (-w/2+.045,w/2-.045):
        b(k,name+' mitre seam',(x+xx,-.115,z),( .004,.002,h-.025),'oak_end',0,root)


def sconce(k,name,root,x,z):
    b(k,name+' wall plate',(x,-.045,z),(.115,.065,.20),'metal',.015,root)
    tube(k,name+' bent bracket',[(x,-.06,z+.035),(x,-.28,z+.035),(x,-.31,z-.06)],.018,'metal',root)
    shade=k.cylinder(name+' angled shade',(x,-.31,z-.10),.095,.14,'metal','LIGHTS',12,radius_top=.055,parent=root)
    shade.rotation_euler=(.38,0,0)
    k.cylinder(name+' luminous diffuser',(x,-.328,z-.166),.080,.011,'warm_diffuser','LIGHTS',12,parent=root)
    local_glow(k,name+' practical pool',(x,-.34,z-.22),13,.12,root)


def local_glow(k,name,pos,power=8,radius=.15,parent=None):
    """Practical fixture light for the editable Blender scene, never a proxy prop."""
    data=bpy.data.lights.new(name,'POINT');data.energy=power
    data.color=(1.0,.68,.34);data.shadow_soft_size=radius
    ob=bpy.data.objects.new(name,data);k.link(ob,'LIGHTS',parent);ob.location=pos
    return ob


def blade(k,name,start,end,width,mat='leaf_mid',parent=None):
    """Thin creased botanical leaf, using a stepped outline and bent midrib."""
    a=Vector(start);delta=Vector(end)-a
    axis=delta.normalized()
    side=axis.cross(Vector((0,0,1)))
    if side.length<.08:side=Vector((1,0,0))
    side.normalize();verts=[]
    lengths=(0,.18,.40,.63,.83,1)
    widths=(.035,.63,1,.94,.48,0)
    for t,w in zip(lengths,widths):
        centre=a+delta*t+Vector((0,0,math.sin(t*math.pi)*width*.28))
        verts.extend([tuple(centre-side*width*w),tuple(centre+Vector((0,0,.005))),tuple(centre+side*width*w)])
    faces=[]
    for row in range(len(lengths)-1):
        q=row*3
        faces.extend([(q,q+3,q+4,q+1),(q+1,q+4,q+5,q+2)])
    ob=k.mesh(name,verts,faces,mat,'BOTANICALS',0,parent)
    tube(k,name+' fine central vein',[tuple(a+delta*t+Vector((0,0,math.sin(t*math.pi)*width*.28+.005))) for t in lengths],.0018,'leaf_fresh',parent)
    return ob


def botanical(k,name,pos,size=1,flowers=False):
    """Fine fern/philodendron mix instead of the old swollen succulent leaves."""
    x,y,z=pos;rng=random.Random(name)
    ceramic='terracotta' if rng.random()<.6 else 'ceramic_white'
    k.cylinder(name+' faceted planter',(x,y,z+.104*size),.134*size,.208*size,ceramic,'BOTANICALS',14,radius_top=.158*size)
    k.cylinder(name+' planter rim',(x,y,z+.211*size),.164*size,.027*size,ceramic,'BOTANICALS',16)
    k.cylinder(name+' dark rooted soil',(x,y,z+.217*size),.145*size,.013*size,'walnut_dark','BOTANICALS',14)
    for i in range(10):
        angle=i*2.399+.1*rng.random();reach=(.22+.11*rng.random())*size
        rise=(.21+.23*rng.random())*size
        root=(x,y,z+.213*size)
        tip=(x+math.cos(angle)*reach,y+math.sin(angle)*reach,z+(.21+rise/size)*size)
        mid=(x+math.cos(angle)*reach*.33,y+math.sin(angle)*reach*.33,z+(.21+rise/size*.85)*size)
        tube(k,name+' arching frond',[root,mid,tip],.0033*size,'leaf_deep')
        for j in range(1,6):
            t=j/6;base=tuple(Vector(mid)*(1-t)+Vector(tip)*t)
            feather=.082*size*(1-t*.6)
            for sign in (-1,1):
                dest=(base[0]+math.cos(angle+sign*1.05)*feather,base[1]+math.sin(angle+sign*1.05)*feather,base[2]-.012*size)
                blade(k,name+' fern leaflet',base,dest,.025*size,'leaf_mid' if (i+j)%3 else 'leaf_fresh')
        if i%3==0:blade(k,name+' larger heart leaf',mid,tip,.070*size,'leaf_deep')
        if flowers and i%2==0:
            for j in range(5):
                an=j*TAU/5
                blade(k,name+' flower petal',tip,(tip[0]+math.cos(an)*.047*size,tip[1]+math.sin(an)*.047*size,tip[2]+.005),.028*size,'flower_white')
            k.sphere(name+' pollen centre',tip,(.012*size,.012*size,.015*size),'yellow','BOTANICALS',8,4)


def framed_window(k,kit,name,cx,width,base,height):
    if hasattr(kit,'scenic_panel'):
        kit.scenic_panel(k,name+' distant garden',(cx,3.038,base+height/2),width,height,axis='back',kind='garden')
    else:
        b(k,name+' sky',(cx,3.058,base+height/2),(width,.02,height),'screen_light',.002)
    # Deep reveal, casement wood, black metal inner rails, sill and iron latch.
    for x in (cx-width/2,cx+width/2):
        b(k,name+' reveal jamb',(x,2.955,base+height/2),(.16,.23,height+.16),'oak_end',.013)
    for z in (base,base+height):
        b(k,name+' reveal crosspiece',(cx,2.955,z),(width+.16,.23,.14),'oak_end',.013)
    for x in (cx-width/2+.06,cx,cx+width/2-.06):
        b(k,name+' dark window stile',(x,2.80,base+height/2),(.055,.075,height-.06),'ink',.006)
    for z in (base+.055,base+height-.055):
        b(k,name+' dark window rail',(cx,2.80,z),(width-.05,.075,.055),'ink',.006)
    b(k,name+' projecting sill',(cx,2.78,base-.075),(width+.29,.56,.11),'woodlight',.016)
    tube(k,name+' window handle',[(cx+.11,2.725,base+.85),(cx+.17,2.725,base+.85),(cx+.17,2.725,base+1.0)],.012,'gold')


def upholstered(k,name,pos,angle=0,color='fabric_sage',cushion='fabric_ivory',arms=True):
    g=k.group(name,pos,(0,0,angle),'SEATS')
    b(k,name+' underframe',(0,0,.26),(.81,.83,.24),'walnut_dark',.05,g)
    b(k,name+' padded seat',(0,-.035,.46),(.82,.80,.17),color,.060,g)
    b(k,name+' curved back',(0,.31,.84),(.83,.22,.72),color,.075,g)
    b(k,name+' back inset',(0,.175,.87),(.68,.13,.48),color,.052,g)
    for xx in (-.25,0,.25):
        tube(k,name+' back tailored seam',[(xx,.102,.70),(xx,.101,1.02)],.0028,'fabric_seam',g)
    for yy in (-.41,.335):
        tube(k,name+' seat welt',[(-.36,yy,.50),(.36,yy,.50)],.003,'fabric_seam',g)
    for x in (-.34,.34):
        for y in (-.29,.28): b(k,name+' tapered foot',(x,y,.095),(.065,.065,.19),'oak',.012,g)
    if arms:
        for x in (-.455,.455):
            b(k,name+' arm bolster',(x,.015,.66),(.19,.83,.27),color,.065,g)
            tube(k,name+' arm piping',[(x,-.345,.765),(x,.305,.765)],.003,'fabric_seam',g)
    # A soft throw stays against the back and out of the avatar pelvis area.
    if cushion:
        p=b(k,name+' throw pillow',(.24,.035,.85),(.36,.15,.35),cushion,.070,g,rotation=(.15,.0,-.13))
        for q in range(3):
            b(k,name+' pillow woven accent',(.24-.12+q*.12,-.046,.85),(.012,.003,.28),color,.001,g)
    return g


def pouf(k,name,pos,color,seats,kit,angle=0):
    x,y,z=pos
    # Soft faceted pear silhouette with sewn gores, not a sphere or chair.
    profile=[(.035,.34,0),(.12,.49,0),(.29,.56,.03),(.43,.53,.12),(.46,.40,.23),(.445,.21,.12),(.435,.04,0)]
    segments=28;verts=[]
    for zz,rad,lift in profile:
        for j in range(segments):
            a=j*TAU/segments
            # Back rises into a low beanbag backrest, front leaves the knee free.
            bias=max(0,math.cos(a-math.pi/2))*lift
            verts.append((x+rad*math.cos(a),y+rad*math.sin(a),z+zz+bias))
    faces=[]
    for r in range(len(profile)-1):
        for j in range(segments):
            a=r*segments+j;c=r*segments+(j+1)%segments
            faces.append((a,c,c+segments,a+segments))
    faces += [tuple(reversed(range(segments))),tuple(range((len(profile)-1)*segments,len(profile)*segments))]
    k.mesh(name+' shaped beanbag',verts,faces,color,'SEATS',.008)
    for j in range(0,segments,2):
        a=j*TAU/segments
        pts=[]
        for zz,rad,lift in profile:
            bias=max(0,math.cos(a-math.pi/2))*lift
            pts.append((x+(rad+.005)*math.cos(a),y+(rad+.005)*math.sin(a),z+zz+bias))
        tube(k,name+' stitched gore',pts,.0032,'fabric_seam')
    b(k,name+' leather pull tab',(x,y+.41,z+.68),(.10,.03,.07),'oak',.010)
    kit.seat(seats,(x,y,0),angle,'pouf')


def sofa_run(k,name,centre,length,angle,seating,color='fabric_ivory'):
    g=k.group(name,centre,(0,0,angle),'SEATS')
    b(k,name+' oak plinth',(0,0,.155),(length-.10,.85,.17),'walnut_dark',.025,g)
    b(k,name+' tailored upholstered base',(0,0,.30),(length,.98,.24),color,.075,g)
    b(k,name+' supporting back',(0,.40,.84),(length,.23,.88),color,.080,g)
    for x in (-length/2+.10,length/2-.10):
        b(k,name+' outer upholstered arm',(x,0,.65),(.21,1.00,.53),color,.060,g)
    width=(length-.45)/seating
    for j in range(seating):
        x=-length/2+.225+width*(j+.5)
        b(k,name+' separate seat cushion',(x,-.03,.47),(width-.023,.80,.17),color,.055,g)
        b(k,name+' separate back cushion',(x,.245,.87),(width-.03,.20,.57),color,.065,g)
        tube(k,name+' cushion front piping',[(x-width*.43,-.437,.485),(x+width*.43,-.437,.485)],.0033,'fabric_seam',g)
        tube(k,name+' back cushion piping',[(x-width*.43,.137,.625),(x-width*.43,.137,1.095),(x+width*.43,.137,1.095),(x+width*.43,.137,.625)],.0028,'fabric_seam',g)
    for x in (-length/2+.20,length/2-.20):
        for y in (-.30,.30): b(k,name+' short wood foot',(x,y,.06),(.075,.075,.12),'oak',.008,g)
    return g


def throw_pillow(k,name,g,x,y,z,color,rotation=.12):
    p=b(k,name,(x,y,z),(.41,.19,.41),color,.080,g,rotation=(.16,0,rotation))
    # Offset parallel stitching follows the actual tilted pillow parent.
    for side in (-1,1):
        tube(k,name+' sewn edge',[(-.16,side*.098,-.13),(-.16,side*.098,.13),(.16,side*.098,.13),(.16,side*.098,-.13)],.0025,'fabric_seam',p)


def cabinet(k,name,pos,w=1.0,h=.69,doors=2,color='woodlight',parent=None):
    x,y,z=pos
    b(k,name+' carcass',(x,y,z+h/2),(w,.48,h),color,.014,parent)
    b(k,name+' top',(x,y-.025,z+h+.035),(w+.05,.56,.07),'woodlight',.015,parent)
    for i in range(doors):
        xx=x-w/2+(i+.5)*w/doors
        b(k,name+' inset door',(xx,y-.25,z+h*.50),(w/doors-.027,.035,h-.075),'oak_end',.010,parent)
        b(k,name+' raised door field',(xx,y-.270,z+h*.50),(w/doors-.09,.010,h-.16),color,.005,parent)
        tube(k,name+' brass pull',[(xx-.085,y-.289,z+h*.73),(xx+.085,y-.289,z+h*.73)],.012,'gold',parent)
    for dx in (-w*.38,w*.38): b(k,name+' base foot',(x+dx,y-.02,z-.025),(.055,.31,.06),'walnut_dark',.005,parent)


def rich_shelf(k,kit,name,pos,width=2.0,height=2.9,columns=2,rows=5,rotation=0,filled=True):
    """Different widths/heights, horizontal piles, label holders and bookends."""
    g=k.group(name,pos,(0,0,rotation),'FURNITURE')
    depth=.39
    b(k,name+' inset dark back',(0,.17,height/2),(width,.075,height),'walnut_dark',.01,g)
    for xx in (-width/2,width/2):b(k,name+' mortised stile',(xx,-.01,height/2),(.085,.48,height),'oak_end',.012,g)
    for j in range(1,columns):b(k,name+' partition',(-width/2+j*width/columns,0,height/2),(.06,.41,height-.10),'oak',.006,g)
    b(k,name+' crown cornice',(0,-.035,height+.045),(width+.14,.54,.11),'woodlight',.018,g)
    b(k,name+' grounded plinth',(0,-.02,.075),(width+.10,.50,.15),'oak',.012,g)
    for row in range(rows+1):
        zz=.15+row*(height-.22)/rows
        b(k,name+' shelf horizontal',(0,-.015,zz),(width,.46,.061),'woodlight',.007,g)
        b(k,name+' shelf front lip',(0,-.253,zz+.001),(width,.032,.062),'oak_end',.004,g)
        if row==rows: continue
        if not filled:continue
        for col in range(columns):
            lo=-width/2+col*width/columns+.095
            hi=-width/2+(col+1)*width/columns-.085
            rng=random.Random(name+str(row)+str(col))
            xpos=lo
            colors=['binding_red','binding_blue','binding_green','binding_teal','binding_mustard','binding_parchment','binding_violet']
            if (row+col)%4==0:
                # Horizontal folios create a real break in the spine rhythm.
                for layer in range(3):
                    bw=min(.32,(hi-lo)*.46);bz=zz+.033+layer*.057
                    b(k,name+' horizontal folio pages',(xpos+bw/2,-.02,bz+.025),(bw,.23,.047),'paper',.002,g)
                    for dz in (.001,.051):b(k,name+' horizontal folio cover',(xpos+bw/2,-.02,bz+dz),(bw+.013,.246,.008),colors[(layer+row)%7],.002,g)
                xpos+=min(.34,(hi-lo)*.48)
            index=0
            while xpos+.049<hi:
                bw=.038+rng.random()*.035
                bh=min((height-.22)/rows-.10,.245+rng.random()*.145)
                vol=k.book(name+f' volume {row}-{col}-{index}',(xpos+bw/2,-.015,zz+.032),bw,bh,.25,colors[(index+row*2+col)%7],collection='LIBRARY_VOLUMES')
                vol.parent=g
                # Section marks supplement, rather than replace, detailed bindings.
                if index%6==0:b(k,name+' fabric book marker',(xpos+bw*.4,-.149,zz+bh*.66),(.012,.012,.13),'gold',.001,g)
                xpos+=bw+.009+rng.random()*.012;index+=1
            b(k,name+' brass bookend',(hi-.015,-.028,zz+.15),(.016,.25,.23),'metal',.003,g)
    return g


def vine(k,name,pos,length=1.4,side=0):
    x,y,z=pos
    for branch in range(3):
        pts=[]
        for j in range(14):
            zz=z-length*j/13;xx=x+math.sin(j*.82+branch)*.11+branch*.09;yy=y-.025*j/13+math.sin(j*.91)*.035
            pts.append((xx,yy,zz))
            if j>0:
                for sign in (-1,1):
                    leaf=k.sphere(name+' heart leaf',(xx+sign*.052,yy-.025,zz-.015),(.062,.028,.086),'leaf_deep' if (j+branch)%3 else 'leaf_fresh','BOTANICALS',8,4)
                    leaf.rotation_euler=(.25,sign*.65,.2*math.sin(j))
        tube(k,name+' trailing stem',pts,.005,'green')


def floor_plant(k,kit,name,pos,size=1.0,mat='terracotta'):
    x,y,z=pos
    k.cylinder(name+' tapered planter',(x,y,z+.18*size),.22*size,.34*size,mat,'BOTANICALS',12,radius_top=.26*size)
    k.cylinder(name+' soil',(x,y,z+.352*size),.23*size,.025,'oak','BOTANICALS',16)
    k.cylinder(name+' planter rolled rim',(x,y,z+.36*size),.268*size,.065*size,mat,'BOTANICALS',16)
    for i in range(13):
        a=i*2.399;h=(.48+.15*(i%4))*size;r=(.16+.10*(i%3))*size
        end=(x+math.cos(a)*r,y+math.sin(a)*r,z+h)
        tube(k,name+' curved stem',[(x,y,z+.36*size),(x+math.cos(a)*r*.5,y+math.sin(a)*r*.5,z+h*.75),end],.008*size,'green')
        leaf=k.sphere(name+' broad articulated leaf',end,(.10*size,.22*size,.035*size),'leaf_deep' if i%3 else 'leaf_fresh','BOTANICALS',10,5)
        leaf.rotation_euler=(.22,.36*math.sin(a),a)
        tube(k,name+' leaf midrib',[(end[0],end[1]-.16*size,end[2]+.025),(end[0],end[1]+.16*size,end[2]+.025)],.002,'sage')


def shade_lamp(k,name,pos,scale=1.0):
    x,y,z=pos
    k.cylinder(name+' walnut foot',(x,y,z+.035),.14*scale,.07*scale,'oak','LIGHTS',20)
    k.cylinder(name+' brass stem',(x,y,z+.22*scale),.018*scale,.39*scale,'gold','LIGHTS',12)
    k.cylinder(name+' pleated fabric shade',(x,y,z+.46*scale),.22*scale,.29*scale,'fabric_ivory','LIGHTS',32,radius_top=.15*scale)
    for j in range(32):
        a=j*TAU/32
        tube(k,name+' shade pleat',[(x+.22*scale*math.cos(a),y+.22*scale*math.sin(a),z+.315*scale),(x+.15*scale*math.cos(a),y+.15*scale*math.sin(a),z+.605*scale)],.0025*scale,'fabric_seam')
    k.cylinder(name+' warm diffuser',(x,y,z+.32*scale),.205*scale,.012,'light','LIGHTS',24)


def mug(k,name,pos,color='ceramic_white',parent=None):
    x,y,z=pos
    k.cylinder(name+' glazed body',(x,y,z+.065),.061,.13,color,'STUDY_OBJECTS',16,parent=parent)
    k.cylinder(name+' coffee surface',(x,y,z+.132),.051,.004,'walnut_dark','STUDY_OBJECTS',16,parent=parent)
    points=[(x+.066+.030*math.sin(j*math.pi/8),y,z+.070+.047*math.cos(j*math.pi/8)) for j in range(9)]
    tube(k,name+' ceramic handle',points,.009,color,parent)


def backpack(k,name,pos,color='fabric_blue',angle=0):
    g=k.group(name,pos,(0,0,angle),'STUDY_OBJECTS')
    b(k,name+' padded body',(0,0,.285),(.39,.24,.53),color,.055,g)
    b(k,name+' separate front pocket',(0,-.145,.20),(.32,.085,.22),color,.034,g)
    tube(k,name+' main zipper',[(-.16,-.12,.40),(-.14,-.12,.50),(0,-.12,.54),(.14,-.12,.50),(.16,-.12,.40)],.004,'zipper',g)
    tube(k,name+' pocket zipper',[(-.13,-.191,.29),(.13,-.191,.29)],.0035,'zipper',g)
    for x in (-.13,.13):
        tube(k,name+' padded shoulder strap',[(x,.11,.46),(x,.19,.44),(x,.20,.10),(x,.12,.06)],.022,'metal',g)
    tube(k,name+' top carry handle',[(-.08,0,.54),(-.08,0,.61),(.08,0,.61),(.08,0,.54)],.011,'metal',g)
    b(k,name+' label',(0,-.192,.21),(.072,.011,.065),'cream',.007,g)
    for z in (.18,.40):b(k,name+' side bottle pocket',(.215,0,z),(.065,.17,.14),color,.016,g)


def patterned_rug(k,name,cx,cy,w,d,scheme='blue'):
    b(k,name+' woven ground',(cx,cy,.016),(w,d,.028),'rug_cream',.007)
    for side in (-1,1):
        b(k,name+' bound long edge',(cx,cy+side*(d/2-.045),.033),(w,.043,.009),'fabric_seam',.002)
        b(k,name+' bound short edge',(cx+side*(w/2-.045),cy,.033),(.043,d,.009),'fabric_seam',.002)
    nx=int(w/.30);ny=int(d/.29)
    for row in range(ny):
        for col in range(nx):
            if row in (0,ny-1) or col in (0,nx-1) or (col//2+row//2)%3==0:
                b(k,name+' jacquard block',(cx-w/2+(col+.5)*w/nx,cy-d/2+(row+.5)*d/ny,.034),(w/nx-.019,d/ny-.019,.006),'rug_blue_dark' if (row+col)%4==0 else 'rug_blue',.002)
    for j in range(int(w/.052)):
        x=cx-w/2+j*.052
        for sy in (-1,1):tube(k,name+' knotted fringe',[(x,cy+sy*d/2,.021),(x+.008,cy+sy*(d/2+.07),.018)],.004,'rug_cream')
    for j in range(int(d/.04)):
        b(k,name+' fine woven ridge',(cx,cy-d/2+j*.04,.039),(w-.06,.002,.003),'fabric_seam',0)


def coffee_table(k,kit,name,pos,w=2.6,d=1.20):
    x,y,z=pos
    for j in range(5):b(k,name+' individual top board',(x,y-d/2+(j+.5)*d/5,z+.47),(w,d/5-.007,.095),'woodlight',.013)
    b(k,name+' lower shelf',(x,y,z+.19),(w-.20,d-.13,.065),'oak_end',.010)
    for dx in (-w/2+.12,w/2-.12):
        for dy in (-d/2+.11,d/2-.11):b(k,name+' tapered corner leg',(x+dx,y+dy,z+.235),(.10,.10,.47),'oak',.010)
    for i in range(4):
        kit.bookstack(k,name+' lower folios',(x-w*.30+i*.45,y+.06,z+.235),2+(i%2))
    kit.bookstack(k,name+' blue notebook stack',(x-w*.31,y-.20,z+.523),3)
    kit.bookstack(k,name+' reading pile',(x+w*.28,y+.13,z+.523),3)
    kit.notebook(k,name+' open notebook',(x-.10,y-.23,z+.523))
    kit.plant(k,name+' centre greenery',(x+.15,y+.20,z+.523),.60)
    mug(k,name+' shared mug',(x+.50,y-.31,z+.523),'sage')


def work_table(k,name,pos,w,d):
    x,y,z=pos
    for j in range(7):
        yy=y-d/2+(j+.5)*d/7
        b(k,name+' solid oak plank',(x,yy,z+.78),(w,d/7-.006,.095),'woodlight' if j%3 else 'oak_end',.013)
        for row in range(3):b(k,name+' restrained wood grain',(x-.10+row*.21,yy-.07+row*.06,z+.829),(w*.78,.002,.001),'oak_line',0)
    for xx in (-w*.44,w*.44):
        for yy in (-d*.37,d*.37):
            b(k,name+' squared tapered leg',(x+xx,y+yy,z+.38),(.12,.12,.76),'oak',.012)
            b(k,name+' metal foot',(x+xx,y+yy,.028),(.123,.123,.056),'metal',.005)
    for yy in (-d*.38,d*.38):b(k,name+' apron rail',(x,y+yy,z+.64),(w-.18,.07,.18),'oak_end',.008)
    b(k,name+' central foot brace',(x,y,z+.22),(w-.30,.075,.09),'oak',.008)


def work_chair(k,name,pos,angle=0,color='fabric_blue'):
    g=k.group(name,pos,(0,0,angle),'SEATS')
    for x in (-.235,.235):
        for y in (-.23,.23):
            b(k,name+' oak leg',(x,y,.235),(.060,.060,.47),'oak_end',.009,g)
        b(k,name+' back upright',(x,.245,.67),(.055,.055,.79),'oak',.008,g)
    b(k,name+' padded seat',(0,0,.46),(.60,.58,.115),color,.043,g)
    b(k,name+' padded back',(0,.245,.86),(.60,.10,.37),color,.055,g)
    b(k,name+' inset back textile',(0,.183,.86),(.50,.028,.27),'fabric_blue_light',.035,g)
    tube(k,name+' seat perimeter seam',[(-.255,-.262,.489),(.255,-.262,.489),(.273,.23,.489),(-.273,.23,.489)],.0027,'fabric_seam',g)
    for xx in (-.18,.18):b(k,name+' brass back rivet',(xx,.168,.86),(.014,.008,.014),'gold',.005,g)


def clock(k,name,pos,left=False,r=.32):
    root=wall_root(k,name,pos[0],pos[1],left);zz=pos[2]
    o=k.cylinder(name+' oak outer ring',(0,-.025,zz),r,.09,'oak','WALL_STORY',48,parent=root);o.rotation_euler=(math.pi/2,0,0)
    o=k.cylinder(name+' ivory clock face',(0,-.079,zz),r-.035,.022,'paper','WALL_STORY',48,parent=root);o.rotation_euler=(math.pi/2,0,0)
    for i in range(12):
        a=i*TAU/12;x=math.sin(a)*(r-.068);z=zz+math.cos(a)*(r-.068)
        mark=b(k,name+' hour index',(x,-.095,z),(.011,.007,.038),'ink',.001,root);mark.rotation_euler[1]=a
    tube(k,name+' minute hand',[(0,-.112,zz),(.16,-.112,zz+.13)],.009,'ink',root)
    tube(k,name+' hour hand',[(0,-.12,zz),(-.035,-.12,zz+.145)],.012,'ink',root)
    b(k,name+' hand pivot',(0,-.125,zz),(.023,.015,.023),'gold',.005,root)


def globe(k,name,pos,r=.20):
    x,y,z=pos
    k.cylinder(name+' brass base',(x,y,z+.018),r*.62,.035,'gold','STUDY_OBJECTS',20)
    tube(k,name+' stand',[(x,y,z+.035),(x,y,z+r*.83)],.016,'gold')
    k.sphere(name+' globe',(x,y,z+r*1.85),(r,r,r),'blue','STUDY_OBJECTS',24,14)
    # Low-relief faceted continents with a recognizable staggered silhouette.
    for a,t,s in [(-1.6,.7,.07),(-1.4,.8,.08),(-1.3,1.0,.06),(-1.1,1.2,.05),(-.5,.9,.09),(-.7,1.05,.08),(-.4,1.2,.075),(.05,1.1,.05),(-.3,1.45,.055)]:
        xx=x+r*math.sin(t)*math.cos(a);yy=y+r*math.sin(t)*math.sin(a);zz=z+r*1.85+r*math.cos(t)
        k.sphere(name+' land relief',(xx,yy,zz),(s,s*.47,s*.76),'leaf','STUDY_OBJECTS',7,4)
    pts=[(x+(r+.032)*math.sin(a),y,z+r*1.85+(r+.032)*math.cos(a)) for a in [j*TAU/40 for j in range(41)]]
    tube(k,name+' meridian ring',pts,.008,'gold')


def whiteboard(k,name,root,width=4.3,centre=0,z=2.02):
    b(k,name+' extruded frame',(centre,-.045,z),(width,.12,1.67),'metal',.020,root)
    b(k,name+' enamel board',(centre,-.115,z),(width-.085,.032,1.585),'ceramic_white',.010,root)
    b(k,name+' marker tray',(centre,-.22,z-.83),(width-.20,.22,.045),'metal',.007,root)
    k.text(name+' handwritten agenda','Ideas\n+\nPersonas\n\nGrandes cosas',(centre,-.140,z+.10),.19,'ink','WALL_STORY',(math.pi/2,0,0),root)
    for side in (-1,1):
        for i in range(5):
            xx=centre+side*(width*.35+(.20 if i%2 else 0));zz=z+.50-i*.23
            b(k,name+' colored sticky',(xx,-.145,zz),(.16,.011,.16),['yellow','note_pink','sage','blue','coral'][i],.002,root)
            for j in range(2):b(k,name+' written sticky line',(xx,-.152,zz+.025-j*.04),(.105,.004,.006),'ink',.001,root)
    # Tiny drawn bulb in the top right, rather than repeated square artwork.
    circle=[(centre+1.22+.11*math.cos(a),-.153,z+.45+.14*math.sin(a)) for a in [j*TAU/22 for j in range(23)]]
    tube(k,name+' idea bulb outline',circle,.006,'yellow',root)
    for i in range(5):
        a=i*math.pi/4
        tube(k,name+' idea light ray',[(centre+1.22+.17*math.cos(a),-.153,z+.45+.20*math.sin(a)),(centre+1.22+.22*math.cos(a),-.153,z+.45+.25*math.sin(a))],.005,'yellow',root)
    for i,mat in enumerate(('blue','coral','sage','ink')):tube(k,name+' dry erase marker',[(centre-.50+i*.22,-.23,z-.80),(centre-.34+i*.22,-.23,z-.80)],.013,mat,root)
    for xx in (-width*.43,width*.43):b(k,name+' magnetic corner',(centre+xx,-.139,z+.70),(.023,.015,.023),'gold',.005,root)


def build_living(k,seats,kit):
    materials(k);R.seed(120)
    walls(k,'Living')
    patterned_rug(k,'Living blue ivory patchwork',-.25,-.59,5.55,3.90)
    # L-shaped sectional; the corner is a cushion, not a gap or overlapping arms.
    back=sofa_run(k,'Living long return',(-.23,1.79,0),4.18,0,3)
    side=sofa_run(k,'Living left return',(-2.94,.48,0),2.93,math.pi/2,2)
    b(k,'Living coherent corner cushion',(-2.42,1.79,.46),(.22,.79,.16),'fabric_ivory',.045)
    for run,sign in [(back,-1),(side,1)]:
        for ob in list(run.children):
            if 'outer upholstered arm' in ob.name and ob.location.x*sign>0:
                bpy.data.objects.remove(ob,do_unlink=True)
    # Two left-return positions and two on the long return = four couch seats.
    for p,a in [((-2.94,-.18,0),math.pi/2),((-2.94,.98,0),math.pi/2),((-.23,1.79,0),0),((1.163,1.79,0),0)]:kit.seat(seats,p,a,'sofa')
    for x,col in [(-1.15,'fabric_sage'),(.02,'fabric_blue'),(1.31,'fabric_ochre')]:throw_pillow(k,'Living loose sofa pillow',back,x,.10,.86,col,-.17 if x<0 else .16)
    throw_pillow(k,'Living rust corner pillow',side,.10,.06,.90,'fabric_rust',.22)
    # Side seam detailing and gentle cotton throw at the outer arm.
    for i in range(11):b(k,'Living draped blanket fold',(1.70+i*.012,1.44,.70),(.010,.58,.30),'fabric_sage' if i%3 else 'fabric_moss',.005)
    coffee_table(k,kit,'Living shared coffee table',(-.35,-.45,0),2.70,1.14)
    pouf(k,'Living orange beanbag',(-2.10,-2.02,0),'fabric_rust',seats,kit,math.pi*.25)
    pouf(k,'Living moss beanbag',(.09,-2.12,0),'fabric_sage',seats,kit,-.18)
    # Cabinet/library composition reaches the wall and has mixed objects on top.
    rich_shelf(k,kit,'Living book wall',(2.46,2.57,.03),2.06,3.18,2,5)
    kit.plant(k,'Living library top left',(1.70,2.53,3.29),.65)
    kit.plant(k,'Living library top right',(3.09,2.53,3.29),.52)
    vine(k,'Living library trailing ivy',(1.52,2.33,3.27),1.60)
    cabinet(k,'Living side cabinet',(2.95,1.45,.045),.85,.59)
    shade_lamp(k,'Living right reading lamp',(3.16,1.59,.74),1.05)
    kit.bookstack(k,'Living side cabinet books',(2.72,1.28,.746),2)
    # Reading lamp has its own rear corner console, with enough tabletop clearance.
    cabinet(k,'Living corner cabinet',(-3.03,2.42,.03),1.01,.67)
    shade_lamp(k,'Living corner pleated lamp',(-3.01,2.40,.78),1.07)
    # A laptop side console reproduces the secondary working spot in the reference.
    cabinet(k,'Living laptop console',(-3.48,-1.13,.03),.69,.67)
    kit.laptop(k,'Living side laptop',(-3.43,-1.13,.773),math.pi/2)
    from shared_space_exteriors import _palette,_tree
    _palette(k)
    k.cylinder('Living front tree pot',(-3.49,-2.29,.25),.31,.49,'stone','BOTANICALS',12,radius_top=.35)
    _tree(k,'Living sculpted canopy tree',(-3.49,-2.29,.49),1.90,.56,129)
    floor_plant(k,kit,'Living open-side specimen',(3.37,.44,.01),1.20,'cream')
    floor_plant(k,kit,'Living wall plant',(-3.48,2.65,.72),.84,'terracotta')
    # Different scale artwork, shelf and warm wall lamps, not duplicated blocks.
    left=wall_root(k,'Living left wall gallery',-3.917,0,True)
    panel(k,'Living buenas ideas print',left,.43,2.30,1.17,1.42,'BUENAS\nIDEAS\nAQUÍ',size=.17)
    panel(k,'Living small art print',left,-1.14,2.43,.57,.77,'CREÁ\nA TU\nRITMO',color='fabric_ochre',size=.10)
    b(k,'Living floating wall ledge',(0,-.18,2.04),(2.57,.34,.064),'woodlight',.009,left)
    for i in range(4):
        vol=k.book('Living ledge journal',(-1.01+i*.075,-.18,2.083),.055,.24+(i%2)*.06,.16,['binding_teal','binding_mustard','binding_red','binding_parchment'][i]);vol.parent=left
    sconce(k,'Living left task light',left,.65,3.20)
    backwall=wall_root(k,'Living back gallery',0,2.934)
    panel(k,'Living study adventure poster',backwall,.24,2.60,1.46,1.36,'ESTUDIAR\nTAMBIÉN\nES UNA\nAVENTURA',size=.135)
    sconce(k,'Living long return light',backwall,-1.49,3.22)
    for x,z in [(-2.37,2.25),(-2.06,2.23)]:
        b(k,'Living postcard oak frame',(x,2.88,z),(.23,.040,.31),'oak',.007)
        b(k,'Living postcard print',(x,2.855,z),(.18,.010,.25),'binding_teal' if x<-2.2 else 'binding_mustard',.002)
    backpack(k,'Living floor backpack',(2.74,.49,.01),'fabric_blue',-.23)
    kit.plant(k,'Living small shelf fern',(-3.66,.98,2.09),.53)
    vine(k,'Living high left ivy',(-3.67,1.46,3.31),1.52)
    b(k,'Living high plant shelf',(-3.67,1.62,3.16),(.47,.77,.07),'woodlight',.008)
    kit.plant(k,'Living high ivy pot',(-3.65,1.58,3.205),.52)
    # A second low ledge completes the left reading wall, with mixed books and pots.
    b(k,'Living upper reading ledge',(-3.65,-.45,2.94),(.48,1.55,.07),'woodlight',.009)
    kit.plant(k,'Living upper reading plant',(-3.62,-.96,2.98),.72)
    for i in range(6):
        vol=k.book('Living upper ledge book',(-3.61,-.48+i*.073,2.98),.058,.22+(i%3)*.034,.18,['binding_teal','binding_mustard','binding_red'][i%3]);vol.rotation_euler.z=math.pi/2
    vine(k,'Living upper reading ivy',(-3.47,-.92,2.98),.76)


def build_study(k,seats,kit):
    materials(k);R.seed(230)
    walls(k,'Study')
    work_table(k,'Study six-place oak table',(.05,-.28,0),4.80,1.88)
    for row,y,a in [('front',-1.73,math.pi),('back',1.17,0)]:
        for i,x in enumerate((-1.55,.05,1.65)):
            work_chair(k,'Study '+row+' upholstered chair '+str(i),(x,y,0),a)
            kit.seat(seats,(x,y,0),a,'chair')
            ty=-.80 if row=='front' else .24
            kit.laptop(k,'Study '+row+' computer '+str(i),(x-.13,ty,.835),math.pi if row=='front' else 0)
            kit.notebook(k,'Study '+row+' ruled notebook '+str(i),(x+.39,ty,.835))
            mug(k,'Study '+row+' tea cup '+str(i),(x-.51,ty+(.12 if row=='front' else -.12),.835),'sage' if i%2 else 'ceramic_white')
            b(k,'Study loose sticky pad',(x+.42,ty-.26 if row=='back' else ty+.26,.854),(.13,.10,.035),'yellow',.004)
    kit.plant(k,'Study central fern',(.05,-.24,.835),.65)
    kit.bookstack(k,'Study shared reference stack',(-.73,-.21,.835),3)
    kit.bookstack(k,'Study red reference stack',(.91,-.20,.835),2)
    # Whiteboard occupies the long side wall; cubbies and backpacks have the rear.
    side=wall_root(k,'Study teaching wall',-3.916,.07,True)
    whiteboard(k,'Study whiteboard',side,4.76,0,2.04)
    for x in (-1.7,0,1.7):sconce(k,'Study teaching wall sconce',side,x,3.23)
    for j in range(6):
        xx=-2.65 if j<3 else 2.65;zz=2.58-(j%3)*.43
        b(k,'Study pinned artwork frame',(xx,-.095,zz),(.34,.060,.36),'oak',.004,side)
        b(k,'Study pinned artwork colored field',(xx,-.132,zz),(.27,.010,.28),['coral','blue','yellow','sage','note_pink','purple'][j],.002,side)
    rich_shelf(k,kit,'Study resource library',(-.62,2.58,.02),2.44,3.12,3,5)
    # A combination of open cubbies and closed lower cabinetry avoids cloning shelves.
    cabinet(k,'Study low storage',(2.04,2.62,.04),2.36,.73,3)
    cubby=rich_shelf(k,kit,'Study bag cubbies',(2.04,2.61,.84),2.36,1.14,3,2,filled=False)
    for j,col in enumerate(('fabric_blue','fabric_rust','fabric_sage')):
        backpack(k,'Study personal cubby bag '+str(j),(1.30+j*.72,2.44,.925),col)
    back=wall_root(k,'Study rear wall',0,2.93)
    panel(k,'Study discipline poster',back,2.08,2.73,2.05,1.04,'DISCIPLINA HOY\nRESULTADOS MAÑANA',size=.14)
    clock(k,'Study analog wall clock',(-3.05,2.919,2.88),r=.34)
    cabinet(k,'Study clock corner console',(-3.05,2.59,.02),.99,.89,2)
    kit.plant(k,'Study clock flowers',(-3.04,2.55,1.00),.83,True)
    globe(k,'Study geographic globe',(-.46,2.49,3.225),.24)
    kit.bookstack(k,'Study library top journals',(-1.30,2.54,3.225),4)
    kit.plant(k,'Study library ivy',(.30,2.57,3.21),.59)
    vine(k,'Study resource ivy',(.51,2.32,3.17),1.28)
    floor_plant(k,kit,'Study front left tree',(-3.36,-2.44,.015),1.15,'stone')
    floor_plant(k,kit,'Study rear side tree',(3.47,2.23,.015),1.10,'cream')
    backpack(k,'Study front right bag',(2.89,-1.27,.012),'fabric_blue',-.20)
    backpack(k,'Study front left bag',(-2.63,-1.46,.012),'fabric_moss',.22)
    # Chalkboard-style rolling organizer in free right aisle, with purposeful stationery.
    cabinet(k,'Study stationery side cart',(3.22,.11,.09),.64,.62,1,'metal')
    for x in (2.99,3.45):
        for y in (-.09,.30):
            wheel=k.cylinder('Study cart rubber caster',(x,y,.065),.053,.034,'ink','FURNITURE',12);wheel.rotation_euler=(math.pi/2,0,0)
    kit.bookstack(k,'Study cart books',(3.20,.10,.82),3)
    mug(k,'Study pen pot',(3.40,.09,.82),'fabric_rust')
    for j in range(5):tube(k,'Study colored pencil',[(3.37+j*.012,.09,.89),(3.36+j*.019,.09,1.08)],.005,['blue','coral','sage','yellow','ink'][j])


def build_library(k,seats,kit):
    materials(k);R.seed(340)
    walls(k,'Library',window=(1.04,3.10,.66,2.56))
    framed_window(k,kit,'Library garden casement',1.04,3.10,.66,2.56)
    # Main wall library: deep books, varied heights, proper lower plinth and cornice.
    rich_shelf(k,kit,'Library left wall of volumes',(-3.70,-.02,.02),5.78,3.20,5,6,math.pi/2)
    rich_shelf(k,kit,'Library rear corner volumes',(-2.15,2.58,.02),2.45,3.20,2,6)
    left=wall_root(k,'Library illuminated sign wall',-3.92,0,True)
    b(k,'Library large sign oak surround',(-.04,-.60,3.37),(4.46,.09,.46),'oak_end',.024,left)
    b(k,'Library large sign dark face',(-.04,-.653,3.37),(4.31,.024,.39),'walnut_dark',.008,left)
    k.text('Library illuminated motto','MÁS HISTORIAS\nMEJORES PERSONAS',(-.04,-.670,3.37),.16,'paper','WALL_STORY',(math.pi/2,0,0),left)
    for i in range(24):b(k,'Library upper sign warm LED',(-2.17+i*.185,-.65,3.59),(.11,.024,.018),'light',.004,left)
    # Six studying places, all within the table perimeter. No books off its edges.
    patterned_rug(k,'Library framed reading rug',-.16,-1.32,5.75,2.86)
    work_table(k,'Library long communal table',(-.17,-1.26,0),4.83,1.31)
    for row,y,a in [('front',-2.33,math.pi),('back',-.18,0)]:
        for i,x in enumerate((-1.75,-.17,1.41)):
            work_chair(k,'Library '+row+' oak chair '+str(i),(x,y,0),a,'fabric_blue')
            kit.seat(seats,(x,y,0),a,'chair')
            ty=-1.58 if row=='front' else -.94
            kit.laptop(k,'Library '+row+' laptop '+str(i),(x-.13,ty,.835),math.pi if row=='front' else 0)
            kit.notebook(k,'Library '+row+' notebook '+str(i),(x+.38,ty,.835))
    # Lamps sit at the ends of the central spine, away from laptop keyboards.
    for x in (-2.08,1.80):shade_lamp(k,'Library table shaded lamp '+str(x),(x,-1.26,.837),.67)
    kit.plant(k,'Library communal table fern',(-.17,-1.26,.836),.40)
    # Back reading nook, a third yellow chair by the open edge and two side tables.
    upholstered(k,'Library green reading armchair one',(.18,1.77,0),0,'fabric_sage','fabric_ivory')
    upholstered(k,'Library green reading armchair two',(1.84,1.69,0),-.13,'fabric_moss','fabric_ochre')
    upholstered(k,'Library ochre reading armchair',(3.26,.67,0),-.70,'fabric_ochre','fabric_ivory')
    cabinet(k,'Library reading side table',(.99,1.96,.02),.53,.56,1)
    shade_lamp(k,'Library nook reading lamp',(.99,1.94,.68),.96)
    mug(k,'Library nook tea',(.98,1.70,.68),'sage')
    cabinet(k,'Library right side table',(3.29,1.91,.02),.59,.61,1)
    shade_lamp(k,'Library right shaded lamp',(3.26,1.90,.73),.85)
    # Low outward-facing bookcases enclose the table without blocking seat access.
    rich_shelf(k,kit,'Library front left low stack',(-2.97,-1.44,.02),1.06,.83,2,2,math.pi/2)
    kit.bookstack(k,'Library low-stack books',(-2.97,-1.40,.94),4)
    kit.plant(k,'Library low-stack plant',(-2.96,-1.79,.95),.40)
    rich_shelf(k,kit,'Library front right low stack',(2.82,-1.54,.02),1.12,.82,2,2,math.pi/2)
    kit.bookstack(k,'Library right stack journals',(2.82,-1.56,.93),3)
    # Right wall typography and climbing plants frame, rather than replace, scenery.
    back=wall_root(k,'Library right pier gallery',0,2.93)
    panel(k,'Library reading poster',back,3.34,2.25,1.04,1.51,'LEER\nPENSAR\nCONECTAR\nTRANSFORMAR',size=.119)
    sconce(k,'Library right pier sconce',back,3.33,3.27)
    kit.plant(k,'Library casement sill plant',(2.04,2.69,.67),.70)
    floor_plant(k,kit,'Library corner floor specimen',(3.55,2.65,.012),.74,'cream')
    kit.plant(k,'Library rear bookcase fern',(-2.15,2.57,3.29),.64)
    vine(k,'Library upper corner ivy',(-.86,2.32,3.28),1.63)
    # Two rooted vines follow the open left-wall edge, leaving all six chairs clear.
    for y in (-2.34,1.68):
        kit.plant(k,'Library upper left ivy pot',(-3.63,y,3.28),.52)
        vine(k,'Library hanging bookcase ivy',(-3.44,y,3.22),1.18)
    backpack(k,'Library student backpack',(3.38,-.70,.012),'fabric_rust',-.40)
