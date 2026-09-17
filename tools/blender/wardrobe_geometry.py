"""Editable, meter-based garment patterns. Geometry includes seams and appliqués.

Coordinates are the inspected compa-humanoid-v2 bind space (front is -Y).
Every vertex carries normalized skin weights; sleeves and trouser knees share
continuous weighted rings. No external textures or downloaded meshes.
"""
import math, hashlib
from collections import defaultdict
import bpy
from mathutils import Vector, Matrix
from wardrobe_catalog import COLORS
from build_harper import material

FONT={
'A':'01110/10001/10001/11111/10001/10001/10001','B':'11110/10001/10001/11110/10001/10001/11110','C':'01111/10000/10000/10000/10000/10000/01111','D':'11110/10001/10001/10001/10001/10001/11110','E':'11111/10000/10000/11110/10000/10000/11111','F':'11111/10000/10000/11110/10000/10000/10000','G':'01111/10000/10000/10111/10001/10001/01111','H':'10001/10001/10001/11111/10001/10001/10001','I':'111/010/010/010/010/010/111','J':'00111/00010/00010/00010/10010/10010/01100','K':'10001/10010/10100/11000/10100/10010/10001','L':'10000/10000/10000/10000/10000/10000/11111','M':'10001/11011/10101/10101/10001/10001/10001','N':'10001/11001/10101/10011/10001/10001/10001','O':'01110/10001/10001/10001/10001/10001/01110','P':'11110/10001/10001/11110/10000/10000/10000','Q':'01110/10001/10001/10001/10101/10010/01101','R':'11110/10001/10001/11110/10100/10010/10001','S':'01111/10000/10000/01110/00001/00001/11110','T':'11111/00100/00100/00100/00100/00100/00100','U':'10001/10001/10001/10001/10001/10001/01110','V':'10001/10001/10001/10001/10001/01010/00100','W':'10001/10001/10001/10101/10101/10101/01010','X':'10001/10001/01010/00100/01010/10001/10001','Y':'10001/10001/01010/00100/00100/00100/00100','Z':'11111/00001/00010/00100/01000/10000/11111',
'0':'01110/10001/10011/10101/11001/10001/01110','1':'010/110/010/010/010/010/111','2':'01110/10001/00001/00010/00100/01000/11111','3':'11110/00001/00001/01110/00001/00001/11110','4':'00010/00110/01010/10010/11111/00010/00010','5':'11111/10000/10000/11110/00001/00001/11110','6':'01110/10000/10000/11110/10001/10001/01110','7':'11111/00001/00010/00100/01000/01000/01000','8':'01110/10001/10001/01110/10001/10001/01110','9':'01110/10001/10001/01111/00001/00001/01110',':':'0/1/0/0/1/0/0',' ':'000/000/000/000/000/000/000'}
ICONS={
'smile':['..yyyyy..','.yyyyyyy.','yykyyykyy','yykyyykyy','yyyyyyyyy','ykyyyyyky','yykkkkkyy','.yyyyyyy.','..yyyyy..'],
'cat':['w.......w','ww.....ww','wwwwwwwww','wwkw wwkw'.replace(' ',''),'wwwwpwwww','.wwpppww.','..wwwww..','..w...w..'],
'heart':['.pp...pp.','pppp.pppp','ppppppppp','ppppppppp','.ppppppp.','..ppppp..','...ppp...','....p....'],
'star':['....y....','...yyy...','yyyyyyyyy','.yyyyyyy.','..yyyyy..','.yyyyyyy.','.yyy.yyy.','yy.....yy'],
'mountain':['.......y...','......yyy..','.....w.....','....www....','...gwwwg...','..gggwggg..','.ggggggggg.','ggggggggggg'],
'planet':['....bbbb....','..bbbbbbbb..','.bbbwwwbbbb.','bbwwbbbbwwbb','ybbbbbbbbbyy','.yybbbbbyy..','...yyyyyy...','....bbbb....'],
'galaxy':['...pppp....','..p....pp..','.p..ppp..p.','p..p...p.p.','p.p..p.p.p.','.p.ppp..p..','..p....p...','...pppp....'],
'butterfly':['pp.....pp','ppp...ppp','ppppkpppp','.pppkppp.','..ppkpp..','.pppkppp.','ppp.k.ppp','pp..k..pp'],
'flame':['....r....','....rr...','...rrr...','..rrrr.r.','.rryrrrr.','rryyyrrrr','rryyyyyrr','.ryyyyyy.','..yyyyy..'],
'wave':['....bbb.....','..bbbbbb....','.bbwwwbbb...','bbww..wbb...','bw.....bb..b','b......bbbbb','wwbbbbbbbbww','wwwwwwwwwwww'],
'bear':['bb.....bb','bbbbbbbbb','.bbbbbbb.','.bkbbbkb.','.bbwwwbb.','..bwkwb..','.bbbbbbb.','bb.bbb.bb','...b.b...'],
'flower':['...www...','..wwwww..','wwwyyywww','wwwyyywww','..wwwww..','...www...','....g....','...ggg...'],
'clover':['.gg...gg.','gggg.gggg','ggggggggg','.ggggggg.','..ggggg..','.ggggggg.','ggggggggg','.gg..gg..','....g....'],
'cloud':['...www...','..wwwww..','wwwwwwwww','wwwwwwwww','.wwwwwww.'],
'robot':['..rrrrr..','..rrbrr..','.bbbbbbb.','bbwywywbb','..bbbbb..','.rrbrbrr.','rr.bbb.rr','..bb.bb..','.bb...bb.'],
'dino':['...gggg..','..gggkg..','..gggggg.','..ggg....','g.gggg...','gggggggg.','.ggggg...','..g.g....'],
'cross':['ww...ww','www.www','.wwwww.','..www..','.wwwww.','www.www','ww...ww']}

def tint(hexcolor, factor):
    return '#'+''.join(f'{min(255,max(0,round(int(hexcolor[i:i+2],16)*factor))):02x}' for i in (1,3,5))

