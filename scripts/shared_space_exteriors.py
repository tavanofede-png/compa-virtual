"""Authored outdoor collaborative environments, Blender metres and Z-up.

The plants, brickwork, furniture, lights and study props are three dimensional.
Only the distant garden/city is a framed scenic panel, supplied by the build kit.
Seat metadata describes the actual six usable places in each environment.
"""
import bpy
import math
import random


def _palette(k):
    for key, color, rough in (
        ('ex_stone', '#b4a58c', .88), ('ex_stone_dark', '#776e62', .88),
        ('ex_grout', '#807967', .95), ('ex_oak', '#88552e', .74),
        ('ex_oak_light', '#bf915c', .7), ('ex_oak_edge', '#a67140', .7),
        ('ex_leaf_dark', '#224b28', .92), ('ex_leaf_mid', '#477b35', .92),
        ('ex_leaf_light', '#87aa43', .91), ('ex_leaf_lime', '#bdc461', .9),
        ('ex_bark', '#735030', .92), ('ex_soil', '#403b2b', 1),
        ('ex_petal_pink', '#db889d', .74), ('ex_petal_cream', '#fff0ce', .74),
        ('ex_petal_purple', '#bd8fb4', .74), ('ex_petal_yellow', '#efd575', .7),
        ('ex_cushion', '#aeb3b6', .91), ('ex_cushion_blue', '#657a91', .89),
        ('ex_cushion_linen', '#c9c4b9', .91), ('ex_rattan', '#b19163', .87),
        ('ex_charcoal', '#313943', .69), ('ex_teal', '#637c72', .79),
        ('ex_coral', '#bf7758', .82), ('ex_coffee', '#5a3521', .67),
        ('ex_sky_glass', '#8d9eab', .32), ('ex_mug', '#e4d4b8', .38),
        ('ex_glow', '#ffd991', .42), ('ex_fire', '#ff8c38', .5),
    ):
        material = k.material(key, color, rough)
        if key in ('ex_glow', 'ex_fire'):
            node = material.node_tree.nodes.get('Principled BSDF')
            if node:
                rgba = tuple(int(color[i:i+2], 16)/255 for i in (1, 3, 5))+(1,)
                node.inputs['Emission Color'].default_value = rgba
                node.inputs['Emission Strength'].default_value = 2.8 if key == 'ex_fire' else 1.25


def _b(k, name, p, d, material, bevel=.012, parent=None, rotation=(0, 0, 0)):
    return k.box(name, p, d, material, 'EXTERIOR_DETAIL', bevel, rotation, parent)


def _mesh(k, name, vertices, faces, material, bevel=.003, parent=None):
    return k.mesh(name, vertices, faces, material, 'EXTERIOR_DETAIL', bevel, parent)


def _line(k, name, a, b, radius=.012, material='ex_charcoal', parent=None):
    return k.tube(name, [a, b], radius, material, 'EXTERIOR_DETAIL', parent=parent)


def _brick_panel(k, name, center, width, height, depth=.26, axis='back', floor=0, cap=True):
    """Mortar-backed staggered courses; edge bricks clipped to the actual wall."""
    x, y = center
    # The backing must sit strictly INSIDE the dressed blocks; coincident end
    # faces create black seams in both Cycles and the flattened GLB.
    dim = (width-.026, depth-.025, height-.012) if axis == 'back' else (depth-.025, width-.026, height-.012)
    _b(k, name+' mortar core', (x, y, floor+height/2), dim, 'ex_grout', .008)
    brick_w, brick_h = .36, .18
    rows = math.ceil(height/brick_h)
    for row in range(rows):
        z0 = row*brick_h
        bh = min(brick_h-.012, height-z0-.005)
        if bh <= 0: continue
        start = -width/2-(brick_w/2 if row % 2 else 0)
        while start < width/2:
            lo, hi = max(start, -width/2), min(start+brick_w-.012, width/2)
            if hi-lo > .025:
                t = (lo+hi)/2
                pos = (x+t, y, floor+z0+bh/2) if axis == 'back' else (x, y+t, floor+z0+bh/2)
                dims = (hi-lo, depth+.016, bh) if axis == 'back' else (depth+.016, hi-lo, bh)
                mat = 'ex_stone_dark' if (row+round(t*10)) % 11 == 0 else 'ex_stone'
                _b(k, name+' individual masonry', pos, dims, mat, .012)
            start += brick_w
    capdim = (width+.05, depth+.08, .06) if axis == 'back' else (depth+.08, width+.05, .06)
    if cap:_b(k, name+' dressed coping', (x, y, floor+height+.028), capdim, 'ex_stone', .015)


def _leaf(k, name, p, length, yaw, material='ex_leaf_mid', tilt=.3):
    """Stepped faceted leaf: shaped tips and a central vein, not a smooth blob."""
    w = length*.38
    verts = [(-w*.3,-length*.5,0), (w*.3,-length*.5,0),
             (w*.55,-length*.16,.015), (w*.40,length*.30,.006),
             (0,length*.52,0), (-w*.4,length*.3,.006),
             (-w*.55,-length*.16,.015), (0,0,.045)]
    faces = [(i, (i+1)%7, 7) for i in range(7)] + [tuple(reversed(range(7)))]
    obj = _mesh(k, name, verts, faces, material, .001)
    obj.location=p; obj.rotation_euler=(tilt, .15*math.sin(yaw), yaw)
    return obj


