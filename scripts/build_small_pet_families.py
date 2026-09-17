"""Build the non-canine/non-feline Compa Virtual pet families.

Each species is authored from a clean silhouette and keeps editable geometry,
its own rig-family metadata, a complete semantic animation set, and a lightweight
GLB/portrait pair for the mobile app.
"""
import bpy, json, math, sys
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"scripts"))
from build_pet_mvp import reset, mat, rounded, sphere, make_rig, create_actions, export_selected
from pet_premium_details import finish_small_pet

SOURCE=ROOT/"packages/assets/3d/source/pets"
MODELS=ROOT/"apps/web/public/selection/models"
PREVIEWS=ROOT/"apps/web/public/selection/pets"
for folder in (SOURCE,MODELS,PREVIEWS): folder.mkdir(parents=True,exist_ok=True)

BLACK=mat("SmallPet_Eye",(.025,.020,.018),.28)
GLINT=mat("SmallPet_Glint",(1,.96,.86),.18)
PINK=mat("SmallPet_Pink",(.88,.32,.36),.72)
GOLD=mat("SmallPet_Tag",(.94,.60,.10),.25,.32)

PETS={
 "rabbit":{"label":"Conejo","rig":"rabbit","height":1.34,"radius":.22},
 "hamster":{"label":"Hámster","rig":"small-mammal","height":.43,"radius":.18},
 "guinea-pig":{"label":"Cobayo","rig":"small-mammal","height":.45,"radius":.22},
 "ferret":{"label":"Hurón","rig":"mustelid","height":.48,"radius":.19},
 "hedgehog":{"label":"Erizo","rig":"small-mammal","height":.42,"radius":.20},
 "turtle":{"label":"Tortuga","rig":"turtle","height":.36,"radius":.23},
 "gecko":{"label":"Gecko","rig":"gecko","height":.22,"radius":.18},
 "budgie":{"label":"Periquito","rig":"avian","height":.48,"radius":.15},
}

def attach(obj,rig,bone):
    world=obj.matrix_world.copy(); obj.parent=rig; obj.parent_type="BONE"; obj.parent_bone=bone; obj.matrix_world=world
    return obj

def eye_pair(prefix,rig,z,y,x=.095,size=(.073,.025,.078),iris_color=(.28,.48,.26),bone="head"):
    iris=mat(prefix+"_Iris",iris_color,.20)
    for side,sign in (("L",-1),("R",1)):
        sphere(f"{prefix}_EyeOuter_{side}",(sign*x,y,z),size,BLACK,rig,bone,3)
        sphere(f"{prefix}_Iris_{side}",(sign*x,y-.018,z),(.68*size[0],.010,.72*size[2]),iris,rig,bone,3)
        sphere(f"{prefix}_Pupil_{side}",(sign*x,y-.029,z),(.32*size[0],.006,.48*size[2]),BLACK,rig,bone,2)
        sphere(f"{prefix}_Glint_{side}",(sign*x-.015,y-.036,z+.025),(.014,.004,.014),GLINT,rig,bone,2)

def collar(prefix,rig,z,y,color):
    rounded(prefix+"_Collar",(0,y,z),(.185,.035,.025),color,.012,rig,"spine")
    sphere(prefix+"_Tag",(0,y-.045,z-.045),(.030,.016,.030),GOLD,rig,"spine",2)