class MeshBuilder:
    def __init__(self,item):
        self.item=item; self.parts={}; self.part='main'; self.bone='spine'
        self.base=COLORS[item['color']];self.dark=tint(self.base,.72);self.light=tint(self.base,1.16)
        self.transform=Matrix.Identity(4)
        self.tags={}
    def data(self):
        return self.parts.setdefault(self.part,{'v':[],'f':[],'m':[],'w':[],'materials':[]})
    def add(self,v,f,color,weights=None):
        d=self.data();offset=len(d['v']);color=COLORS.get(color,color)
        if color not in d['materials']:d['materials'].append(color)
        d['v'].extend(tuple(self.transform@Vector(p)) for p in v)
        d['f'].extend(tuple(offset+x for x in face) for face in f)
        d['m'].extend([d['materials'].index(color)]*len(f))
        if weights is None:weights=[{self.bone:1.}]*len(v)
        elif isinstance(weights,dict):weights=[weights]*len(v)
        d['w'].extend(weights)
    def rings(self,profiles,color,centers=None,weights=None,cap=True):
        # 8-sided chamfered rectangular sections. Each tuple is z,width,depth,cx,cy.
        v=[]
        for i,(z,w,d,x,y) in enumerate(profiles):
            a=min(w,d)*.18
            pts=[(-w/2+a,-d/2),(w/2-a,-d/2),(w/2,-d/2+a),(w/2,d/2-a),(w/2-a,d/2),(-w/2+a,d/2),(-w/2,d/2-a),(-w/2,-d/2+a)]
            for px,py in pts:
                p=Vector((px+x,py+y,z))
                v.append(centers(i,p) if centers else p)
        f=[(i*8+j,i*8+(j+1)%8,(i+1)*8+(j+1)%8,(i+1)*8+j) for i in range(len(profiles)-1) for j in range(8)]
        if cap:f.extend([tuple(range(7,-1,-1)),tuple((len(profiles)-1)*8+j for j in range(8))])
        wts=[weights(i) for i in range(len(profiles)) for _ in range(8)] if weights else None
        self.add(v,f,color,wts)
    def box(self,loc,dims,color,bevel=.002,rotation=None):
        x,y,z=loc;w,d,h=dims;b=min(bevel,w*.24,d*.24,h*.24)
        pr=[(-h/2,w-2*b,d-2*b,0,0),(-h/2+b,w,d,0,0),(h/2-b,w,d,0,0),(h/2,w-2*b,d-2*b,0,0)]
        q=Matrix.Rotation(rotation[0],4,'X')@Matrix.Rotation(rotation[1],4,'Y')@Matrix.Rotation(rotation[2],4,'Z') if rotation else Matrix.Identity(4)
        self.rings(pr,color,lambda i,p:Vector(loc)+q@p)
    def beam(self,a,b,width,depth,color):
        a,b=Vector(a),Vector(b);q=(b-a).to_track_quat('Z','Y').to_matrix()
        old=self.transform.copy();self.transform=old@Matrix.Translation((a+b)/2)@q.to_4x4()
        self.box((0,0,0),(width,depth,(b-a).length),color)
        self.transform=old
    def tube(self,points,radius,color,closed=False,sides=6):
        points=[Vector(p) for p in points];v=[]
        for i,p in enumerate(points):
            delta=points[(i+1)%len(points)]-p if closed or i<len(points)-1 else p-points[i-1]
            q=delta.to_track_quat('Z','Y')
            v.extend(p+q@Vector((radius*math.cos(j*2*math.pi/sides),radius*math.sin(j*2*math.pi/sides),0)) for j in range(sides))
        f=[(i*sides+j,i*sides+(j+1)%sides,((i+1)%len(points))*sides+(j+1)%sides,((i+1)%len(points))*sides+j) for i in range(len(points) if closed else len(points)-1) for j in range(sides)]
        if not closed:f.extend([tuple(range(sides-1,-1,-1)),tuple((len(points)-1)*sides+j for j in range(sides))])
        self.add(v,f,color)
    def torus(self,loc,rx,rz,radius,color,plane='XZ',steps=24):
        x,y,z=loc
        pts=[(x+rx*math.cos(i*2*math.pi/steps),y,z+rz*math.sin(i*2*math.pi/steps)) if plane=='XZ' else (x+rx*math.cos(i*2*math.pi/steps),y+rz*math.sin(i*2*math.pi/steps),z) for i in range(steps)]
        self.tube(pts,radius,color,True)
    def cylinder(self,loc,radius,depth,color,r2=None,n=16):
        x,y,z=loc;r2=radius if r2 is None else r2
        v=[(x+r*math.cos(j*2*math.pi/n),y+r*math.sin(j*2*math.pi/n),z+zz) for r,zz in ((radius,-depth/2),(r2,depth/2)) for j in range(n)]
        f=[(j,(j+1)%n,(j+1)%n+n,j+n) for j in range(n)]+[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]
        self.add(v,f,color)
    def sphere(self,loc,scale,color,n=16,rings=10):
        x,y,z=loc;rx,ry,rz=scale
        v=[(x+rx*math.sin(k*math.pi/rings)*math.cos(j*2*math.pi/n),y+ry*math.sin(k*math.pi/rings)*math.sin(j*2*math.pi/n),z+rz*math.cos(k*math.pi/rings)) for k in range(rings+1) for j in range(n)]
        self.add(v,[(k*n+j,k*n+(j+1)%n,(k+1)*n+(j+1)%n,(k+1)*n+j) for k in range(rings) for j in range(n)],color)
    def stitch(self,a,b,n=16,color=None):
        a,b=Vector(a),Vector(b);delta=(b-a)/n
        for i in range(n):self.beam(a+delta*(i+.15),a+delta*(i+.68),.0013,.0013,color or self.light)
    def label(self,body,loc,width,color='white'):
        rows=body.upper().replace('-',' ').split('\n');cell=width/max(sum(len(FONT.get(ch,FONT[' '])[0:FONT.get(ch,FONT[' ']).find('/')])+1 for ch in row) for row in rows)
        x,y,z=loc
        for line,row in enumerate(rows):
            glyphs=[FONT.get(ch,FONT[' ']).split('/') for ch in row]; total=sum(len(g[0])+1 for g in glyphs)-1;xx=x-total*cell/2
            for g in glyphs:
                for iy,strip in enumerate(g):
                    for ix,c in enumerate(strip):
                        if c=='1':self.box((xx+ix*cell,y,z-(iy+line*9)*cell),(cell*.92,.0016,cell*.92),color,.0002)
                xx+=(len(g[0])+1)*cell
    def icon(self,name,loc,size):
        if name in ('a','b','c','s','ny','nyc','98','focus','calm','study','good-days','good-study','stay-kind','better-days'):
            self.label(name.replace('-','\n'),loc,size,'navy' if self.item['color'] in ('ivory','white','gray','sky') else 'ivory');return
        if name in ('plain','hiker','panel','mono','chain','piping','cargo','cable','all-stripe','double-stripe','stripe','fairisle','orange-stitch'):return
        if name in ('label','gold-label'):
            self.box(loc,(size,.006,size*.55),'gold' if name=='gold-label' else 'ivory');self.box((loc[0],loc[1]-.005,loc[2]),(size*.3,.005,size*.25),'black');return
        name2={'red-butterfly':'butterfly','orange-butterfly':'butterfly','raglan-star':'star','brown-star':'star','checker':'smile','tag':'label'}.get(name,name)
        art=ICONS.get(name2,ICONS['star']);cs={'k':'#201D24','w':'#F3EFE4','y':'#EDB548','r':'#D45B48','b':'#4881B5','p':'#D57DAB','g':'#588B58'}
        if name2=='bear':cs['b']='#C29A74'
        if name.startswith('red-'):cs['p']='#D14F54'
        if name.startswith('orange-'):cs['p']='#D87841'
        if name=='brown-star':cs['y']=COLORS['brown']
        if name=='heart' and self.item['color']=='pink':cs['p']=COLORS['ivory']
        if name=='flower' and self.item['family']=='charm' and self.item['color']=='pink':cs['w']=COLORS['pink'];cs['y']=COLORS['ivory']
        step=size/max(len(s) for s in art);x,y,z=loc
        for row,line in enumerate(art):
            for col,char in enumerate(line):
                if char in cs:self.box((x+(col-(len(line)-1)/2)*step,y,z+((len(art)-1)/2-row)*step),(step*.97,.003,step*.97),cs[char],.0003)
    def finish(self,collection,rig):
        result=[]
        for part,d in self.parts.items():
            if not d['v']:continue
            name=self.item['id']+'__'+part
            mesh=bpy.data.meshes.new(name);mesh.from_pydata(d['v'],[],d['f']);mesh.update()
            for color in d['materials']:
                mn='WARDROBE_'+color[1:];mat=bpy.data.materials.get(mn)
                if mat is None:mat=material(mn,color,.68)
                mesh.materials.append(mat)
            for p,m in zip(mesh.polygons,d['m']):p.material_index=m
            obj=bpy.data.objects.new(name,mesh);collection.objects.link(obj)
            obj.parent=rig
            bones=defaultdict(list)
            for i,weights in enumerate(d['w']):
                for bone,weight in weights.items():bones[(bone,round(weight,6))].append(i)
            groups={b:obj.vertex_groups.new(name=b) for b in sorted({bone for bone,weight in bones})}
            for (bone,weight),indices in bones.items():groups[bone].add(indices,weight,'REPLACE')
            mod=obj.modifiers.new('Compa normalized skin','ARMATURE');mod.object=rig
            obj['compa_item']=self.item['id'];obj['compa_slot']=self.item['slot'];obj['compa_component']=part
            obj['compa_schema']='compa-humanoid-v2';obj['compa_bind_space']='canonical-meters'
            result.append(obj)
        return result