def _shrub(k, name, p, radius=.34, height=.57, seed=1, flowers=False):
    r = random.Random(seed); x, y, z = p
    for branch in range(11):
        a = branch*2.399
        reach = radius*r.uniform(.4, .96)
        tip=(x+math.cos(a)*reach, y+math.sin(a)*reach, z+height*r.uniform(.48, 1))
        _line(k, name+' branching stem', (x,y,z), tip, .011, 'ex_leaf_dark')
        for j in range(3):
            u=.40+j*.26
            lp=(x+(tip[0]-x)*u, y+(tip[1]-y)*u, z+(tip[2]-z)*u)
            _leaf(k, name+' sculpted foliage', lp, radius*r.uniform(.47,.78), a+j*1.7,
                  ['ex_leaf_dark','ex_leaf_mid','ex_leaf_light'][branch%3], .1+j*.3)
        if flowers and branch%2 == 0:
            color=['ex_petal_pink','ex_petal_cream','ex_petal_purple'][branch%3]
            _flower(k, name+' clustered flower', (tip[0],tip[1],tip[2]+.04), .075, color)


def _flower(k, name, p, scale=.075, color='ex_petal_pink'):
    x,y,z=p
    for i in range(5):
        a=i*math.tau/5
        _b(k,name+' angular petal',(x+math.cos(a)*scale*.57,y+math.sin(a)*scale*.57,z),
           (scale*.84,scale*.56,scale*.28),color,.009,rotation=(.12*math.sin(a),.12*math.cos(a),a))
    _b(k,name+' pollen',(x,y,z+.015),(scale*.44,scale*.44,.029),'ex_petal_yellow',.01)


def _tree(k, name, p, height=2.8, radius=.66, seed=3):
    r=random.Random(seed);x,y,z=p
    _line(k,name+' trunk',(x,y,z),(x+.06,y,z+height*.73),.065,'ex_bark')
    for i in range(7):
        a=i*2.399; h=height*(.56+.06*(i%3))
        tip=(x+math.cos(a)*radius*.65,y+math.sin(a)*radius*.65,z+h)
        _line(k,name+' branch',(x+.035,y,z+height*.44),tip,.028,'ex_bark')
    # Small branching lobes: more natural crown silhouette than a bag of cubes.
    for lobe in range(10):
        a=lobe*2.399; cr=radius*(.24 if lobe==0 else .59)
        center=(x+math.cos(a)*cr,y+math.sin(a)*cr,z+height*.83+.20*math.sin(lobe*1.8))
        _line(k,name+' fine crown branch',(x+.04,y,z+height*.70),center,.017,'ex_bark')
        for i in range(34):
            theta=r.random()*math.tau;rr=radius*.39*math.sqrt(r.random());zz=r.uniform(-.22,.22)
            loc=(center[0]+math.cos(theta)*rr,center[1]+math.sin(theta)*rr,center[2]+zz)
            side=r.uniform(.069,.139)
            mat=['ex_leaf_dark','ex_leaf_mid','ex_leaf_light','ex_leaf_lime'][r.choices(range(4),[3,6,3,.4])[0]]
            _b(k,name+' fine faceted canopy',loc,(side,side*.83,side*.53),mat,.008,
               rotation=(r.uniform(-.2,.2),r.uniform(-.15,.15),r.uniform(-.35,.35)))
            if i%3==0:
                _leaf(k,name+' crown terminal leaf',(loc[0],loc[1],loc[2]+.037),r.uniform(.10,.17),theta,mat,.3)


def _vines(k, name, points, seed=5):
    r=random.Random(seed)
    k.tube(name+' climbing woody vine', points,.017,'ex_bark','EXTERIOR_DETAIL')
    for idx in range(len(points)-1):
        a,b=points[idx:idx+2]
        for j in range(6):
            t=j/6
            p=tuple(a[c]*(1-t)+b[c]*t for c in range(3))
            for side in (-1,1):
                _leaf(k,name+' ivy leaf',(p[0]+side*.078,p[1]-.035,p[2]),r.uniform(.16,.25),
                      side*1.1+idx*.6, 'ex_leaf_light' if (idx+j)%3==0 else 'ex_leaf_mid',.45)


def _planter(k, name, p, width, depth, seed=1, flowers=True):
    x,y,z=p
    _brick_panel(k,name+' front',(x,y-depth/2),width+.14,.38,.14,floor=z,cap=False)
    _brick_panel(k,name+' back',(x,y+depth/2),width+.14,.38,.14,floor=z,cap=False)
    for xx in (x-width/2,x+width/2):
        _brick_panel(k,name+' end',(xx,y),max(.04,depth-.15),.38,.14,'left',z,cap=False)
    # Four non-overlapping cap strips avoid coplanar corner artifacts.
    for yy in (y-depth/2,y+depth/2):
        _b(k,name+' front coping',(x,yy,z+.408),(width+.22,.215,.065),'ex_stone',.012)
    for xx in (x-width/2,x+width/2):
        _b(k,name+' end coping',(xx,y,z+.408),(.215,max(.04,depth-.224),.065),'ex_stone',.012)
    _b(k,name+' rich planting soil',(x,y,z+.30),(width-.12,depth-.08,.15),'ex_soil',.005)
    along_x=width>=depth
    span=max(width,depth)
    count=max(2,int(span/.37))
    for i in range(count):
        t=-span/2+.20+(span-.40)*(i/(count-1) if count>1 else .5)
        xx=x+t if along_x else x+(.065 if i%2 else -.065)
        yy=y+(.065 if i%2 else -.065) if along_x else y+t
        _shrub(k,name+' bedding',(xx,yy,z+.38),.25,.39,seed+i,flowers)


