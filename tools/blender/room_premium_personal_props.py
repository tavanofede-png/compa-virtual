"""Personal study/music props, built as editable geometry in the Cozy master."""
from __future__ import annotations

import math


def upgrade(k):
    removed=k.remove_prefixes(("Decor_Backpack","Detail_Backpack","Decor_Guitar","Detail_Guitar","Decor_Skate","Detail_Skate"))
    before=len(k.created)
    k.material("bag_canvas","#C19186",roughness=.89)
    k.material("bag_panel","#AB7B73",roughness=.88)
    k.material("bag_webbing","#86655E",roughness=.90)
    k.material("guitar_spruce","#DCAA6C",roughness=.46)
    k.material("guitar_walnut","#774B33",roughness=.40)
    k.material("guitar_binding","#EFDCBA",roughness=.48)
    k.material("skate_grip","#373839",roughness=.98)
    coll="PERSONAL_PROPS"

    def box(name,loc,dims,mat,parent,bevel=.003,rotation=(0,0,0)):
        return k.box(name,loc,dims,mat,collection=coll,bevel=bevel,rotation=rotation,parent=parent)

    def tube(name,pts,radius,mat,parent,cyclic=False):
        return k.tube(name,pts,radius,mat,collection=coll,cyclic=cyclic,parent=parent)

    def cylinder(name,loc,radius,depth,mat,parent,rotation=(0,0,0),vertices=20):
        obj=k.cylinder(name,loc,radius,depth,mat,collection=coll,vertices=vertices,parent=parent)
        obj.rotation_euler=rotation
        return obj

    def outline_ring(w,d):
        x,y=w*.5,d*.5;c=min(x,y)*.28
        return[(-x+c,-y),(x-c,-y),(x,-y+c),(x,y-c),(x-c,y),(-x+c,y),(-x,y-c),(-x,-y+c)]

    bag=k.group("Premium_Personal_SchoolBackpack",(2.65,1.10,.18),rotation=(0,0,-.065),collection=coll)
    profile=[(.018,.283,.198),(.047,.360,.232),(.169,.396,.254),(.373,.397,.255),(.490,.360,.236),(.559,.274,.191),(.592,.157,.135)]
    verts=[(x,y,z) for z,w,d in profile for x,y in outline_ring(w,d)]
    faces=[tuple(reversed(range(8))),tuple(range((len(profile)-1)*8,len(profile)*8))]
    for j in range(len(profile)-1):
        faces.extend((j*8+i,j*8+(i+1)%8,(j+1)*8+(i+1)%8,(j+1)*8+i) for i in range(8))
    k.mesh("Premium_Personal_BackpackTailoredShell",verts,faces,"bag_canvas",collection=coll,bevel=.006,parent=bag)
    box("Premium_Personal_BackpackBottomGuard",(0,.006,.039),(.348,.241,.047),"bag_webbing",bag,.006)
    box("Premium_Personal_BackpackRaisedFront",(0,-.143,.278),(.311,.064,.269),"bag_panel",bag,.020)
    box("Premium_Personal_BackpackFrontPocket",(0,-.183,.215),(.265,.030,.142),"bag_canvas",bag,.013)
    box("Premium_Personal_BackpackFrontFacing",(0,-.202,.215),(.231,.010,.107),"bag_canvas",bag,.005)
    for i,(z,y,width) in enumerate(((.399,-.181,.256),(.281,-.206,.225))):
        box(f"Premium_Personal_BackpackZipTape_{i}",(0,y,z),(width,.007,.015),"bag_webbing",bag,.001)
        for j in range(31):
            box(f"Premium_Personal_BackpackZipTooth_{i}_{j}",(-width*.46+j*width*.92/30,y-.006,z+(j%2-.5)*.002),(.0035,.004,.006),"metal",bag,.0005)
        slider_x=width*.30
        box(f"Premium_Personal_BackpackZipSlider_{i}",(slider_x,y-.013,z),(.014,.011,.013),"gold",bag,.001)
        tube(f"Premium_Personal_BackpackZipPull_{i}",[(slider_x,y-.017,z-.004),(slider_x+.002,y-.024,z-.038),(slider_x+.011,y-.024,z-.038),(slider_x+.010,y-.017,z-.004)],.0028,"gold",bag)
    # Rounded stitched outline is a real path around the smaller pocket.
    pocket=[(-.101,-.210,.157),(.101,-.210,.157),(.114,-.210,.168),(.114,-.210,.249),(.100,-.210,.261),(-.100,-.210,.261),(-.114,-.210,.249),(-.114,-.210,.168)]
    tube("Premium_Personal_BackpackPocketPiping",pocket,.0020,"cream",bag,True)
    for side in (-1,1):
        box(f"Premium_Personal_BackpackSideGusset_{side}",(side*.205,.007,.151),(.055,.185,.203),"bag_panel",bag,.007)
        box(f"Premium_Personal_BackpackSidePouchRim_{side}",(side*.207,-.002,.255),(.059,.188,.026),"bag_webbing",bag,.003)
        path=[(side*.105,.110,.495),(side*.114,.166,.464),(side*.111,.188,.269),(side*.100,.163,.110),(side*.141,.100,.071)]
        tube(f"Premium_Personal_BackpackSoftStrap_{side}",path,.022,"bag_webbing",bag)
        box(f"Premium_Personal_BackpackStrapBuckle_{side}",(side*.107,.179,.174),(.060,.014,.037),"metal",bag,.002)
        box(f"Premium_Personal_BackpackStrapSlot_{side}",(side*.107,.189,.174),(.038,.005,.013),"bag_webbing",bag,.001)
    tube("Premium_Personal_BackpackCarryHandle",[(-.055,.015,.571),(-.055,.015,.650),(-.040,.015,.671),(.040,.015,.671),(.055,.015,.650),(.055,.015,.571)],.012,"bag_webbing",bag)
    # Small botanical patch connects the canvas bag to the room's plant motif.
    box("Premium_Personal_BackpackBotanicalPatch",(0,-.137,.490),(.102,.011,.108),"cream",bag,.011)
    tube("Premium_Personal_BackpackPatchStem",[(0,-.146,.448),(-.004,-.147,.472),(.007,-.145,.522)],.0022,"sage",bag)
    for i,(x,z,angle) in enumerate(((-.020,.470,-.55),(.019,.488,.5),(-.014,.509,-.45))):
        leaf=k.sphere(f"Premium_Personal_BackpackPatchLeaf_{i}",(x,-.146,z),(.015,.004,.007),"sage",collection=coll,segments=10,rings=6,parent=bag)
        leaf.rotation_euler[1]=angle
    cylinder("Premium_Personal_BackpackBottle",(.226,.010,.346),.037,.231,"screen_light",bag,vertices=24)
    cylinder("Premium_Personal_BackpackBottleShoulder",(.226,.010,.466),.029,.018,"screen_light",bag,vertices=24)
    cylinder("Premium_Personal_BackpackBottleCap",(.226,.010,.483),.027,.023,"metal",bag,vertices=20)
    tube("Premium_Personal_BackpackBottleLoop",[(.207,.01,.493),(.205,.01,.516),(.245,.01,.516),(.245,.01,.493)],.0035,"metal",bag)

    # Acoustic guitar: a waisted extruded wooden body with an actual opening in
    # the soundboard. The parent turns its soundboard toward the room (+X).
    guitar=k.group("Premium_Personal_AcousticGuitar",(-2.76,-1.26,.18),rotation=(0,-.035,math.pi/2),collection=coll)
    half=[(.00,.027),(.073,.031),(.131,.050),(.172,.085),(.194,.133),(.198,.188),(.180,.239),
          (.147,.282),(.122,.320),(.122,.348),(.143,.377),(.166,.414),(.165,.451),(.145,.489),(.106,.517),(.046,.533),(0,.537)]
    perimeter=half+[(-x,z) for x,z in reversed(half[1:-1])]
    n=len(perimeter)
    sideverts=[(x,y,z) for y in (-.060,.052) for x,z in perimeter]
    sidefaces=[tuple(reversed(range(n,2*n)))]
    sidefaces.extend((i,i+n,(i+1)%n+n,(i+1)%n) for i in range(n))
    k.mesh("Premium_Personal_GuitarWalnutRibs",sideverts,sidefaces,"guitar_walnut",collection=coll,bevel=.003,parent=guitar)
    centerz=.368; radius=.052
    front=[(x,-.062,z) for x,z in perimeter]
    inner=[]
    for x,z in perimeter:
        a=math.atan2(z-centerz,x)
        inner.append((math.cos(a)*radius,-.062,centerz+math.sin(a)*radius))
    frontfaces=[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    k.mesh("Premium_Personal_GuitarSpruceSoundboard",front+inner,frontfaces,"guitar_spruce",collection=coll,bevel=.0008,parent=guitar)
    inside=[(x,.019,z) for x,y,z in inner]
    k.mesh("Premium_Personal_GuitarSoundholeWall",inner+inside,[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],"guitar_walnut",collection=coll,bevel=0,parent=guitar)
    cylinder("Premium_Personal_GuitarSoundChamber",(0,.022,centerz),.056,.004,"black",guitar,rotation=(math.pi/2,0,0),vertices=48)
    tube("Premium_Personal_GuitarCreamBinding",[(x,-.064,z) for x,z in perimeter],.004,"guitar_binding",guitar,True)
    for i,r in enumerate((.055,.059,.063)):
        tube(f"Premium_Personal_GuitarRosette_{i}",[(r*math.cos(math.tau*j/60),-.064,centerz+r*math.sin(math.tau*j/60)) for j in range(60)],.0015,"guitar_walnut" if i%2 else "guitar_binding",guitar,True)
    # Fine intentional spruce grain instead of a uniform front color.
    for i,x in enumerate((-.160,-.133,-.101,-.078,.080,.102,.132,.158)):
        pts=[(x+.0015*math.sin(j*.42+i),-.063,.085+j*.015) for j in range(11)]
        tube(f"Premium_Personal_GuitarWoodGrain_{i}",pts,.00065,"oak",guitar)
    box("Premium_Personal_GuitarNeck",(0,.003,.727),(.063,.062,.415),"guitar_walnut",guitar,.003)
    box("Premium_Personal_GuitarFingerboard",(0,-.034,.727),(.056,.012,.421),"oak_dark",guitar,.0018)
    box("Premium_Personal_GuitarNut",(0,-.044,.937),(.060,.013,.012),"guitar_binding",guitar,.001)
    box("Premium_Personal_GuitarHeadstock",(0,.004,1.007),(.083,.038,.149),"guitar_walnut",guitar,.009)
    box("Premium_Personal_GuitarHeadstockFace",(0,-.019,1.007),(.074,.006,.126),"oak_dark",guitar,.004)
    box("Premium_Personal_GuitarBridge",(0,-.071,.214),(.116,.023,.041),"guitar_walnut",guitar,.003)
    box("Premium_Personal_GuitarSaddle",(0,-.086,.225),(.074,.007,.009),"guitar_binding",guitar,.0007)
    for i in range(6):
        xx=-.023+i*.0092
        tube(f"Premium_Personal_GuitarString_{i}",[(xx,-.092,.207),(xx,-.089,.228),(xx,-.045,.937),(xx,-.027,1.048)],.00055 if i<3 else .00075,"metal",guitar)
        cylinder(f"Premium_Personal_GuitarBridgePin_{i}",(xx,-.087,.205),.0034,.005,"guitar_binding",guitar,rotation=(math.pi/2,0,0),vertices=10)
    for i in range(14):
        z=.936-(.936-.418)*(1-2**(-(i+1)/12))
        box(f"Premium_Personal_GuitarFret_{i}",(0,-.043,z),(.057,.003,.002),"metal",guitar,.0003)
        if i in (2,4,6,8,11):
            cylinder(f"Premium_Personal_GuitarFretMarker_{i}",(0,-.043,z+.009),.0035,.001,"guitar_binding",guitar,rotation=(math.pi/2,0,0),vertices=10)
    for side in (-1,1):
        for j in range(3):
            zz=.966+j*.039
            cylinder(f"Premium_Personal_GuitarTunerPost_{side}_{j}",(side*.024,-.027,zz),.006,.012,"metal",guitar,rotation=(math.pi/2,0,0),vertices=12)
            tube(f"Premium_Personal_GuitarTunerShaft_{side}_{j}",[(side*.031,.004,zz),(side*.054,.004,zz)],.0035,"metal",guitar)
            k.sphere(f"Premium_Personal_GuitarTuningKey_{side}_{j}",(side*.057,.004,zz),(.007,.011,.015),"cream",collection=coll,segments=10,rings=6,parent=guitar)
    # Discrete low stand establishes visible floor contact.
    tube("Premium_Personal_GuitarStandLeft",[(-.130,.035,.008),(-.133,-.052,.008),(-.085,-.057,.043)],.010,"metal",guitar)
    tube("Premium_Personal_GuitarStandRight",[(.130,.035,.008),(.133,-.052,.008),(.085,-.057,.043)],.010,"metal",guitar)

    # The skateboard keeps the original left-wall position, now resting on its
    # tail. Trucks face into the room, with grip tape on the opposite surface.
    skate=k.group("Premium_Personal_Skateboard",(-2.82,.16,.748),rotation=(0,-.035,math.pi/2),collection=coll)
    edge=[]
    for i in range(17):
        a=math.pi*i/16
        edge.append((.151*math.cos(a),.385+.151*math.sin(a)))
    for i in range(17):
        a=math.pi+math.pi*i/16
        edge.append((.151*math.cos(a),-.385+.151*math.sin(a)))
    def surface(y):
        return[(x,y+max(0,(abs(z)-.373)/.163)**1.7*.037,z) for x,z in edge]
    nn=len(edge);vv=surface(-.013)+surface(.013)
    ff=[tuple(range(nn)),tuple(reversed(range(nn,2*nn)))]
    ff.extend((i,i+nn,(i+1)%nn+nn,(i+1)%nn) for i in range(nn))
    k.mesh("Premium_Personal_SkateMapleDeck",vv,ff,"oak_light",collection=coll,bevel=.003,parent=skate)
    k.mesh("Premium_Personal_SkateSageUnderside",surface(-.016),[tuple(range(nn))],"sage",collection=coll,bevel=0,parent=skate)
    grip=[(x*.94,y+.002,z*.982) for x,y,z in surface(.014)]
    k.mesh("Premium_Personal_SkateGripTape",grip,[tuple(reversed(range(nn)))],"skate_grip",collection=coll,bevel=0,parent=skate)
    # Original botanical emblem on underside, free of third-party branding.
    tube("Premium_Personal_SkateLeafStem",[(0,-.020,-.176),(-.012,-.022,-.018),(.029,-.022,.171)],.005,"cream",skate)
    for i,(x,z,a) in enumerate(((-.040,-.09,-.55),(.043,-.014,.55),(-.023,.075,-.45),(.052,.138,.55))):
        leaf=k.sphere(f"Premium_Personal_SkateLeaf_{i}",(x,-.023,z),(.047,.004,.018),"sage_light",collection=coll,segments=12,rings=6,parent=skate)
        leaf.rotation_euler[1]=a
    for side,z in (("Lower",-.333),("Upper",.333)):
        box(f"Premium_Personal_SkateTruckBase_{side}",(0,-.027,z),(.083,.015,.084),"metal",skate,.004)
        tube(f"Premium_Personal_SkateTruckHanger_{side}",[(-.167,-.071,z),(0,-.065,z+.012),(.167,-.071,z)],.012,"metal",skate)
        cylinder(f"Premium_Personal_SkateKingpin_{side}",(0,-.065,z),.012,.057,"gold",skate,rotation=(math.pi/2,0,0),vertices=12)
        for sign in (-1,1):
            cylinder(f"Premium_Personal_SkateWheel_{side}_{sign}",(sign*.166,-.071,z),.052,.040,"pink_light",skate,rotation=(0,math.pi/2,0),vertices=24)
            cylinder(f"Premium_Personal_SkateBearing_{side}_{sign}",(sign*.188,-.071,z),.019,.005,"metal",skate,rotation=(0,math.pi/2,0),vertices=16)
            cylinder(f"Premium_Personal_SkateAxleNut_{side}_{sign}",(sign*.192,-.071,z),.008,.006,"metal",skate,rotation=(0,math.pi/2,0),vertices=6)
            for zz in (-.027,.027):
                cylinder(f"Premium_Personal_SkateDeckBolt_{side}_{sign}_{zz}",(sign*.026,.017,z+zz),.005,.003,"metal",skate,rotation=(math.pi/2,0,0),vertices=8)

    return {"created":len(k.created)-before,"removed":removed,
            "backpack_anchor":[2.65,1.10,.18],"guitar_anchor":[-2.76,-1.26,.18],
            "skate_anchor":[-2.82,.16,.748],"guitar_has_open_soundhole":True,
            "guitar_strings":6,"skate_wheels":4}