def tops(b):
    f=b.item['family'];outer=b.item['slot']=='outerwear';tee=f=='tee';light=f in ('tee','longsleeve')
    width=.46 if light else .484 if not outer else .540
    depth=.285 if light else .316 if not outer else .380
    b.part='torso';b.bone='spine'
    pr=[(.823,width*.96,depth*.95,0,0),(.860,width,depth,0,0),(.92,width*.98,depth*.97,0,0),(1.02,width*.95,depth*.98,0,0),(1.12,width,depth,0,0),(1.23,width*1.02,depth,0,0),(1.275,width*.85,depth*.93,0,0),(1.309,.21,.187,0,0)]
    raglan=b.item['design']=='raglan-star'
    b.rings(pr,'ivory' if raglan else b.base,cap=False)
    y=-depth/2-.004
    b.part='hem';b.rings([(.823,width*.99,depth*.97,0,0),(.834,width*1.025,depth*1.016,0,0),(.867,width*1.02,depth*1.01,0,0)],b.dark,cap=False)
    for i in range(30):b.box((-.22+i*.44/29,y-.004,.846),(.0024,.003,.026),b.light,.0004)
    b.part='collar';b.torus((0,0,1.307),.112,.102,.013,b.dark,'XY',32)
    if outer:
        b.part='construction'
        for sign in (-1,1):
            b.box((sign*.022,y-.008,1.078),(.038,.018,.388),b.dark)
            b.box((sign*.170,y-.008,.958),(.12,.022,.049),b.dark,rotation=(0,sign*.18,0))
            b.stitch((sign*.229,y-.004,.906),(sign*.228,y-.004,1.218),27)
        for i in range(40):b.box(((-1 if i%2 else 1)*.003,y-.021,.904+i*.008),(.006,.004,.004),'silver',.0004)
        b.box((0,y-.025,1.19),(.013,.009,.026),'gold')
        if f=='varsity':
            for z in (.88,.895):b.box((0,y-.01,z),(.515,.008,.006),'ivory')
            for z in (.939,1.00,1.06,1.12,1.18,1.24):b.box((0,y-.029,z),(.012,.008,.012),'silver')
            b.icon(b.item['design'],(-.154,y-.020,1.236),.08)
        if f=='puffer':
            for z in (.923,1.011,1.099,1.187):
                for sign in (-1,1):b.box((sign*.141,y-.005,z),(.231,.037,.074),b.base,.015)
            b.icon('label',(-.15,y-.04,1.206),.044)
        if f in ('denimjacket','utility'):
            for sign in (-1,1):
                b.box((sign*.15,y-.018,1.183),(.112,.027,.101),b.light)
                b.box((sign*.15,y-.035,1.225),(.123,.015,.03),b.dark)
                b.box((sign*.15,y-.045,1.224),(.009,.006,.009),'gold')
            if f=='utility':
                accent=b.item['design'];b.box((-.195,y-.04,1.088),(.022,.007,.094),accent);b.icon('label',(.164,y-.04,1.20),.053)
        if f=='shearling' or b.item['design']=='shearling':
            for sign in (-1,1):
                for z in range(19):b.box((sign*.030,y-.03,.905+z*.019),(.045,.037,.021),'ivory',.007)
            for i in range(27):b.box((-.245+i*.019,y, .851),(.022,.035,.028),'ivory',.005)
    else:
        b.part='graphic'
        design=b.item['design']
        if 'stripe' in design or design=='fairisle':
            zs=(1.098,1.167) if design=='double-stripe' else (.925,1.01,1.095,1.18)
            for z in zs:b.box((0,y-.002,z),(width*.86,.003,.028),'ivory')
            if design=='fairisle':
                for x in range(13):b.icon('star',(-.19+x*.032,y-.006,1.22),.024)
        else:
            if raglan:
                b.icon('brown-star',(0,y-.006,1.17),.14)
            else:b.icon(design,(0,y-.006,1.17),.19 if f!='sweater' else .15)
        if f=='hoodie':
            b.part='pocket'
            b.box((0,y-.018,.973),(.284,.032,.108),b.base,.009)
            for sign in (-1,1):b.beam((sign*.145,y-.04,1.02),(sign*.10,y-.04,.941),.008,.005,b.dark)
            b.stitch((-.118,y-.037,.936),(.118,y-.037,.936),24)
        if f=='sweater':
            b.part='knit'
            for ix in range(21):
                x=-.205+ix*.0205
                for iz in range(27):
                    z=.89+iz*.0117
                    if b.item['design'] not in ('cable','fairisle','stripe') and abs(x)<.096 and 1.05<z<1.26:continue
                    dx=.004*math.sin(iz*.8+ix) if b.item['design']=='cable' else .002
                    b.beam((x-dx,y-.004,z),(x+dx,y-.004,z+.008),.0023,.0023,b.light)
    if f=='hoodie' or b.item['design']=='hood':
        b.part='hood';b.rings([(1.26,.30,.24,0,.040),(1.295,.355,.278,0,.048),(1.367,.32,.24,0,.067),(1.40,.255,.20,0,.080)],b.base,cap=False)
        for sign in (-1,1):
            b.tube([(sign*.08,-.10,1.315),(sign*.069,-.17,1.26),(sign*.065,y-.014,1.12)],.004,'ivory')
            b.box((sign*.065,y-.014,1.113),(.008,.008,.023),'gold')
    # Arms use actual anatomical joints, blended continuously around elbows.
    for side,sgn in (('L',-1),('R',1)):
        b.part='sleeve_'+side;b.bone='upper_arm.'+side
        a=Vector((sgn*.23,0,1.23));e=Vector((sgn*.38,0,.98));w=Vector((sgn*.41,-.02,.75))
        stations=[(-.29,0),(-.16,0),(.02,0),(.17,0),(.35,0),(.55,0)] if tee else [(-.29,0),(-.16,0),(.02,0),(.19,0),(.40,0),(.64,0),(.82,.03),(.94,.28),(1,.5),(1.06,.72),(1.18,.97),(1.35,1),(1.55,1),(1.76,1),(1.95,1),(2.02,1)]
        sw=.18 if light else .220 if not outer else .270;sd=sw*1.14
        centers=[];rots=[];profiles=[];weights=[]
        for i,(t,blend) in enumerate(stations):
            center=a+(e-a)*t if t<=1 else e+(w-e)*(t-1)
            delta=(e-a).lerp(w-e,max(0,min(1,(t-.8)/.4)))
            centers.append(center);rots.append(delta.to_track_quat('Z','Y'));fac=1-.15*max(0,t-1)+.024*math.sin(t*19)
            if t<-.20:fac=.38
            elif t<0:fac=.82
            profiles.append((0,sw*fac,sd*fac,0,0));weights.append({'upper_arm.'+side:1-blend,'forearm.'+side:blend})
        sleevecolor='ivory' if f=='varsity' else b.base
        b.rings(profiles,sleevecolor,lambda i,p:centers[i]+rots[i]@p,lambda i:{k:v for k,v in weights[i].items() if v>0},True)
        # Raised seam follows the upper sleeve rather than drawing a line across the joint.
        qa=(e-a).to_track_quat('Z','Y');b.bone='upper_arm.'+side
        b.stitch(a+qa@Vector((sw*.30,-sd*.5,.025)),a+(e-a)*(.48 if tee else .7)+qa@Vector((sw*.30,-sd*.5,0)),12,b.light)
        if 'stripe' in b.item['design'] or b.item['design']=='stripe':
            for t in ((.20,.47) if tee else (.2,.52,1.40,1.76)):
                cc=a+(e-a)*t if t<1 else e+(w-e)*(t-1);qq=((e-a) if t<1 else (w-e)).to_track_quat('Z','Y')
                b.bone='upper_arm.'+side if t<1 else 'forearm.'+side;fac=1-.15*max(0,t-1)
                b.rings([(-.013,sw*fac*1.03,sd*fac*1.03,0,0),(.013,sw*fac*1.03,sd*fac*1.03,0,0)],'ivory',lambda i,p:cc+qq@p,cap=False)
        end=centers[-1];q=rots[-1];b.bone='upper_arm.'+side if tee else 'forearm.'+side
        old=b.transform.copy();b.transform=old@Matrix.Translation(end)@q.to_matrix().to_4x4()
        b.rings([(-.024,sw*.88,sd*.88,0,0),(0,sw*.91,sd*.91,0,0),(.014,sw*.88,sd*.88,0,0)],b.dark,cap=False)
        for k in range(12):b.box((-.07+k*.014,-sd*.456,-.004),(.002,.003,.028),b.light,.0004)
        b.transform=old
        if f=='puffer':
            for t in (.25,.55,1.42,1.76):
                c=a+(e-a)*t if t<1 else e+(w-e)*(t-1);q=((e-a) if t<1 else (w-e)).to_track_quat('Z','Y')
                b.bone='upper_arm.'+side if t<1 else 'forearm.'+side
                b.rings([(-.003,sw*.99,sd*.99,0,0),(.003,sw*.99,sd*.99,0,0)],b.dark,lambda i,p:c+q@p,cap=False)