def _lantern(k, name, p, scale=1, hanging=False):
    x,y,z=p; s=scale
    _b(k,name+' base',(x,y,z+.025*s),(.24*s,.24*s,.05*s),'ex_charcoal',.012)
    _b(k,name+' lit frosted glass',(x,y,z+.20*s),(.177*s,.177*s,.28*s),'ex_glow',.012)
    for dx in (-.107,.107):
        for dy in (-.107,.107):
            _b(k,name+' metal corner',(x+dx*s,y+dy*s,z+.19*s),(.023*s,.023*s,.32*s),'ex_charcoal',.003)
    _b(k,name+' lantern roof',(x,y,z+.37*s),(.28*s,.28*s,.07*s),'ex_charcoal',.012)
    k.tube(name+' carry loop',[(x-.05*s,y,z+.42*s),(x-.05*s,y,z+.48*s),(x+.05*s,y,z+.48*s),(x+.05*s,y,z+.42*s)],.012*s,'ex_charcoal','EXTERIOR_DETAIL')
    if hanging:
        _line(k,name+' hanging chain',(x,y,z+.48*s),(x,y,z+.72*s),.009,'ex_charcoal')
    # Editable local lighting, outside the frosted housing so it is not blocked.
    light=bpy.data.lights.new(name+' warm pool','POINT');light.energy=23*s*s
    light.color=(1,.69,.29);light.shadow_soft_size=.18*s
    obj=bpy.data.objects.new(name+' warm pool',light);k.collection('LIGHTS').objects.link(obj)
    obj.location=(x,y-.155*s,z+.19*s)


def _mug(k, name, p, color='ex_mug'):
    x,y,z=p
    k.cylinder(name+' cup',(x,y,z+.057),.052,.112,color,'EXTERIOR_DETAIL',16,radius_top=.056)
    k.cylinder(name+' coffee surface',(x,y,z+.115),.046,.004,'ex_coffee','EXTERIOR_DETAIL',16)
    pts=[(x+.06+.035*math.cos(a),y,z+.062+.039*math.sin(a)) for a in [i*math.tau/12 for i in range(13)]]
    k.tube(name+' ceramic handle',pts,.011,color,'EXTERIOR_DETAIL',cyclic=True)
    k.cylinder(name+' coaster',(x,y,z+.003),.076,.006,'ex_oak','EXTERIOR_DETAIL',16)


def _hanging_planter(k,name,p,seed=1):
    x,y,z=p
    k.cylinder(name+' ribbed terracotta pot',(x,y,z+.13),.16,.27,'ex_oak_edge','EXTERIOR_DETAIL',16,radius_top=.22)
    k.cylinder(name+' pot rim',(x,y,z+.27),.228,.047,'ex_oak_light','EXTERIOR_DETAIL',16)
    k.cylinder(name+' dark earth',(x,y,z+.30),.204,.012,'ex_soil','EXTERIOR_DETAIL',16)
    for i in range(12):
        a=i*math.tau/12
        _line(k,name+' basket rib',(x+math.cos(a)*.17,y+math.sin(a)*.17,z+.015),
              (x+math.cos(a)*.218,y+math.sin(a)*.218,z+.26),.009,'ex_oak_light')
    for a in (0,math.tau/3,math.tau*2/3):
        _line(k,name+' hanging cord',(x+math.cos(a)*.22,y+math.sin(a)*.22,z+.29),
              (x,y,z+.74),.009,'ex_rattan')
    _shrub(k,name+' dense crown',(x,y,z+.28),.27,.29,seed,False)
    for j in range(4):
        a=j*math.pi/2
        points=[(x+math.cos(a)*.16,y+math.sin(a)*.16,z+.35),
                (x+math.cos(a)*.25,y+math.sin(a)*.25,z+.09),
                (x+math.cos(a)*.30,y+math.sin(a)*.30,z-.22),
                (x+math.cos(a)*.21,y+math.sin(a)*.21,z-.46)]
        _vines(k,name+' trailing foliage',points,seed+j)


def _pencil_cup(k,name,p):
    x,y,z=p
    k.cylinder(name+' ceramic holder',(x,y,z+.085),.066,.17,'ex_teal','EXTERIOR_DETAIL',12)
    k.cylinder(name+' holder opening',(x,y,z+.172),.054,.003,'ex_soil','EXTERIOR_DETAIL',12)
    for i in range(5):
        a=i*2.399;xx=x+math.cos(a)*.031;yy=y+math.sin(a)*.031
        _line(k,name+' coloured pencil',(xx,yy,z+.08),(xx+math.sin(a)*.025,yy+math.cos(a)*.025,z+.26+(i%3)*.027),
              .007,['blue','yellow','coral','sage','purple'][i])


def _soft_cushion(k,name,p,width,height,depth,material,parent=None,rotation=(0,0,0)):
    """Closed quilted shell with puffy faces, tapering toward a stitched edge."""
    g=k.group(name,p,rotation,'SEATS');g.parent=parent
    n=8;verts=[];faces=[]
    for side in (-1,1):
        for row in range(n+1):
            v=-1+2*row/n
            for col in range(n+1):
                u=-1+2*col/n
                bulge=(1-u*u)*(1-v*v)
                verts.append((u*width/2*(1-.07*abs(v)**5),side*depth*(.18+.35*bulge),
                              v*height/2*(1-.07*abs(u)**5)))
    q=(n+1)**2
    for side in range(2):
        for row in range(n):
            for col in range(n):
                a=side*q+row*(n+1)+col
                faces.append((a,a+1,a+n+2,a+n+1) if side==0 else (a+n+1,a+n+2,a+1,a))
    ring=[]
    ring.extend(range(n+1));ring.extend(row*(n+1)+n for row in range(1,n+1))
    ring.extend(n*(n+1)+col for col in range(n-1,-1,-1));ring.extend(row*(n+1) for row in range(n-1,0,-1))
    for j,a in enumerate(ring):
        b=ring[(j+1)%len(ring)];faces.append((a,b,b+q,a+q))
    _mesh(k,name+' tailored cloth shell',verts,faces,material,.0015,g)
    seam=[(verts[idx][0],0,verts[idx][2]) for idx in ring]
    k.tube(name+' sewn perimeter piping',seam,.006,'ex_cushion_linen','EXTERIOR_DETAIL',cyclic=True,parent=g)
    return g


