"""Shared high-detail finishing helpers for Compa Virtual pet assets.

The base builders establish proportions, rigs and animation contracts.  This
module adds the dense secondary forms that make the pets hold up in close-ups:
layered coats, breed-specific facial framing, shell/scales and feather rows.
Everything remains real editable Blender geometry and is rigidly attached to a
semantic rig bone so exports keep working with the existing runtime.
"""
from __future__ import annotations

import math
import random

import bpy
from mathutils import Vector

from build_pet_mvp import rounded, sphere, mat


def _attach(obj, rig, bone):
    world = obj.matrix_world.copy()
    obj.parent = rig
    obj.parent_type = "BONE"
    obj.parent_bone = bone
    obj.matrix_world = world
    obj["pet_asset"] = True
    return obj


def triangular_prism(name, center, width, height, depth, material, rig, bone):
    """Create a beveled triangular ear rather than a stack of rectangular bars."""
    cx, cy, cz = center
    half_w = width * .5
    half_d = depth * .5
    verts = [
        (cx-half_w, cy-half_d, cz-height*.5),
        (cx+half_w, cy-half_d, cz-height*.5),
        (cx,        cy-half_d, cz+height*.5),
        (cx-half_w, cy+half_d, cz-height*.5),
        (cx+half_w, cy+half_d, cz-height*.5),
        (cx,        cy+half_d, cz+height*.5),
    ]
    faces = [(0,1,2),(5,4,3),(0,3,4,1),(1,4,5,2),(2,5,3,0)]
    mesh = bpy.data.meshes.new(name+"Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.materials.append(material)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bevel = obj.modifiers.new("Soft voxel edges", "BEVEL")
    bevel.width = min(width, height, depth) * .12
    bevel.segments = 2
    return _attach(obj, rig, bone)


def quill(name, location, normal, length, radius, material, rig, bone="spine"):
    """Create one tapered, faceted quill aligned with a surface normal."""
    n = Vector(normal).normalized()
    center = Vector(location) + n * (length*.42)
    bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=radius, radius2=radius*.08,
                                    depth=length, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    obj.rotation_euler = Vector((0,0,1)).rotation_difference(n).to_euler()
    return _attach(obj, rig, bone)


def fur_shell(prefix, rig, bone, center, radii, material, *, count=100,
              seed=0, size=.032, front_clearance=True, color_alt=None):
    """Place deterministic rounded voxel tufts over an ellipsoid surface."""
    rng = random.Random(seed)
    cx, cy, cz = center
    rx, ry, rz = radii
    golden = math.pi * (3-math.sqrt(5))
    made = 0
    for index in range(count * 2):
        if made >= count:
            break
        # Fibonacci sphere gives an even coat without obvious latitude bands.
        u = (index + .5) / (count * 2)
        nz = 1 - 2*u
        radial = math.sqrt(max(0, 1-nz*nz))
        angle = index * golden
        nx, ny = math.cos(angle)*radial, math.sin(angle)*radial
        # Keep the underside clean and leave the central face readable.
        if nz < -.42:
            continue
        px, py, pz = cx+nx*rx, cy+ny*ry, cz+nz*rz
        if front_clearance and ny < -.64 and abs(nx) < .72 and abs(nz) < .60:
            continue
        jitter = .82 + rng.random()*.38
        # The thin local Z axis points along the surface normal, producing an
        # overlapping coat tile rather than a porcupine spike.
        tuft = rounded(
            f"{prefix}_Tuft_{made:03d}",
            (px, py, pz),
            (size*jitter*1.06, size*jitter*.78, size*jitter*.30),
            color_alt if color_alt and made % 9 == 0 else material,
            size*.16,
            rig,
            bone,
        )
        normal = Vector((nx/max(rx,.001), ny/max(ry,.001), nz/max(rz,.001))).normalized()
        tuft.rotation_euler = Vector((0,0,1)).rotation_difference(normal).to_euler()
        made += 1


def face_finish(prefix, rig, *, head_z, front_y, width, dark, pink, light, tongue=True, lids=True):
    """Add brows, lower eyelids, mouth corners and optional tongue."""
    for side, sign in (("L", -1), ("R", 1)):
        if lids:
            brow = rounded(
                f"{prefix}_ExpressionBrow_{side}",
                (sign*width*.44, front_y, head_z+width*.35),
                (width*.16, .006, .010), dark, .004, rig, "head",
            )
            brow.rotation_euler.y = sign*.13
            lid = rounded(
                f"{prefix}_LowerLid_{side}",
                (sign*width*.43, front_y-.006, head_z-width*.03),
                (width*.13, .004, .006), light, .003, rig, "head",
            )
            lid.rotation_euler.y = -sign*.09
        smile = rounded(
            f"{prefix}_MouthCorner_{side}",
            (sign*width*.14, front_y-.012, head_z-width*.43),
            (width*.12, .004, .006), dark, .003, rig, "head",
        )
        smile.rotation_euler.y = sign*.28
    if tongue:
        rounded(
            f"{prefix}_Tongue", (0, front_y-.022, head_z-width*.56),
            (width*.12, .012, width*.12), pink, width*.045, rig, "head",
        )


def finish_cat(identifier, spec, rig, *, head_z, body_scale):
    base = bpy.data.materials.get("Cat_Base")
    light = bpy.data.materials.get("Cat_Light")
    dark = bpy.data.materials.get("Cat_Dark")
    pink = bpy.data.materials.get("Cat_Nose_Pink")
    if not all((base, light, dark, pink)):
        return

    # Replace the former tall block stacks: they read as rabbit ears.
    for obj in list(bpy.context.scene.objects):
        if (obj.name.startswith("Cat_Ear_") or obj.name.startswith("Cat_InnerEar_")
                or obj.name.startswith("Cat_Ruff_") or obj.name.startswith("Cat_Coat_")
                or obj.name.startswith("Cat_LynxTip_")):
            bpy.data.objects.remove(obj, do_unlink=True)
    ear_h = .245 if spec["shape"] == "large" else .215
    for side, sign in (("L", -1), ("R", 1)):
        x = sign * (.205 if spec["shape"] != "round" else .185)
        outer = triangular_prism(
            f"Cat_Ear_{side}", (x, -.435, head_z+.225),
            .205, ear_h, .105, base, rig, "ear."+side,
        )
        outer.rotation_euler.y = -sign*.11
        inner = triangular_prism(
            f"Cat_InnerEar_{side}", (x, -.495, head_z+.218),
            .120, ear_h*.62, .018, pink, rig, "ear."+side,
        )
        inner.rotation_euler.y = -sign*.11
        # The Maine Coon keeps the larger ear silhouette without rigid rods
        # above it; those read as antennae rather than feline ear tufts.

    # Remove graphic bars over the eyes. Expression comes from the eye shape,
    # pupils, cheeks and mouth rather than human eyebrows.
    for obj in list(bpy.context.scene.objects):
        if any(token in obj.name for token in ("Cat_UpperLid", "ExpressionBrow", "LowerLid")):
            bpy.data.objects.remove(obj, do_unlink=True)

    if spec["shape"] in ("fluffy", "large"):
        # A continuous layered mane replaces bead-like fake fur.
        for index,(x,z,sx,sz) in enumerate((
            (0,.59,.13,.12),(-.12,.62,.09,.11),(.12,.62,.09,.11),
            (-.19,.66,.07,.09),(.19,.66,.07,.09),(0,.71,.12,.08),
        )):
            rounded(f"Cat_Mane_{index}",(x,-.445,z),(sx,.045,sz),
                    light if index%3==0 else base,.025,rig,"spine")

    if identifier == "sphynx":
        # The hairless cat earns its detail through anatomical folds and warm
        # tonal breaks rather than a synthetic coat.
        skin_shadow = mat("Sphynx_Fold_Shadow", (.34,.10,.11), .72)
        # Keep the eye and brow plane clean. At this scale, folds belong on the
        # neck and flanks; bars across the forehead look like human eyebrows.
        for side, sign in (("L",-1),("R",1)):
            for row in range(5):
                fold=rounded(
                    f"Sphynx_FlankFold_{side}_{row}",
                    (sign*.22,.02+row*.075,.61),(.010,.055,.014),
                    skin_shadow,.004,rig,"spine",
                )
                fold.rotation_euler.x=(row-2)*.08

    # Long-haired breeds already receive deliberate ruffs and cheek volumes in
    # the base authoring pass.  No random shell is added to any cat.


def finish_small_pet(identifier, rig):
    eye = bpy.data.materials.get("SmallPet_Eye") or mat("Finish_Eye",(.02,.015,.012),.3)
    pink = bpy.data.materials.get("SmallPet_Pink") or mat("Finish_Pink",(.8,.2,.25),.7)
    glint = bpy.data.materials.get("SmallPet_Glint") or mat("Finish_Glint",(1,.95,.84),.2)

    configs = {
        "rabbit": ("Rabbit_Cream","Rabbit_White",(0,.08,.42),(.245,.31,.31),(0,-.30,.70),(.245,.205,.23),120,150),
        "hamster": ("Hamster_Orange","Hamster_Cream",(0,.02,.25),(.255,.245,.235),(0,-.16,.42),(.235,.185,.205),130,115),
        "guinea-pig": ("Guinea_Caramel","Guinea_White",(0,.06,.25),(.285,.42,.245),(0,-.31,.31),(.26,.225,.225),150,120),
        "ferret": ("Ferret_Sable","Ferret_Cream",(0,.13,.33),(.19,.55,.18),(0,-.48,.46),(.19,.22,.18),145,100),
        "hedgehog": ("Hedgehog_Tan","Hedgehog_Cream",None,None,(0,-.265,.31),(.205,.18,.19),0,75),
    }
    if identifier in configs:
        base_name, light_name, body_c, body_r, head_c, head_r, body_n, head_n = configs[identifier]
        base = bpy.data.materials.get(base_name)
        light = bpy.data.materials.get(light_name) or base
        # Keep the clean anatomical volumes. Facial detail is added without a
        # generic coat or human-like eyebrow treatment.
        front = {"rabbit":(-.555,.70,.23),"hamster":(-.404,.42,.21),
                 "guinea-pig":(-.578,.32,.22),"ferret":(-.758,.46,.18),
                 "hedgehog":(-.552,.31,.18)}[identifier]
        face_finish(identifier.title(),rig,head_z=front[1],front_y=front[0],width=front[2],
                    dark=eye,pink=pink,light=light or glint,tongue=identifier in ("rabbit","ferret","hedgehog"),lids=False)
        for side, sign in (("L",-1),("R",1)):
            for row in range(3):
                whisker=rounded(
                    f"{identifier}_Whisker_{side}_{row}",
                    (sign*front[2]*.75,front[0]-.018,front[1]-front[2]*(.30+row*.10)),
                    (front[2]*.34,.004,.004),glint,.002,rig,"head",
                )
                whisker.rotation_euler.y=sign*(row-1)*.10

    if identifier == "hedgehog":
        quill_mat=bpy.data.materials.get("Hedgehog_Quill")
        quill_alt=mat("Hedgehog_Quill_Light",(.24,.065,.010))
        for obj in list(bpy.context.scene.objects):
            if obj.name.startswith("Hedgehog_Quill_"):
                bpy.data.objects.remove(obj,do_unlink=True)
        if quill_mat:
            rng=random.Random(212)
            made=0
            for i in range(760):
                nz=1-2*(i+.5)/760
                radial=math.sqrt(max(0,1-nz*nz)); a=i*2.399963
                nx,ny=math.cos(a)*radial,math.sin(a)*radial
                if nz<-.02 or ny<-.30:
                    continue
                pos=(nx*.285,.02+ny*.32,.25+nz*.26)
                direction=Vector((nx*.55,ny*.48,max(.42,nz))).normalized()
                quill(f"Hedgehog_Quill_{made:03d}",pos,direction,
                      .027+rng.random()*.018,.007+rng.random()*.004,
                      quill_alt if made%7==0 else quill_mat,rig)
                made+=1
    elif identifier == "turtle":
        green=bpy.data.materials.get("Turtle_Green")
        light=bpy.data.materials.get("Turtle_Light")
        shell=bpy.data.materials.get("Turtle_Shell")
        plate=bpy.data.materials.get("Turtle_Plate")
        if all((green,light,shell,plate)):
            # Concentric scutes and rim blocks give the shell real construction.
            for ring,(radius,count,z) in enumerate(((.31,18,.36),(.22,14,.425),(.12,8,.475))):
                for i in range(count):
                    a=i/count*math.tau+(ring%2)*.12
                    p=rounded(
                        f"Turtle_PremiumScute_{ring}_{i}",
                        (radius*math.cos(a),.05+radius*1.22*math.sin(a),z),
                        (.047,.055,.022),plate if (i+ring)%3 else light,
                        .010,rig,"spine",
                    )
                    p.rotation_euler.z=a
            fur_shell("Turtle_NeckScale",rig,"head",(0,-.48,.29),(.15,.18,.14),green,
                      count=55,seed=14,size=.018,front_clearance=True,color_alt=light)
            face_finish("Turtle",rig,head_z=.29,front_y=-.738,width=.14,
                        dark=eye,pink=pink,light=light,tongue=True,lids=False)
    elif identifier == "gecko":
        gold=bpy.data.materials.get("Gecko_Gold")
        cream=bpy.data.materials.get("Gecko_Cream")
        dark=bpy.data.materials.get("Gecko_Spots")
        if all((gold,cream,dark)):
            fur_shell("Gecko_Scales",rig,"spine",(0,.10,.17),(.15,.43,.12),gold,
                      count=120,seed=73,size=.015,front_clearance=False,color_alt=dark)
            fur_shell("Gecko_HeadScales",rig,"head",(0,-.35,.23),(.20,.20,.15),gold,
                      count=85,seed=79,size=.016,front_clearance=True,color_alt=cream)
            for side,sign in (("L",-1),("R",1)):
                rounded(f"Gecko_VerticalPupil_{side}",(sign*.105,-.552,.275),(.010,.007,.052),eye,.004,rig,"head")
            face_finish("Gecko",rig,head_z=.23,front_y=-.565,width=.17,
                        dark=eye,pink=pink,light=cream,tongue=True,lids=False)
    elif identifier == "budgie":
        blue=bpy.data.materials.get("Budgie_Blue")
        light=bpy.data.materials.get("Budgie_Light")
        yellow=bpy.data.materials.get("Budgie_Yellow")
        navy=bpy.data.materials.get("Budgie_Navy")
        if all((blue,light,yellow,navy)):
            # Dense overlapping breast/head feather tiles produce the premium
            # voxel plumage visible in the art direction.
            for row in range(9):
                count=7-row//3
                for col in range(count):
                    x=(col-(count-1)/2)*.042
                    z=.22+row*.048
                    color=light if row<5 else (yellow if row>7 else blue)
                    rounded(f"Budgie_BreastFeather_{row}_{col}",(x,-.205,z),(.025,.014,.036),color,.010,rig,"spine" if row<6 else "head")
            for side,sign in (("L",-1),("R",1)):
                for row in range(7):
                    for col in range(3):
                        feather=rounded(
                            f"Budgie_PremiumWing_{side}_{row}_{col}",
                            (sign*(.19+col*.022),-.01+row*.038,.50-row*.045),
                            (.019,.052,.041),navy if (row+col)%4==0 else blue,
                            .008,rig,"spine",
                        )
                        feather.rotation_euler.x=.08+row*.05
            face_finish("Budgie",rig,head_z=.62,front_y=-.326,width=.15,
                        dark=navy,pink=pink,light=yellow,tongue=False,lids=False)