def bottoms(b):
    f=b.item['family'];short=f in ('shorts','sportshorts');sport=f in ('sportshorts','trackpants')
    b.part='waist';b.bone='hips'
    b.rings([(.745,.365,.249,0,0),(.80,.407,.270,0,0),(.878,.403,.272,0,0),(.902,.393,.268,0,0)],b.base,cap=False)
    b.rings([(.873,.411,.279,0,0),(.898,.410,.279,0,0)],b.dark,cap=False)
    if sport:
        for sign in (-1,1):b.tube([(sign*.013,-.145,.89),(sign*.028,-.150,.835),(sign*.015,-.153,.799)],.003,'ivory')
    else:
        b.box((0,-.148,.886),(.014,.007,.014),'gold');b.beam((.012,-.142,.866),(.012,-.142,.785),.003,.003,b.dark)
        for x in (-.16,-.075,.075,.16):b.box((x,-.147,.883),(.015,.009,.045),b.light)
    for side,sgn in (('L',-1),('R',1)):
        b.part='leg_'+side;b.bone='thigh.'+side;x=sgn*.135
        zs=[.825,.78,.7,.62,.545,.523] if short else [.825,.78,.70,.6,.51,.465,.43,.398,.36,.30,.24,.18,.145]
        profiles=[];weights=[]
        for i,z in enumerate(zs):
            width=.213 if short else .213-(.825-z)*.032
            width+=.011*math.sin(i*2.4) if not sport else 0
            profiles.append((z,width,.247-(.825-z)*.025,x,.002))
            blend=max(0,min(1,(.49-z)/.115));weights.append({'thigh.'+side:1-blend,'shin.'+side:blend})
        # Reverse rings to keep outward normals (profiles must ascend).
        profiles.reverse();weights.reverse()
        b.rings(profiles,b.base,weights=lambda i:{k:v for k,v in weights[i].items() if v>0},cap=False)
        b.bone='thigh.'+side if short else 'shin.'+side
        z=.532 if short else .162
        b.rings([(z-.015,.219,.248,x,0),(z+.025,.218,.247,x,0)],b.dark,cap=False)
        if not sport:
            b.bone='thigh.'+side
            b.box((x+sgn*.088,-.021,.653),(.079,.269,.134),b.dark,.008)
            b.box((x+sgn*.088,-.163,.696),(.089,.027,.036),b.light)
            for xx in (-.028,.028):b.box((x+sgn*.088+xx,-.181,.70),(.010,.007,.010),'gold')
            b.stitch((x-.07,-.133,.795),(x-.04,-.140,.738),10)
        b.bone='thigh.'+side
        seam='orange' if b.item['design']=='orange-stitch' else 'ivory' if sport else b.light
        b.beam((x+sgn*.106,-.065,.77),(x+sgn*.107,-.065,.54 if short else .49),.003,.003,seam)
        if not short:
            b.bone='shin.'+side;b.beam((x+sgn*.106,-.065,.365),(x+sgn*.097,-.065,.196),.003,.003,seam)
    if b.item['design']=='chain':
        b.part='chain';b.bone='hips'
        for i in range(15):b.torus((.07+i*.009,-.16,.863-.062*math.sin(i*math.pi/14)),.008,.012,.002,'gold',steps=12)