def _slatted_table(k,name,p,width,depth,height=.78):
    x,y,z=p
    for i in range(max(3,int(depth/.14))):
        n=max(3,int(depth/.14));dy=-depth/2+(i+.5)*depth/n
        _b(k,name+' distinct top plank',(x,y+dy,z+height),(width,depth/n-.008,.075),
           'ex_oak_light' if i%2 else 'ex_oak_edge',.01)
        for end in (-1,1):
            k.cylinder(name+' flush screw',(x+end*(width/2-.09),y+dy,z+height+.039),.010,.003,'ex_charcoal','EXTERIOR_DETAIL',8)
    for dx in (-width*.40,width*.40):
        for dy in (-depth*.35,depth*.35):
            _b(k,name+' tapered leg',(x+dx,y+dy,z+height/2),(.09,.09,height),'ex_oak',.012)
    _b(k,name+' low joining rail',(x,y,z+.23),(width*.83,.065,.075),'ex_oak',.008)


def _bench(k,name,p,width=2.5,back=True):
    x,y,z=p
    for i in range(4):
        _b(k,name+' seat plank',(x,y-.24+i*.15,z+.45),(width,.14,.07),'ex_oak_light',.009)
    for dx in (-width*.40,width*.40):
        for dy in (-.21,.21):_b(k,name+' leg',(x+dx,y+dy,z+.215),(.075,.075,.43),'ex_oak',.009)
    if back:
        for dx in (-width*.43,width*.43):
            _b(k,name+' back upright',(x+dx,y+.28,z+.72),(.07,.07,.94),'ex_oak',.009)
        for j in range(3):
            _b(k,name+' back plank',(x,y+.28,z+.70+j*.12),(width,.065,.105),'ex_oak_light',.008)


def _garden_chair(k,name,p,angle=0):
    g=k.group(name,p,(0,0,angle),'SEATS')
    for i in range(5):
        _b(k,name+' slatted seat',(0,-.26+i*.125,.465),(.61,.113,.075),'ex_teal',.012,g)
    for i in range(5):
        _b(k,name+' back slat',(-.25+i*.125,.27,.84),(.105,.07,.61),'ex_teal',.015,g)
    for x in (-.27,.27):
        for y in (-.25,.25):_b(k,name+' iron leg',(x,y,.22),(.045,.045,.44),'ex_charcoal',.006,g)
        _b(k,name+' iron back rail',(x,.28,.81),(.045,.045,.77),'ex_charcoal',.006,g)
        _b(k,name+' arm rest',(x*1.14,-.02,.67),(.075,.62,.06),'ex_oak_light',.012,g)
    _b(k,name+' linen pad',(0,-.02,.515),(.54,.52,.055),'ex_cushion_linen',.04,g)


def _umbrella(k,name,p,radius=1.32):
    x,y,z=p
    k.cylinder(name+' heavy round foot',(x,y,.055),.26,.10,'ex_stone_dark','EXTERIOR_DETAIL',16)
    _line(k,name+' central wood pole',(x,y,.10),(x,y,z+.22),.034,'ex_oak')
    n=12
    # Separate thick cloth panels, visible radial seams and structural ribs.
    for i in range(n):
        a,b=i*math.tau/n,(i+1)*math.tau/n
        verts=[(x,y,z+.24),(x+math.cos(a)*radius*.55,y+math.sin(a)*radius*.55,z+.06),
               (x+math.cos(a)*radius,y+math.sin(a)*radius,z-.20),
               (x+math.cos(b)*radius,y+math.sin(b)*radius,z-.20),
               (x+math.cos(b)*radius*.55,y+math.sin(b)*radius*.55,z+.06)]
        _mesh(k,name+' stitched canvas panel',verts,[(0,1,4),(1,2,3,4)],
              'ex_petal_cream' if i%2 else 'ex_cushion_linen',.002)
        _line(k,name+' radial wood rib',(x,y,z+.19),(x+math.cos(a)*radius,y+math.sin(a)*radius,z-.22),.012,'ex_oak_light')
        _line(k,name+' stitched canopy edge',verts[2],verts[3],.015,'ex_petal_cream')
        _mesh(k,name+' short valance',[(verts[2][0],verts[2][1],z-.20),(verts[3][0],verts[3][1],z-.20),
              (verts[3][0],verts[3][1],z-.29),(verts[2][0],verts[2][1],z-.29)],[(0,1,2,3)],'ex_petal_cream',.002)
    k.cylinder(name+' finial',(x,y,z+.31),.05,.11,'ex_oak','EXTERIOR_DETAIL',12,radius_top=.025)


