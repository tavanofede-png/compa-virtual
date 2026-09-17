"""Create the first premium feline family from the proven animated pet pipeline."""
import bpy, math, json, sys
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"scripts"))
from build_pet_mvp import rounded, sphere, mat, export_selected
from pet_premium_details import finish_cat

SOURCE=ROOT/"packages/assets/3d/source/pets"
MODELS=ROOT/"apps/web/public/selection/models"
PREVIEWS=ROOT/"apps/web/public/selection/pets"
MASTER=SOURCE/"golden-retriever-master.blend"

CATS={
 "orange-tabby": {"label":"Gato naranja","base":(.52,.11,.012),"light":(.82,.39,.075),"dark":(.16,.025,.004),"accent":(.10,.25,.12),"pattern":"tabby","shape":"standard"},
 "black-cat": {"label":"Gato negro","base":(.18,.14,.20),"light":(.44,.35,.47),"dark":(.025,.018,.030),"accent":(.72,.13,.16),"pattern":"solid","shape":"standard"},
 "siamese": {"label":"Siamés","base":(.43,.27,.12),"light":(.74,.51,.25),"dark":(.075,.022,.018),"accent":(.08,.18,.50),"pattern":"points","shape":"slender"},
 "ragdoll": {"label":"Ragdoll","base":(.72,.58,.42),"light":(.94,.80,.58),"dark":(.20,.095,.075),"accent":(.68,.10,.31),"pattern":"mask","shape":"fluffy"},
 "british-shorthair": {"label":"British shorthair","base":(.28,.34,.45),"light":(.54,.59,.66),"dark":(.055,.070,.12),"accent":(.05,.14,.38),"pattern":"solid","shape":"round"},
 "maine-coon": {"label":"Maine coon","base":(.15,.045,.012),"light":(.44,.20,.055),"dark":(.025,.008,.003),"accent":(.06,.20,.09),"pattern":"tabby","shape":"large"},
 "calico": {"label":"Calico","base":(.62,.35,.11),"light":(.82,.62,.34),"dark":(.022,.014,.012),"accent":(.42,.045,.035),"pattern":"calico","shape":"standard"},
 "sphynx": {"label":"Sphynx","base":(.60,.24,.21),"light":(.78,.43,.34),"dark":(.20,.055,.065),"accent":(.08,.07,.13),"pattern":"skin","shape":"slender"},
}

def remove(keys):
    for obj in list(bpy.context.scene.objects):
        if any(key.lower() in obj.name.lower() for key in keys): bpy.data.objects.remove(obj,do_unlink=True)

def scale_named(keys,scale):
    for obj in bpy.context.scene.objects:
        if obj.type=="MESH" and any(key.lower() in obj.name.lower() for key in keys):
            obj.scale.x*=scale[0]; obj.scale.y*=scale[1]; obj.scale.z*=scale[2]

def assign_materials(spec):
    base=mat("Cat_Base",spec["base"]); light=mat("Cat_Light",spec["light"])
    dark=mat("Cat_Dark",spec["dark"]); accent=mat("Cat_Accent",spec["accent"])
    for obj in [item for item in bpy.context.scene.objects if item.type=="MESH" and item.get("pet_asset")]:
        name=obj.name.lower()
        if any(word in name for word in ("eye","pupil","spark","nose","smile")): continue
        if "bandana" in name or "tag" in name: obj.data.materials[0]=accent
        elif any(word in name for word in ("muzzle","chest","ruff","toe","paw","chin")): obj.data.materials[0]=light
        elif "brow" in name: obj.data.materials[0]=dark
        else: obj.data.materials[0]=base
    return base,light,dark,accent