def footwear(b):
    boot=b.item['family']=='boot';mono=b.item['design']=='mono';sole='black' if boot and b.item['color']!='ivory' else 'ivory'
    for side,sgn in (('L',-1),('R',1)):
        b.part='shoe_'+side;b.bone='foot.'+side;x=sgn*.135
        b.rings([(.004,.225,.350,x,-.04),(.013,.242,.362,x,-.04),(.041,.239,.36,x,-.04),(.059,.232,.354,x,-.04)],sole)
        b.rings([(.057,.227,.346,x,-.04),(.09,.222,.332,x,-.04),(.12,.207,.305,x,-.04),(.148,.187,.245,x,-.008),(.18,.164,.185,x,.012),(.265 if boot else .197,.158,.176,x,.012)],b.base,cap=False)
        trim=b.dark if mono else 'ivory' if not boot else b.light
        b.box((x,-.180,.11),(.202,.081,.035),b.light,.005)
        b.box((x,.117,.136),(.170,.019,.103),b.dark)
        for s in (-1,1):
            b.box((x+s*.103,-.046,.118),(.009,.172,.05),trim)
            for i in range(9):b.box((x+s*.118,-.19+i*.041,.016),(.012,.018,.018),b.dark,.001)
            b.stitch((x+s*.110,-.16,.063),(x+s*.105,.08,.063),20,'ivory')
        top=.234 if boot else .18
        b.box((x,-.076,top-.018),(.10,.033,.105 if boot else .049),b.light,.004,rotation=(.25,0,0))
        n=8 if boot else 5
        for i in range(n):
            y=-.142+i*.012;z=.139+i*(.014 if boot else .007)
            for s in (-1,1):b.torus((x+s*.047,y,z),.006,.004,.002,'gold' if boot else 'silver',steps=10)
            b.beam((x-.045,y-.006,z+.004),(x+.045,y+.006,z+.014),.004,.004,'ivory' if not mono else 'gray')
            b.beam((x+.045,y-.006,z+.004),(x-.045,y+.006,z+.014),.004,.004,'ivory' if not mono else 'gray')
        b.box((x,.115,.265 if boot else .187),(.038,.017,.038),b.dark)
        b.box((x,-.102,top+.027),(.041,.006,.022),b.dark)

def bags(b):
    cross=b.item['family']=='crossbody';b.bone='spine';b.part='bag'
    if cross:
        b.rings([(.795,.280,.105,.09,-.231),(.825,.335,.125,.09,-.241),(.998,.34,.128,.09,-.241),(1.024,.28,.108,.09,-.236)],b.base)
        y=-.317;b.box((.09,y,.884),(.265,.027,.105),b.dark,.007)
        points=[(-.175,.06,1.313),(-.195,-.12,1.28),(-.10,-.211,1.18),(.01,-.218,1.07),(.14,-.246,1.01)]
        for a,c in zip(points,points[1:]):b.beam(a,c,.040,.016,b.base)
        # Rear return of the strap, continuous shoulder-to-bag route.
        for a,c in zip([(.22,-.19,.97),(.22,.18,1.04),(-.12,.18,1.25)],[ (.22,.18,1.04),(-.12,.18,1.25),(-.175,.06,1.313)]):b.beam(a,c,.04,.015,b.base)
        b.box((-.115,-.232,1.18),(.048,.020,.036),'gold')
        if b.item['design']!='stickers':b.icon(b.item['design'],(.09,y-.018,.898),.062)
        if b.item['design']=='stickers':
            b.icon('smile',(.078,y-.021,.904),.070);b.icon('cat',(.17,y-.022,.865),.029);b.icon('star',(-.008,y-.022,.859),.031)
        for i in range(23):b.box((-.045+i*.012,y-.008,.956),(.005,.005,.006),'gold',.0004)
        if b.item['design']=='checker':
            for i in range(12):
                for j in range(7):
                    if (i+j)%2:b.box((-.065+i*.027,-.310,.812+j*.027),(.026,.004,.026),'ivory')
    else:
        b.rings([(.79,.34,.18,0,.241),(.825,.40,.22,0,.245),(.99,.43,.23,0,.25),(1.19,.416,.227,0,.241),(1.27,.30,.18,0,.233)],b.base)
        b.box((0,.393,.985),(.325,.065,.232),b.dark,.012)
        b.box((0,.433,.923),(.272,.026,.110),b.base,.006)
        # Back-facing embroidery is transformed from the same front appliqué.
        old=b.transform.copy();b.transform=Matrix.Translation((0,.382,1.185))@Matrix.Rotation(math.pi,4,'Z')
        b.icon(b.item['design'],(0,-.006,0),.074);b.transform=old
        for sign in (-1,1):
            points=[(sign*.145,.224,1.272),(sign*.17,.08,1.341),(sign*.18,-.07,1.313),(sign*.182,-.203,1.206),(sign*.174,-.209,.957)]
            for a,c in zip(points,points[1:]):b.beam(a,c,.054,.022,b.base)
            b.box((sign*.18,-.225,1.079),(.064,.015,.042),'black');b.box((sign*.18,-.236,1.079),(.043,.009,.012),'silver')
            b.box((sign*.222,.25,.964),(.049,.18,.168),b.dark,.008)
            b.stitch((sign*.16,-.218,1.13),(sign*.16,-.214,1.255),15)
        b.tube([(-.057,.23,1.264),(-.057,.23,1.345),(.057,.23,1.345),(.057,.23,1.264)],.010,b.dark)
        for z,y in ((1.099,.432),(.979,.45)):
            for i in range(26):b.box((-.131+i*.0105,y,z+(.0015 if i%2 else 0)),(.004,.004,.005),'gold',.0003)
            b.box((.09,y+.008,z-.015),(.009,.008,.026),'gold')
        b.stitch((-.121,.450,.88),(.121,.450,.88),25)

