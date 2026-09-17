"""Five designed sibling environments; retain all Cozy furniture and detail."""
import math
import random
import bpy
from mathutils import Matrix,Vector
from build_harper import rgba,look_at

THEMES={
 'minimalista':{'name':'Minimalista','wall':'#E4E4DE','wall_shadow':'#C9CDC9','oak':'#ACAC9C','oak_light':'#D8D1BF','oak_dark':'#6D716A','floor':'#CCC7B6','floor_light':'#DED9CC','floor_dark':'#AEA897','pink':'#73828D','pink_light':'#9DA7AB','pink_dark':'#52616B','sage':'#777F76','sage_light':'#B5BAAC','textile_rose':'#818B96','textile_sage':'#9CA79D','textile_rose_shadow':'#697681','textile_sage_shadow':'#7C887F','rug_rose':'#A5A9A5','rug_oat':'#AAA89B','rug_cream':'#D2D0C1','bag_canvas':'#667782','bag_panel':'#54636D'},
 'tecnologia':{'name':'Tecnología','wall':'#424053','wall_shadow':'#333443','trim':'#5D5B70','oak':'#373644','oak_light':'#646174','oak_dark':'#272632','floor':'#66636B','floor_light':'#797680','floor_dark':'#514D59','pink':'#6A6691','pink_light':'#8A84AA','pink_dark':'#49445F','sage':'#526780','sage_light':'#8B9FA8','linen':'#C0BBCB','linen_shadow':'#777282','textile_ivory':'#9E9AAE','textile_rose':'#544D7D','textile_sage':'#71718C','textile_rose_shadow':'#3D375D','textile_sage_shadow':'#4A5068','rug_rose':'#6A5C8A','rug_oat':'#4C4661','rug_cream':'#8F86A6','bag_canvas':'#4B4767','bag_panel':'#36334E','cream':'#B0AABE','paper':'#D7D1DB'},
 'naturaleza':{'name':'Naturaleza','wall':'#E7DDC9','wall_shadow':'#D1C4A6','oak':'#A28250','oak_light':'#C3A46F','oak_dark':'#725B3A','floor':'#C0A377','floor_light':'#D3BB91','floor_dark':'#A58B62','pink':'#78866A','pink_light':'#A9B499','pink_dark':'#57654B','sage':'#626F4B','sage_light':'#A5AD82','textile_rose':'#7E8E66','textile_sage':'#9AAA78','textile_rose_shadow':'#5C704B','textile_sage_shadow':'#788964','rug_rose':'#B09C6F','rug_oat':'#A18A60','rug_cream':'#CEBE96','bag_canvas':'#788265','bag_panel':'#5B654B'},
 'urbano':{'name':'Urbano','wall':'#777278','wall_shadow':'#605B5F','trim':'#9A9291','oak':'#62504A','oak_light':'#927467','oak_dark':'#392F30','floor':'#9B8F83','floor_light':'#B5A89B','floor_dark':'#7E726C','pink':'#AC414D','pink_light':'#CA6870','pink_dark':'#712D38','sage':'#5F6B62','sage_light':'#9CA497','textile_rose':'#AF4050','textile_sage':'#646668','textile_rose_shadow':'#802B38','textile_sage_shadow':'#474B50','rug_rose':'#985160','rug_oat':'#5B5658','rug_cream':'#ACA09A','bag_canvas':'#853F48','bag_panel':'#5B3037'},
 'biblioteca-moderna':{'name':'Biblioteca moderna','wall':'#E1D1AD','wall_shadow':'#C9B68E','oak':'#8B5A35','oak_light':'#B78750','oak_dark':'#593E29','floor':'#B59361','floor_light':'#CBAA77','floor_dark':'#947245','pink':'#797D59','pink_light':'#ADA985','pink_dark':'#565A3F','sage':'#4E654A','sage_light':'#8D9A72','textile_rose':'#657955','textile_sage':'#8B986A','textile_rose_shadow':'#44583C','textile_sage_shadow':'#67774F','rug_rose':'#B69A63','rug_oat':'#9F8055','rug_cream':'#D6BE90','bag_canvas':'#826649','bag_panel':'#594833'},
}