def _sign(k,name,p,width,height,lines,size=.20,material='ex_petal_cream',text='ex_charcoal'):
    x,y,z=p
    _b(k,name+' wood backing',(x,y,z),(width,.10,height),'ex_oak',.015)
    _b(k,name+' inset enamel face',(x,y-.060,z),(width-.10,.018,height-.10),material,.01)
    for dx in (-width/2+.05,width/2-.05):
        for dz in (-height/2+.05,height/2-.05):
            bolt=k.cylinder(name+' sign fixing',(x+dx,y-.076,z+dz),.012,.009,'gold','EXTERIOR_DETAIL',8)
            bolt.rotation_euler.x=math.pi/2
    k.text(name+' lettering',lines,(x,y-.077,z),size,text,'EXTERIOR_DETAIL',rotation=(math.pi/2,0,0))


def build_patio(k,seats,kit):
    _palette(k)
    # A real enclosure: garden glazing at the rear, coursed walls and planting beds.
    kit.scenic_panel(k,'Garden beyond the pergola',(0,3.14,1.85),8.0,3.3,axis='back',kind='garden')
    _brick_panel(k,'Garden back garden wall',(0,2.88),8,.77,.24)
    _brick_panel(k,'Garden left perimeter',(-3.88,0),5.9,.46,.20,'left')
    for xx in (-3.94,3.94):_b(k,'Garden scenic side frame',(xx,3.06,1.84),(.10,.17,3.50),'ex_oak',.012)
    _b(k,'Garden scenic top crosspiece',(0,3.02,3.64),(8.05,.23,.12),'ex_oak',.012)
    # Recessed vertical joinery makes the distant garden read as architectural
    # glazing, partly covered by the pergola canopy and climbers.
    for xx in (-1.29,1.29):_b(k,'Garden recessed glazing mullion',(xx,3.075,2.13),(.062,.083,2.85),'ex_oak',.008)
    _planter(k,'Left mixed flower border',(-3.50,-.31,0),.58,4.5,21,True)
    _planter(k,'Rear perennial border',(.18,2.47,0),6.50,.42,61,False)
    _planter(k,'Front left flowers',(-2.66,-2.55,0),2.28,.52,11,True)
    _planter(k,'Front right flowers',(2.02,-2.55,0),3.00,.52,42,True)
    _planter(k,'Right climbing border',(3.48,.10,0),.51,3.42,87,True)
    # Trees have branches and layered faceted canopies, sized to frame the patio.
    _tree(k,'Left garden tree',(-3.44,1.80,.40),2.82,.66,3)
    _tree(k,'Rear right garden tree',(3.43,2.35,.42),2.94,.68,18)
    # Pergola occupies the rear half. The front study table remains visible.
    for x in (-2.48,3.10):
        for y in (1.03,2.62):
            _b(k,'Pergola stone footing',(x,y,.16),(.34,.34,.32),'ex_stone',.025)
            _b(k,'Pergola crafted upright',(x,y,1.72),(.14,.14,3.04),'ex_oak',.015)
            for z in (.35,2.93):_b(k,'Pergola steel strap',(x,y-.078,z),(.16,.018,.13),'ex_charcoal',.003)
    for y in (1.03,2.62):
        _b(k,'Pergola main lintel',(.31,y,3.28),(5.98,.20,.20),'ex_oak_light',.017)
    for i in range(9):
        x=-2.50+i*.72
        _b(k,'Pergola shaped roof rafter',(x,1.85,3.44),(.13,2.25,.16),'ex_oak',.012)
        if True:
            _vines(k,'Pergola roof climber',[(x-.03,2.84,2.6),(x+.10,2.61,3.4),
                   (x-.12,2.1,3.52),(x+.10,1.56,3.50),(x-.03,.79,3.27),(x-.12,.77,2.73)],i+7)
            for j in range(4):
                yy=1.14+j*.43
                _shrub(k,'Pergola roof leafy lobe',(x,yy,3.47),.21,.18,180+i*5+j,False)
    for i,x in enumerate((-2.32,-.92,.50,1.93,3.0)):
        _vines(k,'Rear hanging ivy',[(x,2.61,3.4),(x+.10,2.50,2.97),(x-.12,2.51,2.62),
               (x+.09,2.45,2.17)],i+31)
    for x in (-1.70,.36,2.49):
        _lantern(k,'Pergola hanging lantern',(x,1.52,2.43),.73,True)
    for i,x in enumerate((-1.65,-.16,1.35,2.70)):
        _hanging_planter(k,'Pergola suspended planted basket',(x,2.41,2.59),230+i*9)
    _sign(k,'Patio inspirational ceramic plaque',(1.43,2.50,1.84),1.72,1.21,'AQUÍ\nTAMBIÉN\nSE APRENDE',.18)
    # Round table: four inward-facing places under an offset umbrella.
    cx,cy=-1.59,-.22
    k.cylinder('Garden round table rim',(cx,cy,.79),.79,.095,'ex_oak','EXTERIOR_DETAIL',40)
    for j in range(9):
        yy=-.72+j*.18; half=math.sqrt(max(.01,.765**2-yy**2))
        _b(k,'Round table cut timber plank',(cx,cy+yy,.845),(half*2,.168,.025),'ex_oak_light',.008)
    k.cylinder('Round table pedestal',(cx,cy,.39),.09,.77,'ex_charcoal','EXTERIOR_DETAIL',12)
    for a in (0,math.pi/2,math.pi,3*math.pi/2):
        _line(k,'Round table radial foot',(cx,cy,.1),(cx+math.cos(a)*.51,cy+math.sin(a)*.51,.035),.04)
        p=(cx+math.sin(a)*1.24,cy-math.cos(a)*1.24,0)
        _garden_chair(k,'Garden round table chair',p,a+math.pi)
        kit.seat(seats,p,a+math.pi,'garden-chair')
    # Umbrella is behind-left, not directly hiding the front avatars and tabletop.
    _umbrella(k,'Ivory garden parasol',(-1.98,.31,2.13),1.10)
    kit.bookstack(k,'Garden reserve books',(-1.18,-.39,.867),2)
    _mug(k,'Garden tea',(-1.89,-.60,.865));_mug(k,'Garden shared cup',(-1.04,-.02,.865),'ex_teal')
    kit.notebook(k,'Garden open journal',(-1.75,-.06,.866))
    _pencil_cup(k,'Garden shared pencils',(-1.31,-.02,.867))
    _shrub(k,'Round table herb planter',(-1.25,.21,.92),.15,.24,104,False)
    k.cylinder('Round table herb pot',(-1.25,.21,.918),.10,.11,'ex_mug','EXTERIOR_DETAIL',12)
    # Two-person bench with a generous separate tabletop and open approach in front.
    _slatted_table(k,'Pergola study table',(1.65,.12,0),2.36,.84,.79)
    _bench(k,'Garden two-person bench',(1.65,1.15,0),2.42,True)
    for x in (1.11,2.20):
        _b(k,'Bench woven linen pad',(x,1.10,.505),(.96,.50,.055),'ex_cushion_linen',.026)
        kit.seat(seats,(x,1.15,0),0,'garden-bench')
    # Decorative front bench is a physical prop, not a seventh reserved place.
    _bench(k,'Short visitor bench',(1.75,-.79,0),1.92,False)
    kit.laptop(k,'Pergola laptop',(1.03,.09,.835),.06)
    kit.notebook(k,'Pergola notebook',(1.67,.11,.835))
    kit.bookstack(k,'Pergola books',(2.39,.13,.835),3)
    _mug(k,'Pergola coffee',(1.65,.40,.835),'ex_teal')
    _pencil_cup(k,'Pergola study stationery',(2.60,-.08,.835))
    _b(k,'Pergola pencil case',(1.77,-.17,.86),(.23,.09,.047),'ex_coral',.017)
    for j in range(9):_b(k,'Pergola pencil case zipper',(1.67+j*.023,-.17,.886),(.010,.01,.005),'gold',.001)
    # Lamps and low beds edge a clear central path to both study zones.
    for i,(x,y) in enumerate([(-3.49,-2.37),(-1.21,-2.62),(.44,-2.62),(3.54,-2.42),(3.49,.96)]):
        _brick_panel(k,'Garden lantern plinth '+str(i),(x,y),.37,.60,.37)
        _lantern(k,'Garden boundary lantern '+str(i),(x,y,.66),.87)
    for i,(x,y) in enumerate([(-3.54,.17),(3.44,-.9),(2.84,2.35)]):
        _line(k,'Garden planted climbing support',(x,y,.38),(x,y,2.40),.017,'ex_oak')
        _vines(k,'Garden wall climber '+str(i),[(x,y,.48),(x+.02,y,1.1),(x-.09,y,1.54),
               (x+.07,y,1.95),(x-.12,y,2.27)],i+70)


