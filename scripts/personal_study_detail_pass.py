"""Room-specific second-read details and real textile relief for the study masters."""
import bpy,math,random
from mathutils import Vector
import personal_study_assets as A
from personal_study_assets import I,E

def camera_prop():
    A.b('Camera wrapped body',(0,0,.068),(.18,.075,.13),'graphite',.014)
    A.b('Camera grip',(.077,-.028,.072),(.04,.08,.12),'ink',.008)
    for r,d,y,m in [(.055,.032,-.05,'metal'),(.048,.06,-.077,'graphite'),(.039,.007,-.111,'glass_light')]:
        ob=A.c('Lens concentric barrel',(0,y,.07),r,d,m,24);ob.rotation_euler.x=math.pi/2
    for j in range(9):A.b('Lens knurled focus ring',(.05*math.cos(j*math.tau/9),-.089,.07+.05*math.sin(j*math.tau/9)),(.009,.02,.009),'graphite',.002)
    A.c('Camera shutter',(.055,-.0,.139),.015,.012,'gold',12)
def storage_box():
    A.b('Linen box',(0,0,.085),(.27,.23,.17),'fabric_ivory',.01);A.b('Lift-off box lid',(0,0,.18),(.286,.246,.027),'ivory',.005)
    A.b('Metal label rim',(0,-.122,.10),(.08,.007,.035),'gold',.003);A.b('Paper label',(0,-.127,.10),(.06,.002,.023),'paper',.001)
def jar():
    A.c('Ceramic apothecary jar',(0,0,.11),.065,.22,'ivory',16);A.c('Jar cork lid',(0,0,.225),.067,.027,'oak',16)
    A.b('Coffee label',(0,-.064,.12),(.079,.004,.075),'graphite',.001)
    for j in range(3):A.b('Jar label lettering',(0,-.068,.137-j*.017),(.044,.001,.003),'ivory',0)
def clock():
    A.b('Clock walnut surround',(0,0,.065),(.21,.075,.13),'oak',.009);A.b('Clock inset face',(0,-.040,.065),(.18,.006,.102),'graphite',.002)
    A.K.text('Clock display','10:24',(0,-.045,.070),.044,'ivory','STUDY_OBJECTS',(math.pi/2,0,0))
def keyboard():
    A.b('Keyboard chassis',(0,0,.016),(.45,.16,.032),'graphite',.007)
    rows=[('1234567890-=',.052,-.173),('QWERTYUIOP',.022,-.161),('ASDFGHJKL',-.008,-.148),('ZXCVBNM',-.038,-.133)]
    for letters,y,start in rows:
        for j,label in enumerate(letters):
            x=start+j*.029
            A.b('Sculpted alphanumeric keycap',(x,y,.039),(.026,.025,.014),'ivory',.0025)
            A.K.text('Key legend '+label,label,(x,y-.002,.0463),.007,'graphite','STUDY_OBJECTS')
    for label,x,y,w in [('ESC',-.204,.052,.025),('TAB',-.199,.022,.038),('CAPS',-.191,-.008,.048),('SHIFT',-.185,-.038,.061),('ENTER',.176,-.008,.068),('DEL',.200,.052,.028)]:
        A.b('Modifier key '+label,(x,y,.039),(w,.025,.014),'metal',.0025)
        A.K.text('Modifier legend '+label,label,(x,y-.002,.0463),.0045,'ivory','STUDY_OBJECTS')
    A.b('Long keyboard spacebar',(-.015,-.067,.039),(.17,.020,.014),'ivory',.003)
    for x in (-.189,-.153,-.117,.106,.142,.178,.207):
        A.b('Bottom modifier key',(x,-.067,.039),(.026,.020,.014),'metal',.0025)
    for j in range(3):A.b('Keyboard status light',(.146+j*.012,.052,.034),(.006,.004,.002),'led_blue',.001)
def blanket():
    # A thick folded blanket with modelled warp, stripes and irregular tied fringe.
    A.b('Folded woven blanket',(0,0,.053),(.58,.45,.105),'fabric_ivory',.018)
    for row in range(34):
        x=-.276+row*.0165;A.line('Wool warp',[(x,-.217,.087),(x,0,.116),(x,.217,.088)],.006,'rug_cream')
    for row in range(24):
        y=-.21+row*.018;A.line('Wool weft',[(-.28,y,.089),(0,y,.12),(.28,y,.089)],.004,'fabric_ivory' if row%8<5 else 'fabric_sage')
    for j in range(24):A.line('Blanket tied fringe',[(-.26+j*.022,-.221,.070),(-.26+j*.022,-.27,.04),(-.253+j*.022,-.29,.03)],.005,'rug_cream')
