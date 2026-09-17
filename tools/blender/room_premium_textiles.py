"""Tailored bed textiles and a woven reading nook for the existing Cozy master.

All geometry is authored in metres with deterministic sewing/fold patterns.
Only the named old textiles and lounge furniture are replaced. Bed frame,
headboard, mattress and the surrounding bedroom layout remain untouched.
"""
from __future__ import annotations

import math


REPLACED_PREFIXES = (
    "Bed_Duvet", "Bed_PinkThrow", "Bed_Pillow", "Bed_Cushion",
    "Detail_DuvetPiping", "Detail_Cushion", "Decor_Rug", "Decor_Pouf",
    "Detail_PoufSeam", "Decor_SideTable", "Decor_TableBooks", "Decor_TableMug",
)


def upgrade(k):
    counts = {"created": 0, "cloth_shells": 0, "sewn_paths": 0,
              "replaced_prefixes": list(REPLACED_PREFIXES)}
    k.remove_prefixes(REPLACED_PREFIXES)
    k.material("textile_ivory", "#F2E5D3", roughness=.91)
    k.material("textile_stitch", "#C9B998", roughness=.92)
    k.material("textile_sage", "#81917A", roughness=.89)
    k.material("textile_sage_shadow", "#647760", roughness=.92)
    k.material("textile_rose", "#CD9290", roughness=.90)
    k.material("textile_rose_shadow", "#BA7D7D", roughness=.92)
    k.material("rug_oat", "#CFB595", roughness=.96)
    k.material("rug_cream", "#E4CCAD", roughness=.96)
    k.material("rug_rose", "#C9988E", roughness=.96)
    k.material("tea", "#775337", roughness=.26)

    def box(*args, **kwargs):
        counts["created"] += 1
        return k.box(*args, **kwargs)

    def tube(*args, **kwargs):
        counts["created"] += 1
        counts["sewn_paths"] += 1
        return k.tube(*args, **kwargs)

    def mesh(*args, **kwargs):
        counts["created"] += 1
        return k.mesh(*args, **kwargs)

    def cylinder(*args, **kwargs):
        counts["created"] += 1
        return k.cylinder(*args, **kwargs)

    def sphere(*args, **kwargs):
        counts["created"] += 1
        return k.sphere(*args, **kwargs)

    def rot(p, angles):
        x,y,z=p
        a,b,c=angles
        y,z=y*math.cos(a)-z*math.sin(a),y*math.sin(a)+z*math.cos(a)
        x,z=x*math.cos(b)+z*math.sin(b),-x*math.sin(b)+z*math.cos(b)
        x,y=x*math.cos(c)-y*math.sin(c),x*math.sin(c)+y*math.cos(c)
        return x,y,z

    def cloth(name, point, nx, ny, thickness, color):
        """Closed double-surface cloth shell; exported GLB has real thickness."""
        verts=[]
        for layer in (0,1):
            for j in range(ny+1):
                for i in range(nx+1):
                    x,y,z=point(i/nx,j/ny)
                    verts.append((x,y,z-layer*thickness))
        stride=nx+1; layer_size=stride*(ny+1); faces=[]
        for j in range(ny):
            for i in range(nx):
                a=j*stride+i;b=a+1;d=a+stride;c=d+1
                faces.append((a,b,c,d))
                faces.append((a+layer_size,d+layer_size,c+layer_size,b+layer_size))
        edge=list(range(stride))
        edge.extend(j*stride+nx for j in range(1,ny+1))
        edge.extend(ny*stride+i for i in range(nx-1,-1,-1))
        edge.extend(j*stride for j in range(ny-1,0,-1))
        for a,b in zip(edge,edge[1:]+edge[:1]):
            faces.append((a,a+layer_size,b+layer_size,b))
        counts["cloth_shells"]+=1
        return mesh(name,verts,faces,color,collection="BED",bevel=0)

    def line_uv(name,point,uvs,radius,color,offset=.003,collection="BED"):
        pts=[]
        for u,v in uvs:
            x,y,z=point(u,v);pts.append((x,y,z+offset))
        return tube(name,pts,radius,color,collection=collection)

    # The duvet hugs the mattress across the top and turns down beyond both
    # side rails and the foot. Individual quilt cells have padded geometry.
    def duvet(u,v):
        x=-1.78+(u-.5)*1.80
        y=-.135+(v-.5)*2.11
        edge_x=max(0,(abs(u-.5)*2-.80)/.20)
        foot=max(0,(.11-v)/.11)
        z=.904-.245*edge_x**1.30-.200*foot**1.25
        z+=.010*math.sin(u*math.tau*2+v*3.0)
        z+=.024*(math.sin(math.pi*u*8)**2)*(math.sin(math.pi*v*10)**2)*(1-edge_x*.7)
        z+=.017*math.exp(-((v-.77)/.045)**2)*math.sin(u*math.pi*3)**2
        return x,y,z
    cloth("Premium_Bed_QuiltedIvoryDuvet",duvet,40,48,.037,"textile_ivory")
    for i in range(1,8):
        line_uv(f"Premium_Bed_QuiltLongSeam_{i}",duvet,[(i/8,j/48) for j in range(49)],.0020,"textile_stitch")
    for j in range(1,10):
        line_uv(f"Premium_Bed_QuiltCrossSeam_{j}",duvet,[(i/40,j/10) for i in range(41)],.0018,"textile_stitch")
    rim=[(i/40,0) for i in range(41)]+[(1,j/48) for j in range(1,49)]
    rim += [(i/40,1) for i in range(39,-1,-1)]+[(0,j/48) for j in range(47,-1,-1)]
    line_uv("Premium_Bed_DuvetBoundEdge",duvet,rim,.008,"textile_ivory",offset=-.008)

    def folded_top(u,v):
        x=-1.78+(u-.5)*1.55;y=.576+v*.255
        z=.963+.025*math.sin(v*math.pi)-.084*(abs(u-.5)*2)**8
        return x,y,z
    cloth("Premium_Bed_FoldedSheet",folded_top,26,10,.025,"linen")
    line_uv("Premium_Bed_FoldedSheetHem",folded_top,[(i/26,.08) for i in range(27)],.004,"linen_shadow")

    # A sage woven runner adds a quieter color bridge to Harper's green outfit.
    def runner(u,v):
        x=-1.78+(u-.5)*1.82;y=-.335+(v-.5)*.39
        edge=max(0,(abs(u-.5)*2-.77)/.23)
        z=.966-.268*edge**1.15+.014*math.sin(u*math.tau*4)+.007*math.sin(v*math.pi)
        return x,y,z
    cloth("Premium_Bed_SageRunner",runner,38,10,.019,"textile_sage")
    for row in (.06,.14,.86,.94):
        line_uv(f"Premium_Bed_RunnerWovenBand_{row}",runner,[(i/38,row) for i in range(39)],.003,"textile_ivory")
    for u in (0,1):
        for j in range(12):
            x,y,z=runner(u,(j+.5)/12)
            sign=-1 if u==0 else 1
            tube(f"Premium_Bed_RunnerFringe_{u}_{j}",[(x,y,z),(x+sign*.013,y-.001,z-.025),(x+sign*.026,y+.003,z-.054)],.0045,"textile_ivory",collection="BED")

    # The pink throw has a broad cloth fall at the foot and a longer loose
    # corner down the near side; this is a shaped shell, not a flat slab.
    def throw(u,v):
        x=-1.91+(u-.5)*1.60;y=-1.335+v*.695
        side=max(0,(.13-u)/.13)
        foot=max(0,(.32-v)/.32)
        z=.992-.38*foot**1.15-.19*side**1.15
        z+=.025*math.sin(u*math.tau*5+.5)*(0.4+.6*foot)
        z+=.008*math.sin(v*math.pi*2)+.017*math.exp(-((u-.76)/.11)**2)
        return x,y,z
    cloth("Premium_Bed_RoseDrapedBlanket",throw,42,26,.031,"textile_rose")
    for i in range(1,19):
        line_uv(f"Premium_Bed_ThrowKnitRib_{i}",throw,[(i/20,j/26) for j in range(27)],.0035,"textile_rose_shadow",offset=.002)
    for v in (.045,.092,.91,.956):
        line_uv(f"Premium_Bed_ThrowHem_{v}",throw,[(i/42,v) for i in range(43)],.0034,"pink_light",offset=.004)
    for i in range(22):
        u=(i+.5)/22;x,y,z=throw(u,0)
        for strand in (-1,1):
            tube(f"Premium_Bed_ThrowTassel_{i}_{strand}",[(x+strand*.002,y,z),(x+strand*.004,y-.010,z-.032),(x+strand*.007,y-.006,z-.075)],.0032,"textile_rose",collection="BED")

    def pillow(name,center,width,height,depth,color,orientation="horizontal",angles=(0,0,0),collection="BED",checks=False):
        nx,ny=18,14
        def p(u,v,side=1):
            a=(u-.5)*width;b=(v-.5)*height
            pad=(max(0,math.cos((u-.5)*math.pi)*math.cos((v-.5)*math.pi)))**.68
            thick=side*(depth*.095+depth*.43*pad)
            # Sewn edge has a little puckering, diminishing into the panel.
            thick+=side*.003*math.sin(u*math.pi*12)*math.sin(v*math.pi*10)*(1-pad)
            pos=(a,b,thick) if orientation=="horizontal" else (a,-thick,b)
            pp=rot(pos,angles)
            return tuple(center[i]+pp[i] for i in range(3))
        verts=[p(i/nx,j/ny,s) for s in (1,-1) for j in range(ny+1) for i in range(nx+1)]
        stride=nx+1;size=stride*(ny+1);faces=[]
        for j in range(ny):
            for i in range(nx):
                a=j*stride+i
                faces.extend(((a,a+1,a+1+stride,a+stride),(a+size,a+stride+size,a+stride+1+size,a+1+size)))
        edge=list(range(stride))+[j*stride+nx for j in range(1,ny+1)]
        edge += [ny*stride+i for i in range(nx-1,-1,-1)]+[j*stride for j in range(ny-1,0,-1)]
        for a,b in zip(edge,edge[1:]+edge[:1]):faces.append((a,a+size,b+size,b))
        mesh(name,verts,faces,color,collection=collection,bevel=0)
        outline=[(i/nx,0) for i in range(nx+1)]+[(1,j/ny) for j in range(1,ny+1)]
        outline += [(i/nx,1) for i in range(nx-1,-1,-1)]+[(0,j/ny) for j in range(ny-1,-1,-1)]
        tube(name+"_SewnPiping",[p(u,v) for u,v in outline],.0042,"textile_ivory",collection=collection,cyclic=True)
        if checks:
            for i,u in enumerate((.18,.39,.61,.82)):
                tube(name+f"_CheckVertical_{i}",[p(u,j/30) for j in range(31)],.0052,"textile_ivory",collection=collection)
            for j,v in enumerate((.22,.5,.78)):
                tube(name+f"_CheckHorizontal_{j}",[p(i/30,v) for i in range(31)],.0052,"textile_ivory",collection=collection)
        return p

    pillow("Premium_Bed_LeftLinenPillow",(-2.135,.838,1.052),.653,.438,.237,"linen_shadow",angles=(.14,0,-.07))
    pillow("Premium_Bed_RightLinenPillow",(-1.460,.844,1.062),.650,.432,.237,"linen",angles=(.14,0,.065))
    pillow("Premium_Bed_SageCheckCushion",(-1.752,.572,1.104),.416,.357,.178,"textile_sage",orientation="vertical",angles=(-.17,0,-.04),checks=True)
    # Small flower cushion, with a stitched center and five plump petals.
    fx,fy,fz=-2.229,.511,1.086
    for i in range(5):
        a=math.tau*i/5+.2
        xx=fx+math.cos(a)*.079;zz=fz+math.sin(a)*.079
        sphere(f"Premium_Bed_FlowerPetal_{i}",(xx,fy,zz),(.069,.043,.070),"pink_light",collection="BED",segments=12,rings=8)
    sphere("Premium_Bed_FlowerCenter",(fx,fy-.036,fz),(.057,.031,.057),"cream",collection="BED",segments=14,rings=8)
    tube("Premium_Bed_FlowerCenterStitch",[(fx+math.cos(a)*.043,fy-.063,fz+math.sin(a)*.043) for a in [math.tau*i/28 for i in range(28)]],.002,"gold",collection="BED",cyclic=True)

    # Drawer fronts stay within the original bed-frame footprint and introduce
    # shallow joinery detail instead of adding a new bulky piece of furniture.
    for i,y in enumerate((-.668,.383)):
        box(f"Premium_Bed_DrawerShadow_{i}",(-.984,y,.449),(.018,.916,.235),"oak_dark",collection="BED",bevel=.006)
        box(f"Premium_Bed_DrawerFront_{i}",(-.970,y,.450),(.021,.892,.211),"oak_light",collection="BED",bevel=.005)
        box(f"Premium_Bed_DrawerInset_{i}",(-.955,y,.450),(.010,.788,.135),"oak",collection="BED",bevel=.004)
        box(f"Premium_Bed_DrawerHandleBack_{i}",(-.943,y,.477),(.012,.168,.044),"oak_dark",collection="BED",bevel=.004)
        tube(f"Premium_Bed_DrawerHandle_{i}",[(-.930,y-.073,.472),(-.906,y-.067,.484),(-.906,y+.067,.484),(-.930,y+.073,.472)],.009,"gold",collection="BED")
    box("Premium_Bed_FootboardInset",(-1.78,-1.138,.448),(1.36,.014,.159),"oak_light",collection="BED",bevel=.006)

    # Woven round rug: actual braided concentric threads, a quiet palette, and
    # short cotton knots. All remain walkable below the avatar foot anchor.
    rx,ry=.35,-.72
    cylinder("Premium_Lounge_RugFoundation",(rx,ry,.207),1.48,.040,"rug_oat",vertices=96)
    cylinder("Premium_Lounge_RugFace",(rx,ry,.230),1.437,.012,"rug_cream",vertices=96)
    for i in range(17):
        radius=.102+i*.080
        color="rug_rose" if i in (5,6,12,13) else ("rug_cream" if i%2 else "rug_oat")
        pts=[]
        for j in range(144):
            a=math.tau*j/144
            r=radius+.006*math.sin(a*(26+i*3))
            pts.append((rx+math.cos(a)*r,ry+math.sin(a)*r,.239+.004*math.cos(a*(26+i*3))))
        tube(f"Premium_Lounge_RugBraidedRing_{i:02}",pts,.010,color,cyclic=True)
    # Woven loops between paired border braids create an unmistakable textile edge.
    for i in range(96):
        a=math.tau*i/96
        pts=[]
        for j in range(11):
            t=math.tau*j/10
            r=1.409+.029*math.cos(t)
            angle=a+.014*math.sin(t)
            pts.append((rx+math.cos(angle)*r,ry+math.sin(angle)*r,.237+.006*math.sin(t)**2))
        tube(f"Premium_Lounge_RugBorderLoop_{i:02}",pts,.0045,"rug_cream",cyclic=True)
    for i in range(72):
        a=math.tau*i/72
        for strand in (-1,1):
            aa=a+strand*.002
            tube(f"Premium_Lounge_RugFringe_{i:02}_{strand}",[(rx+math.cos(aa)*r,ry+math.sin(aa)*r,z) for r,z in ((1.465,.221),(1.488,.213),(1.510,.204))],.005,"rug_cream")

    # A soft twelve-panel knitted pouf sits on the near edge of the rug.
    px,py=-.35,-1.50
    levels=[(.243,.311),(.266,.381),(.321,.438),(.413,.462),(.511,.449),(.598,.397),(.653,.300),(.680,.160),(.669,.034)]
    segments=48
    verts=[(px+math.cos(math.tau*i/segments)*r,py+math.sin(math.tau*i/segments)*r,z) for z,r in levels for i in range(segments)]
    faces=[]
    for j in range(len(levels)-1):
        for i in range(segments):faces.append((j*segments+i,j*segments+(i+1)%segments,(j+1)*segments+(i+1)%segments,(j+1)*segments+i))
    faces.extend((tuple(reversed(range(segments))),tuple(range((len(levels)-1)*segments,len(levels)*segments))))
    mesh("Premium_Lounge_KnittedPouf",verts,faces,"textile_rose",bevel=0)
    for i in range(12):
        a=math.tau*i/12
        tube(f"Premium_Lounge_PoufPanelPiping_{i}",[(px+math.cos(a)*(r+.004),py+math.sin(a)*(r+.004),z) for z,r in levels],.005,"textile_rose_shadow")
        # Pair of short knit braids across each broad sewn panel.
        for edge in (-1,1):
            points=[]
            for j in range(23):
                t=j/22;z=.29+t*.30
                radius=.423+.033*math.sin(t*math.pi)
                angle=a+math.pi/12+edge*.046+.009*math.sin(t*math.pi*14)
                points.append((px+math.cos(angle)*radius,py+math.sin(angle)*radius,z))
            tube(f"Premium_Lounge_PoufKnitBraid_{i}_{edge}",points,.0032,"pink_light")
    cylinder("Premium_Lounge_PoufButton",(px,py,.675),.026,.016,"textile_rose_shadow",vertices=16)
    pillow("Premium_Lounge_PoufSmallCushion",(px+.008,py+.045,.727),.292,.235,.101,"textile_sage",angles=(0,.07,-.22),collection="DECOR")

    # Compact tripod reading table, one book and a ceramic tea mug.
    tx,ty=.55,-.80
    cylinder("Premium_Lounge_TableTop",(tx,ty,.685),.36,.072,"oak_light",vertices=48)
    cylinder("Premium_Lounge_TableRim",(tx,ty,.721),.350,.006,"oak",vertices=48)
    cylinder("Premium_Lounge_TableInset",(tx,ty,.726),.334,.008,"oak_light",vertices=48)
    cylinder("Premium_Lounge_TableLowerShelf",(tx,ty,.356),.275,.042,"oak",vertices=36)
    for i in range(3):
        a=math.tau*i/3+.32
        bottom=(tx+math.cos(a)*.254,ty+math.sin(a)*.254,.218)
        top=(tx+math.cos(a)*.214,ty+math.sin(a)*.214,.664)
        tube(f"Premium_Lounge_TableSplayedLeg_{i}",[bottom,top],.030,"oak")
        cylinder(f"Premium_Lounge_TableFoot_{i}",(bottom[0],bottom[1],.221),.033,.025,"oak_dark",vertices=12)
    # Shallow engraved growth-rings remain visible around the book.
    for i in range(3):
        pts=[]
        for j in range(49):
            a=math.tau*j/48;r=.226+i*.043+.005*math.sin(a*3)
            pts.append((tx+math.cos(a)*r,ty+math.sin(a)*r,.731))
        tube(f"Premium_Lounge_TableGrainRing_{i}",pts,.0009,"oak")
    def flat_book(name,center,width,length,thickness,color,angle):
        def pos(x,y,z):
            return(center[0]+x*math.cos(angle)-y*math.sin(angle),
                   center[1]+x*math.sin(angle)+y*math.cos(angle),center[2]+z)
        box(name+"_PageBlock",center,(width-.011,length-.012,thickness-.009),"paper",bevel=.001,rotation=(0,0,angle))
        for sign in (-1,1):
            box(name+f"_Cover_{sign}",pos(0,0,sign*(thickness*.5-.002)),(width,length,.004),color,bevel=.0008,rotation=(0,0,angle))
        box(name+"_Spine",pos(-width*.5,0,0),(.006,length,thickness),color,bevel=.001,rotation=(0,0,angle))
        for i in range(6):
            zz=-thickness*.34+i*thickness*.68/5
            box(name+f"_PageEdge_{i}",pos(width*.5-.004,0,zz),(.0009,length-.026,.0009),"linen_shadow",bevel=0,rotation=(0,0,angle))
        box(name+"_CoverLabel",pos(.015,.022,thickness*.5+.0004),(width*.55,length*.32,.0014),"cream",bevel=.0003,rotation=(0,0,angle))
        for j in range(3):
            box(name+f"_LabelRule_{j}",pos(.015,.043-j*.021,thickness*.5+.0014),(width*.39,.002,.0006),"sage",bevel=0,rotation=(0,0,angle))
    flat_book("Premium_Lounge_CurrentRead",(.441,-.757,.750),.231,.267,.038,"sage",-.11)
    flat_book("Premium_Lounge_LowerBookA",(.560,-.795,.399),.235,.262,.042,"pink",.12)
    flat_book("Premium_Lounge_LowerBookB",(.556,-.790,.437),.220,.249,.034,"cream",-.08)
    mx,my=.706,-.912
    cylinder("Premium_Lounge_CupSaucer",(mx,my,.736),.093,.012,"cream",vertices=32)
    cylinder("Premium_Lounge_CeramicMug",(mx,my,.800),.065,.119,"cream",vertices=32,radius_top=.071)
    cylinder("Premium_Lounge_MugTea",(mx,my,.859),.060,.003,"tea",vertices=32)
    tube("Premium_Lounge_MugRim",[(mx+math.cos(a)*.067,my+math.sin(a)*.067,.861) for a in [math.tau*i/40 for i in range(40)]],.0045,"linen",cyclic=True)
    tube("Premium_Lounge_MugHandle",[(mx+.062+math.sin(math.pi*t)*.043,my,.839-t*.076) for t in [i/18 for i in range(19)]],.009,"cream")
    # One tiny stitched bookmark makes the tabletop belong to a reader.
    box("Premium_Lounge_Bookmark",(.414,-.898,.747),(.023,.083,.003),"pink_dark",bevel=.0005,rotation=(0,0,-.11))

    counts["layout"]={"bed_center":[-1.78,.15],"rug_center":[rx,ry],"rug_radius":1.48,
                      "pouf_center":[px,py],"table_center":[tx,ty],"table_top":.730,
                      "avatar_clearance_center":[1.55,-.1],"avatar_clearance_radius":.38}
    return counts