def _sofa(k,name,p,width,angle=0,seats_count=3):
    g=k.group(name,p,(0,0,angle),'SEATS')
    _b(k,name+' teak platform',(0,0,.29),(width,.94,.21),'ex_oak',.025,g)
    for x in (-width/2+.13,width/2-.13):
        for y in (-.32,.32):_b(k,name+' inset wood foot',(x,y,.12),(.12,.12,.24),'ex_oak',.008,g)
    for i in range(7):_b(k,name+' back timber slat',(0,.42,.54+i*.068),(width,.06,.054),'ex_oak_edge',.007,g)
    for x in (-width/2,width/2):
        _b(k,name+' teak side arm',(x,.0,.61),(.105,.96,.13),'ex_oak_light',.017,g)
        for y in (-.34,.34):_b(k,name+' arm support',(x,y,.44),(.06,.06,.42),'ex_oak',.008,g)
    step=(width-.18)/seats_count
    for i in range(seats_count):
        x=-(width-.18)/2+(i+.5)*step
        _soft_cushion(k,name+' upholstered seat',(x,-.035,.475),step-.035,.76,.17,'ex_cushion_linen',g,(math.pi/2,0,0))
        _soft_cushion(k,name+' upholstered back',(x,.34,.825),step-.027,.61,.20,'ex_cushion',g)
        # Fine piping lies just proud of cushion edges.
        pts=[(x-step*.44,-.42,.49),(x+step*.44,-.42,.49),(x+step*.44,.30,.49),
             (x-step*.44,.30,.49),(x-step*.44,-.42,.49)]
        k.tube(name+' seat stitched piping',pts,.008,'ex_cushion_blue','EXTERIOR_DETAIL',parent=g)
        color=['ex_teal','ex_coral','ex_cushion_blue'][i%3]
        _soft_cushion(k,name+' loose velvet pillow',(x+.14,.17,.80),.39,.38,.19,color,g,(.10,.04,-.07+i*.07))
        _soft_cushion(k,name+' linen pillow',(x-.26,.19,.73),.28,.29,.15,'ex_petal_cream',g,(.02,.03,.10))
    return g