def catify(identifier,spec,rig,base,light,dark,accent):
    rig["rig_family"]="feline"
    # Build every cat from clean feline anatomy. The golden scene supplies only
    # the proven rig and animation library; no canine geometry is retained.
    for obj in list(bpy.context.scene.objects):
        if obj.type=="MESH" and obj.get("pet_asset"):
            bpy.data.objects.remove(obj,do_unlink=True)

    eye_white=mat("Cat_Eye_Outer",(.035,.025,.024),.28)
    eye_glint=mat("Cat_Eye_Glint",(1,.96,.88),.22)
    pink=mat("Cat_Nose_Pink",(.72,.18,.20),.65)
    collar=accent
    shape=spec["shape"]
    body_scale={"slender":(.225,.43,.22),"round":(.31,.36,.28),"large":(.32,.47,.29),"fluffy":(.31,.42,.29)}.get(shape,(.27,.40,.245))
    head_scale={"slender":(.255,.215,.25),"round":(.31,.25,.29),"large":(.32,.26,.30),"fluffy":(.32,.26,.30)}.get(shape,(.29,.235,.27))
    leg_width=.070 if shape=="slender" else (.095 if shape in ("round","large","fluffy") else .082)
    head_z=.76 if shape in ("large","fluffy") else .73

    sphere("Cat_Body",(0,.07,.43),body_scale,base,rig,"spine",3)
    sphere("Cat_Chest",(0,-.24,.45),(body_scale[0]*.92,.20,.215),light if shape=="fluffy" else base,rig,"spine",3)
    sphere("Cat_Haunches",(0,.29,.35),(body_scale[0]*1.10,.24,.215),base,rig,"spine",2)
    sphere("Cat_Neck",(0,-.21,.58),(.19,.15,.14),base,rig,"spine",2)
    sphere("Cat_Head",(0,-.40,head_z),head_scale,base,rig,"head",3)
    sphere("Cat_CheekL",(-.17,-.54,head_z-.04),(.12,.105,.13),light if shape in ("fluffy","large") else base,rig,"head",2)
    sphere("Cat_CheekR",(.17,-.54,head_z-.04),(.12,.105,.13),light if shape in ("fluffy","large") else base,rig,"head",2)

    # Pointed ears have a broad base and a real inner plane, with lynx tips on Maine Coon.
    ear_height=.25 if shape=="slender" else .22
    for side,x,sign in (("L",-.18,-1),("R",.18,1)):
        for layer in range(4):
            t=layer/3
            ear=rounded(f"Cat_Ear_{side}_{layer}",(x+sign*t*.025,-.43,head_z+.20+t*ear_height*.68),(.105*(1-t*.68),.055,.075),base,.028,rig,"ear."+side)
            ear.rotation_euler.y=sign*(.10+t*.08)
        rounded(f"Cat_InnerEar_{side}",(x+sign*.010,-.492,head_z+.30),(.052,.012,.085),pink,.010,rig,"ear."+side)
        if shape=="large":
            for tuft in range(3):
                rounded(f"Cat_LynxTip_{side}_{tuft}",(x+sign*(.035+tuft*.008),-.43,head_z+.43+tuft*.025),(.018,.018,.045),dark,.008,rig,"ear."+side)

    # Almond eye layers and vertical pupils replace the former square canine eyes.
    eye_color=(.18,.52,.73) if spec["pattern"] in ("points","mask") else ((.58,.72,.24) if identifier in ("orange-tabby","maine-coon") else (.76,.54,.13))
    iris=mat("Cat_Iris",eye_color,.22)
    for side,x in (("L",-.115),("R",.115)):
        sphere(f"Cat_EyeOuter_{side}",(x,-.617,head_z+.025),(.090,.026,.078),eye_white,rig,"head",3)
        sphere(f"Cat_Iris_{side}",(x,-.638,head_z+.025),(.067,.014,.061),iris,rig,"head",3)
        rounded(f"Cat_Pupil_{side}",(x,-.654,head_z+.025),(.012,.008,.048),dark,.006,rig,"head")
        sphere(f"Cat_EyeGlint_{side}",(x-.021,-.664,head_z+.056),(.014,.006,.014),eye_glint,rig,"head",2)

    # Short feline muzzle, nose, mouth and whiskers stay readable in close-ups.
    for side,x in (("L",-.058),("R",.058)):
        sphere(f"Cat_WhiskerPad_{side}",(x,-.634,head_z-.105),(.075,.055,.064),light,rig,"head",2)
    nose=sphere("Cat_Nose",(0,-.688,head_z-.067),(.041,.026,.031),pink,rig,"head",2)
    rounded("Cat_Chin",(0,-.637,head_z-.165),(.069,.038,.035),light,.020,rig,"head")
    for side,sign in (("L",-1),("R",1)):
        for row,zoff in enumerate((-.13,-.105,-.08)):
            whisker=rounded(f"Cat_Whisker_{side}_{row}",(sign*.185,-.674,head_z+zoff),(.105,.005,.005),eye_glint,.003,rig,"head")
            whisker.rotation_euler.y=sign*((row-1)*.10)
    for side,sign in (("L",-1),("R",1)):
        smile=rounded(f"Cat_Smile_{side}",(sign*.037,-.673,head_z-.128),(.038,.005,.009),dark,.004,rig,"head")
        smile.rotation_euler.y=sign*.26

    # Articulated feline legs with visible joints and compact paws.
    for side,x in (("L",-.165),("R",.165)):
        for front,y,bone in ((True,-.25,"leg.F"+side),(False,.29,"leg.B"+side)):
            upper_z=.245 if front else .265
            sphere(f"Cat_Upper_{bone}",(x,y,upper_z),(leg_width,.100,.120),base,rig,bone,2)
            rounded(f"Cat_Lower_{bone}",(x,y-.018,.135),(leg_width*.68,.064,.070),base,.026,rig,bone)
            pawbone="paw.F"+side if front else "paw.B"+side
            rounded(f"Cat_Paw_{pawbone}",(x,y-.055,.050),(leg_width*.98,.098,.038),light,.020,rig,pawbone)
            for toe in (-.030,0,.030):
                rounded(f"Cat_Toe_{pawbone}_{toe}",(x+toe,y-.145,.078),(.010,.020,.010),light,.005,rig,pawbone)

    # Long tail follows the rig but reads as a continuous tapered curve.
    tail_radius=.075 if shape in ("large","fluffy") else .055
    tail_points=[(0,.46,.44),(0,.61,.52),(.015,.74,.64),(.055,.82,.78),(.10,.80,.92),(.13,.72,1.03)]
    for index,(x,y,z) in enumerate(tail_points):
        radius=tail_radius*(1-index*.07)
        part=sphere(f"Cat_Tail_{index}",(x,y,z),(radius,.12 if index<3 else .095,radius),base,rig,"tail.01" if index<3 else "tail.02",2)
        part.rotation_euler.x=.22+index*.13

    # Breed-specific silhouette and coat layers.
    if shape in ("fluffy","large"):
        for row,z in enumerate((.51,.59,.67,.75)):
            count=5 if row<3 else 3
            for column in range(count):
                x=(column-(count-1)/2)*.085
                sphere(f"Cat_Ruff_{row}_{column}",(x,-.455,z),(.055,.045,.060),light if (row+column)%3==0 else base,rig,"spine",2)
        for side,sign in (("L",-1),("R",1)):
            for row,z in enumerate((.48,.58,.68,.78)):
                for col,y in enumerate((-.05,.13,.30)):
                    sphere(f"Cat_Coat_{side}_{row}_{col}",(sign*(body_scale[0]+.015),y,z),(.035,.045,.040),light if (row+col)%4==0 else base,rig,"spine",2)
    if identifier=="ragdoll":
        sphere("Ragdoll_ChestBib",(0,-.445,.59),(.19,.045,.22),light,rig,"spine",2)
    if identifier=="british-shorthair":
        sphere("British_Jowls",(0,-.60,head_z-.065),(.235,.085,.14),base,rig,"head",2)
    if identifier=="sphynx":
        for row,z in enumerate((.50,.57,.64,.72)):
            rounded(f"Sphynx_NeckWrinkle_{row}",(0,-.335,z),(.17,.018,.010),dark,.005,rig,"spine")
        for side,sign in (("L",-1),("R",1)):
            for row,z in enumerate((.53,.61,.69)):
                rounded(f"Sphynx_BodyWrinkle_{side}_{row}",(sign*.205,-.02,z),(.010,.11,.014),dark,.005,rig,"spine")

    # Crisp geometry patterns avoid large texture atlases and preserve the voxel style.
    pattern=spec["pattern"]
    if pattern=="tabby":
        # Small forehead markings sit between the ears and never imitate brows.
        for index,(x,angle) in enumerate(((-.075,-.22),(0,0),(.075,.22))):
            stripe=rounded(f"Cat_ForeheadMark_{index}",(x,-.631,head_z+.17),(.012,.007,.032),dark,.004,rig,"head")
            stripe.rotation_euler.y=angle
        for side,sign in (("L",-1),("R",1)):
            for row,y in enumerate((-.04,.12,.28)):
                rounded(f"Cat_FlankStripe_{side}_{row}",(sign*(body_scale[0]+.008),y,.62),(.015,.060,.042),dark,.007,rig,"spine")
        for index,obj in enumerate(sorted([o for o in bpy.context.scene.objects if o.name.startswith("Cat_Tail_")], key=lambda o:o.name)):
            if index % 2 and obj.data.materials:
                obj.data.materials[0]=dark
    elif pattern in ("points","mask"):
        sphere("Cat_FaceMask",(0,-.627,head_z+.015),(.19,.060,.18),dark,rig,"head",2)
        # Reapply all eye layers in front of the mask.
        for side,x in (("L",-.115),("R",.115)):
            sphere(f"Cat_MaskEye_{side}",(x,-.686,head_z+.025),(.078,.020,.070),eye_white,rig,"head",3)
            sphere(f"Cat_MaskIris_{side}",(x,-.704,head_z+.025),(.056,.010,.055),iris,rig,"head",2)
            rounded(f"Cat_MaskPupil_{side}",(x,-.716,head_z+.025),(.010,.005,.043),dark,.005,rig,"head")
            sphere(f"Cat_MaskSpark_{side}",(x-.018,-.722,head_z+.052),(.012,.004,.012),eye_glint,rig,"head",2)
        for side,x in (("L",-.165),("R",.165)):
            rounded(f"Cat_PointLeg_{side}",(x,-.25,.20),(.064,.072,.105),dark,.026,rig,"leg.F"+side)
        for obj in [o for o in bpy.context.scene.objects if o.name.startswith("Cat_Tail_")]:
            if obj.data.materials: obj.data.materials[0]=dark
    elif pattern=="calico":
        sphere("Calico_FacePatch",(-.13,-.655,head_z+.08),(.105,.030,.105),dark,rig,"head",2)
        sphere("Calico_CheekPatch",(.17,-.635,head_z-.08),(.075,.034,.090),accent,rig,"head",2)
        sphere("Calico_FlankPatch",(.245,.10,.63),(.040,.17,.12),dark,rig,"spine",2)
        sphere("Calico_BackPatch",(-.15,.24,.76),(.13,.13,.045),accent,rig,"spine",2)

    # Collar and engraved tag provide a close-up focal detail for every pet.
    rounded("Cat_Collar",(0,-.275,.64),(.205,.035,.026),collar,.012,rig,"spine")
    sphere("Cat_Tag",(0,-.325,.60),(.032,.018,.032),mat("Cat_Tag_Gold",(.92,.57,.10),.28,.35),rig,"spine",2)
    finish_cat(identifier, spec, rig, head_z=head_z, body_scale=body_scale)

