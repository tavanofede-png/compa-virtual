"""Editable folded-leaf botanical collection for the enlarged Cozy room.

Geometry is constructed in room world metres. Plants are individually grouped;
leaf outlines, folds, stems, leaf veins, pots, soil and saucers remain editable.
The caller owns scene backup, presentation, asset export and collision review.
"""
from __future__ import annotations

import math
import random

import bpy
from mathutils import Vector


PREFIX = "PRM_BOT_"


def upgrade(k):
    k.remove_prefixes(("Decor_FloorPlant", "Decor_WindowPlant", "Decor_ShelfPlant", PREFIX))
    for key, color, rough in (
        ("bot_leaf_deep", "#294F35", .71), ("bot_leaf", "#456D43", .65),
        ("bot_leaf_lime", "#799256", .69), ("bot_leaf_sage", "#8DAB7F", .78),
        ("bot_leaf_vein", "#A7B481", .76), ("bot_leaf_back", "#577349", .79),
        ("bot_stem", "#628043", .79), ("bot_stem_wood", "#735544", .90),
        ("bot_soil", "#443729", .98), ("bot_soil_light", "#79604A", .96),
        ("bot_cream_ceramic", "#EBDAC4", .45), ("bot_sage_ceramic", "#A1AEA0", .48),
        ("bot_pink_ceramic", "#CB8C85", .56), ("bot_terracotta", "#B47758", .84),
        ("bot_clay_rim", "#CD9975", .79), ("bot_sand", "#D9C3A1", .87),
    ):
        k.material(key,color,roughness=rough)
    plant_names=[]
    counters={"leaves":0,"veins":0,"stems":0,"pots":0,"trailingVines":0}
    rng=random.Random(64821)

    def tube(name,points,radius,key,parent,cyclic=False):
        return k.tube(PREFIX+name,points,radius,key,cyclic=cyclic,parent=parent)

    def circle(cx,cy,z,r,n=32):
        return [(cx+r*math.cos(i*2*math.pi/n),cy+r*math.sin(i*2*math.pi/n),z) for i in range(n)]

    def pot(name,base,radius,height,key="bot_terracotta",fluted=False):
        group=k.group(PREFIX+name,(0,0,0))
        plant_names.append(name)
        x,y,z=base
        n=32
        # A hollow turned pot: base, belly, lip and visible inner wall are one mesh.
        profile=[(radius*.71,z+.020),(radius*.75,z+.041),(radius*.89,z+height*.47),
                 (radius,z+height*.91),(radius*.995,z+height),
                 (radius*.874,z+height),(radius*.860,z+height*.86),
                 (radius*.790,z+height*.72)]
        verts=[]
        for r,zz in profile:
            for i in range(n):
                a=i*2*math.pi/n
                flute=1+(.014*math.cos(a*16) if fluted else 0)
                verts.append((x+r*math.cos(a)*flute,y+r*math.sin(a)*flute,zz))
        faces=[tuple(reversed(range(n)))]
        for ring in range(len(profile)-1):
            for i in range(n):
                j=(i+1)%n
                faces.append((ring*n+i,ring*n+j,(ring+1)*n+j,(ring+1)*n+i))
        k.mesh(PREFIX+name+"_OpenPot",verts,faces,key,bevel=.0018,parent=group)
        k.cylinder(PREFIX+name+"_Saucer",(x,y,z+.014),radius*1.09,.028,key,vertices=32,parent=group)
        tube(name+"_SaucerLip",circle(x,y,z+.026,radius*1.04),radius*.020,"bot_clay_rim" if key=="bot_terracotta" else key,group,True)
        tube(name+"_Lip",circle(x,y,z+height*.97,radius*.95),radius*.035,key,group,True)
        k.cylinder(PREFIX+name+"_Soil",(x,y,z+height*.82),radius*.86,.018,"bot_soil",vertices=24,parent=group)
        for i in range(9):
            a=rng.random()*2*math.pi
            rr=radius*.72*math.sqrt(rng.random())
            px,py=x+rr*math.cos(a),y+rr*math.sin(a)
            k.sphere(PREFIX+name+"_SoilGrain_%02d"%i,(px,py,z+height*.833),
                     (radius*.045,radius*.034,radius*.019),"bot_soil_light",segments=6,rings=3,parent=group)
        if fluted:
            for i in range(24):
                a=i*2*math.pi/24
                r0,r1=radius*.78,radius*.97
                points=[(x+r0*math.cos(a),y+r0*math.sin(a),z+.043),
                        (x+radius*.89*math.cos(a),y+radius*.89*math.sin(a),z+height*.48),
                        (x+r1*math.cos(a),y+r1*math.sin(a),z+height*.87)]
                tube(name+"_CeramicFlute_%02d"%i,points,radius*.008,key,group)
        counters["pots"]+=1
        return group,Vector((x,y,z+height*.84))

    def leaf(name,start,tip,width,key,parent,fold=.020,lobed=False,veins=True,heart=False):
        start,tip=Vector(start),Vector(tip)
        axis=tip-start
        direction=axis.normalized()
        up=Vector((0,0,1))
        if abs(direction.dot(up))>.93:
            up=Vector((0,1,0))
        side=direction.cross(up).normalized()
        normal=side.cross(direction).normalized()
        n=12 if lobed else 8
        centers=[]
        verts=[]
        for i in range(n+1):
            t=i/n
            profile=max(.008,math.sin(math.pi*t)**(.63 if heart else .84))
            if heart:
                profile*=1+.30*math.exp(-((t-.27)/.21)**2)
            if lobed and i in (4,8):
                # Broad monstera shoulders with two restrained splits. Deep,
                # repeated notches made the first pass read as thin fern fronds.
                profile*=.72
            sway=math.sin(t*math.pi)*.03*axis.length
            center=start+axis*t+normal*(fold*math.sin(math.pi*t)) + side*sway
            centers.append(center)
            edge_drop=normal*(fold*.48*math.sin(math.pi*t))
            half=side*(width*.5*profile)
            verts.extend([tuple(center-half-edge_drop),tuple(center),tuple(center+half-edge_drop)])
        front_count=len(verts)
        # Real leaf thickness. It remains visible when viewed from underneath.
        verts.extend([tuple(Vector(p)-normal*.0012) for p in list(verts)])
        faces=[]
        for i in range(n):
            a=i*3
            for j in (0,1):
                faces.extend([(a+j,a+j+4,a+j+3),(a+j,a+j+1,a+j+4)])
        faces.extend([tuple(v+front_count for v in reversed(face)) for face in list(faces)])
        for i in range(n):
            for edge in (0,2):
                a,b=i*3+edge,(i+1)*3+edge
                faces.append((a,b,b+front_count,a+front_count) if edge==0 else (a,a+front_count,b+front_count,b))
        for edge in (0,n*3):
            for j in (0,1):
                a,b=edge+j,edge+j+1
                faces.append((a,a+front_count,b+front_count,b) if edge==0 else (a,b,b+front_count,a+front_count))
        obj=k.mesh(PREFIX+name,verts,faces,key,bevel=.00018,parent=parent)
        back=k.mat("bot_leaf_back")
        obj.data.materials.append(back)
        for p in obj.data.polygons:
            if n*4<=p.index<n*8:
                p.material_index=1
        if veins:
            mid=[tuple(p+normal*.0013) for p in centers]
            tube(name+"_Midrib",mid,max(.0007,width*.007),"bot_leaf_vein",parent)
            counters["veins"]+=1
            for i in (2,4,6):
                if i>=n:
                    continue
                t=i/n
                profile=math.sin(math.pi*t)**.84
                for sign in (-1,1):
                    a=centers[i-1]+normal*.0015
                    b=centers[i]+side*(width*.35*profile*sign)-normal*fold*.2
                    tube(name+"_Vein_%d_%d"%(i,sign),[tuple(a),tuple(b)],max(.00045,width*.0035),"bot_leaf_vein",parent)
                    counters["veins"]+=1
        counters["leaves"]+=1
        return obj

    def stem(name,points,radius,parent):
        counters["stems"]+=1
        return tube(name,points,radius,"bot_stem",parent)

    def broad_plant(name,base,scale=1,key="bot_cream_ceramic",leaves=12,lobed=False):
        pot_radius=.22 if lobed else max(.13,.19*scale)
        pot_height=.34 if lobed else max(.135,.29*scale)
        group,root=pot(name,base,pot_radius,pot_height,key,fluted=key!="bot_terracotta")
        for i in range(leaves):
            a=i*2.399963+.28
            tier=i%4
            if lobed:
                # Dense overlapping foliage begins near the rim. Shorter
                # petioles and broad rising blades fill a real canopy volume.
                height=.145+.135*tier+.014*math.sin(i)
                radius=.080+.026*(3-tier)
                leaf_length=.34+.022*(i%4)
                rise=.19+.020*tier
                leaf_width=.235+.018*(i%4)
                reach=math.sqrt(leaf_length**2-rise**2)
            else:
                height=max(.15,.38*scale)+tier*.020
                radius=max(.065,.14*scale)
                leaf_length=max(.145,.38*scale)
                rise=leaf_length*.45
                leaf_width=max(.088,.28*scale)
                reach=leaf_length*.89
            end=root+Vector((math.cos(a)*radius,math.sin(a)*radius,height))
            elbow=root+Vector((math.cos(a)*radius*.37,math.sin(a)*radius*.37,height*.68))
            stem(name+"_Stem_%02d"%i,[tuple(root),tuple(elbow),tuple(end)],.004*scale,group)
            tip=end+Vector((math.cos(a)*reach,math.sin(a)*reach,rise))
            leaf(name+"_Leaf_%02d"%i,end,tip,leaf_width,
                 ("bot_leaf_deep","bot_leaf","bot_leaf","bot_leaf_lime")[tier],
                 group,.032 if lobed else .018,lobed=lobed,heart=lobed)
        return group

    def fern(name,base,scale=.7):
        group,root=pot(name,base,.14*scale,.21*scale,"bot_terracotta")
        for frond in range(10):
            a=frond*2.399963
            forward=Vector((math.cos(a),math.sin(a),0))
            side=Vector((-math.sin(a),math.cos(a),0))
            reach=(.34+.045*math.sin(frond))*scale
            points=[]
            for j in range(8):
                t=j/7
                points.append(root+forward*reach*t+Vector((0,0,(.34*math.sin(t*math.pi*.83)+.015)*scale)))
            stem(name+"_Frond_%d"%frond,[tuple(p) for p in points],.0018*scale,group)
            for j in range(1,7):
                for sign in (-1,1):
                    length=(.105*(1-j/9))*scale
                    end=points[j]+side*length*sign+forward*length*.36+Vector((0,0,.013*scale))
                    leaf(name+"_Pinna_%d_%d_%d"%(frond,j,sign),points[j],end,.032*scale,
                         "bot_leaf_lime" if (j+frond)%3==0 else "bot_leaf",group,.004*scale,veins=False)
        return group

    def rosette(name,base,scale=.75):
        group,root=pot(name,base,.123*scale,.16*scale,"bot_sage_ceramic",fluted=True)
        for ring,count in ((0,11),(1,9),(2,7)):
            for j in range(count):
                a=j*2*math.pi/count+ring*.37
                reach=(.21-ring*.043)*scale
                end=root+Vector((math.cos(a)*reach,math.sin(a)*reach,(.13+.046*ring)*scale))
                leaf(name+"_Blade_%d_%d"%(ring,j),root,end,(.082-.014*ring)*scale,
                     "bot_leaf_sage" if ring==0 else "bot_leaf_lime",group,.020*scale,veins=False)
        return group

    def pilea(name,base,scale=.8):
        group,root=pot(name,base,max(.13,.151*scale),max(.145,.195*scale),"bot_pink_ceramic")
        for i in range(17):
            a=i*2.399963
            end=root+Vector((math.cos(a)*.115*scale,math.sin(a)*.115*scale,(.10+.028*(i%4))*scale))
            stem(name+"_Petiole_%02d"%i,[tuple(root),tuple(end)],.0025*scale,group)
            outward=Vector((math.cos(a)*.165*scale,math.sin(a)*.165*scale,.050*scale))
            leaf(name+"_RoundLeaf_%02d"%i,end-outward*.25,end+outward,.175*scale,
                 "bot_leaf_lime" if i%3==0 else "bot_leaf",group,.012*scale,heart=True)
        return group

    def trail(name,base,scale=.75,length=.55,direction=(0,-1,0),pot_key="bot_cream_ceramic"):
        radius=max(.13,min(.15,.13+(scale-.62)*.14))
        group,root=pot(name,base,radius,.16,pot_key,fluted=True)
        forward=Vector(direction).normalized()
        side=Vector((-forward.y,forward.x,0))
        # A small crown grows above the pot, three tendrils cross the shelf edge.
        for i in range(16):
            a=i*2.399963
            r=.035+.010*(i%3)
            end=root+Vector((math.cos(a)*r,math.sin(a)*r,.025+.017*(i%4)))
            blade=.13+.013*(i%4)
            tip=end+Vector((math.cos(a)*blade,math.sin(a)*blade,.043+.007*(i%3)))
            stem(name+"_CrownStem_%d"%i,[tuple(root),tuple(end)],.0018*scale,group)
            leaf(name+"_CrownLeaf_%d"%i,end,tip,.092+.010*(i%3),
                 "bot_leaf_deep" if i%4==0 else "bot_leaf",group,.013,heart=True)
        for vine in range(3):
            points=[]
            for j in range(13):
                t=j/12
                clearance=.29 if name=='BookcaseTopPothos' else .16
                offset=forward*(clearance*math.sin(min(t*4,1)*math.pi/2))
                sway=side*((vine-1)*.075+.035*math.sin(t*5+vine))
                p=root+offset+sway+Vector((0,0,-length*(t**1.24)+.028*math.sin(t*math.pi)))
                points.append(p)
            stem(name+"_TrailingStem_%d"%vine,[tuple(p) for p in points],.0018*scale,group)
            counters["trailingVines"]+=1
            for j in range(1,12):
                sign=1 if j%2 else -1
                start=points[j]
                end=start+side*(sign*(.090+.016*math.sin(j)))+forward*.043+Vector((0,0,-.041))
                leaf(name+"_TrailLeaf_%d_%d"%(vine,j),start,end,.079+.008*(j%3),
                     "bot_leaf_lime" if (j+vine)%5==0 else "bot_leaf_deep",group,.011,heart=True,veins=j%3==0)
                if j%3==0:
                    companion=start-side*(sign*.072)+forward*.034+Vector((0,0,-.032))
                    leaf(name+"_TrailLeafCompanion_%d_%d"%(vine,j),start,companion,.072,
                         "bot_leaf",group,.010,heart=True,veins=False)
        return group

    broad_plant("FloorMonstera",(2.95,-1.70,.18),1.05,"bot_cream_ceramic",19,True)
    fern("FloorFern",(2.51,-1.91,.18),.67)
    broad_plant("BedsideCalathea",(-.63,1.25,1.00),.39,"bot_sage_ceramic",13)
    pilea("WindowPilea",(-2.12,2.30,1.23),.79)
    rosette("WindowAloe",(-1.27,2.30,1.23),1.02)
    trail("MainShelfPothos",(-.35,2.25,2.415),.76,.55,(0,-1,0))
    trail("BookcaseTopPothos",(3.90,1.90,2.75),.68,.68,(1,0,0),"bot_terracotta")
    trail("LeftShelfIvyA",(-2.73,.83,2.63),.69,.60,(1,0,0),"bot_pink_ceramic")
    trail("LeftShelfIvyB",(-2.73,-.42,2.63),.62,.54,(1,0,0),"bot_terracotta")
    rosette("DeskSucculent",(1.96,1.78,1.087),.63)
    pilea("BookcaseMiddlePilea",(3.77,1.91,1.78),.64)
    broad_plant("ShelfHerb",(1.26,2.22,2.415),.32,"bot_terracotta",12)
    broad_plant("BedFootCalathea",(-2.68,-2.06,.18),.58,"bot_terracotta",13)
    pilea("ReadingTablePilea",(.70,-.645,.732),.59)
    rosette("MainShelfHaworthia",(1.56,2.39,2.415),.64)
    broad_plant("FloorRubberPlant",(3.80,-1.88,.18),.66,"bot_sage_ceramic",13)
    rosette("BookcaseTinyAloe",(3.43,1.95,2.275),.56)
    pilea("WindowCenterPilea",(-1.70,2.27,1.23),.61)
    return {
        "module":"room_premium_botanicals", "plants":plant_names,
        "counts":counters,
        "newMeshes":len([o for o in bpy.context.scene.objects if o.type=="MESH" and o.name.startswith(PREFIX)]),
        "design":"Eighteen botanicals; hollow pots, saucers, soil, folded leaves, actual veins, fern pinnae and trailing stems.",
        "qa":"Geometry created; final room camera, overlap and export review belong to the caller.",
    }