def textile_relief(P):
    for ob in list(bpy.context.scene.objects):
        if ob.type!='MESH' or len(ob.data.vertices)!=8 or not ob.data.materials:continue
        key=ob.data.materials[0].name
        if not key.startswith('MAT_FABRIC_') or 'SEAM' in key:continue
        dims=ob.dimensions
        if max(dims)<.23 or min(dims)<.075:continue
        vs=[];fs=[]
        for face in ob.data.polygons:
            if len(face.vertices)!=4:continue
            pts=[ob.data.vertices[i].co.copy() for i in face.vertices];u=pts[1]-pts[0];v=pts[3]-pts[0];normal=u.cross(v).normalized();uw=u.length;vh=v.length
            margin=min(.065,uw*.24,vh*.24);cols=max(2,int((uw-2*margin)/.022));rows=max(2,int((vh-2*margin)/.022))
            for row in range(rows):
                for col in range(cols):
                    center=pts[0]+u*(margin/uw+(col+.5)/cols*(1-2*margin/uw))+v*(margin/vh+(row+.5)/rows*(1-2*margin/vh))+normal*.0018
                    uu=u.normalized()*.0084;vv=v.normalized()*.0084;k=len(vs)
                    vs.extend([center-uu-vv,center+uu-vv,center+uu+normal*.0035,center+uu+vv,center-uu+vv,center-uu+normal*.0035]);fs.extend([(k,k+1,k+2,k+5),(k+5,k+2,k+3,k+4)])
        if not vs:continue
        mesh=bpy.data.meshes.new(ob.name+' woven textile geometry');mesh.from_pydata(vs,[],fs);mesh.materials.append(ob.data.materials[0]);n=bpy.data.objects.new(ob.name+' individual cloth stitches',mesh);P.K.link(n,'TEXTILES',ob)
        if 'placeable_owner' in ob:n['placeable_owner']=ob['placeable_owner']