def recolor(theme):
    for key,color in THEMES[theme].items():
        if key=='name':continue
        mat=bpy.data.materials.get('MAT_'+key.upper())
        if mat and mat.use_nodes:
            mat.diffuse_color=rgba(color)
            bs=mat.node_tree.nodes.get('Principled BSDF')
            if bs:bs.inputs['Base Color'].default_value=rgba(color)
    # The plush is the same companion's keepsake across all rooms.
    for mat in bpy.data.materials:
        if not mat.use_nodes:continue
        bs=mat.node_tree.nodes.get('Principled BSDF')
        if bs and mat.name.startswith('MAT_GOLD'):
            bs.inputs['Metallic'].default_value=.78;bs.inputs['Roughness'].default_value=.30


def roots(prefix):
    return [o for o in bpy.context.scene.objects if o.name.startswith(prefix) and not(o.parent and o.parent.name.startswith(prefix))]


def shift(prefix,delta):
    for o in roots(prefix):o.location+=Vector(delta)


def clone_tree(k,source_name,name,origin,destination,scale=1):
    original=bpy.data.objects[source_name]
    group=k.group(name,(0,0,0),collection='THEME_BOTANICALS')
    group.matrix_world=Matrix.Translation(destination)@Matrix.Scale(scale,4)@Matrix.Translation(-Vector(origin))
    def copy(old,parent):
        new=old.copy()
        if old.data is not None:new.data=old.data.copy()
        new.name=name+'_'+old.name
        k.link(new,'THEME_BOTANICALS',parent)
        new.matrix_parent_inverse=old.matrix_parent_inverse.copy()
        for child in old.children:copy(child,new)
    copy(original,group)
    return group


def glow(k,key,color,strength=3):
    mat=k.material(key,color,.3)
    bs=mat.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Emission Color'].default_value=rgba(color);bs.inputs['Emission Strength'].default_value=strength
    return mat


def lamp(k,name,loc,energy,color,size=.20,target=None):
    data=bpy.data.lights.new(name,'AREA' if target else 'POINT');data.energy=energy;data.color=color
    if target:data.size=size
    else:data.shadow_soft_size=size
    obj=bpy.data.objects.new(name,data);k.link(obj,'LIGHTING');obj.location=loc
    if target:look_at(obj,target)
    return obj


def poster_text(body):
    changes={'Premium_Wall_QuietTitle':body[0],'Premium_Wall_ConstellationTitle':body[1],'Premium_Wall_BotanicalTitle':body[2]}
    for name,title in changes.items():
        obj=bpy.data.objects.get(name)
        if obj:obj.data.body=title


def standing_lamp(k,loc,key='gold',shade='cream',name='Theme_ReadingLamp'):
    x,y,z=loc;c='THEME_FURNITURE'
    k.cylinder(name+'_Foot',(x,y,z+.025),.16,.05,'oak_dark',c,24)
    k.cylinder(name+'_Stem',(x,y,z+.66),.016,1.28,key,c,16)
    k.tube(name+'_Arm',[(x,y,z+1.29),(x+.14,y,z+1.38),(x+.31,y,z+1.30)],.014,key,c)
    k.cylinder(name+'_Shade',(x+.30,y,z+1.24),.14,.15,shade,c,32,radius_top=.085)
    warm=glow(k,name+'_Emitter','#FFE3AD',2)
    k.cylinder(name+'_Bulb',(x+.30,y,z+1.16),.08,.012,warm,c,24)
    lamp(k,name+'_Light',(x+.30,y,z+1.145),13,(1,.77,.48),.12,(x+.3,y,z+.45))