def _stool(k,name,p):
    x,y,z=p
    for i in range(4):_b(k,name+' seat plank',(x,y-.24+i*.16,z+.45),(.62,.147,.065),'ex_oak_light',.009)
    for dx in (-.245,.245):
        for dy in (-.23,.23):_b(k,name+' leg',(x+dx,y+dy,z+.21),(.07,.07,.42),'ex_oak',.009)
    for dy in (-.23,.23):_b(k,name+' foot brace',(x,y+dy,z+.16),(.57,.05,.05),'ex_oak',.006)


def _fireplace(k,p):
    x,y=p
    _brick_panel(k,'Terrace full-height fireplace column',(x,y),.97,3.25,.66)
    # Recess: side piers and lintel surround an open dark fire chamber.
    _b(k,'Fire chamber dark recess',(x,y-.364,.66),(.65,.025,.53),'ex_charcoal',.009)
    _b(k,'Fire hearth projecting ledge',(x,y-.53,.34),(1.10,.78,.14),'ex_stone_dark',.015)
    for xx in (x-.41,x+.41):_b(k,'Firebox cheek pier',(xx,y-.56,.64),(.17,.64,.64),'ex_stone',.010)
    _b(k,'Firebox lintel',(x,y-.56,.95),(1.10,.66,.12),'ex_stone',.014)
    for i in range(4):
        log=k.cylinder('Firepit real cut log',(x-.21+i*.135,y-.63,.48),.045,.34,'ex_bark','EXTERIOR_DETAIL',9)
        log.rotation_euler=(math.pi/2,0,(-.12 if i%2 else .12))
    for i in range(7):
        px=x-.25+i*.079;yy=y-.62+.04*math.sin(i);h=.15+.14*(i%3)/2
        verts=[(px-.04,yy-.035,.50),(px+.04,yy-.035,.50),(px+.05,yy+.025,.50),
               (px-.03,yy+.025,.50),(px+.018,yy,.50+h)]
        _mesh(k,'Sculpted warm fire flame',verts,[(0,1,4),(1,2,4),(2,3,4),(3,0,4)],'ex_fire',.003)
        _b(k,'Fire glowing embers',(px,yy,.50),(.07,.05,.025),'ex_glow',.005)
    _sign(k,'Terrace tall ideas sign',(x,y-.371,2.06),.74,1.53,'GRANDES\nIDEAS\nTAMBIÉN\nTIENEN\nVISTAS',.137,'ex_oak','ex_glow')
    _lantern(k,'Terrace chimney lantern',(x,y-.54,2.96),.64)