def apply(P):
    K=P.K;W,D=P.DIMS[P.ROOM];own=P.own;pot=P.pot;lamp=P.lamp;b=P.b;line=P.line
    for key,col in [('roof_mid','#35654D'),('roof_dark','#315B47'),('knit_ivory','#DCC7A2')]:K.material(key,col,.79)
    # Light leaks through a thin cloth shade; practical lights remain editable.
    mat=K.material('lamp_fabric','#F4D5A1',.78);p=mat.node_tree.nodes['Principled BSDF'];p.inputs['Emission Color'].default_value=(1,.50,.16,1);p.inputs['Emission Strength'].default_value=.24;p.inputs['Subsurface Weight'].default_value=.3
    for ob in bpy.context.scene.objects:
        if ob.type=='MESH' and 'fabric shade' in ob.name.lower():ob.data.materials.clear();ob.data.materials.append(mat)
    room=P.ROOM
    def niche(p,r=.23):
        bpy.context.view_layer.update()
        for name in [ob.name for ob in bpy.context.scene.objects if ob.type=='EMPTY']:
            ob=bpy.data.objects.get(name)
            if not ob:continue
            if ob.type!='EMPTY' or not ob.name.startswith('Individually bound library volume'):continue
            q=ob.matrix_world.translation
            if abs(q.z-p[2])<.08 and math.hypot(q.x-p[0],q.y-p[1])<r:
                for child in list(ob.children_recursive):bpy.data.objects.remove(child,do_unlink=True)
                bpy.data.objects.remove(ob,do_unlink=True)
    if room=='library':
        # Display furniture and foliage are grounded, with broad leaves kept off the desk.
        p=(-1.83,.35,1.46);niche(p,.27);globe=own('Reading globe','globe',lambda:I.globe(K,'Brass meridian globe',(0,0,0)),p,math.pi/2);globe.scale*=.65
        for j,p in enumerate([(-1.74,-.60,1.03),(-1.74,.93,1.89),(.44,1.46,1.03)]):niche(p);pot('Library bay fern '+str(j),p,.6,'fern')
        own('Desk folded textile','blankets',blanket,(-.99,-.58,.56))
        # A few genuinely different display subjects, not identical framed rectangles.
        p=(-.63,1.44,1.46);niche(p);own('Shelf vintage camera','camera',camera_prop,p)
        p=(.81,1.42,.61);niche(p);own('Shelf letter archive','storage-boxes',storage_box,p)
        for x in (-.85,.02,.92):b('Cabinet fluted lower moulding',(x,1.39,.13),(.76,.028,.028),'oak',.002)
    elif room=='terrace':
        # Terrace glass is held by proper rails; the city has an architectural surround.
        for j in range(5):
            x=-W/2+(j+.5)*W/5;b('Rear safety glass',(x,D/2-.026,.85),(W/5-.065,.015,.67),'glass_light',.002)
        for j in range(4):
            y=-D/2+(j+.5)*D/4;b('Side safety glass',(-W/2+.026,y,.85),(.015,D/4-.065,.67),'glass_light',.002)
        for j,(x,y,z) in enumerate([(-2.08,.62,2.5),(.89,1.69,2.5),(-1.02,1.6,1.2)]):
            P.vines('Terrace climbing branch '+str(j),[(x,y,z),(x+.06,y-.05,z-.45),(x-.1,y-.1,z-.90)],211+j)
        pot('Terrace border tall fern',(-1.90,1.50,.45),1.18,'monstera')
        pot('Terrace layered fern',(.60,1.49,.44),.90,'monstera')
        own('Outdoor cushion throw','blankets',blanket,(-1.39,.05,.57))
        # Framed rear panel is an intentional distant view, not a floating poster.
        for x in (-W/2,W/2):b('Skyline outer frame',(x,D/2+.06,1.81),(.07,.10,2.78),'graphite',.005)
        b('Skyline top frame',(0,D/2+.06,3.21),(W+.08,.1,.07),'graphite',.005)
    elif room=='pergola':
        for j in range(8):
            x=-1.77+j*.50
            P.vines('Garden rear screen '+str(j),[(x,1.82,2.80),(x-.10,1.81,2.20),(x+.11,1.73,1.6),(x,1.73,1.05)],120+j)
        for j in range(6):
            y=-1.5+j*.58;P.vines('Garden left screen '+str(j),[(-2.0,y,2.73),(-1.94,y+.12,2.15),(-1.93,y,1.65)],138+j)
        for j,p in enumerate([(-1.44,1.18,.45),(1.72,1.45,.45),(-1.70,-1.46,.44)]):pot('Garden specimen fern '+str(j),p,1.1,'monstera')
        for ob in list(bpy.context.scene.objects):
            if ob.type=='EMPTY' and ob.get('definition_id')=='ambient-lantern' and ob.location.z>2:ob.location.z-=.40;ob.scale*=1.3
        b('Garden bench storage base',(-.45,1.09,.26),(1.80,.61,.44),'woodlight',.008)
        for x in (-1.01,-.45,.11):b('Bench wicker drawer',(x,.766,.28),(.53,.025,.30),'oak',.006)
        own('Garden relaxed throw','blankets',blanket,(-.86,1.04,.60))
    elif room=='cafe':
        # A filled service station, and separate shelves in the rear corner.
        for z in (1.58,2.02,2.43):
            b('Cafe corner service shelf',(-.79,D/2-.20,z),(.87,.31,.044),'woodlight',.004)
            for j in range(3):own('Coffee archive jar '+str(z)+'-'+str(j),'coffee-jar',jar,(-1.04+j*.24,D/2-.23,z+.026))
        pot('Cafe corner fern',(-1.01,1.59,.87),.68,'fern')
        pot('Cafe top foliage',(-.78,1.63,2.47),.55,'fern')
        own('Fresh pastry plate','pastry-tray',lambda:(A.c('Plate',(0,0,.01),.095,.02,'ivory',24),A.b('Layered cake square',(0,0,.061),(.10,.09,.09),'woodlight',.008),A.b('Cream topping',(0,0,.111),(.10,.09,.017),'ivory',.007)),(-.08,-.18,.81))
        b('Banquette panelled base',(-.32,1.08,.27),(1.92,.65,.43),'woodlight',.008)
        for x in (-.88,-.32,.24):b('Banquette inset field',(x,.742,.28),(.53,.025,.31),'oak_end',.004)
        own('Cafe clock','clock',clock,(-.78,1.40,1.05))
    elif room=='minimal':
        for j,(x,y,z) in enumerate([(-1.74,.05,1.5),(-1.74,.6,1.93),(-1.74,1.05,2.32)]):
            own('Minimal shelf books '+str(j),'books',A.book_stack,(x,y-.21,z+.03),math.pi/2,count=2)
            line('Shelf underlighting',[(x+.235,y-.39,z-.025),(x+.235,y+.39,z-.025)],.009,'lamp_glow')
        own('Shelf photography camera','camera',camera_prop,(-1.63,.81,1.963),math.pi/2)
        own('Minimal desk clock','digital-clock',clock,(-1.28,-.87,.813),math.pi/2)
        own('Minimal desk organizer','storage-boxes',storage_box,(.46,1.43,.818))
        own('Pegboard headphones','headphones',A.headphones,(.78,D/2-.28,1.76))
        for i in range(3):
            b('Pinned planning sheet',(.24+i*.32,D/2-.207,1.47),(.20,.007,.27),'paper',.002)
            for j in range(7):b('Planning sheet lines',(.24+i*.32,D/2-.213,1.53-j*.024),(.145,.001,.0015),'screen_ink',0)
        for j in range(2):own('Minimal ceramic vessel '+str(j),'coffee-jar',jar,(-1.69,.18+j*.21,1.53))
        pot('Minimal snake fern',(1.60,1.04,.04),1.1,'monstera')
        ob=bpy.data.objects.get('ivory-lounge-pouf')
        if ob:ob.scale=(1,1,1.36)
    elif room=='tech':
        # Keep the whole L workstation continuous and equipped.
        for j,(y,z) in enumerate([(-.65,1.43),(.20,1.95),(.86,2.37)]):
            b('Tech floating shelf',(-1.88,y,z),(.39,.86,.05),'graphite',.005)
            own('Tech shelf folios '+str(j),'books',A.book_stack,(-1.83,y-.13,z+.026),math.pi/2,count=2)
            pot('Tech shelf fern '+str(j),(-1.84,y+.22,z+.026),.5,'fern')
        own('Tech camera','camera',camera_prop,(-1.82,-.46,1.46),math.pi/2)
        own('Dedicated mechanical keyboard','keyboard',keyboard,(.12,1.04,.803))
        own('Tech working tablet','tablet',A.laptop,(-1.46,.10,.803),math.pi/2)
        # A narrow side credenza and cloth storage boxes match the reference cabinetry.
        cred=own('tech-right-credenza','cube-storage',A.cabinet,(1.66,-.55,.04),w=.60,h=.59)
        own('Tech archived notes','storage-boxes',storage_box,(0,0,.66),parent=cred)
        pot('Credenza foliage',(1.64,-.54,.87),.44,'square')
        for x in (-1.78,1.88):line('Desk apron LED',[(x,.88,.74),(x,1.73,.74)],.008,'led_blue')
        for y in (-1.23,.86):line('Return apron LED',[(-1.82,y,.77),(-1.2,y,.77)],.008,'led_blue')
        own('Desk technology headphones','headphones',A.headphones,(-1.88,-.24,1.38),math.pi/2)
        b('Underdesk equipment cabinet',(.86,1.58,.35),(1.12,.26,.50),'graphite',.010)
        for j in range(3):
            b('Rack module',(.86,1.44,.18+j*.14),(1.01,.028,.112),'metal',.004)
            for q in range(7):b('Module status light',(.51+q*.075,1.423,.20+j*.14),(.027,.004,.009),'led_blue',.001)
    elif room=='pavilion':
        for j,p in enumerate([(-1.80,-1.23,.46),(1.80,-1.23,.46),(-1.83,1.42,.40),(1.76,1.39,.4)]):pot('Pavilion mature fern '+str(j),p,.95,'monstera')
        for x in (-1.56,1.56):
            P.vines('Pavilion trailing ivy '+str(x),[(x,1.72,2.8),(x+.08,1.65,2.22),(x-.09,1.6,1.70)],231+int(x*10))
        for ob in list(bpy.context.scene.objects):
            if ob.type=='EMPTY' and ob.get('definition_id')=='ambient-lantern' and ob.location.z>2:ob.location.z-=.42;ob.scale*=1.25
        own('Pavilion reading blanket','blankets',blanket,(-1.08,1.0,.60))
        b('Pavilion bench storage',(-.65,1.0,.24),(1.79,.59,.40),'oak',.008)
        P.picture('Pavilion botanical sign','Quiet\nplaces.\nBrighter\nideas.',(1.76,.59,1.40),.49,.78)
    elif room=='loft':
        # Complete the low window bench and adapted right cabinetry.
        b('Window seat cabinet',(.12,1.17,.25),(1.69,.60,.43),'woodlight',.008)
        for x in (-.43,.13,.69):
            b('Window seat drawer',(x,.85,.27),(.525,.030,.29),'oak_end',.006)
            line('Window drawer handle',[(x-.064,.826,.32),(x+.064,.826,.32)],.006,'gold')
        own('Window seat folded throw','blankets',blanket,(.35,1.04,.60))
        own('Loft adapted right cabinet','bookshelf-medium',P.bookcase,(1.63,1.39,.03),w=.73,h=1.14,cols=1,seed=15)
        pot('Loft right cabinet fern',(1.64,1.37,1.28),.65,'fern')
        own('Loft cubby archive','storage-boxes',storage_box,(1.73,1.25,.62))
        own('Burgundy puff throw','blankets',blanket,(1.41,-1.06,.46))
        lamp('Loft left reading lamp',(-1.72,-.70,1.07),'pleated',.7)
        for j,p in enumerate([(-1.80,.51,2.34),(-1.81,-1.01,1.49),(1.65,1.43,1.14)]):
            pot('Loft varied fern '+str(j),p,.62,'fern')
            P.vines('Loft trailing foliage '+str(j),[p,(p[0]+.08,p[1]-.12,p[2]-.31),(p[0]-.10,p[1]-.13,p[2]-.6)],250+j)
    textile_relief(P)