def roman_blind(k,theme):
    c='THEME_ARCHITECTURE'
    k.box('Theme_RomanBlind_Pelmet',(-1.71,2.255,2.84),(1.53,.11,.15),'oak_light',c,.015)
    for i in range(6):
        z=2.74-i*.07
        k.box('Theme_RomanBlind_Fold',(-1.71,2.295,z),(1.42,.09,.078),'linen' if theme=='minimalista' else 'oak_light',c,.012)
    for x in (-2.27,-1.15):
        k.tube('Theme_RomanBlind_Cord',[(x,2.228,2.77),(x,2.228,2.345)],.004,'thread',c)
        k.sphere('Theme_RomanBlind_Pull',(x,2.228,2.332),(.013,.013,.024),'oak_dark',c,10,6)


def minimalista(k):
    poster_text(('UN PASO A LA VEZ','ESPACIO PARA PENSAR','HACER LUGAR'))
    roman_blind(k,'minimalista');c='THEME_FURNITURE'
    # A fluted architectural dado behind the existing artwork and shelf.
    for i in range(33):
        y=-2.27+i*.139
        k.box('MIN_LeftWall_OakFlute',(-2.943,y,1.86),(.030,.066,2.33),'oak_light','THEME_ARCHITECTURE',.012)
    # Raised artwork remains in front of the shallow flutes.
    shift('Premium_Wall_',(.028,0,0))
    standing_lamp(k,(3.75,.45,.18),'metal','linen','MIN_ArchitectLamp')
    # A detailed low filing cabinet and trays establish clean, deliberate organization.
    k.box('MIN_FilingCabinet',(3.51,-.30,.485),(1.02,.56,.59),'linen',c,.023)
    k.box('MIN_FilingCabinet_Top',(3.51,-.30,.80),(1.05,.60,.06),'oak_light',c,.011)
    for i in range(3):
        x=3.19+i*.32
        k.box('MIN_FilingDrawer',(x,-.59,.50),(.289,.025,.49),'linen',c,.009)
        k.box('MIN_DrawerRecess',(x,-.607,.651),(.12,.008,.023),'ink',c,.004)
        k.box('MIN_DrawerLabel',(x,-.612,.528),(.124,.003,.038),'paper',c,.002)
    for i in range(3):
        x=3.16+i*.2
        k.box('MIN_ArchiveMagazine',(x,-.22,1.0),(.14,.28,.35),'sage' if i%2 else 'linen_shadow',c,.006)
        for j in range(4):
            k.box('MIN_ArchiveSpine',(x-.04+j*.023,-.365,1.03),(.018,.009,.275),'paper',c,.001)
        k.cylinder('MIN_ArchivePull',(x,-.382,.93),.015,.007,'metal',c,16).rotation_euler.x=math.pi/2
    k.book('MIN_ClosedJournal',(3.72,-.38,.834),.027,.26,.18,'ink',collection=c,flat=True)
    return ['Ash fluted wall','Layered Roman shade','Three-drawer filing cabinet','Magazine archives','Architect reading lamp']