def hats(b):
    b.part='headwear';b.bone='head';f=b.item['family']
    if f=='cap':
        b.rings([(1.82,.684,.562,0,.014),(1.85,.678,.552,0,.014),(1.93,.62,.51,0,.023),(2.005,.45,.39,0,.04),(2.026,.15,.14,0,.045)],b.base,cap=True)
        b.box((0,-.315,1.827),(.59,.305,.024),b.dark,.008)
        b.torus((0,.014,1.829),.325,.271,.006,b.light,'XY')
        for sign in (-1,1):b.stitch((sign*.15,-.25,1.85),(sign*.055,-.16,2.009),16)
        b.icon(b.item['design'],(0,-.278,1.923),.078)
        b.cylinder((0,.04,2.032),.015,.011,b.dark,n=12)
    elif f=='beanie':
        b.rings([(1.805,.689,.57,0,.015),(1.875,.70,.577,0,.017),(1.947,.62,.525,0,.024),(2.025,.42,.374,0,.045),(2.050,.11,.12,0,.056)],b.base,cap=True)
        def perimeter(t,width,depth,z,cy):
            a=min(width,depth)*.18
            pts=[(-width/2+a,-depth/2),(width/2-a,-depth/2),(width/2,-depth/2+a),(width/2,depth/2-a),(width/2-a,depth/2),(-width/2+a,depth/2),(-width/2,depth/2-a),(-width/2,-depth/2+a)]
            j=int(t)%8;frac=t-int(t);x=pts[j][0]*(1-frac)+pts[(j+1)%8][0]*frac;y=pts[j][1]*(1-frac)+pts[(j+1)%8][1]*frac
            return (x*1.008,cy+y*1.008,z)
        for i in range(72):
            t=i*8/72
            b.beam(perimeter(t,.689,.57,1.808,.015),perimeter(t,.70,.577,1.874,.017),.005,.005,b.light)
            b.beam(perimeter(t,.699,.577,1.878,.017),perimeter(t,.62,.525,1.944,.024),.003,.003,b.light)
            b.beam(perimeter(t,.619,.524,1.950,.024),perimeter(t,.42,.374,2.024,.045),.003,.003,b.light)
        b.icon(b.item['design'],(0,-.280,1.846),.057)
    else:
        b.rings([(1.80,.77,.654,0,.017),(1.83,.716,.600,0,.017),(1.86,.642,.536,0,.017),(1.98,.597,.50,0,.032),(1.992,.52,.445,0,.035)],b.base,cap=True)
        for z,r in ((1.804,.381),(1.82,.363),(1.976,.294)):b.torus((0,.02,z),r,r*.84,.002,b.light,'XY',32)
        b.icon(b.item['design'],(0,-.264,1.914),.073)

def eyewear(b):
    b.bone='head';b.part='frame';f=b.item['design'];front=-.284
    for sign in (-1,1):
        x=sign*.130
        if f in ('round','sun'):
            b.torus((x,front,1.566),.106,.085,.008,b.base,steps=24)
        else:
            pts=[(x-.102,front,1.643),(x+.102,front,1.643),(x+.102,front,1.488),(x-.102,front,1.488)]
            b.tube(pts,.009,b.base,True)
        if f in ('sun','smoke'):
            b.box((x,front+.002,1.566),(.193,.008,.14),'#313940',.010)
        # Clear lenses intentionally have no opaque slab over the eyes.
        b.beam((sign*.23,front,1.606),(sign*.284,.047,1.609),.012,.010,b.base)
        b.box((sign*.24,front-.010,1.615),(.012,.007,.008),'silver')
    b.beam((-.03,front,1.594),(.03,front,1.594),.010,.011,b.base)

def headphones(b):
    b.bone='neck';b.part='headphones'
    # Neck-worn: an intentionally open headband accommodates every hairstyle.
    b.tube([(-.202,-.178,1.30),(-.21,-.08,1.365),(-.158,.118,1.371),(0,.176,1.362),(.158,.118,1.371),(.21,-.08,1.365),(.202,-.178,1.30)],.016,b.base)
    for sign in (-1,1):
        b.box((sign*.203,-.195,1.259),(.075,.066,.118),b.dark,.014)
        b.box((sign*.203,-.236,1.259),(.082,.030,.11),b.base,.012)
        b.box((sign*.203,-.255,1.259),(.057,.009,.082),'ivory' if b.item['design']=='ivory-pads' else b.light,.01)
    if b.item['design']=='cat':b.icon('cat',(.20,-.263,1.258),.038)