def rabbit(rig):
    cream=mat("Rabbit_Cream",(.46,.20,.055)); light=mat("Rabbit_White",(.78,.52,.24)); dark=mat("Rabbit_Shadow",(.14,.035,.008)); green=mat("Rabbit_Bandana",(.07,.26,.12))
    sphere("Rabbit_Body",(0,.08,.36),(.275,.33,.30),cream,rig,"spine",3)
    sphere("Rabbit_Chest",(0,-.18,.38),(.215,.15,.245),light,rig,"spine",3)
    sphere("Rabbit_Head",(0,-.30,.63),(.255,.215,.235),cream,rig,"head",3)
    for side,sign in (("L",-1),("R",1)):
        # Long ears taper with four overlapping segments and a recessed pink center.
        for i,(z,sx,sz) in enumerate(((.80,.098,.13),(.91,.086,.12),(1.02,.065,.105),(1.11,.038,.070))):
            rounded(f"Rabbit_Ear_{side}_{i}",(sign*(.13+i*.010),-.27,z),(sx,.055,sz),cream,.030,rig,"ear."+side)
        rounded(f"Rabbit_InnerEar_{side}",(sign*.145,-.331,.93),(.043,.012,.145),PINK,.011,rig,"ear."+side)
    eye_pair("Rabbit",rig,.665,-.495,.105,(.078,.025,.086),(.35,.49,.22))
    for side,sign in (("L",-1),("R",1)):
        sphere(f"Rabbit_Cheek_{side}",(sign*.085,-.503,.55),(.095,.060,.072),light,rig,"head",2)
    sphere("Rabbit_Nose",(0,-.561,.595),(.040,.025,.032),PINK,rig,"head",2)
    rounded("Rabbit_Chin",(0,-.50,.505),(.070,.030,.035),light,.018,rig,"head")
    # Strong haunches and long feet make the silhouette unmistakably rabbit.
    for side,sign in (("L",-1),("R",1)):
        sphere(f"Rabbit_Haunch_{side}",(sign*.175,.24,.22),(.15,.19,.18),cream,rig,"leg.B"+side,2)
        rounded(f"Rabbit_HindFoot_{side}",(sign*.17,.03,.085),(.095,.22,.060),light,.030,rig,"paw.B"+side)
        rounded(f"Rabbit_FrontLeg_{side}",(sign*.145,-.18,.195),(.060,.070,.12),cream,.028,rig,"leg.F"+side)
        rounded(f"Rabbit_FrontPaw_{side}",(sign*.145,-.25,.075),(.075,.105,.050),light,.025,rig,"paw.F"+side)
    sphere("Rabbit_Tail",(0,.39,.40),(.12,.12,.12),light,rig,"tail.01",3)
    collar("Rabbit",rig,.48,-.30,green)

def hamster(rig):
    orange=mat("Hamster_Orange",(.68,.25,.035)); light=mat("Hamster_Cream",(.94,.68,.32)); brown=mat("Hamster_Shadow",(.25,.055,.006)); blue=mat("Hamster_Scarf",(.075,.28,.58))
    # Compact pear-shaped torso, broad cheek pouches, tiny paws and an almost
    # invisible tail make the silhouette read immediately as a hamster.
    sphere("Hamster_Body",(0,.03,.245),(.275,.255,.245),orange,rig,"spine",3)
    sphere("Hamster_Belly",(0,-.214,.225),(.185,.050,.180),light,rig,"spine",3)
    sphere("Hamster_Head",(0,-.165,.415),(.242,.190,.205),orange,rig,"head",3)
    for side,sign in (("L",-1),("R",1)):
        sphere(f"Hamster_Ear_{side}",(sign*.165,-.105,.555),(.066,.040,.064),orange,rig,"ear."+side,3)
        sphere(f"Hamster_InnerEar_{side}",(sign*.165,-.147,.555),(.037,.010,.037),PINK,rig,"ear."+side,2)
        sphere(f"Hamster_Cheek_{side}",(sign*.135,-.322,.326),(.108,.066,.090),light,rig,"head",3)
    eye_pair("Hamster",rig,.455,-.334,.105,(.062,.021,.068),(.45,.22,.06))
    sphere("Hamster_Nose",(0,-.405,.375),(.030,.019,.025),PINK,rig,"head",3)
    for side,sign in (("L",-1),("R",1)):
        rounded(f"Hamster_Incisor_{side}",(sign*.014,-.411,.338),(.010,.008,.022),light,.004,rig,"head")
    for side,sign in (("L",-1),("R",1)):
        sphere(f"Hamster_Shoulder_{side}",(sign*.105,-.255,.255),(.052,.050,.060),orange,rig,"leg.F"+side,2)
        sphere(f"Hamster_Hand_{side}",(sign*.060,-.345,.245),(.040,.032,.043),PINK,rig,"paw.F"+side,3)
        rounded(f"Hamster_Foot_{side}",(sign*.13,-.12,.055),(.060,.095,.035),PINK,.017,rig,"paw.B"+side)
    sphere("Hamster_Tail",(0,.272,.19),(.025,.030,.025),PINK,rig,"tail.01",2)
    # A real sunflower seed gives the hands a readable interaction prop.
    seed=mat("Hamster_Seed",(.16,.07,.025))
    rounded("Hamster_SunflowerSeed",(0,-.355,.235),(.030,.018,.060),seed,.012,rig,"head")
    collar("Hamster",rig,.315,-.22,blue)