def tecnologia(k):
    poster_text(('CREAR. PROBAR. APRENDER.','IDEAS EN ÓRBITA','CURIOSIDAD ENCENDIDA'))
    c='THEME_TECH';blue=glow(k,'tech_blue','#7C9BFF',4);violet=glow(k,'tech_violet','#AD77FF',4)
    # Preserve the original complete study screen; side displays augment it.
    for side,x in enumerate((.405,1.988)):
        g=k.group('TECH_SideDisplay_'+str(side),(x,2.10,1.46),(0,0,-.16 if side else .16),c)
        k.box('TECH_Display_Case',(0,0,.16),(.38,.073,.65),'ink',c,.013,parent=g)
        k.box('TECH_Display_Glass',(0,-.040,.16),(.338,.008,.601),'dusk',c,.004,parent=g)
        for i in range(12):
            z=.42-i*.045
            k.box('TECH_CodeNumber',(-.14,-.046,z),(.017,.002,.005),blue,c,.0003,parent=g)
            for j in range(3):
                k.box('TECH_CodeToken',(-.094+j*.075,-.046,z),(.038+(i+j)%3*.01,.002,.007),(blue,violet,'sage_light')[(i+j)%3],c,.0004,parent=g)
        k.tube('TECH_Display_MonitorArm',[(0,.024,.0),(0,.14,-.12),((.2 if side==0 else -.2),.14,-.34)],.017,'metal',c,parent=g)
    shift('STUDY_Lamp',(0,.24,0));shift('Desk_LampBase',(0,.24,0))
    # Real PC internals, fans, ports and cooling, visible from the front corner.
    pc=k.group('TECH_ComputerTower',(2.68,2.02,.18),collection=c)
    for x in (-.137,.137):k.box('TECH_PC_Side',(x,0,.38),(.02,.47,.74),'ink',c,.007,parent=pc)
    for z in (.02,.75):k.box('TECH_PC_Cap',(0,0,z),(.29,.48,.029),'metal',c,.005,parent=pc)
    k.box('TECH_PC_Back',(0,.224,.38),(.27,.019,.72),'ink',c,.005,parent=pc)
    for z in (.19,.40,.61):
        k.cylinder('TECH_PC_FanDisk',(0,-.224,z),.089,.022,'black',c,32,parent=pc).rotation_euler.x=math.pi/2
        k.tube('TECH_PC_FanLED',[(.09*math.cos(a),-.239,z+.09*math.sin(a)) for a in [i*math.tau/40 for i in range(40)]],.006,blue,c,True,pc)
        for i in range(7):
            a=i*math.tau/7
            k.box('TECH_PC_FanBlade',(.038*math.cos(a),-.243,z+.038*math.sin(a)),(.073,.004,.025),'metal',c,.004,(0,-a,0),pc)
    for i in range(3):
        k.box('TECH_PC_USBPort',(-.081+i*.049,-.240,.709),(.027,.008,.012),'black',c,.001,parent=pc)
    k.box('TECH_PC_InternalBoard',(.119,0,.4),(.01,.35,.48),'sage',c,.002,parent=pc)
    for i in range(8):k.box('TECH_PC_InternalChip',(.108,-.14+(i%2)*.18,.21+(i//2)*.11),(.016,.071,.045),'metal',c,.002,parent=pc)
    for i in range(4):k.tube('TECH_PC_Cable',[(.09,.13,.55-i*.025),(.04,.05,.48-i*.025),(.09,-.12,.3-i*.015)],.004,('black','sage','metal','black')[i],c,parent=pc)
    # Under-shelf LEDs with actual local light rather than an overall purple wash.
    for name,x,y,z,length in [('Desk',.58,2.40,2.278,2.22),('Library',3.50,1.89,2.615,1.17)]:
        k.box('TECH_LED_Channel_'+name,(x,y,z),(length,.047,.024),'metal',c,.004)
        k.box('TECH_LED_Diffuser_'+name,(x,y-.018,z-.014),(length-.04,.016,.013),blue,c,.003)
        lamp(k,'TECH_LED_RealLight_'+name,(x,y-.12,z-.06),13,(.34,.35,1),.65,(x,y-.1,z-.85))
    k.tube('TECH_BackWall_LED',[(-.57,2.43,2.97),(2.79,2.43,2.97),(2.79,2.43,1.00)],.012,violet,c)
    for i in range(12):
        yy=-1.75+(i%4)*.22;z=1.56+(i//4)*.27
        k.box('TECH_AcousticTile',(-2.927,yy,z),(.062,.20,.25),'ink' if i%2 else 'metal',c,.025)
    # Small robotics kit on a new low display console in the reading zone.
    k.box('TECH_RoboticsConsole',(3.54,-.25,.57),(.94,.52,.08),'oak_light',c,.016)
    for x in (3.16,3.92):k.box('TECH_ConsoleLeg',(x,-.25,.365),(.04,.43,.36),'metal',c,.006)
    k.box('TECH_RobotBase',(3.49,-.25,.65),(.28,.23,.085),'paper',c,.02)
    for x in (3.33,3.65):
        k.cylinder('TECH_RobotWheel',(x,-.25,.65),.084,.044,'ink',c,24).rotation_euler.y=math.pi/2
    k.box('TECH_RobotHead',(3.49,-.245,.79),(.2,.17,.14),'linen',c,.02)
    for x in (3.445,3.535):k.sphere('TECH_RobotEye',(x,-.338,.8),(.021,.009,.027),blue,c,12,8)
    # Twilight is local to this theme.
    for name,power in [('Light_WindowSoft',180),('Light_LateAfternoon',.23),('Light_SoftFrontFill',820),('Light_UpperBounce',110)]:bpy.data.objects[name].data.energy=power
    bpy.data.objects['Light_SoftFrontFill'].data.color=(.71,.77,1)
    for mat in bpy.data.materials:
        if mat.name.startswith('MAT_EXTERIOR_UNLIT_'):
            for node in mat.node_tree.nodes:
                if node.type=='EMISSION':node.inputs['Strength'].default_value=.20
    return ['Three-screen study station','PC with three lit fans, internal board and ports','Under-shelf light channels','Acoustic tiles','Robotics display console']


def naturaleza(k):
    poster_text(('OBSERVAR Y APRENDER','EXPLORAR CON CALMA','TODOS LOS DÍAS CRECER'))
    roman_blind(k,'naturaleza');c='THEME_NATURE'
    # Slatted timber wall with lattice joinery behind the long floating shelf.
    for i in range(15):
        k.box('NAT_LeftWall_LatticeVertical',(-2.95,-1.94+i*.286,2.15),(.025,.019,1.62),'oak',c,.005)
    for i in range(7):k.box('NAT_LeftWall_LatticeHorizontal',(-2.926,.06,1.40+i*.241),(.022,4.05,.018),'oak',c,.004)
    # Existing foliage geometry is instanced into individually editable botanical groups.
    clone_tree(k,'PRM_BOT_LeftShelfIvyA','NAT_HangingFern',(-2.73,.83,2.63),(-2.73,-1.85,2.55),.89)
    clone_tree(k,'PRM_BOT_MainShelfPothos','NAT_HangingPothos',(-.35,2.25,2.415),(2.67,2.26,2.47),.92)
    for name,loc in [('Left',(-2.73,-1.85,2.55)),('Back',(2.67,2.26,2.47))]:
        x,y,z=loc
        for j in range(4):
            a=j*math.tau/4
            k.tube('NAT_Macrame_'+name,[(x,y,3.05),(x+.16*math.cos(a),y+.16*math.sin(a),z+.04),(x,y,z-.06)],.004,'thread',c)
        k.tube('NAT_MacrameRing_'+name,[(x+.024*math.cos(a),y,3.06+.024*math.sin(a)) for a in [i*math.tau/20 for i in range(20)]],.006,'oak',c,True)
    # Small potting / specimen workbench, distinct from the digital study desk.
    k.box('NAT_PottingBench_Top',(3.53,-.14,.91),(1.04,.59,.07),'oak_light',c,.012)
    k.box('NAT_PottingBench_LowerShelf',(3.53,-.14,.38),(1.0,.54,.045),'oak',c,.006)
    for x in (3.08,3.98):
        for y in (-.37,.09):k.box('NAT_PottingBench_Leg',(x,y,.53),(.047,.047,.70),'oak',c,.007)
    # Seed trays with separated soil wells and growth markers.
    for i in range(6):
        x=3.17+(i%3)*.13;y=-.28+(i//3)*.14
        k.box('NAT_SeedTray',(x,y,.968),(.116,.126,.055),'terracotta',c,.007)
        k.box('NAT_SeedSoil',(x,y,.997),(.095,.1,.005),'oak_dark',c,.002)
        k.tube('NAT_SeedStem',[(x,y,1.0),(x+.006,y,1.055)],.002,'leaf',c)
        for sign in (-1,1):k.sphere('NAT_SeedLeaf',(x+sign*.025,y,1.046),(.029,.012,.007),'leaf_light',c,8,5)
        k.box('NAT_SeedLabel',(x,y+.047,1.027),(.037,.003,.064),'cream',c,.002)
    k.cylinder('NAT_WateringCan',(3.82,-.17,1.03),.095,.19,'sage',c,24)
    k.tube('NAT_WateringSpout',[(3.86,-.17,1.01),(3.99,-.17,1.09),(4.02,-.17,1.17)],.017,'sage',c)
    k.tube('NAT_WateringHandle',[(3.75,-.17,.99),(3.65,-.17,1.04),(3.65,-.17,1.16),(3.78,-.17,1.18)],.010,'sage',c)
    for i in range(5):
        k.cylinder('NAT_StackedClayPot',(3.24,-.14,.41+i*.043),.078+i*.001,.08,'terracotta',c,16,radius_top=.091)
    k.book('NAT_BotanicalNotebook',(3.74,-.12,.406),.034,.31,.24,'sage',collection=c,flat=True)
    clone_tree(k,'PRM_BOT_FloorRubberPlant','NAT_BenchFern',(3.80,-1.88,.18),(3.9,.55,.18),1.08)
    bpy.data.objects['Light_WindowSoft'].data.color=(1,.94,.77)
    bpy.data.objects['Light_WindowSoft'].data.energy=760
    return ['Timber lattice','Roman bamboo-style folds','Two suspended macrame plants','Potting bench with six seedlings','Watering can and specimen journal','Additional floor foliage']


def urbano(k):
    poster_text(('ENCONTRÁ TU RITMO','IDEAS EN MOVIMIENTO','PASO A PASO'))
    c='THEME_URBAN';rng=random.Random(98)
    for i,color in enumerate(('#656064','#73696B','#58575D','#86767A')):k.material('urban_brick_'+str(i),color,.94)
    # Individual staggered bricks leave true recessed mortar joints.
    for row in range(12):
        z=.57+row*.206
        for i in range(13):
            y=-2.42+i*.397+(row%2)*.19
            if y<2.45:k.box('URB_LeftWall_Brick',(-2.952,y,z),(.025,.38,.189),'urban_brick_'+str(rng.randrange(4)),c,.006)
    shift('Premium_Wall_',(.032,0,0))
    # Original city print, layered blocks and independent street lines.
    group=bpy.data.objects.get('Premium_Wall_QuietHorizons')
    if group:
        for i in range(6):
            x=-.25+i*.088;h=.13+(i%3)*.059
            k.box('URB_Poster_Skyline',(x,-.20+h/2,.065),(.072,h,.012),'ink',c,.001,parent=group)
            for j in range(3):k.box('URB_Poster_Window',(x,-.17+j*.038,.073),(.011,.014,.002),'cream',c,0,parent=group)
    # Music console with actual turntable platter, tonearm, controls and record rack.
    for x in (3.035,4.005):
        k.box('URB_RecordConsole_Side',(x,-.15,.515),(.060,.62,.61),'oak_dark',c,.014)
    k.box('URB_RecordConsole_Bottom',(3.52,-.15,.24),(1.03,.62,.055),'oak_dark',c,.012)
    k.box('URB_RecordConsole_Top',(3.52,-.15,.84),(1.08,.66,.06),'oak_light',c,.014)
    k.box('URB_RecordCubby_Back',(3.52,.142,.51),(.93,.025,.52),'black',c,.008)
    for i in range(10):
        x=3.13+i*.038
        k.box('URB_RecordSleeve',(x,-.32,.436),(.032,.27,.33),('ink','pink_dark','cream','dusk')[i%4],c,.002,rotation=(0,-.09 if i==9 else 0,0))
        k.box('URB_RecordSpine',(x,-.461,.456),(.022,.008,.20),'paper',c,.001)
    k.box('URB_Turntable_Deck',(3.44,-.16,.915),(.62,.43,.075),'ink',c,.015)
    k.cylinder('URB_Turntable_Platter',(3.37,-.16,.96),.16,.026,'metal',c,64)
    k.cylinder('URB_Vinyl',(3.37,-.16,.977),.151,.006,'black',c,64)
    for radius in (.071,.09,.111,.132):k.tube('URB_Vinyl_Groove',[(3.37+radius*math.cos(a),-.16+radius*math.sin(a),.981) for a in [i*math.tau/80 for i in range(80)]],.0006,'metal',c,True)
    k.cylinder('URB_Vinyl_Label',(3.37,-.16,.983),.039,.003,'pink_dark',c,32)
    k.tube('URB_Tonearm',[(3.66,-.03,.99),(3.68,-.09,1.03),(3.50,-.21,1.01)],.007,'gold',c)
    k.box('URB_Cartridge',(3.49,-.217,1.007),(.035,.018,.02),'cream',c,.003)
    for i in range(3):k.cylinder('URB_Turntable_Control',(3.64,-.28+i*.068,.96),.012,.013,'gold',c,16)
    k.box('URB_ConsoleSpeaker',(3.90,-.12,1.04),(.19,.28,.32),'ink',c,.012)
    for z,r in ((.978,.056),(1.12,.028)):
        disk=k.cylinder('URB_ConsoleSpeaker_Driver',(3.9,-.267,z),r,.012,'metal',c,32);disk.rotation_euler.x=math.pi/2
    # Sport identity: basketball tucked beside the console, ball seams are geometry.
    k.material('urban_ball','#B77642',.91)
    k.sphere('URB_Basketball',(3.91,.48,.304),(.124,.124,.124),'urban_ball',c,24,16)
    for plane in range(3):
        pts=[]
        for i in range(64):
            a=i*math.tau/64;u=.125*math.cos(a);v=.125*math.sin(a)
            pts.append((3.91+u,.48+v,.304) if plane==0 else ((3.91+u,.48,.304+v) if plane==1 else (3.91,.48+u,.304+v)))
        k.tube('URB_BallSeam',pts,.002,'ink',c,True)
    # Independent geometric textile accent, sewn onto the existing rug.
    for i in range(9):
        x=-.48+i*.18
        k.box('URB_Rug_AccentPatch',(x,-1.92,.25),(.13,.15,.002),'pink_dark' if i%2 else 'ink',c,.001,rotation=(0,0,.07))
    bpy.data.objects['Light_WindowSoft'].data.energy=430
    bpy.data.objects['Light_LateAfternoon'].data.energy=1.0
    return ['Staggered masonry wall','Original city art','Record console and playable-looking turntable mechanics','Ten record sleeves','Basketball with seams','Graphic sewn rug accents']


def bookcase(k,name,loc,width,height,depth,side='back',rows=5,seed=1):
    g=k.group(name,loc,(0,0,math.pi/2 if side=='left' else 0),'THEME_LIBRARY')
    c='THEME_LIBRARY';rng=random.Random(seed);books=0
    k.box(name+'_Back',(0,depth/2-.009,height/2),(width,.024,height),'oak_dark',c,.004,parent=g)
    for x in (-width/2+.025,width/2-.025):k.box(name+'_Side',(x,0,height/2),(.05,depth,height),'oak',c,.007,parent=g)
    for j in range(rows+1):
        z=.055+j*(height-.10)/rows
        k.box(name+'_Shelf',(0,0,z),(width,depth,.042),'oak_light',c,.006,parent=g)
        if j==rows:continue
        x=-width/2+.082
        while x<width/2-.11:
            w=rng.uniform(.032,.059);h=(height-.10)/rows*rng.uniform(.68,.86)
            b=k.book(name+'_Book',(x+w/2,-.012,z+.022),w,h,depth*.82,('sage','berry','dusk','cream','oak_dark','pink_dark')[books%6],collection=c)
            b.parent=g;books+=1;x+=w+.006
    return books


def biblioteca(k):
    poster_text(('UN MUNDO EN CADA PÁGINA','SIEMPRE UNA HISTORIA','APRENDER Y COMPARTIR'))
    c='THEME_LIBRARY';count=0
    # Shallow left-wall bookcase fits between the preserved bed and the wall.
    count+=bookcase(k,'LIB_LeftWallBooks',(-2.82,-.15,.18),1.31,2.29,.20,'left',6,15)
    # Original framed artwork is displayed on the bookshelf's front, not discarded.
    for prefix in ('Premium_Wall_QuietHorizons','Premium_Wall_TravelPhoto'):
        shift(prefix,(.24,0,0))
    guitar=bpy.data.objects.get('Premium_Personal_AcousticGuitar')
    if guitar:guitar.location.y=-1.80
    skate=bpy.data.objects.get('Premium_Personal_Skateboard')
    if skate:skate.location.y=-1.11
    count+=bookcase(k,'LIB_BookTower',(2.695,2.02,.18),.38,2.53,.51,'back',6,81)
    # Window-like reading bench has cubbies, padded cushion and piping.
    count+=bookcase(k,'LIB_ReadingBench',(3.48,-.19,.18),1.14,.51,.67,'back',1,42)
    k.box('LIB_BenchCushion',(3.48,-.19,.758),(1.12,.65,.13),'textile_sage',c,.045)
    for i in range(6):
        x=3.03+i*.177
        k.tube('LIB_BenchCushion_Seam',[(x,-.47,.815),(x,.10,.815)],.0023,'textile_stitch',c)
    k.tube('LIB_BenchCushion_Piping',[(2.965,-.472,.789),(3.995,-.472,.789),(4.012,-.445,.789),(4.012,.070,.789),(3.99,.097,.789),(2.97,.097,.789),(2.948,.07,.789),(2.948,-.44,.789)],.005,'textile_ivory',c,True)
    k.box('LIB_ReadingPillow',(3.84,.028,.967),(.31,.12,.30),'linen',c,.07,rotation=(.14,0,-.13))
    standing_lamp(k,(4.04,.43,.18),'gold','cream','LIB_BrassReadingLamp')
    # Catalog cards identify the bookcase sections with restrained typography.
    for i,label in enumerate(('HISTORIAS','CIENCIA','IDEAS')):
        z=.82+i*.59
        k.box('LIB_CatalogPlate',(2.694,1.753,z),(.20,.015,.057),'gold',c,.003)
        k.text('LIB_CatalogSection',label,(2.694,1.744,z),.019,'oak_dark',c,(math.pi/2,0,0))
    k.book('LIB_BenchCurrentBook',(3.3,-.21,.826),.032,.29,.22,'berry',collection=c,flat=True)
    bpy.data.objects['Light_WindowSoft'].data.energy=540
    bpy.data.objects['Light_WindowSoft'].data.color=(1,.80,.55)
    bpy.data.objects['Light_SoftFrontFill'].data.color=(1,.91,.75)
    return ['Left-wall library','Desk-side book tower','Book-filled reading bench with stitched seat','Brass reading lamp','Catalog plates',str(count)+' additional bound books']


def apply(k,theme):
    recolor(theme)
    return {'theme':theme,'name':THEMES[theme]['name'],'features':{
        'minimalista':minimalista,'tecnologia':tecnologia,'naturaleza':naturaleza,
        'urbano':urbano,'biblioteca-moderna':biblioteca}[theme](k)}