def look_at(obj,target): obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()

def render(identifier):
    scene=bpy.context.scene; scene.render.engine="BLENDER_EEVEE"; scene.render.resolution_x=400; scene.render.resolution_y=400; scene.render.resolution_percentage=100
    scene.render.film_transparent=False; scene.render.image_settings.file_format="WEBP"; scene.render.image_settings.color_mode="RGB"; scene.view_settings.look="AgX - Medium High Contrast"; scene.view_settings.exposure=.18
    scene.world.color=(.70,.62,.56)
    scene.world.use_nodes=True
    scene.world.node_tree.nodes["Background"].inputs["Color"].default_value=(.72,.65,.59,1)
    scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value=.72
    # The editable source and GLB are already saved before this function runs.
    # Merge the hundreds of small voxel pieces only for the portrait render so
    # Eevee can batch them in one draw call instead of spending a minute per cat.
    portrait_parts=[obj for obj in scene.objects if obj.type=="MESH" and obj.get("pet_asset")]
    if portrait_parts:
        for obj in portrait_parts:
            world=obj.matrix_world.copy()
            obj.parent=None
            obj.matrix_world=world
            obj.select_set(True)
        scene.view_layers[0].objects.active=portrait_parts[0]
        bpy.ops.object.join()
        bpy.context.object.name="pet_portrait_mesh"
    bpy.ops.mesh.primitive_plane_add(size=7,location=(0,0,.015)); bpy.context.object.data.materials.append(mat("Cat_Studio",(.82,.72,.64),.82))
    bpy.ops.object.camera_add(location=(1.65,-2.95,1.52)); camera=bpy.context.object; camera.data.lens=56; look_at(camera,(0,-.04,.57)); scene.camera=camera
    for loc,energy,color,size in [((-2,-2.6,3),700,(1,.74,.50),3),((2,.2,2.2),350,(.62,.74,1),2.2),((0,2.2,2.5),400,(1,.46,.22),1.8)]:
        bpy.ops.object.light_add(type="AREA",location=loc); light=bpy.context.object; light.data.energy=energy; light.data.color=color; light.data.size=size
    scene.render.filepath=str(PREVIEWS/(identifier+".webp")); bpy.ops.render.render(write_still=True)

selected=set(sys.argv[sys.argv.index("--")+1:]) if "--" in sys.argv else set(CATS)
for identifier,spec in CATS.items():
    if identifier not in selected: continue
    bpy.ops.wm.open_mainfile(filepath=str(MASTER))
    rig=bpy.data.objects.get("pet-canine-rig")
    base,light,dark,accent=assign_materials(spec)
    catify(identifier,spec,rig,base,light,dark,accent)
    rig.name="pet-feline-rig"
    bpy.context.scene["asset_manifest"]=json.dumps({"id":identifier,"schema":"compa-pet-v1","rig":"feline","breed":spec["label"]})
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/(identifier+"-master.blend")))
    export_selected(MODELS/("pet-"+identifier+".glb"),[rig]+[obj for obj in bpy.context.scene.objects if obj.get("pet_asset")])
    render(identifier)
    print("FELINE_READY",identifier,flush=True)