def guinea_pig(rig):
    chestnut=mat("Guinea_Chestnut",(.38,.085,.012)); caramel=mat("Guinea_Caramel",(.62,.22,.035)); white=mat("Guinea_White",(.82,.62,.34)); blue=mat("Guinea_Scarf",(.055,.17,.38))
    sphere("Guinea_Body",(0,.06,.25),(.285,.42,.245),chestnut,rig,"spine",3)
    sphere("Guinea_BackPatch",(0,.18,.37),(.24,.22,.10),caramel,rig,"spine",2)
    sphere("Guinea_Head",(0,-.31,.31),(.26,.225,.225),caramel,rig,"head",3)
    sphere("Guinea_FaceBlaze",(0,-.515,.36),(.085,.035,.17),white,rig,"head",2)
    for side,sign in (("L",-1),("R",1)):
        sphere(f"Guinea_Ear_{side}",(sign*.18,-.26,.47),(.072,.040,.062),chestnut,rig,"ear."+side,2)
        sphere(f"Guinea_Cheek_{side}",(sign*.13,-.48,.27),(.115,.070,.10),white,rig,"head",2)
        rounded(f"Guinea_Paw_{side}",(sign*.16,-.23,.06),(.065,.10,.040),white,.020,rig,"paw.F"+side)
    eye_pair("Guinea",rig,.37,-.505,.12,(.065,.022,.070),(.38,.22,.08))
    sphere("Guinea_Nose",(0,-.572,.285),(.036,.023,.028),PINK,rig,"head",2)
    collar("Guinea",rig,.34,-.39,blue)

def ferret(rig):
    sable=mat("Ferret_Sable",(.075,.018,.006)); tan=mat("Ferret_Tan",(.34,.12,.028)); cream=mat("Ferret_Cream",(.68,.40,.13)); green=mat("Ferret_Harness",(.06,.24,.11))
    sphere("Ferret_Body",(0,.13,.33),(.19,.55,.18),sable,rig,"spine",3)
    sphere("Ferret_Neck",(0,-.30,.38),(.17,.20,.16),tan,rig,"spine",2)
    sphere("Ferret_Head",(0,-.48,.46),(.19,.22,.18),tan,rig,"head",3)
    sphere("Ferret_Mask",(0,-.665,.49),(.165,.035,.095),sable,rig,"head",2)
    for side,sign in (("L",-1),("R",1)):
        sphere(f"Ferret_Ear_{side}",(sign*.14,-.43,.59),(.058,.038,.060),tan,rig,"ear."+side,2)
        sphere(f"Ferret_Muzzle_{side}",(sign*.050,-.692,.405),(.066,.052,.054),cream,rig,"head",2)
    eye_pair("Ferret",rig,.505,-.682,.085,(.056,.020,.060),(.30,.20,.08))
    sphere("Ferret_Nose",(0,-.753,.43),(.038,.025,.027),PINK,rig,"head",2)
    for side,x in (("L",-.125),("R",.125)):
        for y,bone in ((-.25,"leg.F"+side),(.40,"leg.B"+side)):
            rounded(f"Ferret_Leg_{bone}",(x,y,.16),(.055,.075,.11),sable,.025,rig,bone)
            rounded(f"Ferret_Paw_{bone}",(x,y-.04,.055),(.066,.10,.035),cream,.018,rig,"paw.F"+side if '.F' in bone else "paw.B"+side)
    for i in range(7):
        sphere(f"Ferret_Tail_{i}",(.03*i,.62+.10*i,.35+.025*i),(.070-i*.004,.11,.065-i*.003),sable,rig,"tail.01" if i<4 else "tail.02",2)
    collar("Ferret",rig,.45,-.32,green)