def accessories(b):
    f=b.item['family'];b.part=f
    if f in ('watch','bracelet','wristband','ring'):
        b.bone='hand.R';x=.41;y=-.02;z=.755 if f!='ring' else .656
        if f=='ring':b.torus((x-.024,-.078,z),.018,.013,.003,'silver','XY');return
        b.torus((x,y,z),.070,.078,.009,b.base,'XY',24)
        if f=='watch':
            b.box((x,-.104,z),(.065,.024,.070),b.base,.006)
            b.box((x,-.120,z),(.050,.009,.052),'black')
            if b.item['design']=='digital':b.label('10:24',(x,-.126,z+.012),.045,'ivory')
            else:
                b.beam((x,-.127,z),(x,-.127,z+.019),.002,.002,'gold');b.beam((x,-.127,z),(x+.015,-.127,z-.010),.002,.002,'gold')
        elif f=='bracelet':
            for i in range(18):
                t=i*2*math.pi/18;b.sphere((x+.073*math.cos(t),y+.081*math.sin(t),z),(.009,.009,.009),'gold' if 'gold' in b.item['design'] and i%3==0 else 'ivory' if i%3==0 else b.base,8,5)
        else:b.icon('label',(x,-.11,z),.035)
    elif f in ('necklace','belt'):
        b.bone='neck' if f=='necklace' else 'hips'
        if f=='belt':
            b.rings([(.868,.427,.299,0,0),(.899,.427,.299,0,0)],b.base,cap=False)
            b.tube([(-.035,-.16,.871),(.035,-.16,.871),(.035,-.16,.905),(-.035,-.16,.905)],.006,'silver',True)
        else:
            for i in range(32):
                t=i*2*math.pi/32;b.torus((.143*math.cos(t),.127*math.sin(t),1.292-.124*max(0,-math.sin(t))),.009,.012,.002,b.base,steps=10)
            if b.item['design']=='smile':b.icon('smile',(0,-.155,1.137),.054)
    else:
        b.bone='hips';b.transform=Matrix.Translation((.238,-.162,.78));b.torus((0,0,.02),.018,.024,.003,'silver',steps=14)
        if f in ('carabiner','keyring'):b.torus((0,0,-.023),.022,.034,.004,b.base,steps=12)
        elif f=='pin':b.icon('star',(0,-.009,-.028),.07)
        elif b.item['design']=='tag':
            b.box((0,-.008,-.040),(.043,.012,.065),b.base,.004)
            b.torus((0,-.016,-.014),.006,.006,.0015,'silver',steps=12)
            for x in (-.009,.009):b.box((x,-.017,-.043),(.006,.003,.022),'black',.0005)
        else:b.icon(b.item['design'],(0,-.008,-.040),.069)
        b.transform=Matrix.Identity(4)

def book(b,x,y,z,color,flat=False):
    old=b.transform.copy();b.transform=old@Matrix.Translation((x,y,z))
    if flat:b.transform=b.transform@Matrix.Rotation(math.pi/2,4,'X')
    b.box((0,0,.13),(.18,.029,.26),'ivory')
    for sign in (-1,1):b.box((0,sign*.019,.13),(.194,.007,.274),color)
    b.box((-.094,0,.13),(.009,.043,.274),color)
    for i in range(7):b.box((.091,-.012+i*.004,.13),(.002,.001,.245),'tan',.0001)
    b.transform=old

