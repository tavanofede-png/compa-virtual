"""Original botanical / astronomy wall story and rebuilt window for Cozy v2."""
import math
import random
import bpy
from build_harper import rgba


def upgrade(k):
    rng=random.Random(90421)
    k.material('cork','#BA906B',.92)
    k.material('dusk','#6A8190',.83)
    k.material('sunset','#EFC18F',.85)
    k.material('berry','#925969',.8)
    k.material('thread','#E8C3A5',.85)
    bulb=k.material('lantern','#FFE0A1',.35)
    bs=bulb.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Emission Color'].default_value=rgba('#FFDDA2')
    bs.inputs['Emission Strength'].default_value=3
    k.remove_prefixes(('Architecture_BackWall_', 'Architecture_Window','Detail_Window',
        'Decor_Curtain','Decor_Poster','Detail_PosterShape','Decor_Clock','Decor_Cork',
        'Decor_Pin_','Decor_LED_','Decor_StringBulb','Decor_Lamp','Detail_Lamp',
        'Detail_FloorGrain_','Detail_FloorJoint_'))

    # Real aperture replaces a wall segment that occluded half the old window.
    for name,x,w in [('Left',-2.8075,.675),('Right',1.6525,5.205)]:
        k.box('Architecture_BackWall_'+name,(x,2.62,1.58),(w,.20,3.08),'wall','ARCHITECTURE',.015)
    for name,z,h in [('Below',.645,1.21),('Above',2.92,.40)]:
        k.box('Architecture_BackWall_'+name,(-1.71,2.62,z),(1.52,.20,h),'wall','ARCHITECTURE',.012)
    for x in (-2.48,-.94):
        k.box('Premium_Window_CasingSide', (x,2.47,1.985),(.11,.16,1.59),'trim','ARCHITECTURE',.012)
        k.box('Premium_Window_FrameSide', (x,2.57,1.985),(.052,.10,1.52),'oak_light','ARCHITECTURE',.006)
    for z in (1.22,2.75):
        k.box('Premium_Window_CasingHorizontal',(-1.71,2.47,z),(1.65,.16,.09),'trim','ARCHITECTURE',.008)
    k.box('Premium_Window_Mullion',(-1.71,2.51,1.99),(.055,.09,1.46),'trim','ARCHITECTURE',.005)
    k.box('Premium_Window_Sill',(-1.71,2.39,1.19),(1.86,.38,.08),'oak_light','ARCHITECTURE',.018)
    for x in (-2.1,-1.32):
        k.box('Premium_Window_Handle',(x,2.445,1.70),(.017,.035,.095),'gold','ARCHITECTURE',.005)
    # Clean daylight sky with a shallow miniature landscape beyond the opening.
    sky=k.material('outdoor_sky','#A1C9DB',.9)
    bs=sky.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Emission Color'].default_value=rgba('#B8D9E9');bs.inputs['Emission Strength'].default_value=.3
    k.box('Premium_Outside_Sky',(-1.71,2.795,1.985),(1.49,.006,1.47),sky,'WINDOW_EXTERIOR',0)
    for i in range(6):
        x=-2.31+i*.24;h=.3+rng.random()*.35
        k.box('Premium_Outside_DistantHouse', (x,2.77,1.27+h/2),(.23,.009,h),('pink_light','cream','dusk')[i%3],'WINDOW_EXTERIOR',.005)
        for row in range(2):
            for col in range(2):
                k.box('Premium_Outside_HouseWindow',(x-.05+col*.1,2.76,1.37+row*.14),(.045,.003,.067),'sunset','WINDOW_EXTERIOR',.001)
    for i in range(7):
        x=-2.31+i*.205;z=1.44+rng.random()*.21
        k.cylinder('Premium_Outside_Trunk',(x,2.745,z-.07),.011,.29,'oak_dark','WINDOW_EXTERIOR')
        for j in range(3):
            k.sphere('Premium_Outside_Tree',(x+(j-1)*.035,2.74,z+j*.055),(.09,.009,.12),('sage','sage_light','leaf_light')[(i+j)%3],'WINDOW_EXTERIOR',10,7)
    for i in range(4):
        k.sphere('Premium_Outside_Cloud',(-2.1+i*.11,2.76,2.5+.025*math.sin(i)),(.14,.01,.05),'white','WINDOW_EXTERIOR',12,7)
    for obj in k.collection('WINDOW_EXTERIOR').objects:
        obj.visible_shadow=False
        if obj.type=='MESH':
            source_mat=obj.data.materials[0]
            name='MAT_EXTERIOR_UNLIT_'+source_mat.name
            mat=bpy.data.materials.get(name)
            if mat is None:
                mat=source_mat.copy();mat.name=name
                bs=mat.node_tree.nodes.get('Principled BSDF')
                color=tuple(bs.inputs['Base Color'].default_value)
                output=mat.node_tree.nodes.get('Material Output')
                emitter=mat.node_tree.nodes.new('ShaderNodeEmission')
                emitter.inputs['Color'].default_value=color;emitter.inputs['Strength'].default_value=.8
                mat.node_tree.links.new(emitter.outputs[0],output.inputs['Surface'])
            obj.data.materials[0]=mat

    # Gathered curtains, real folded surfaces with thickness, heading and tiebacks.
    rod=k.cylinder('Premium_Curtain_Rod',(-1.71,2.27,2.88),.027,2.34,'oak_dark','ARCHITECTURE',20)
    rod.rotation_euler[1]=math.pi/2
    for cx in (-2.66,-.76):
        verts=[];faces=[];nx=24;nz=30
        for j in range(nz+1):
            t=j/nz;z=.67+t*2.18
            width=.32-.10*math.exp(-((z-1.55)/.25)**2)
            for i in range(nx+1):
                u=i/nx;xx=cx+(u-.5)*width
                yy=2.24-.035*math.cos(u*math.tau*5)-.014*math.sin(t*4+u*2)
                verts.append((xx,yy,z+.012*math.cos(u*math.tau*5)*(1-t)))
        for j in range(nz):
            for i in range(nx):
                a=j*(nx+1)+i;faces.append((a,a+1,a+nx+2,a+nx+1))
        obj=k.mesh('Premium_Curtain_WovenPanel',verts,faces,'pink','TEXTILES',0)
        solid=obj.modifiers.new('Woven cloth thickness','SOLIDIFY');solid.thickness=.009
        for z in (.695,2.78):
            k.tube('Premium_Curtain_Hem',[(cx+(i/24-.5)*.32,2.229-.035*math.cos(i/24*math.tau*5),z) for i in range(25)],.004,'pink_dark','TEXTILES')
        for i in range(6):
            xx=cx-.135+i*.054
            k.tube('Premium_Curtain_HangingLoop',[(xx,2.245+math.cos(a)*.035,2.872+math.sin(a)*.035) for a in [j*math.tau/16 for j in range(16)]],.006,'pink_dark','TEXTILES',True)
        k.tube('Premium_Curtain_Tie',[(cx+math.cos(a)*.12,2.25+math.sin(a)*.06,1.55) for a in [j*math.tau/32 for j in range(32)]],.012,'thread','TEXTILES',True)
        k.tube('Premium_Curtain_TieDrop',[(cx+.04,2.18,1.55),(cx+.09,2.15,1.45),(cx+.04,2.16,1.35)],.006,'thread','TEXTILES')
        for i in range(6):
            k.tube('Premium_Curtain_Tassel',[(cx+.04+(i-2.5)*.006,2.16,1.37),(cx+.04+(i-2.5)*.009,2.16,1.30)],.003,'thread','TEXTILES')

    # Extend the nightstand sequence instead of leaving the bed isolated.
    k.box('Premium_Bedside_RightCabinet',(-.63,1.25,.585),(.60,.60,.75),'oak','STORAGE',.018)
    k.box('Premium_Bedside_RightTop',(-.63,1.25,.967),(.64,.64,.066),'oak_light','STORAGE',.016)
    for z in (.43,.75):
        k.box('Premium_Bedside_RightDrawer',(-.63,.941,z),(.54,.028,.27),'oak_light','STORAGE',.01)
        k.box('Premium_Bedside_RightHandle',(-.63,.918,z+.055),(.16,.026,.027),'oak_dark','STORAGE',.004)
    # A pleated bedside shade remains visibly hollow, with separate luminous lining.
    k.cylinder('Premium_BedLamp_Base',(-2.64,1.12,1.035),.14,.065,'oak_dark','DECOR',24)
    k.cylinder('Premium_BedLamp_Stem',(-2.64,1.12,1.235),.024,.36,'gold','DECOR',16)
    verts=[];faces=[];n=64
    for z,rad in ((1.36,.24),(1.69,.14)):
        for i in range(n):
            r=rad+(.009 if i%2 else -.009);a=i*math.tau/n
            verts.append((-2.64+r*math.cos(a),1.12+r*math.sin(a),z))
    for i in range(n):faces.append((i,(i+1)%n,(i+1)%n+n,i+n))
    shade=k.mesh('Premium_BedLamp_PleatedShade',verts,faces,'cream','DECOR',0)
    solid=shade.modifiers.new('Linen shade thickness','SOLIDIFY');solid.thickness=.004
    for z,r in ((1.36,.24),(1.69,.14)):
        k.tube('Premium_BedLamp_Piping',[(-2.64+r*math.cos(a),1.12+r*math.sin(a),z) for a in [i*math.tau/64 for i in range(64)]],.006,'linen','DECOR',True)
    k.sphere('Premium_BedLamp_Bulb',(-2.64,1.12,1.43),(.056,.056,.075),'lantern','DECOR')

    # Jointed floorboards and restrained grain lines make the architecture legible.
    for i in range(24):
        x=-3+i*.315
        for j in range(3):
            y=-2.28+j*1.78+(i%3)*.21
            if y<2.5:k.box('Premium_Floor_StaggeredJoint',(x,y,.175),(.299,.006,.002),'floor_dark','ARCHITECTURE',0)
        for j in range(3):
            y=-2.4+j*1.65+rng.uniform(0,.25)
            k.tube('Premium_Floor_Grain',[(x-.07+j*.064+.009*math.sin(t*.8),y+t*.09,.176) for t in range(9)],.0012,'floor_dark','ARCHITECTURE')
    k.box('Premium_LeftShelf_Plank',(-2.80,.25,2.575),(.38,1.75,.11),'oak_light','STORAGE',.014)
    for y in (-.39,.9):
        k.box('Premium_LeftShelf_Bracket',(-2.91,y,2.43),(.10,.033,.23),'gold','STORAGE',.004)
        k.tube('Premium_LeftShelf_Brace',[(-2.95,y,2.32),(-2.67,y,2.515)],.013,'gold','STORAGE')
    for i in range(6):
        k.book('Premium_LeftShelf_Book',(-2.73,-.14+i*.066,2.63),.057,.28+(i%3)*.035,.18,('dusk','berry','cream','sage')[i%4],(0,0,math.pi/2),'STORAGE')

    # Artwork uses original layered vector-like geometry, never raster placeholders.
    def panel(name,loc,w,h,side='back',frame='oak',paper='cream'):
        rot=(math.pi/2,0,math.pi/2 if side=='left' else 0)
        group=k.group(name,loc,rot,'WALL_STORY')
        k.box(name+'_Backing',(0,0,0),(w,h,.036),frame,'WALL_STORY',.006,parent=group)
        k.box(name+'_Mat',(0,0,.022),(w-.06,h-.06,.012),'paper','WALL_STORY',.002,parent=group)
        k.box(name+'_Paper',(0,0,.030),(w-.13,h-.13,.004),paper,'WALL_STORY',.001,parent=group)
        return group
    def landscape(name,loc,w,h,side='back'):
        group=panel(name,loc,w,h,side,paper='dusk')
        k.cylinder(name+'_Sun',(w*.17,h*.21,.035),min(w,h)*.095,.004,'sunset','WALL_STORY',24,parent=group)
        for j,col in enumerate(('berry','sage','leaf')):
            bottom=-h/2+.066;y=-.04-j*.075
            verts=[(-w/2+.066,bottom,.04+j*.004),(w/2-.066,bottom,.04+j*.004)]
            for i in range(8):
                xx=w/2-.066-i*(w-.132)/7
                verts.append((xx,y+.08*math.sin(i*1.3+j),.04+j*.004))
            k.mesh(name+'_Hill',verts,[tuple(range(len(verts)))],col,'WALL_STORY',0,group)
        return group
    g=landscape('Premium_Wall_QuietHorizons',(-2.945,-.42,1.95),.78,.90,'left')
    k.text('Premium_Wall_QuietTitle','PEQUEÑOS MUNDOS',(0,-.32,.056),.032,'cream',parent=g)
    # Study identity: leaves, observations, celestial marks, a small hand-drawn plan.
    g=panel('Premium_Wall_Botanical',(.08,2.48,1.89),.45,.64,paper='linen')
    k.tube('Premium_Wall_BotanicalStem',[(0,-.18,.043),(0,0,.043),(.02,.16,.043)],.006,'leaf','WALL_STORY',parent=g)
    for i in range(5):
        sign=-1 if i%2 else 1;y=-.12+i*.057
        verts=[(0,y,.045),(sign*.09,y+.03,.045),(sign*.10,y+.09,.045),(.01,y+.07,.045)]
        k.mesh('Premium_Wall_BotanicalLeaf',verts,[(0,1,2,3)],'sage','WALL_STORY',0,g)
    k.text('Premium_Wall_BotanicalTitle','CRECER DE A POCO',(0,-.235,.045),.024,'ink',parent=g)
    g=panel('Premium_Wall_Constellation',(-2.945,-1.71,1.91),.52,.43,'left',paper='dusk')
    points=[(-.15,.02,.04),(-.07,.10,.04),(.02,.04,.04),(.14,.10,.04),(.12,-.06,.04)]
    k.tube('Premium_Wall_ConstellationLines',points,.0018,'cream','WALL_STORY',parent=g)
    for p in points:k.sphere('Premium_Wall_ConstellationStar',p,(.013,.013,.004),'gold','WALL_STORY',8,5,g)
    k.text('Premium_Wall_ConstellationTitle','SEGUIR EXPLORANDO',(0,-.128,.044),.021,'cream',parent=g)

    # Framed corkboard and a readable weekly plan behind the desk.
    g=panel('Premium_Wall_StudyBoard',(2.02,2.475,2.02),1.03,.67,paper='cork')
    for i,(x,y,key) in enumerate(((-.30,.12,'cream'),(-.04,.12,'pink_light'),(.26,.1,'sage_light'),(-.2,-.13,'paper'),(.13,-.13,'cream'))):
        p=k.group('Premium_StudyBoard_Note',(x,y,.039),(0,0,(-.08,.07,-.05,.04,.08)[i]),'WALL_STORY');p.parent=g
        k.box('Premium_StudyBoard_Paper',(0,0,0),(.20,.15,.003),key,'WALL_STORY',.001,parent=p)
        k.sphere('Premium_StudyBoard_Pin',(0,.055,.01),(.008,.008,.007),'berry','WALL_STORY',8,5,p)
        for row in range(3):
            k.box('Premium_StudyBoard_PencilLine',(0,.012-row*.028,.003),(.135-row*.016,.002,.001),'oak_dark','WALL_STORY',0,parent=p)
    g=panel('Premium_Wall_WeeklyPlan',(.73,2.475,1.89),.48,.55,paper='paper')
    k.text('Premium_Wall_WeeklyTitle','MI SEMANA',(0,.17,.037),.042,'ink',parent=g)
    for i,day in enumerate(('L','M','M','J','V')):
        xx=-.14+i*.07
        k.text('Premium_Wall_Weekday',day,(xx,.095,.037),.026,'berry',parent=g)
        for j in range(4):
            k.box('Premium_Wall_CalendarCell',(xx,.035-j*.052,.037),(.047,.034,.002),'sage_light' if (i+j)%4==0 else 'linen_shadow','WALL_STORY',.001,parent=g)
    # A real clock face in front of the rim, not hidden behind a solid cap.
    g=k.group('Premium_Wall_Clock',(-2.937,-1.67,2.66),(math.pi/2,0,math.pi/2),'WALL_STORY')
    k.cylinder('Premium_Clock_WoodRim',(0,0,0),.255,.049,'oak','WALL_STORY',48,parent=g)
    k.cylinder('Premium_Clock_Face',(0,0,.028),.232,.012,'cream','WALL_STORY',48,parent=g)
    for i in range(12):
        a=i*math.tau/12
        k.box('Premium_Clock_Tick',(math.sin(a)*.204,math.cos(a)*.204,.037),(.009,.026,.003),'ink','WALL_STORY',.001,(0,0,-a),g)
    k.tube('Premium_Clock_HourHand',[(0,0,.041),(-.073,.067,.041)],.007,'ink','WALL_STORY',parent=g)
    k.tube('Premium_Clock_MinuteHand',[(0,0,.045),(.034,.161,.045)],.004,'ink','WALL_STORY',parent=g)
    k.cylinder('Premium_Clock_Pivot',(0,0,.05),.014,.005,'gold','WALL_STORY',16,parent=g)
    # Photo string over bed, suspended under the left shelf.
    k.tube('Premium_Wall_PhotoCord',[(-2.91,-.72+i*.19,2.34-.08*math.sin(i/10*math.pi)) for i in range(11)],.004,'thread','WALL_STORY')
    for i,y in enumerate((-.66,.56,1.13)):
        g=landscape('Premium_Wall_TravelPhoto',(-2.90,y,2.18),.22,.27,'left')
        k.box('Premium_Wall_PhotoClip',(0,.148,.041),(.025,.055,.013),'oak_light','WALL_STORY',.002,parent=g)
    # Connected hanging lanterns create warm pools against the wall.
    for segment in range(2):
        points=[];count=17 if segment==0 else 18
        for i in range(121):
            t=i/120;z=3.035-.15*abs(math.sin(t*math.pi*3))
            points.append((-2.875,-2.24+t*4.64,z) if segment==0 else (-2.90+t*6.94,2.43,z))
        k.tube('Premium_Garland_Cord',points,.005,'oak_dark','LIGHT_DECOR')
        for i in range(count):
            t=(i+.25)/count;z=3.035-.15*abs(math.sin(t*math.pi*3))
            x,y=(-2.875,-2.24+t*4.64) if segment==0 else (-2.90+t*6.94,2.43)
            k.tube('Premium_Garland_Drop',[(x,y,z),(x,y,z-.065)],.003,'oak_dark','LIGHT_DECOR')
            k.box('Premium_Garland_Cap',(x,y,z-.07),(.039,.039,.019),'gold','LIGHT_DECOR',.005)
            k.box('Premium_Garland_Lantern',(x,y,z-.105),(.059,.059,.064),'lantern','LIGHT_DECOR',.009)
    # Small foot-of-bed runner and slippers connect bed to the lounge path.
    k.box('Premium_Bedside_WovenMat',(-1.80,-1.56,.189),(1.55,.43,.027),'linen','TEXTILES',.009)
    for i in range(31):
        x=-2.53+i*.048
        for side in (-1,1):
            k.tube('Premium_Bedside_MatFringe',[(x,-1.56+side*.21,.20),(x+.008,-1.56+side*.27,.19)],.005,'thread','TEXTILES')
    for i in range(2):
        x=-1.94+i*.22
        k.box('Premium_Bedside_SlipperSole',(x,-1.57,.221),(.17,.25,.033),'oak_dark','DECOR',.025)
        k.box('Premium_Bedside_SlipperUpper',(x,-1.61,.255),(.16,.16,.056),'sage','DECOR',.027)
        k.box('Premium_Bedside_SlipperLining',(x,-1.523,.244),(.135,.066,.015),'cream','DECOR',.008)
    # A sleepy fox plush, with sewn muzzle and ears, makes the bed personal.
    k.material('fox_fabric','#BD855D',.91)
    g=k.group('Premium_Bed_SleepyFox',(-1.68,-.03,.99),(0,0,-.18),'PERSONAL_PROPS')
    k.sphere('Premium_Fox_Body',(.065,.005,0),(.215,.123,.112),'fox_fabric','PERSONAL_PROPS',16,10,g)
    k.sphere('Premium_Fox_Head',(-.135,-.024,.028),(.116,.119,.114),'fox_fabric','PERSONAL_PROPS',16,10,g)
    for sign in (-1,1):
        xx=-.135+sign*.07
        verts=[(xx-.033,-.028,.103),(xx+.033,-.028,.103),(xx+sign*.008,-.009,.206),
               (xx-.029,.025,.102),(xx+.029,.025,.102),(xx+sign*.008,.021,.191)]
        k.mesh('Premium_Fox_Ear',verts,[(0,1,2),(5,4,3),(0,3,4,1),(1,4,5,2),(2,5,3,0)],'fox_fabric','PERSONAL_PROPS',.004,g)
        k.mesh('Premium_Fox_EarLining',[(xx-.021,-.031,.117),(xx+.021,-.031,.117),(xx+sign*.007,-.015,.177)],[(0,1,2)],'cream','PERSONAL_PROPS',0,g)
        k.sphere('Premium_Fox_Cheek',(xx,-.112,.01),(.060,.036,.044),'linen','PERSONAL_PROPS',12,7,g)
        k.tube('Premium_Fox_SleepyEye',[(xx-.022+i*.0055,-.124,.059-.005*math.sin(i/8*math.pi)) for i in range(9)],.0028,'oak_dark','PERSONAL_PROPS',parent=g)
        k.sphere('Premium_Fox_Paw',(sign*.082,-.107,-.064),(.049,.058,.035),'linen','PERSONAL_PROPS',12,7,g)
    k.sphere('Premium_Fox_Nose',(-.135,-.146,.022),(.016,.011,.012),'oak_dark','PERSONAL_PROPS',10,6,g)
    k.tube('Premium_Fox_MuzzleStitch',[(-.135,-.148,.011),(-.135,-.146,0),(-.147,-.143,-.005)],.0016,'oak_dark','PERSONAL_PROPS',parent=g)
    k.sphere('Premium_Fox_CurledTail',(.159,-.117,-.012),(.119,.075,.063),'fox_fabric','PERSONAL_PROPS',16,8,g)
    k.sphere('Premium_Fox_TailTip',(.072,-.151,-.012),(.066,.051,.050),'linen','PERSONAL_PROPS',12,8,g)
    k.tube('Premium_Fox_BackSeam',[(.04+i*.021,.011,.111-.011*(i/9)**2) for i in range(10)],.0014,'thread','PERSONAL_PROPS',parent=g)

    # A low wooden crate of ongoing projects fills the reading corner at floor level.
    g=k.group('Premium_Lounge_ProjectCrate',(3.48,-.81,.18),(0,0,-.06),'PERSONAL_PROPS')
    k.box('Premium_Crate_Base',(0,0,.034),(.60,.39,.057),'oak','PERSONAL_PROPS',.007,parent=g)
    for z in (.105,.209,.313):
        for yy in (-.202,.202):
            k.box('Premium_Crate_LongSlat',(0,yy,z),(.62,.033,.085),'oak_light','PERSONAL_PROPS',.005,parent=g)
        for xx in (-.296,.296):
            k.box('Premium_Crate_SideSlat',(xx,0,z),(.028,.39,.085),'oak_light','PERSONAL_PROPS',.005,parent=g)
    for xx in (-.269,.269):
        for yy in (-.16,.16):
            k.box('Premium_Crate_CornerPost',(xx,yy,.193),(.04,.04,.31),'oak','PERSONAL_PROPS',.005,parent=g)
            for z in (.108,.309):k.sphere('Premium_Crate_Pin',(xx,yy-.055,z),(.006,.003,.006),'metal','PERSONAL_PROPS',8,5,g)
    for i in range(5):
        b=k.book('Premium_Crate_ProjectBook',(-.19+i*.083,0,.071),.066,.33+i%3*.027,.25,('sage','berry','dusk','cream','pink')[i],(0,-.08 if i==4 else 0,0),'PERSONAL_PROPS')
        b.parent=g
    k.box('Premium_Crate_Label',(0,-.223,.208),(.26,.009,.096),'cream','PERSONAL_PROPS',.006,parent=g)
    k.text('Premium_Crate_LabelText','EN PROGRESO',(0,-.229,.209),.025,'oak_dark','PERSONAL_PROPS',(math.pi/2,0,0),g)
    for i in range(4):
        k.book('Premium_Lounge_ReadingStack',(.64+(i%2)*.02,-1.76,.255+i*.045),.045,.36-i*.014,.26,('dusk','cream','berry','sage')[i],(0,0,-.09+i*.05),'PERSONAL_PROPS',True)
    k.text('Premium_Lounge_FavoriteBookTitle','PEQUEÑOS\nMUNDOS',(.65,-1.76,.438),.03,'cream','PERSONAL_PROPS')
    for i in range(3):
        k.book('Premium_Bedside_CurrentBooks',(-.66,.995,1.004+i*.026),.026,.235-i*.008,.157,('dusk','cream','berry')[i],(0,0,i*.025),'STORAGE',True)
    for i in range(3):
        k.book('Premium_Bookcase_TopJournals',(3.53+i*.06,1.94,2.735),.051,.23+i*.025,.22,('dusk','berry','sage')[i],(0,0,0),'STORAGE')
    for i in range(2):
        k.book('Premium_FloatingShelf_ExtraRead',(.45+i*.056,2.43,2.409),.049,.23+i*.04,.21,('berry','cream')[i],(0,0,0),'STORAGE')
    return {'windowAperture':{'x':[-2.47,-.95],'z':[1.25,2.72]},'lanterns':35,'wallStory':'Botanical observations, quiet horizons and constellations','floorJoints':True}