def hedgehog(rig):
    brown=mat("Hedgehog_Quill",(.24,.075,.012)); tan=mat("Hedgehog_Tan",(.56,.22,.045)); cream=mat("Hedgehog_Cream",(.84,.52,.19)); red=mat("Hedgehog_Scarf",(.55,.055,.035))
    sphere("Hedgehog_Body",(0,.02,.25),(.29,.32,.26),brown,rig,"spine",3)
    sphere("Hedgehog_Face",(0,-.265,.31),(.205,.18,.19),tan,rig,"head",3)
    sphere("Hedgehog_Muzzle",(0,-.435,.25),(.13,.12,.11),cream,rig,"head",2)
    eye_pair("Hedgehog",rig,.35,-.435,.09,(.060,.020,.064),(.42,.25,.08))
    sphere("Hedgehog_Nose",(0,-.548,.255),(.040,.030,.032),BLACK,rig,"head",2)
    for side,sign in (("L",-1),("R",1)):
        sphere(f"Hedgehog_Ear_{side}",(sign*.145,-.225,.46),(.055,.034,.055),tan,rig,"ear."+side,2)
        rounded(f"Hedgehog_Foot_{side}",(sign*.13,-.16,.055),(.063,.10,.035),PINK,.018,rig,"paw.F"+side)
    # The finishing pass adds a dense tapered cap. The former ring of large
    # blocks resembled a dinosaur crest and is deliberately omitted.
    collar("Hedgehog",rig,.29,-.30,red)

def turtle(rig):
    green=mat("Turtle_Green",(.10,.29,.035)); light=mat("Turtle_Light",(.31,.48,.075)); shell=mat("Turtle_Shell",(.115,.042,.006)); plate=mat("Turtle_Plate",(.30,.13,.018)); pink=mat("Turtle_Flower",(.66,.12,.25))
    sphere("Turtle_Shell",(0,.05,.25),(.34,.43,.22),shell,rig,"spine",3)
    sphere("Turtle_Plastron",(0,-.02,.145),(.27,.35,.075),light,rig,"spine",2)
    # Raised shell plates preserve detail without textures.
    for row,(z,rad,count) in enumerate(((.39,.22,6),(.45,.14,5),(.49,.065,3))):
        for col in range(count):
            a=col/count*math.tau+(row%2)*.25
            sphere(f"Turtle_ShellPlate_{row}_{col}",(rad*math.cos(a),.05+rad*1.2*math.sin(a),z),(.070,.082,.026),plate,rig,"spine",2)
    sphere("Turtle_Neck",(0,-.36,.23),(.12,.18,.105),green,rig,"spine",2)
    sphere("Turtle_Head",(0,-.52,.29),(.16,.17,.15),green,rig,"head",3)
    eye_pair("Turtle",rig,.325,-.665,.075,(.055,.020,.060),(.40,.52,.18))
    sphere("Turtle_Muzzle",(0,-.675,.245),(.10,.055,.060),light,rig,"head",2)
    rounded("Turtle_Mouth",(0,-.733,.235),(.045,.005,.008),BLACK,.004,rig,"head")
    for side,x in (("L",-.235),("R",.235)):
        for front,y,bone in ((True,-.22,"leg.F"+side),(False,.30,"leg.B"+side)):
            sphere(f"Turtle_Leg_{bone}",(x,y,.12),(.11,.13,.07),green,rig,bone,2)
            for toe in (-.04,0,.04): rounded(f"Turtle_Toe_{bone}_{toe}",(x+toe,y-.10,.07),(.014,.040,.014),light,.006,rig,"paw.F"+side if front else "paw.B"+side)
    # Small flower crown from the official art direction.
    for i in range(5):
        a=i/5*math.tau; sphere(f"Turtle_FlowerPetal_{i}",(.10*math.cos(a),-.47,.48+.06*math.sin(a)),(.035,.018,.035),pink,rig,"head",2)
    sphere("Turtle_FlowerCenter",(0,-.49,.48),(.035,.018,.035),GOLD,rig,"head",2)