def small_props(b):
    f=b.item['family'];design=b.item['design'];b.part='prop';b.bone='root'
    if f in ('books','planner','sketchbook'):
        if f=='books':
            for i,c in enumerate(('navy','red',b.base)):book(b,.004*i,0,.025+i*.042,c,True)
            if design=='plant':plant(b,0,0,.159)
        else:
            book(b,0,0,0,b.base)
            for i in range(12):b.torus((-.098,-.023,.022+i*.020),.011,.007,.002,'black',steps=12)
            b.label('PLAN' if f=='planner' else 'SKETCH',(0,-.025,.224),.135,'black')
            if f=='sketchbook':b.icon('bear',(0,-.026,.13),.105)
    elif f in ('laptop','tablet','phone','console'):
        if f=='laptop':
            b.box((0,0,.013),(.315,.227,.022),b.base,.005)
            b.box((0,.09,.132),(.31,.015,.218),b.base,.004,rotation=(-.13,0,0))
            b.box((0,.073,.134),(.28,.009,.184),'#283440',.003,rotation=(-.13,0,0))
            for row in range(5):
                for col in range(13):b.box((-.135+col*.022,-.001+row*.015,.026),(.017,.011,.003),'charcoal',.0004)
            b.box((0,-.071,.027),(.09,.052,.002),'silver')
            if design=='cat':b.icon('cat',(0,.064,.138),.07)
        else:
            w,h=(.20,.26) if f=='tablet' else (.077,.15) if f=='phone' else (.295,.136)
            b.box((0,0,h/2),(w,.014,h),'charcoal',.004)
            b.box((0,-.009,h/2),(w*.88,.003,h*.86),'#344451')
            if f=='console':
                for sign,col in ((-1,'blue'),(1,'red')):
                    b.box((sign*.126,-.004,h/2),(.051,.026,h),col,.01)
                    b.sphere((sign*.126,-.024,h*.67),(.010,.007,.01),'black')
                    for dx,dz in ((-.009,0),(.009,0),(0,-.009),(0,.009)):b.box((sign*.126+dx,-.023,h*.35+dz),(.005,.004,.005),'black')
    elif f=='plant':plant(b,0,0,0)
    elif f=='mug':
        b.cylinder((0,0,.049),.038,.092,b.base,r2=.043)
        b.cylinder((0,0,.097),.035,.003,'brown');b.torus((0,0,.099),.04,.04,.004,b.light,'XY')
        b.torus((.047,0,.056),.026,.032,.007,b.base)
        b.label('FUEL\nGOOD' if design=='fuel-good' else 'GOOD\nIDEAS',(0,-.041,.080),.061,'black')
    elif f=='bottle':
        b.cylinder((0,0,.11),.039,.20,b.base,r2=.037)
        b.cylinder((0,0,.219),.028,.021,b.light);b.cylinder((0,0,.238),.024,.025,'black')
        b.icon('cat',(0,-.039,.116),.041)
    elif f=='frame':
        b.box((0,0,.135),(.18,.023,.27),b.base,.004);b.box((0,-.014,.135),(.15,.005,.235),'ivory')
        b.label('WELL\nDONE' if design=='well-done' else 'GOOD\nDAYS',(0,-.019,.211),.13,'brown')
        b.beam((0,.011,.19),(0,.10,0),.022,.014,b.base)
    elif f=='camera':
        b.box((0,0,.062),(.16,.067,.114),b.base,.007)
        b.box((-.045,.003,.129),(.046,.036,.023),'charcoal')
        b.box((.04,0,.126),(.039,.036,.015),'silver')
        old=b.transform.copy();b.transform=Matrix.Translation((.012,-.039,.068))@Matrix.Rotation(math.pi/2,4,'X')
        b.cylinder((0,0,.017),.043,.044,'black');b.cylinder((0,0,.042),.037,.011,'gold' if design=='gold' else 'silver');b.cylinder((0,0,.049),.030,.003,'#1D3F4F');b.transform=old
        b.torus((.012,-.080,.068),.032,.032,.003,'gray')
    elif f in ('pouch','postits','penholder','pen'):
        if f=='pouch':
            b.box((0,0,.044),(.18,.075,.080),b.base,.01);b.icon('cat',(0,-.039,.043),.042)
            for i in range(20):b.box((-.080+i*.008,0,.087),(.003,.005,.003),'gold',.0002)
        elif f=='postits':
            for i,col in enumerate(('pink','purple','blue','green','yellow')):b.box((0,0,.005+i*.011),(.080,.08,.011),col)
        elif f=='pen':
            b.cylinder((0,0,.069),.005,.124,b.base,n=10);b.cylinder((0,0,.006),.0006,.012,'black',r2=.005,n=10);b.cylinder((0,0,.136),.006,.029,b.base,n=10)
            b.beam((.007,0,.145),(.007,0,.120),.002,.002,'silver')
        else:
            b.box((0,0,.044),(.065,.065,.088),b.base)
            for i,col in enumerate(('red','green','blue','yellow','pink')):b.cylinder((-.02+i*.01,(i%2)*.014-.007,.13),.004,.135,col,n=8)
    elif f=='lamp':
        b.box((0,0,.012),(.13,.10,.021),b.base,.004)
        b.beam((0,0,.025),(.025,.02,.20),.013,.013,b.base);b.beam((.025,.02,.20),(-.038,-.013,.31),.013,.013,b.base)
        b.sphere((.025,.02,.20),(.021,.016,.020),'silver')
        b.cylinder((-.038,-.013,.29),.050,.045,b.base,r2=.030)
        b.cylinder((-.038,-.013,.266),.041,.003,'ivory')
    elif f=='clock':
        b.box((0,0,.039),(.16,.05,.075),b.base,.006);b.box((0,-.028,.039),(.142,.005,.055),'#14241F')
        b.label('10:24',(0,-.033,.056),.125,'yellow')
    elif f in ('trophy','medal'):
        if f=='medal':
            b.tube([(-.035,0,.19),(0,.005,.30),(.035,0,.19),(0,-.015,.078)],.012,'red')
            b.torus((0,-.015,.069),.043,.043,.010,'gold');b.icon('star',(0,-.025,.069),.062)
        else:
            b.box((0,0,.023),(.135,.113,.04),'black');b.box((0,-.059,.023),(.081,.004,.024),'gold')
            b.cylinder((0,0,.070),.031,.062,'gold',r2=.019)
            if design=='star':b.icon('star',(0,0,.172),.17)
            else:
                b.cylinder((0,0,.156),.029,.105,'gold',r2=.080)
                b.cylinder((0,0,.209),.071,.005,'brown');b.torus((0,0,.212),.078,.078,.007,'gold','XY')
                for s in (-1,1):b.torus((s*.076,0,.164),.033,.041,.009,'gold',steps=16)
    elif f=='gamepad':
        b.box((0,0,.052),(.165,.039,.086),b.base,.016)
        for s in (-1,1):
            b.box((s*.067,0,.027),(.051,.045,.080),b.dark,.012,rotation=(0,-s*.25,0))
            b.sphere((s*.036,-.028,.057),(.013,.007,.013),'gray')
        for x,z in ((-.062,.078),(.058,.077),(.070,.066),(.046,.066),(.058,.054)):b.box((x,-.029,z),(.009,.004,.009),'ivory',.002)
    elif f in ('soccer','basketball'):
        b.sphere((0,0,.105),(.105,.105,.105),b.base,24,14)
        if f=='basketball':
            for angle in (0,math.pi/2):
                old=b.transform.copy();b.transform=Matrix.Rotation(angle,4,'Z');b.torus((0,0,.105),.106,.106,.002,'black',steps=32);b.transform=old
            b.torus((0,0,.105),.106,.106,.002,'black','XY',32)
        else:
            for i in range(12):
                t=i*2*math.pi/12;direction=Vector((math.cos(t),math.sin(t),.60 if i%2 else -.60)).normalized();p=Vector((0,0,.105))+direction*.107
                old=b.transform.copy();b.transform=Matrix.Translation(p)@(p-Vector((0,0,.105))).to_track_quat('Z','Y').to_matrix().to_4x4()
                b.cylinder((0,0,.001),.028,.002,'black',n=5);b.transform=old
    elif f=='keyboard':
        b.box((0,0,.035),(.42,.125,.063),b.base,.006)
        for i in range(24):b.box((-.196+i*.017,-.022,.069),(.016,.080,.010),'ivory')
        for i in range(23):
            if i%7 not in (2,6):b.box((-.188+i*.017,.004,.079),(.009,.045,.012),'black')
    elif f=='skateboard':
        b.box((0,0,.063),(.185,.59,.019),'tan',.008);b.box((0,0,.075),(.169,.564,.004),b.base,.005)
        for y in (-.188,.188):
            b.beam((-.097,y,.034),(.097,y,.034),.014,.014,'silver')
            for s in (-1,1):b.sphere((s*.096,y,.029),(.019,.028,.028),'ivory',12,8)
    elif f=='guitar':
        b.sphere((0,0,.20),(.145,.048,.185),b.base,16,12);b.sphere((0,0,.385),(.098,.041,.113),b.base,16,10)
        b.box((0,0,.630),(.052,.030,.43),'brown');b.box((0,-.020,.62),(.044,.008,.43),'charcoal')
        b.box((0,0,.869),(.076,.025,.104),b.base)
        b.torus((0,-.047,.327),.045,.045,.008,'brown');b.box((0,-.043,.165),(.086,.025,.018),'brown')
        for i in range(6):b.beam((-.017+i*.006,-.061,.175),(-.017+i*.006,-.036,.907),.0009,.0009,'silver')
        for i in range(15):b.box((0,-.027,.438+i*.024),(.047,.004,.002),'silver',.0002)
        for s in (-1,1):
            for z in (.84,.872,.904):b.box((s*.046,0,z),(.018,.021,.012),'silver')
    else:raise ValueError('Unimplemented family '+f)

def plant(b,x,y,z):
    b.cylinder((x,y,z+.042),.038,.081,'tan',r2=.048,n=12);b.cylinder((x,y,z+.083),.042,.003,'brown')
    for i in range(12):
        a=i*2.4;h=.10+(i%4)*.021;end=(x+.060*math.cos(a),y+.060*math.sin(a),z+h)
        b.beam((x,y,z+.072),end,.003,.003,'green')
        old=b.transform.copy();b.transform=old@Matrix.Translation(end)@Vector((math.cos(a)*.6,math.sin(a)*.6,1)).to_track_quat('Z','Y').to_matrix().to_4x4()
        b.sphere((0,0,.018),(.020,.007,.04),'green' if i%2 else 'olive',8,6);b.transform=old

def build_item(item):
    b=MeshBuilder(item);slot=item['slot'];f=item['family']
    if slot in ('top','outerwear'):tops(b)
    elif slot=='bottom':bottoms(b)
    elif slot=='shoes':footwear(b)
    elif slot in ('back','crossbody'):bags(b)
    elif slot=='headwear':hats(b)
    elif f=='glasses':eyewear(b)
    elif f=='headphones':headphones(b)
    elif slot=='prop':small_props(b)
    else:accessories(b)
    return b