def finish_materials(k):
    """Subtle anisotropic grain and cloth response; geometry carries large detail."""
    for key in ('oak','oak_light','oak_dark','floor','floor_light','floor_dark'):
        mat=k.mat(key);nodes=mat.node_tree.nodes;links=mat.node_tree.links
        bs=nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=.57
        tc=nodes.new('ShaderNodeTexCoord');scale=nodes.new('ShaderNodeVectorMath');scale.operation='MULTIPLY';scale.inputs[1].default_value=(13,1.1,8)
        noise=nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=18;noise.inputs['Detail'].default_value=2
        bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.15;bump.inputs['Distance'].default_value=.0012
        links.new(tc.outputs['Generated'],scale.inputs[0]);links.new(scale.outputs[0],noise.inputs['Vector']);links.new(noise.outputs['Fac'],bump.inputs['Height']);links.new(bump.outputs['Normal'],bs.inputs['Normal'])
    for mat in bpy.data.materials:
        if not mat.use_nodes:continue
        bs=mat.node_tree.nodes.get('Principled BSDF')
        if not bs:continue
        if any(word in mat.name.lower() for word in ('linen','pink','cloth','quilt','textile')):
            bs.inputs['Roughness'].default_value=.86
            bs.inputs['Sheen Weight'].default_value=.18
        if 'gold' in mat.name.lower():
            bs.inputs['Metallic'].default_value=.72;bs.inputs['Roughness'].default_value=.31