def gecko(rig):
    gold=mat("Gecko_Gold",(.52,.16,.014)); cream=mat("Gecko_Cream",(.76,.40,.075)); dark=mat("Gecko_Spots",(.12,.022,.003)); aqua=mat("Gecko_Collar",(.03,.29,.30))
    sphere("Gecko_Body",(0,.10,.16),(.15,.43,.12),gold,rig,"spine",3)
    sphere("Gecko_Head",(0,-.35,.23),(.20,.20,.15),gold,rig,"head",3)
    sphere("Gecko_Muzzle",(0,-.52,.19),(.15,.09,.08),cream,rig,"head",2)
    eye_pair("Gecko",rig,.275,-.515,.105,(.072,.030,.075),(.56,.66,.18))
    for side,x in (("L",-.13),("R",.13)):
        for front,y,bone in ((True,-.20,"leg.F"+side),(False,.27,"leg.B"+side)):
            limb=rounded(f"Gecko_Leg_{bone}",(x,y,.105),(.11,.045,.035),gold,.018,rig,bone); limb.rotation_euler.z=(-.35 if side=="L" else .35)
            for toe in range(4):
                rounded(f"Gecko_Toe_{bone}_{toe}",(x+(-.06+toe*.04),y-.075,.058),(.010,.055,.010),cream,.004,rig,"paw.F"+side if front else "paw.B"+side)
    for i in range(9):
        sphere(f"Gecko_Tail_{i}",(.018*i,.50+.105*i,.15+.012*math.sin(i*.7)),(.070-i*.005,.12,.055-i*.004),gold if i%3 else dark,rig,"tail.01" if i<5 else "tail.02",2)
    for row in range(3):
        for col in range(5):
            if (row+col)%2==0: sphere(f"Gecko_Spot_{row}_{col}",((col-2)*.055,-.02+row*.15,.25),(.020,.025,.012),dark,rig,"spine",2)
    collar("Gecko",rig,.245,-.27,aqua)

def budgie(rig):
    blue=mat("Budgie_Blue",(.07,.32,.70)); light=mat("Budgie_Light",(.42,.64,.70)); yellow=mat("Budgie_Yellow",(.80,.46,.025)); navy=mat("Budgie_Navy",(.012,.035,.11)); perch=mat("Budgie_Perch",(.22,.065,.010))
    sphere("Budgie_Body",(0,.02,.34),(.18,.19,.285),blue,rig,"spine",3)
    sphere("Budgie_Chest",(0,-.155,.33),(.15,.055,.23),light,rig,"spine",2)
    sphere("Budgie_Head",(0,-.10,.62),(.185,.17,.18),light,rig,"head",3)
    sphere("Budgie_Forehead",(0,-.245,.68),(.15,.055,.12),yellow,rig,"head",2)
    eye_pair("Budgie",rig,.675,-.268,.085,(.050,.018,.055),(.20,.26,.28))
    rounded("Budgie_Cere",(0,-.294,.620),(.050,.020,.022),light,.010,rig,"head")
    rounded("Budgie_Beak",(0,-.326,.575),(.042,.038,.040),yellow,.018,rig,"head").rotation_euler.x=.20
    for side,sign in (("L",-1),("R",1)):
        sphere(f"Budgie_Cheek_{side}",(sign*.112,-.274,.585),(.040,.014,.042),blue,rig,"head",2)
        for dot in range(3):
            sphere(f"Budgie_ThroatDot_{side}_{dot}",(sign*(.055+dot*.027),-.285,.545-dot*.018),(.010,.005,.011),navy,rig,"head",2)
    for row in range(4):
        for side,sign in (("L",-1),("R",1)):
            bar=rounded(f"Budgie_HeadBar_{side}_{row}",(sign*(.070+row*.019),-.225+.025*row,.735-.025*row),(.033,.010,.010),navy,.005,rig,"head")
            bar.rotation_euler.y=sign*.35
    # Layered wings have individual flight feathers and dark barring.
    for side,sign in (("L",-1),("R",1)):
        sphere(f"Budgie_Wing_{side}",(sign*.17,.02,.37),(.085,.15,.23),blue,rig,"spine",2)
        for i in range(6):
            feather=rounded(f"Budgie_Feather_{side}_{i}",(sign*(.19+i*.006),.02+i*.025,.40-i*.045),(.030,.105,.050),light if i%3==0 else blue,.018,rig,"spine")
            feather.rotation_euler.x=.10+i*.04
        for row in range(3):
            rounded(f"Budgie_WingBar_{side}_{row}",(sign*.258,-.01+row*.055,.46-row*.055),(.010,.055,.018),navy,.006,rig,"spine")
    for i,x in enumerate((-.065,0,.065)):
        tail=rounded(f"Budgie_Tail_{i}",(x,.28,.17),(.035,.25,.075),navy if i==1 else blue,.022,rig,"tail.01" if i!=1 else "tail.02"); tail.rotation_euler.x=-.16
    # Feet grip a real perch; room maps can later snap this actor to elevated anchors.
    rounded("Budgie_Perch",(0,.02,.075),(.28,.035,.035),perch,.016,rig,"root")
    for side,sign in (("L",-1),("R",1)):
        rounded(f"Budgie_Foot_{side}",(sign*.065,-.005,.11),(.025,.045,.018),PINK,.009,rig,"paw.F"+side)
        for toe in range(3): rounded(f"Budgie_Toe_{side}_{toe}",(sign*.065+(-.025+toe*.025),-.025,.075),(.007,.040,.007),PINK,.003,rig,"paw.F"+side)