def build_terrace(k,seats,kit):
    _palette(k)
    # Sky is a continuous authored scene behind framed architectural elements.
    # No floating building primitives: the distant skyline belongs to the backdrop.
    kit.scenic_panel(k,'Continuous sunset city beyond terrace',(0,3.15,1.66),8.02,3.10,axis='back',kind='sunset')
    _brick_panel(k,'Terrace rear parapet',(0,2.85),8,.46,.24)
    _brick_panel(k,'Terrace left parapet',(-3.89,.13),5.85,.44,.20,'left')
    _brick_panel(k,'Terrace right low wall',(3.87,.38),5.15,.30,.20,'left')
    # A substantial dark window frame makes the skyline belong to the space.
    for x in (-3.99,3.99):_b(k,'City panorama structural jamb',(x,3.07,1.64),(.115,.14,3.18),'ex_charcoal',.012)
    _b(k,'City panorama top mullion',(0,3.035,3.26),(8.08,.18,.085),'ex_charcoal',.011)
    _b(k,'City panorama bottom sill',(0,3.035,.10),(8.08,.24,.16),'ex_stone_dark',.01)
    for x in (-2.63,-1.28,.10,1.45,2.78):
        _b(k,'Terrace rear balustrade post',(x,2.72,.85),(.042,.047,1.20),'ex_charcoal',.005)
    for z in (.46,1.43):_b(k,'Terrace continuous handrail',(0,2.72,z),(7.92,.07,.065),'ex_charcoal',.009)
    # Slim glass edge lines and gaskets provide depth without obscuring scenery.
    for i in range(6):
        x=-3.31+i*1.32
        for z in (.56,1.33):_b(k,'Terrace glass panel polished rim',(x,2.724,z),(1.25,.012,.013),'ex_sky_glass',.002)
        for dx in (-.62,.62):_b(k,'Terrace glass vertical edge',(x+dx,2.724,.945),(.012,.014,.77),'ex_sky_glass',.002)
    # Surrounding trees, planters, flowers and lamps anchor the terrace physically.
    _planter(k,'Terrace left olive planter',(-3.46,2.20,0),.67,.65,114,False)
    _tree(k,'Terrace leafy olive',(-3.46,2.20,.39),2.38,.60,51)
    _planter(k,'Terrace railing flowers',(.40,2.34,0),3.84,.44,140,False)
    for x in (-1.12,1.85):_shrub(k,'Balustrade flowering greenery',(x,2.32,.43),.35,.88,math.floor(x*100)%70,True)
    _planter(k,'Terrace foreground garden',(3.37,-1.96,0),.77,.75,171,True)
    _shrub(k,'Terrace tall foreground plant',(3.37,-1.96,.46),.40,1.02,24,False)
    _planter(k,'Terrace left fern garden',(-3.48,-1.22,0),.57,1.3,71,False)
    _brick_panel(k,'Terrace left welcome pier',(-3.60,1.10),.64,2.10,.31)
    _sign(k,'Terrace welcome message',(-3.60,.925,1.38),.56,1.25,'IDEAS\nAMISTADES\nPLANES\nAQUÍ',.123,'ex_charcoal','ex_glow')
    _lantern(k,'Terrace entrance lantern',(-3.60,1.10,2.18),.75)
    _fireplace(k,(3.28,2.33))
    # Lounge is an L with five seats and one inward-facing front stool.
    _sofa(k,'Terrace rear connected sofa',(-.10,1.56,0),3.54,0,3)
    for x in (-1.20,-.10,1.00):kit.seat(seats,(x,1.53,0),0,'outdoor-sofa')
    _sofa(k,'Terrace left connected sofa',(-2.40,.08,0),2.50,math.pi/2,2)
    for y in (-.50,.66):kit.seat(seats,(-2.37,y,0),math.pi/2,'outdoor-sofa')
    kit.rug(k,(.05,-.49),4.75,3.09)
    _slatted_table(k,'Terrace long shared coffee table',(.15,-.36,0),2.63,1.40,.63)
    # Lower storage with individual bindings, magazines and a wicker box.
    _b(k,'Terrace coffee table lower shelf',(.15,-.36,.22),(2.30,1.13,.06),'ex_oak',.012)
    kit.bookstack(k,'Terrace lower shelf books',(-.50,-.61,.26),4)
    _b(k,'Terrace woven storage box',(.65,-.43,.34),(.50,.51,.21),'ex_rattan',.024)
    for i in range(12):_b(k,'Wicker storage horizontal weave',(.65,-.693,.26+i*.014),(.48,.012,.006),'ex_oak_light',.002)
    kit.laptop(k,'Terrace shared laptop left',(-.66,-.53,.68),.20)
    kit.laptop(k,'Terrace shared laptop right',(.65,-.21,.68),-.13)
    kit.notebook(k,'Terrace handwritten study notes',(.01,-.57,.68))
    kit.bookstack(k,'Terrace reference books',(.99,-.72,.68),3)
    _mug(k,'Terrace blue coffee',(-.93,-.05,.68),'ex_teal')
    _mug(k,'Terrace warm coffee',(.31,-.70,.68))
    _pencil_cup(k,'Terrace study pencils',(.47,.08,.68))
    _b(k,'Terrace shared study cards',(-.20,.09,.70),(.18,.13,.045),'paper',.004)
    for i in range(4):_b(k,'Terrace flashcard coloured edge',(-.20,.09,.704+i*.009),(.184,.134,.003),['blue','yellow','sage','coral'][i],.001)
    _shrub(k,'Terrace centerpiece',(.04,.06,.77),.18,.28,162,False)
    k.cylinder('Terrace centerpiece planter',(.04,.06,.749),.11,.14,'ex_mug','EXTERIOR_DETAIL',12)
    _stool(k,'Terrace front study stool',(.45,-1.81,0))
    kit.seat(seats,(.45,-1.81,0),math.pi,'outdoor-stool')
    _stool(k,'Terrace spare stool',(2.07,-1.60,0))
    _b(k,'Terrace spare stool seat pad',(2.07,-1.60,.505),(.55,.52,.055),'ex_cushion_blue',.026)
    # Lamps, candles, reserve books, portable speaker and a folded blanket.
    _slatted_table(k,'Terrace sofa end table',(2.13,1.44,0),.58,.65,.59)
    _lantern(k,'Terrace side table lantern',(2.13,1.44,.65),.80)
    _slatted_table(k,'Terrace corner side table',(-2.81,1.67,0),.62,.63,.57)
    kit.bookstack(k,'Terrace corner reading pile',(-2.82,1.65,.62),2)
    _lantern(k,'Terrace corner warm lamp',(-2.82,1.65,.77),.65)
    for i in range(3):
        _b(k,'Terrace folded blanket',(-2.48,-1.16,.78+i*.025),(.60,.23,.045),'ex_teal' if i%2 else 'ex_cushion_linen',.015)
    _b(k,'Terrace compact speaker',(2.18,-.61,.15),(.20,.15,.29),'ex_charcoal',.020)
    for i in range(7):_b(k,'Terrace speaker grille line',(2.18,-.691,.05+i*.031),(.14,.006,.010),'stone',.001)
    for x,y,z in [(-3.2,-1.86,.38),(3.01,-.98,.18),(2.86,1.18,.05)]:
        _lantern(k,'Terrace ground lantern',(x,y,z),.78)
    # Distinctively warm festoon lights above the skyline, each with a real socket.
    for x in (-3.65,2.78):
        _line(k,'Terrace string-light mast',(x,2.61,.40),(x,2.61,3.19),.034)
        _b(k,'Terrace mast fixing foot',(x,2.61,.42),(.16,.16,.05),'ex_charcoal',.004)
    points=[(-3.65+i*6.43/24,2.61,3.18-.38*math.sin(i/24*math.pi)) for i in range(25)]
    k.tube('Terrace overhead festoon cable',points,.011,'ex_charcoal','EXTERIOR_DETAIL')
    for i,p in enumerate(points):
        if i%2:continue
        _line(k,'Terrace pendant lead',p,(p[0],p[1],p[2]-.11),.009)
        k.cylinder('Terrace light screw socket',(p[0],p[1],p[2]-.12),.034,.055,'ex_charcoal','EXTERIOR_DETAIL',12)
        k.sphere('Terrace amber globe',(p[0],p[1],p[2]-.185),(.050,.050,.064),'ex_glow','EXTERIOR_DETAIL',10,5)
    for j,x in enumerate((-3.36,-1.59,.70)):
        _vines(k,'Terrace climbing vine',[(x,2.60,.6),(x+.13,2.57,1.12),(x-.11,2.58,1.66),
               (x+.10,2.57,2.14)],44+j)
