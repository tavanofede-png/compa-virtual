"""Production garment/accessory geometry pass for the existing v3 character masters.

Every position is in the masters' metre-scale bind space.  This module does not
rebuild the skeleton and creates separate, named garment objects in the existing
wardrobe slots.  Ring meshes are cloth silhouettes, not disconnected cube tiles.
"""
from __future__ import annotations

import math

import bpy
from mathutils import Vector


def upgrade(ctx):
    c = ctx.character
    counts = {"removed": 0, "created": 0, "weighted_elbow_bridges": 0}

    def remove_prefixes(prefixes):
        for obj in list(bpy.data.objects):
            if obj.type == "MESH" and any(obj.name.startswith(p) for p in prefixes):
                ctx.remove(obj)
                counts["removed"] += 1

    def box(name, loc, dims, key, slot, bone, bevel=.002, rotation=(0, 0, 0)):
        counts["created"] += 1
        return ctx.box(name, loc, dims, ctx.mat(key) if isinstance(key, str) else key,
                       slot, bone, bevel=bevel, rotation=rotation)

    def mesh(name, verts, faces, key, slot, bone, bevel=.0015):
        data = bpy.data.meshes.new(name + "Geometry")
        data.from_pydata(verts, [], faces)
        data.update()
        obj = bpy.data.objects.new(name, data)
        ctx.collection(slot).objects.link(obj)
        obj.data.materials.append(ctx.mat(key))
        if bevel:
            mod = obj.modifiers.new("Tailored edge radius", "BEVEL")
            mod.width = bevel
            mod.segments = 1
        counts["created"] += 1
        return ctx.attach(obj, slot, bone)

    def beam(name, a, b, width, depth, key, slot, bone, bevel=.001):
        a, b = Vector(a), Vector(b)
        q = (b - a).to_track_quat("Z", "Y")
        return box(name, (a+b)*.5, (width, depth, (b-a).length), key, slot, bone,
                   bevel, q.to_euler())

    # Rectangular ring with intentional chamfers; 8 corners keep the voxel profile.
    def ring(width, depth, corner=.19):
        x, y = width*.5, depth*.5
        k = min(x, y)*corner
        return ((-x+k,-y), (x-k,-y), (x,-y+k), (x,y-k),
                (x-k,y), (-x+k,y), (-x,y-k), (-x,-y+k))

    def rings(name, profiles, key, slot, bone, transform=None, bevel=.0015):
        verts = []
        for z, width, depth, dx, dy in profiles:
            for x, y in ring(width, depth):
                p = Vector((x+dx, y+dy, z))
                verts.append(tuple(transform(p) if transform else p))
        faces = [tuple(reversed(range(8)))]
        for i in range(len(profiles)-1):
            for j in range(8):
                k, n = i*8+j, i*8+(j+1)%8
                faces.append((k, n, n+8, k+8))
        faces.append(tuple(range((len(profiles)-1)*8, len(profiles)*8)))
        return mesh(name, verts, faces, key, slot, bone, bevel)

    def limb(name, start, end, profiles, key, slot, bone):
        a, b = Vector(start), Vector(end)
        q = (b-a).to_track_quat("Z", "Y")
        length = (b-a).length
        ps = [(t*length,w,d,dx,dy) for t,w,d,dx,dy in profiles]
        return rings(name, ps, key, slot, bone, lambda p:a+q@p)

    def stitch_line(name, a, b, n, key, slot, bone, width=.0013):
        a,b=Vector(a),Vector(b)
        for i in range(n):
            p=a+(b-a)*(i+.13)/n
            q=a+(b-a)*(i+.57)/n
            beam(f"{name}_{i:02}",p,q,width,width,key,slot,bone,0)

    # Replace primitive leg slabs by a continuous pattern with a shaped hip,
    # knee drape, compression folds and a fitted ankle.  Separate hip/thigh/shin
    # meshes preserve the current wardrobe/rig contract.
    remove_prefixes(("Bottom_Thigh_", "Bottom_Shin_", "Bottom_OuterSeam_", "Bottom_Cuff_",
                     "Bottom_CargoPocket_", "Bottom_CargoFlap_", "Shoe_", "Backpack_",
                     "Top_UpperSleeve_", "Top_ForeSleeve_", "Top_ShoulderCap_", "Top_Cuff_",
                     "Top_KnitRib_", "Top_Torso", "Top_Hem"))
    wide = c.bottom_style in ("cargo", "wide_jeans")
    w = .210 if wide else .186
    for side, sign in (("L", -1), ("R", 1)):
        x=sign*.128
        profiles=[(.414,w-.020,.214,0,.009),(.438,w+.001,.242,.001*sign,-.003),
                  (.459,w-.009,.228,0,.001),(.507,w-.003,.237,-.003*sign,.003),
                  (.576,w+.006,.249,0,.004),(.637,w+.013,.254,.002*sign,.002),
                  (.705,w+.003,.248,0,0),(.765,w-.009,.242,-.003*sign,0),
                  (.814,w-.012,.237,-.009*sign,0)]
        rings(f"Premium_Pants_ThighPattern_{side}",profiles,"bottom","bottom",f"thigh.{side}",
              lambda p:p+Vector((x,0,0)))
        profiles=[(.142,w-.012,.232,0,.002),(.174,w-.015,.222,0,.002),
                  (.197,w-.027,.210,.003*sign,0),(.222,w-.004,.230,-.002*sign,.007),
                  (.250,w-.020,.212,0,.001),(.298,w-.024,.216,0,.012),
                  (.346,w-.020,.221,.002*sign,.010),(.387,w-.009,.242,0,.002),
                  (.411,w-.016,.232,0,.002),(.458,w-.020,.220,0,.005)]
        rings(f"Premium_Pants_ShinPattern_{side}",profiles,"bottom","bottom",f"shin.{side}",
              lambda p:p+Vector((x,0,0)))
        # Front crease follows the trouser panel; hems have a true turned edge.
        for bn,z0,z1,dep in ((f"thigh.{side}",.495,.765,-.127),(f"shin.{side}",.23,.38,-.109)):
            beam(f"Premium_Pants_PressedSeam_{side}_{z0}",(x+sign*.046,dep,z0),(x+sign*.044,dep-.001,z1),
                 .0025,.002,"bottom_dark","bottom",bn)
        box(f"Premium_Pants_TurnedHem_{side}",(x,.004,.157),(w+.002,.240,.038),"bottom_dark","bottom",f"shin.{side}",.003)
        box(f"Premium_Pants_HemLip_{side}",(x,-.119,.177),(w-.010,.006,.009),"bottom","bottom",f"shin.{side}",.001)
        stitch_line(f"Premium_Pants_HemStitch_{side}",(x-w*.42,-.123,.161),(x+w*.42,-.123,.161),13,"bottom","bottom",f"shin.{side}")
        # Hip pocket opening is a slanted welt with its inner shadow and rim.
        beam(f"Premium_Pants_HipPocket_{side}",(x+sign*.049,-.126,.816),(x+sign*.076,-.124,.736),.013,.004,"bottom_dark","bottom",f"thigh.{side}")
        beam(f"Premium_Pants_HipPocketLip_{side}",(x+sign*.043,-.130,.813),(x+sign*.070,-.129,.736),.004,.004,"bottom","bottom",f"thigh.{side}")
        # Fold fans near the knee are narrow cloth ridges rather than armor plates.
        for i in range(3):
            z=.466+i*.014
            beam(f"Premium_Pants_KneeFold_{side}_{i}",(x-sign*.080,-.115,z+.006),(x+sign*(.035-i*.010),-.121,z-.013),
                 .004,.003,"bottom_dark" if i==1 else "bottom","bottom",f"thigh.{side}")
        if c.bottom_style=="cargo":
            px=x+sign*.087
            box(f"Premium_Pants_CargoGusset_{side}",(px,-.011,.601),(.075,.264,.148),"bottom_dark","bottom",f"thigh.{side}",.003)
            box(f"Premium_Pants_CargoFace_{side}",(px,-.148,.600),(.095,.016,.143),"bottom","bottom",f"thigh.{side}",.003)
            box(f"Premium_Pants_CargoFlap_{side}",(px,-.160,.667),(.108,.014,.040),"bottom","bottom",f"thigh.{side}",.004)
            box(f"Premium_Pants_CargoPleat_{side}",(px,-.160,.596),(.009,.008,.103),"bottom_dark","bottom",f"thigh.{side}",.001)
            box(f"Premium_Pants_CargoSnap_{side}",(px,-.170,.659),(.009,.006,.009),"metal","bottom",f"thigh.{side}",.001)
            stitch_line(f"Premium_Pants_CargoStitch_{side}",(px-.040,-.160,.534),(px+.040,-.160,.534),9,"bottom_dark","bottom",f"thigh.{side}")
        # Five loop positions collectively support a real replaceable belt.
        for j,px in enumerate((x-sign*.045,x+sign*.052)):
            box(f"Premium_Pants_BeltLoop_{side}_{j}",(px,-.135,.874),(.013,.011,.061),"bottom","bottom","hips",.001)
        box(f"Premium_Pants_RearPocket_{side}",(x,.132,.744),(.114,.011,.113),"bottom_dark","bottom",f"thigh.{side}",.004)
        box(f"Premium_Pants_RearPocketFacing_{side}",(x,.139,.744),(.104,.005,.099),"bottom","bottom",f"thigh.{side}",.003)
    box("Premium_Pants_FlyPlacket",(.011,-.131,.833),(.028,.009,.094),"bottom_dark","bottom","hips",.0015)
    box("Premium_Pants_WaistButton",(0,-.145,.874),(.014,.007,.014),"metal","bottom","hips",.002)

    # Torso ring silhouette: shoulder slope, slight waist pinch, layered hem.
    rings("Premium_Top_TailoredTorso",[(.831,.461,.276,0,0),(.864,.476,.283,0,0),
          (.891,.466,.279,0,0),(.948,.444,.272,0,.004),(1.028,.448,.279,0,.006),
          (1.099,.468,.290,0,.002),(1.175,.488,.299,0,0),
          (1.235,.484,.295,0,.004),(1.274,.417,.272,0,.006),
          (1.302,.302,.233,0,.003)],"top","top","spine",bevel=.003)
    box("Premium_Top_RibbedWaistband",(0,-.001,.852),(.479,.286,.059),"top_dark","top","spine",.005)
    for i in range(32):
        xx=-.221+i*.01425
        box(f"Premium_Top_HemRib_{i:02}",(xx,-.146,.852),(.003,.003,.045),"top","top","spine",.0006)
    for sign in (-1,1):
        x=sign*.181
        beam(f"Premium_Top_SideSeam_{sign}",(x,-.132,.900),(sign*.205,-.143,1.213),.003,.004,"top_dark","top","spine")
        for i in range(3):
            beam(f"Premium_Top_WaistFold_{sign}_{i}",(sign*(.119+i*.013),-.144,.902+i*.012),(sign*.211,-.142,.917+i*.018),
                 .003,.003,"top_light","top","spine",.0006)

    if c.top_style=='sweater':
        # A restrained woven front panel has real sub-millimetre facets. The
        # broad drape remains readable; this is not random color noise.
        rows,cols=25,20;verts=[]
        for row in range(rows+1):
            z=.91+row*.013
            depth=.140 if z<1.08 else .146
            for col in range(cols+1):
                x=-.176+col*.0176
                relief=.0012*(.5+.5*math.sin(col*math.pi/2+row*math.pi))
                verts.append((x,-depth-relief,z))
        faces=[]
        for row in range(rows):
            for col in range(cols):
                a=row*(cols+1)+col
                faces.append((a,a+cols+1,a+cols+2,a+1))
        mesh('Premium_Top_WovenFrontRelief',verts,faces,'top','top','spine',0)

    def elbow_bridge(side, elbow, upper_dir, fore_dir, key):
        """Smooth two-bone skinned gusset joins rigid sleeve patterns at the elbow."""
        elbow=Vector(elbow); upper_dir=Vector(upper_dir).normalized(); fore_dir=Vector(fore_dir).normalized()
        qa=upper_dir.to_track_quat("Z","Y"); qb=fore_dir.to_track_quat("Z","Y")
        verts=[]
        weights=[]
        for r,(dist,t) in enumerate(((-.060,0),(-.030,.16),(0,.50),(.030,.84),(.060,1))):
            q=qa.slerp(qb,t)
            center=elbow+(upper_dir if dist<0 else fore_dir)*dist
            for xx,yy in ring(.177,.205,.30):
                verts.append(tuple(center+q@Vector((xx,yy,0))))
                weights.append(t)
        faces=[]
        for r in range(4):
            for j in range(8):
                faces.append((r*8+j,r*8+(j+1)%8,(r+1)*8+(j+1)%8,(r+1)*8+j))
        obj=mesh(f"Premium_Top_ElbowGusset_{side}",verts,faces,key,"top",f"forearm.{side}",0)
        bpy.context.view_layer.update()
        world=obj.matrix_world.copy()
        obj.parent=ctx.rig; obj.parent_type="OBJECT"; obj.parent_bone=""
        obj.matrix_world=world
        for g in list(obj.vertex_groups):
            obj.vertex_groups.remove(g)
        a=obj.vertex_groups.new(name=f"upper_arm.{side}")
        b=obj.vertex_groups.new(name=f"forearm.{side}")
        for i,t in enumerate(weights):
            if t<1:a.add([i],1-t,"REPLACE")
            if t>0:b.add([i],t,"REPLACE")
        mod=obj.modifiers.new("Shared rig elbow drape","ARMATURE");mod.object=ctx.rig
        obj["compa_weighted_garment"]=True
        obj["compa_item"]=c.top_style
        obj["compa_deformation"]= "two-bone normalized elbow gusset"
        counts["weighted_elbow_bridges"]+=1

    for side,sign in (("L",-1),("R",1)):
        sleeve_key="white" if c.top_style=="varsity" else "top"
        shoulder=Vector((sign*.225,0,1.23)); elbow=Vector((sign*.375,-.005,.985)); wrist=Vector((sign*.405,-.020,.755))
        d1=(elbow-shoulder).normalized(); d2=(wrist-elbow).normalized()
        # A single continuous sleeve pattern spans the joint. Ring weights blend
        # gradually across the elbow; no disconnected rigid upper/lower caps.
        qa=d1.to_track_quat('Z','Y'); qb=d2.to_track_quat('Z','Y')
        sleeve_rings=[]
        for t,w,d in ((-.12,.183,.224),(.02,.214,.242),(.15,.224,.245),(.35,.218,.239),(.60,.203,.226),(.80,.198,.222)):
            sleeve_rings.append((shoulder+(elbow-shoulder)*t,qa,w,d,0.0))
        for dist,t in ((-.036,.08),(-.018,.26),(0,.50),(.018,.74),(.036,.92)):
            sleeve_rings.append((elbow+(d1 if dist<0 else d2)*dist,qa.slerp(qb,t),.198,.224,t))
        for t,w,d in ((.28,.195,.221),(.44,.185,.214),(.62,.177,.206),(.79,.183,.211),(.94,.169,.197),(1.04,.166,.193)):
            sleeve_rings.append((elbow+(wrist-elbow)*t,qb,w,d,1.0))
        verts=[]; skin_weights=[]
        for center,q,width,depth,t in sleeve_rings:
            verts.extend(tuple(center+q@Vector((xx,yy,0))) for xx,yy in ring(width,depth,.23))
            skin_weights.extend([t]*8)
        faces=[tuple(reversed(range(8)))]
        for row in range(len(sleeve_rings)-1):
            faces.extend((row*8+k,row*8+(k+1)%8,(row+1)*8+(k+1)%8,(row+1)*8+k) for k in range(8))
        faces.append(tuple(range(len(verts)-8,len(verts))))
        obj=mesh(f'Premium_Top_ContinuousSleeve_{side}',verts,faces,sleeve_key,'top',f'upper_arm.{side}',.0012)
        bpy.context.view_layer.update()
        world=obj.matrix_world.copy()
        obj.parent=ctx.rig;obj.parent_type='OBJECT';obj.parent_bone=''
        obj.matrix_world=world
        upper=obj.vertex_groups.new(name=f'upper_arm.{side}')
        fore=obj.vertex_groups.new(name=f'forearm.{side}')
        for i,t in enumerate(skin_weights):
            if t<1:upper.add([i],1-t,'REPLACE')
            if t>0:fore.add([i],t,'REPLACE')
        mod=obj.modifiers.new('Continuous sleeve deformation','ARMATURE');mod.object=ctx.rig
        obj['compa_weighted_garment']=True
        obj['compa_item']=c.top_style
        counts['weighted_elbow_bridges']+=1
        cuff_start=wrist-d2*.051; cuff_end=wrist+d2*.016
        limb(f"Premium_Top_TurnedCuff_{side}",cuff_start,cuff_end,
             [(0,.180,.210,0,0),(.15,.185,.212,0,0),(.86,.180,.207,0,0),(1,.171,.196,0,0)],
             "top_dark","top",f"forearm.{side}")
        q=d2.to_track_quat("Z","Y")
        for i in range(11):
            p=cuff_start+q@Vector((-.074+i*.0148,-.106,.008))
            beam(f"Premium_Top_CuffRib_{side}_{i}",p,p+d2*.046,.002,.002,sleeve_key,"top",f"forearm.{side}",.0005)
        # Sleeve stitching follows the bone's own coordinate system.
        qa=d1.to_track_quat("Z","Y")
        aa=shoulder+qa@Vector((sign*.088,-.114,.018))
        bb=elbow+qa@Vector((sign*.073,-.109,-.028))
        stitch_line(f"Premium_Top_SleeveStitch_{side}",aa,bb,20,"top_dark","top",f"upper_arm.{side}")

    if c.top_style=="sweater":
        remove_prefixes(("Top_Collar_",))
        # Shirt points are folded shapes in the X/Z plane with an under-fold.
        # Rotating a cube around Z made the previous collars twist horizontally.
        for sign in (-1,1):
            outline=[(sign*.013,1.323),(sign*.070,1.331),(sign*.145,1.290),
                     (sign*.092,1.238),(sign*.047,1.281)]
            front=[(x,-.165,z) for x,z in outline]
            back=[(x,-.143,z) for x,z in outline]
            faces=[tuple(range(4,-1,-1)),tuple(range(5,10))]
            faces.extend((i,(i+1)%5,(i+1)%5+5,i+5) for i in range(5))
            obj=mesh(f"Premium_Top_FoldedShirtCollar_{sign}",front+back,faces,"white","top","spine",.0015)
            # Orient winding consistently for mirrored collar halves.
            if sign<0:
                for polygon in obj.data.polygons:
                    polygon.flip()
        # Fine knit relief concentrated at construction edges; central surface stays cloth.
        for sign in (-1,1):
            beam(f"Premium_Top_NeckRib_{sign}",(sign*.136,-.141,1.300),(sign*.046,-.161,1.248),.017,.009,"top_dark","top","spine",.002)
        box("Premium_Top_ShirtHem",(0,-.001,.816),(.435,.258,.032),"white","top","spine",.003)
        for i in range(26):
            box(f"Premium_Top_ShirtHemPleat_{i}",(-.197+i*.0158,-.131,.815),(.002,.003,.024),"paper","top","spine",.0005)
    elif c.top_style=="hoodie":
        box("Premium_Top_PocketTopSeam",(0,-.182,1.071),(.241,.004,.006),"top_dark","top","spine",.001)
        for sign in (-1,1):
            beam(f"Premium_Top_PocketEntry_{sign}",(sign*.147,-.185,1.057),(sign*.108,-.185,.963),.009,.007,"top_dark","top","spine",.002)
            box(f"Premium_Top_DrawstringAglet_{sign}",(sign*.055,-.171,1.149),(.010,.013,.025),"metal","top","spine",.001)
        stitch_line("Premium_Top_PocketBottomStitch",(-.116,-.183,.938),(.116,-.183,.938),25,"top_dark","top","spine")
    elif c.top_style in ("cardigan","cropped_jacket","varsity"):
        for sign in (-1,1):
            box(f"Premium_Top_FrontFacing_{sign}",(sign*.051,-.163,1.072),(.052,.021,.347),"top_dark","top","spine",.003)
            stitch_line(f"Premium_Top_FrontFacingStitch_{sign}",(sign*.036,-.177,.928),(sign*.036,-.177,1.215),24,"top_light","top","spine")
            box(f"Premium_Top_WeltPocket_{sign}",(sign*.150,-.169,.982),(.098,.013,.032),"top_dark","top","spine",.003,rotation=(0,0,sign*.15))

    if c.top_style=='cardigan':
        remove_prefixes(('Top_InnerShirt','Top_CardiganOpening','Premium_Top_FrontFacing','Premium_Top_WeltPocket'))
        mesh('Premium_Top_InnerShirtInset',[(-.108,-.150,1.270),(.108,-.150,1.270),(.041,-.146,.888),(-.041,-.146,.888)],[(0,1,2,3)],'white','top','spine',0)
        for sign in (-1,1):
            front=[(sign*.153,-.150,1.275),(sign*.104,-.160,1.264),(sign*.037,-.153,.894),(sign*.092,-.147,.892)]
            back=[(x,y+.010,z) for x,y,z in front]
            mesh(f'Premium_Top_CardiganPlacket_{sign}',front+back,[(0,1,2,3),(7,6,5,4),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],'top_light','top','spine',.001)
        for i,z in enumerate((.96,1.055,1.15)):
            x=-.045-(z-.894)*.17
            box(f'Premium_Top_CardiganButton_{i}',(x,-.167,z),(.010,.007,.010),'metal','top','spine',.001)
    if c.top_style=='varsity':
        remove_prefixes(('Top_LetterPatch',))
        for row,line in enumerate(('11111','00010','00010','00010','10010','10010','01100')):
            for col,bit in enumerate(line):
                if bit=='1':box(f'Premium_Top_JPatch_{row}_{col}',(-.155+col*.017,-.158,1.226-row*.018),(.016,.006,.017),'white','top','spine',.0008)
    if c.top_style=='cropped_jacket':
        remove_prefixes(('Top_CropPanel','Top_JacketZip','Premium_Top_RibbedWaistband','Premium_Top_HemRib','Premium_Top_WaistFold','Premium_Top_SideSeam','Premium_Top_FrontFacing','Premium_Top_WeltPocket'))
        torso=ctx.find('Premium_Top_TailoredTorso')
        # Raise only the lower pattern rows, preserving the shoulder fit.
        for v in torso.data.vertices:
            if v.co.z<1.00:v.co.z=.968+(v.co.z-.831)*.17
        box('Premium_Top_CroppedHem',(0,0,.974),(.462,.284,.028),'top_dark','top','spine',.003)
        box('Premium_Body_Waist',(0,0,.923),(.374,.242,.108),'skin','body','hips',.005)
        mesh('Premium_Top_CroppedTee',[(-.114,-.151,1.249),(.114,-.151,1.249),(.101,-.153,.994),(-.101,-.153,.994)],[(0,1,2,3)],'white','top','spine',0)
        for row,line in enumerate(('0110110','1111111','1111111','0111110','0011100','0001000')):
            for col,bit in enumerate(line):
                if bit=='1':box(f'Premium_Top_Heart_{row}_{col}',(-.047+col*.0155,-.159,1.184-row*.016),(.015,.004,.015),'accent','top','spine',.0005)

    # Bespoke shoe last: 3 rubber layers, shaped leather/cloth upper, toe guard,
    # quarter panels, padded tongue, heel counter and real crossing laces.
    for side,sign in (("L",-1),("R",1)):
        x=sign*.135; bone=f"foot.{side}"
        shoe="shoes"; trim="shoes" if c.id=="harper" else "accent"
        rings(f"Premium_Shoe_Outsole_{side}",[(.004,.222,.352,0,-.044),(.012,.237,.359,0,-.044),(.030,.237,.359,0,-.044)],"sole","shoes",bone,lambda p:p+Vector((x,0,0)),.002)
        rings(f"Premium_Shoe_Midsole_{side}",[(.030,.234,.355,0,-.044),(.045,.230,.351,0,-.044),(.061,.225,.346,0,-.044)],"sole","shoes",bone,lambda p:p+Vector((x,0,0)),.002)
        rings(f"Premium_Shoe_UpperLast_{side}",[(.058,.222,.342,0,-.044),(.084,.218,.329,0,-.046),(.111,.205,.303,0,-.039),
              (.139,.183,.248,0,-.015),(.169,.159,.174,0,.011),(.183,.152,.158,0,.018)],shoe,"shoes",bone,lambda p:p+Vector((x,0,0)),.003)
        box(f"Premium_Shoe_ToeOverlay_{side}",(x,-.180,.103),(.202,.077,.031),trim,"shoes",bone,.004)
        box(f"Premium_Shoe_HeelCounter_{side}",(x,.117,.114),(.171,.018,.094),shoe,"shoes",bone,.004)
        box(f"Premium_Shoe_HeelTab_{side}",(x,.127,.172),(.041,.016,.035),trim,"shoes",bone,.002)
        box(f"Premium_Shoe_CollarOpening_{side}",(x,.014,.183),(.144,.136,.020),"black","shoes",bone,.004)
        box(f"Premium_Shoe_PaddedTongue_{side}",(x,-.069,.159),(.099,.104,.031),shoe,"shoes",bone,.003,rotation=(.28,0,0))
        box(f"Premium_Shoe_TongueLabel_{side}",(x,-.069,.183),(.041,.029,.004),trim,"shoes",bone,.001,rotation=(.28,0,0))
        for edge in (-1,1):
            box(f"Premium_Shoe_QuarterPanel_{side}_{edge}",(x+edge*.099,-.026,.108),(.010,.165,.052),trim,"shoes",bone,.002)
            for j in range(7):
                box(f"Premium_Shoe_OutsoleGroove_{side}_{edge}_{j}",(x+edge*.117,-.171+j*.047,.016),(.004,.011,.019),"shoes","shoes",bone,.0005)
            stitch_line(f"Premium_Shoe_SideStitch_{side}_{edge}",(x+edge*.106,-.125,.086),(x+edge*.095,.066,.086),15,"sole","shoes",bone,.0009)
        for j in range(5):
            y=-.133+j*.018; z=.143+j*.006
            for edge in (-1,1):
                box(f"Premium_Shoe_Eyelet_{side}_{j}_{edge}",(x+edge*.050,y,z),(.011,.009,.005),"metal","shoes",bone,.001)
            beam(f"Premium_Shoe_LaceCrossA_{side}_{j}",(x-.050,y,z+.004),(x+.048,y+.016,z+.010),.0045,.0035,"sole","shoes",bone,.0008)
            beam(f"Premium_Shoe_LaceCrossB_{side}_{j}",(x+.050,y,z+.004),(x-.048,y+.016,z+.010),.0045,.0035,"sole","shoes",bone,.0008)
        stitch_line(f"Premium_Shoe_ToeStitch_{side}",(x-.082,-.220,.091),(x+.082,-.220,.091),16,"sole","shoes",bone,.001)

    # Backpack construction faces out toward +Y; straps wrap over shoulders.
    rings("Premium_Backpack_MainShell",[(.796,.336,.173,0,.211),(.827,.403,.202,0,.220),
          (.955,.431,.215,0,.226),(1.147,.424,.222,0,.219),(1.244,.362,.193,0,.211),
          (1.294,.259,.151,0,.199)],"backpack","back","spine",bevel=.005)
    box("Premium_Backpack_BackPadding",(0,.127,1.070),(.354,.035,.398),"black","back","spine",.008)
    box("Premium_Backpack_FrontCompartment",(0,.345,1.001),(.324,.056,.238),"backpack","back","spine",.008)
    box("Premium_Backpack_FrontPocket",(0,.383,.947),(.264,.032,.122),"backpack","back","spine",.004)
    box("Premium_Backpack_PocketFacing",(0,.403,.947),(.238,.010,.096),"backpack","back","spine",.003)
    for z,yy,width in ((1.109,.378,.282),(1.009,.407,.238)):
        box(f"Premium_Backpack_ZipperTape_{z}",(0,yy,z),(width,.008,.014),"black","back","spine",.001)
        for j in range(29):
            box(f"Premium_Backpack_ZipTooth_{z}_{j}",(-width*.46+j*width*.92/28,yy+.007,z+(j%2-.5)*.002),(.004,.004,.006),"metal","back","spine",.0004)
        box(f"Premium_Backpack_ZipSlider_{z}",(width*.31,yy+.013,z),(.015,.009,.013),"metal","back","spine",.001)
        box(f"Premium_Backpack_ZipPull_{z}",(width*.31,yy+.013,z-.019),(.009,.008,.029),"black","back","spine",.001)
    # Leather diamond patch and stitching preserve Harper's academic bag motif.
    box("Premium_Backpack_LeatherPatch",(0,.348,1.195),(.062,.015,.062),"bottom_dark","back","spine",.002,rotation=(0,math.pi*.25,0))
    for sign in (-1,1):
        box(f"Premium_Backpack_PatchSlot_{sign}",(sign*.010,.358,1.195),(.004,.004,.029),"black","back","spine",.0005)
        box(f"Premium_Backpack_SidePouch_{sign}",(sign*.218,.228,.947),(.048,.161,.174),"backpack","back","spine",.006)
        box(f"Premium_Backpack_SidePouchLip_{sign}",(sign*.231,.225,1.030),(.054,.169,.024),"black","back","spine",.002)
        # Five padded strap pieces track the shoulder instead of ending on the chest.
        points=[(sign*.144,.163,1.268),(sign*.162,.090,1.329),(sign*.174,-.032,1.330),
                (sign*.178,-.163,1.246),(sign*.175,-.175,1.039),(sign*.172,-.143,.932)]
        for i,(a,b) in enumerate(zip(points,points[1:])):
            beam(f"Premium_Backpack_PaddedStrap_{sign}_{i}",a,b,.057,.033,"backpack","back","spine",.003)
        box(f"Premium_Backpack_StrapAdjuster_{sign}",(sign*.174,-.198,1.071),(.068,.017,.037),"black","back","spine",.002)
        box(f"Premium_Backpack_StrapBuckle_{sign}",(sign*.174,-.208,1.071),(.043,.007,.012),"metal","back","spine",.001)
        stitch_line(f"Premium_Backpack_StrapStitch_{sign}",(sign*.154,-.195,1.102),(sign*.154,-.191,1.228),16,"bottom_dark","back","spine",.0009)
    # U handle is actual clear geometry, not a solid blob.
    for sign in (-1,1):
        beam(f"Premium_Backpack_HandleSide_{sign}",(sign*.052,.213,1.276),(sign*.055,.213,1.354),.019,.027,"backpack","back","spine",.002)
    beam("Premium_Backpack_HandleGrip",(-.056,.213,1.354),(.056,.213,1.354),.023,.031,"backpack","back","spine",.003)
    for x in (-.115,.115):
        stitch_line(f"Premium_Backpack_PocketEdge_{x}",(x,.411,.903),(x,.411,.986),12,"bottom_dark","back","spine",.001)
    stitch_line("Premium_Backpack_PocketBottom",(-.115,.411,.901),(.115,.411,.901),26,"bottom_dark","back","spine",.001)

    # Harper's notebooks are three independently editable products. Their neutral
    # carry bind location overlaps the left grip and moves with hand.L; pose may
    # bring the arm to the chest without creating a second world-fixed prop.
    if c.id=="harper":
        for index,(xx,yy,zz,width,height,cover) in enumerate((
            (-.376,-.125,.726,.213,.306,"book"),
            (-.384,-.165,.735,.224,.328,"bottom_dark"),
            (-.390,-.204,.724,.200,.288,"book"))):
            slot="hand_prop";bone="hand.L"; depth=.026
            box(f"Premium_Notebook_{index}_PageBlock",(xx,yy,zz),(width-.012,depth,height-.012),"paper",slot,bone,.001)
            for sign in (-1,1):
                box(f"Premium_Notebook_{index}_Cover_{sign}",(xx,yy+sign*(depth*.5+.003),zz),(width,.005,height),cover,slot,bone,.001)
            box(f"Premium_Notebook_{index}_Spine",(xx-width*.5+.002,yy,zz),(.008,depth+.008,height),cover,slot,bone,.001)
            # Exposed fore-edge has small page cuts, visibly layered in close-up.
            for j in range(8):
                box(f"Premium_Notebook_{index}_PageEdge_{j}",(xx+width*.5-.005,yy-.012+j*.0033,zz),(.002,.0008,height-.021),"bottom_dark",slot,bone,0)
            for j in range(7):
                box(f"Premium_Notebook_{index}_TopPage_{j}",(xx,yy-.010+j*.0032,zz+height*.5-.004),(width-.024,.0007,.001),"bottom_dark",slot,bone,0)
            box(f"Premium_Notebook_{index}_Label",(xx+.011,yy-.019,zz+.057),(width*.54,.002,height*.16),"paper",slot,bone,.0005)
            for j in range(3):
                box(f"Premium_Notebook_{index}_LabelRule_{j}",(xx+.011,yy-.021,zz+.069-j*.012),(width*.37,.001,.0012),"book",slot,bone,0)
            box(f"Premium_Notebook_{index}_SpineBand",(xx-width*.5-.003,yy,zz-.080),(.003,depth+.013,.008),"metal",slot,bone,.0004)

    # Rebuild hands as articulated-looking grouped fingers on the existing hand
    # bones. Harper's left grip actually wraps the outer edge of the notebooks.
    remove_prefixes(('Body_Hand_','Detail_Finger_','Detail_Thumb_'))
    for side,sign in (('L',-1),('R',1)):
        bone=f'hand.{side}'
        if side=='L' and c.id=='harper':
            box('Premium_Hand_Palm_L',(-.463,-.080,.714),(.100,.095,.114),'skin_light','body',bone,.010)
            for i,z in enumerate((.734,.704,.674)):
                box(f'Premium_Hand_GripSide_L_{i}',(-.505,-.158,z),(.031,.135,.026),'skin','body',bone,.004)
                box(f'Premium_Hand_GripTip_L_{i}',(-.480,-.234,z-.003),(.066,.024,.025),'skin_light','body',bone,.003)
            box('Premium_Hand_Thumb_L',(-.441,-.094,.773),(.065,.043,.030),'skin','body',bone,.005,rotation=(0,-.13,0))
        else:
            x=sign*.410
            rings(f'Premium_Hand_Palm_{side}',[(.611,.091,.089,x,-.029),(.640,.111,.104,x,-.032),(.707,.115,.110,x,-.027),(.744,.081,.078,x,-.022)],'skin_light','body',bone,bevel=.004)
            for i in range(3):
                xx=x+(i-1)*.029
                box(f'Premium_Hand_Finger_{side}_{i}',(xx,-.083,.653),(.025,.023,.053),'skin','body',bone,.0035)
                box(f'Premium_Hand_FingerTip_{side}_{i}',(xx,-.073,.621),(.025,.027,.025),'skin_light','body',bone,.0035)
            box(f'Premium_Hand_Thumb_{side}',(x-sign*.060,-.071,.688),(.036,.047,.064),'skin','body',bone,.005,rotation=(0,sign*.18,0))

    counts["character"]=c.id
    counts["garment_construction"]="shaped cloth rings; continuous two-bone weighted sleeves; constructed accessories"
    counts["modular_slots"]=["top","bottom","shoes","back","hand_prop"]
    return counts