BUILDERS={"rabbit":rabbit,"hamster":hamster,"guinea-pig":guinea_pig,"ferret":ferret,"hedgehog":hedgehog,"turtle":turtle,"gecko":gecko,"budgie":budgie}

def look_at(obj,target): obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()

def render(identifier,height):
    scene=bpy.context.scene; scene.render.engine="BLENDER_EEVEE"; scene.render.resolution_x=400; scene.render.resolution_y=400; scene.render.resolution_percentage=100
    scene.render.film_transparent=False; scene.render.image_settings.file_format="WEBP"; scene.render.image_settings.color_mode="RGB"; scene.view_settings.look="AgX - Medium High Contrast"; scene.view_settings.exposure=.18
    scene.world.color=(.70,.62,.56)
    scene.world.use_nodes=True
    scene.world.node_tree.nodes["Background"].inputs["Color"].default_value=(.72,.65,.59,1)
    scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value=.72
    parts=[obj for obj in scene.objects if obj.type=="MESH" and obj.get("pet_asset")]
    if parts:
        bpy.ops.object.select_all(action="DESELECT")
        for obj in parts:
            world=obj.matrix_world.copy(); obj.parent=None; obj.matrix_world=world; obj.select_set(True)
        scene.view_layers[0].objects.active=parts[0]; bpy.ops.object.join(); bpy.context.object.name="pet_portrait_mesh"
    bpy.ops.mesh.primitive_plane_add(size=6,location=(0,0,.012)); bpy.context.object.data.materials.append(mat("SmallPet_Studio",(.82,.72,.64),.82))
    distance=3.00 if height>1.0 else (2.45 if height>.65 else (1.95 if height>.4 else 1.65))
    target_z=max(.22,height*.48)
    bpy.ops.object.camera_add(location=(1.05,-distance,target_z+.63)); camera=bpy.context.object; camera.data.lens=58; look_at(camera,(0,-.02,target_z)); scene.camera=camera
    for loc,energy,color,size in [((-2,-2.6,3),930,(1,.76,.55),3),((2,.2,2.2),480,(.68,.79,1),2.2),((0,2.2,2.5),510,(1,.52,.30),1.8)]:
        bpy.ops.object.light_add(type="AREA",location=loc); light=bpy.context.object; light.data.energy=energy; light.data.color=color; light.data.size=size
    scene.render.filepath=str(PREVIEWS/(identifier+".webp")); bpy.ops.render.render(write_still=True)

selected=set(sys.argv[sys.argv.index("--")+1:]) if "--" in sys.argv else set(PETS)
for identifier,spec in PETS.items():
    if identifier not in selected: continue
    reset()
    # Blender's ACTIONS export mode includes every compatible action datablock.
    # Clear the previous species before authoring the next one so each GLB ships
    # exactly one semantic animation library instead of accumulating old clips.
    for action in list(bpy.data.actions): bpy.data.actions.remove(action)
    rig=make_rig(); rig.name="pet-"+spec["rig"]+"-rig"; rig["rig_family"]=spec["rig"]
    BUILDERS[identifier](rig)
    finish_small_pet(identifier, rig)
    create_actions(rig)
    bpy.context.scene["asset_manifest"]=json.dumps({"id":identifier,"schema":"compa-pet-v1","rig":spec["rig"],"species":spec["label"],"height":spec["height"],"colliderRadius":spec["radius"]})
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/(identifier+"-master.blend")))
    export_selected(MODELS/("pet-"+identifier+".glb"),[rig]+[o for o in bpy.context.scene.objects if o.get("pet_asset")])
    render(identifier,spec["height"])
    print("SMALL_PET_READY",identifier,flush=True)
