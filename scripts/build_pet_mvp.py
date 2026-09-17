"""Build the editable golden retriever MVP and its Cozy habitat props."""
import bpy, math, json
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "packages/assets/3d/source/pets"
MODELS = ROOT / "apps/web/public/selection/models"
PREVIEWS = ROOT / "apps/web/public/selection/pets"
for folder in (SOURCE, MODELS, PREVIEWS): folder.mkdir(parents=True, exist_ok=True)

def reset():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.armatures, bpy.data.actions):
        if hasattr(block, "remove"):
            pass

def mat(name, color, rough=.78, metallic=0.0):
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    material.diffuse_color = (*color, 1)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metallic
    return material

PALETTE = {
    "gold": mat("Pet_Golden_Fur", (.64, .255, .038)),
    "mid": mat("Pet_Golden_Mid", (.82, .42, .085)),
    "light": mat("Pet_Cream_Fur", (.94, .64, .22)),
    "dark": mat("Pet_Shadow_Fur", (.20, .052, .010)),
    "white": mat("Pet_Muzzle", (.96, .79, .50)),
    "sclera": mat("Pet_Eye_Sclera", (.98, .91, .78), .28),
    "iris": mat("Pet_Eye_Iris", (.36, .14, .035), .24),
    "black": mat("Pet_Eyes_Nose", (.035, .025, .022), .42),
    "eye": mat("Pet_Eye_Highlight", (1, .94, .78), .3),
    "pink": mat("Pet_Tongue", (.92, .31, .35)),
    "blue": mat("Pet_Bandana_Blue", (.08, .25, .47)),
    "tag": mat("Pet_Tag_Gold", (.95, .62, .12), .28, .35),
    "blush": mat("Pet_Cheek", (.92, .40, .27), .7),
}

def rounded(name, loc, scale, material, bevel=.04, parent=None, bone=None):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    obj = bpy.context.object; obj.name = name; obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    mod = obj.modifiers.new("Voxel bevel", "BEVEL"); mod.width = min(bevel, min(scale)*.72); mod.segments = 2
    bpy.context.view_layer.objects.active = obj; bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.data.materials.append(material); obj["pet_asset"] = True
    if parent and bone:
        world = obj.matrix_world.copy(); obj.parent = parent; obj.parent_type = "BONE"; obj.parent_bone = bone; obj.matrix_world = world
    return obj

def sphere(name, loc, scale, material, parent=None, bone=None, subdivisions=2):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=1, location=loc)
    obj=bpy.context.object; obj.name=name; obj.scale=scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material); obj["pet_asset"] = True
    if parent and bone:
        world=obj.matrix_world.copy(); obj.parent=parent; obj.parent_type="BONE"; obj.parent_bone=bone; obj.matrix_world=world
    return obj

def make_rig():
    arm = bpy.data.armatures.new("Pet_Canine_Rig")
    rig = bpy.data.objects.new("pet-canine-rig", arm); bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active=rig; rig.select_set(True); bpy.ops.object.mode_set(mode="EDIT")
    bones = {
      "root": ((0,0,.12),(0,0,.30),None),
      "spine": ((0,0,.30),(0,-.04,.68),"root"),
      "head": ((0,-.18,.66),(0,-.46,.78),"spine"),
      "ear.L": ((-.16,-.40,.78),(-.19,-.31,.94),"head"), "ear.R": ((.16,-.40,.78),(.19,-.31,.94),"head"),
      "tail.01": ((0,.36,.58),(0,.62,.69),"spine"), "tail.02": ((0,.62,.69),(0,.82,.78),"tail.01"),
      "leg.FL": ((-.20,-.22,.55),(-.20,-.24,.28),"spine"), "paw.FL": ((-.20,-.24,.28),(-.20,-.30,.08),"leg.FL"),
      "leg.FR": ((.20,-.22,.55),(.20,-.24,.28),"spine"), "paw.FR": ((.20,-.24,.28),(.20,-.30,.08),"leg.FR"),
      "leg.BL": ((-.20,.25,.53),(-.20,.27,.27),"spine"), "paw.BL": ((-.20,.27,.27),(-.20,.21,.08),"leg.BL"),
      "leg.BR": ((.20,.25,.53),(.20,.27,.27),"spine"), "paw.BR": ((.20,.27,.27),(.20,.21,.08),"leg.BR"),
    }
    for name,(head,tail,parent) in bones.items():
        bone=arm.edit_bones.new(name); bone.head=head; bone.tail=tail
        if parent: bone.parent=arm.edit_bones[parent]
    bpy.ops.object.mode_set(mode="POSE")
    for bone in rig.pose.bones: bone.rotation_mode="XYZ"
    bpy.ops.object.mode_set(mode="OBJECT"); rig["rig_family"]="canine-standard"; rig["schema"]="compa-pet-v1"
    return rig

def build_golden():
    reset(); rig=make_rig()
    # Premium stylized anatomy: a longer rib cage, articulated legs and a large,
    # expressive puppy head. The silhouette stays voxel based, but no longer reads
    # as a single toy block when the camera moves in close.
    rounded("Golden_Body", (0,.06,.58), (.31,.50,.285), PALETTE["gold"], .135, rig, "spine")
    rounded("Golden_Ribcage", (0,.04,.61), (.325,.39,.285), PALETTE["mid"], .125, rig, "spine")
    rounded("Golden_Shoulder", (0,-.27,.64), (.335,.235,.285), PALETTE["mid"], .115, rig, "spine")
    rounded("Golden_Chest", (0,-.405,.52), (.255,.17,.285), PALETTE["light"], .105, rig, "spine")
    rounded("Golden_Neck", (0,-.27,.75), (.265,.205,.18), PALETTE["light"], .085, rig, "spine")
    rounded("Golden_Head", (0,-.47,.875), (.31,.255,.285), PALETTE["gold"], .125, rig, "head")
    rounded("Golden_Crown", (0,-.455,1.055), (.245,.205,.105), PALETTE["mid"], .06, rig, "head")
    rounded("Golden_Forehead", (0,-.685,.955), (.255,.075,.145), PALETTE["mid"], .052, rig, "head")
    rounded("Golden_BrowPlane", (0,-.724,.885), (.245,.035,.12), PALETTE["gold"], .032, rig, "head")
    rounded("Golden_Muzzle", (0,-.745,.705), (.205,.125,.125), PALETTE["white"], .065, rig, "head")
    rounded("Golden_MuzzleL", (-.092,-.805,.725), (.115,.058,.095), PALETTE["white"], .048, rig, "head")
    rounded("Golden_MuzzleR", (.092,-.805,.725), (.115,.058,.095), PALETTE["white"], .048, rig, "head")
    rounded("Golden_Chin", (0,-.79,.645), (.135,.052,.055), PALETTE["white"], .030, rig, "head")
    sphere("Golden_Nose", (0,-.873,.775), (.086,.052,.065), PALETTE["black"], rig, "head", subdivisions=3)
    rounded("Golden_NoseBridge", (0,-.765,.825), (.050,.048,.075), PALETTE["mid"], .026, rig, "head")
    rounded("Golden_Tongue", (0,-.845,.625), (.060,.038,.086), PALETTE["pink"], .030, rig, "head")
    # Eyes are layered rather than painted: sclera, iris, pupil, catchlight and brows.
    for x in (-.125,.125):
        side="L" if x<0 else "R"
        sphere("Golden_EyeWhite"+side, (x,-.775,.882), (.098,.035,.116), PALETTE["black"], rig, "head", subdivisions=3)
        sphere("Golden_Iris"+side, (x,-.806,.870), (.068,.018,.082), PALETTE["iris"], rig, "head", subdivisions=3)
        sphere("Golden_Pupil"+side, (x,-.820,.880), (.044,.010,.064), PALETTE["black"], rig, "head", subdivisions=2)
        sphere("Golden_EyeSpark"+side, (x-.022,-.832,.920), (.020,.008,.026), PALETTE["eye"], rig, "head", subdivisions=2)
        sphere("Golden_EyeSparkSmall"+side, (x+.026,-.832,.850), (.010,.006,.013), PALETTE["eye"], rig, "head", subdivisions=2)
        rounded("Golden_EyeCorner"+side, (x+(.074 if x<0 else -.074),-.815,.888), (.012,.007,.032), PALETTE["sclera"], .005, rig, "head")
        brow=rounded("Golden_Brow"+side, (x,-.776,1.010), (.105,.020,.024), PALETTE["dark"], .011, rig, "head")
        brow.rotation_euler.y = (-.10 if x<0 else .10)
        rounded("Golden_Cheek"+side, (x*1.42,-.790,.730), (.041,.012,.024), PALETTE["blush"], .010, rig, "head")
    # Layered floppy ears with the characteristic wavy edge.
    for side,x,sign in (("L",-.292,-1),("R",.292,1)):
        for i,(z,y,sx,sz,color) in enumerate([
          (.945,-.50,.090,.155,"dark"),(.830,-.51,.120,.180,"gold"),(.695,-.49,.105,.155,"mid")]):
            ear=rounded(f"Golden_Ear{side}_{i}", (x+sign*i*.018,y,z), (sx,.10,sz), PALETTE[color], .052, rig, "ear."+side)
            ear.rotation_euler.y = sign*(.14+i*.08)
        for i in range(4):
            rounded(f"Golden_EarCurl{side}_{i}",(x+sign*.045,-.615,.90-i*.075),(.052,.038,.052),PALETTE["light" if i%2 else "mid"],.027,rig,"ear."+side)
    for side,x in (("L",-.205),("R",.205)):
        for pos,bone in [((x,-.275,.38),"leg.F"+side),((x,.30,.37),"leg.B"+side)]:
            rounded("Golden_UpperLeg"+bone, (pos[0],pos[1],pos[2]+.105), (.112,.125,.145), PALETTE["gold"], .055, rig, bone)
            rounded("Golden_LowerLeg"+bone, (pos[0],pos[1]-.018,pos[2]-.075), (.088,.098,.155), PALETTE["mid"], .046, rig, bone)
            rounded("Golden_Feather"+bone, (pos[0],pos[1]-.068,pos[2]+.025), (.090,.060,.175), PALETTE["light"], .038, rig, bone)
            rounded("Golden_Hock"+bone, (pos[0],pos[1]+(.045 if '.B' in bone else -.035),.225), (.092,.092,.072), PALETTE["gold"], .035, rig, bone)
        for y,bone in [(-.32,"paw.F"+side),(.24,"paw.B"+side)]:
            rounded("Golden_Paw"+bone, (x,y,.095), (.112,.155,.080), PALETTE["light"], .044, rig, bone)
            for toe in (-.045,0,.045): rounded("Toe", (x+toe,y-.12,.105), (.016,.025,.018), PALETTE["white"], .008, rig, bone)
    rounded("Golden_Tail1", (0,.57,.67), (.12,.24,.12), PALETTE["gold"], .065, rig, "tail.01").rotation_euler.x=.35
    rounded("Golden_Tail2", (0,.79,.79), (.105,.22,.095), PALETTE["light"], .055, rig, "tail.02").rotation_euler.x=.55
    for i in range(6):
        rounded(f"Golden_TailFeather_{i}",((-.05 if i%2 else .05),.57+i*.055,.66+i*.035),(.055,.08,.045),PALETTE["mid" if i%2 else "light"],.026,rig,"tail.01" if i<3 else "tail.02")
    # Blocky fur tufts preserve the official voxel language in close-ups.
    for i,(x,y,z,s,bone) in enumerate([
      (-.24,-.31,.67,.078,"spine"),(.24,-.31,.67,.078,"spine"),(-.30,-.08,.66,.065,"spine"),(.30,-.08,.66,.065,"spine"),
      (-.27,.20,.68,.07,"spine"),(.27,.20,.68,.07,"spine"),(-.20,-.58,.99,.06,"head"),(-.07,-.62,1.02,.065,"head"),(.07,-.62,1.02,.065,"head"),(.20,-.58,.99,.06,"head"),
      (-.27,-.49,.94,.052,"head"),(.27,-.49,.94,.052,"head"),(-.25,-.64,.78,.045,"head"),(.25,-.64,.78,.045,"head"),
      (-.20,-.39,.58,.065,"spine"),(-.10,-.41,.55,.07,"spine"),(0,-.43,.54,.075,"spine"),(.10,-.41,.55,.07,"spine"),(.20,-.39,.58,.065,"spine")]):
        rounded("Golden_FurTuft_%02d"%i,(x,y,z),(s,s*.78,s*.70),PALETTE[["light","mid","gold"][i%3]],s*.38,rig,bone)
    # Fur scallops along the back break the toy-block silhouette in close-ups.
    for row,z in enumerate((.72,.78)):
        for i,x in enumerate((-.24,-.12,0,.12,.24)):
            rounded(f"Golden_BackCoat_{row}_{i}",(x,.11+row*.12,z),(.052,.07,.045),PALETTE["mid" if (i+row)%2 else "light"],.025,rig,"spine")
    # Fine voxel coat. These small layered clumps make the silhouette and close-ups
    # read like the detailed companion characters instead of a smooth toy block.
    detail=0
    for z in (.82,.89,.96,1.02):
        width=.27-(z-.82)*.32
        count=7 if z<.98 else 5
        for column in range(count):
            x=-width+2*width*(column/(count-1))
            y=-.692-.012*((column+round(z*100))%2)
            rounded(f"Golden_HeadDetail_{detail}",(x,y,z),(.033,.024,.030),PALETTE["light" if detail%4==0 else "mid"],.014,rig,"head"); detail+=1
    # Crown and brow curls extend beyond the core mesh, giving the head a dense,
    # groomed silhouette from every camera angle.
    for row,y in enumerate((-.66,-.55,-.44,-.33,-.24)):
        count=7 if row in (1,2,3) else 5
        width=.245 if count==7 else .19
        for column in range(count):
            x=-width+2*width*(column/(count-1))
            lift=.018*((column+row)%2)
            rounded(f"Golden_CrownCurl_{row}_{column}",(x,y,1.165+lift),(.039,.041,.034),PALETTE["light" if (column+row)%4==0 else "mid"],.017,rig,"head")
    for column,x in enumerate((-.22,-.145,-.072,0,.072,.145,.22)):
        rounded(f"Golden_BrowCurl_{column}",(x,-.742,1.055+(.012 if column%2 else 0)),(.038,.026,.038),PALETTE["gold" if column%3 else "light"],.016,rig,"head")
    for side,sign in (("L",-1),("R",1)):
        for row,z in enumerate((.70,.77,.84,.91)):
            for column,y in enumerate((-.58,-.48,-.38)):
                rounded(f"Golden_SideDetail_{side}_{row}_{column}",(sign*(.292+column*.006),y,z),(.031,.037,.034),PALETTE["gold" if (row+column)%2 else "light"],.014,rig,"head")
    for side,sign in (("L",-1),("R",1)):
        for row,z in enumerate((.42,.50,.58,.66,.73)):
            for column,y in enumerate((-.18,.00,.18,.34)):
                rounded(f"Golden_BodyDetail_{side}_{row}_{column}",(sign*.334,y,z),(.035,.045,.034),PALETTE["mid" if (row+column)%3 else "light"],.015,rig,"spine")
    for row,z in enumerate((.37,.45,.53,.61,.68)):
        count=5 if row<4 else 3
        for column in range(count):
            x=(column-(count-1)/2)*.092
            rounded(f"Golden_RuffDetail_{row}_{column}",(x,-.535,z),(.044,.032,.047),PALETTE["white" if (row+column)%3==0 else "light"],.019,rig,"spine")
    # Pixel smile and lower-lip corners are real geometry for clean close-ups.
    for x,angle in ((-.055,-.28),(.055,.28)):
        smile=rounded("Golden_Smile",(x,-.833,.677),(.055,.009,.012),PALETTE["dark"],.005,rig,"head")
        smile.rotation_euler.y=angle
    # Bandana and tag.
    rounded("Pet_Bandana_Blue", (0,-.405,.64), (.285,.045,.055), PALETTE["blue"], .026, rig, "spine")
    rounded("Pet_Bandana_KnotL", (-.245,-.37,.64), (.062,.05,.05), PALETTE["blue"], .024, rig, "spine")
    rounded("Pet_Bandana_KnotR", (.245,-.37,.64), (.062,.05,.05), PALETTE["blue"], .024, rig, "spine")
    flap=rounded("Pet_Bandana_Flap", (0,-.40,.52), (.12,.035,.115), PALETTE["blue"], .028, rig, "spine"); flap.rotation_euler.y=math.pi/4
    sphere("Pet_Tag", (0,-.445,.57), (.035,.02,.035), PALETTE["tag"], rig, "spine")
    create_actions(rig)
    bpy.context.scene["asset_manifest"] = json.dumps({"id":"golden-retriever","schema":"compa-pet-v1","rig":"canine-standard","height":.98,"colliderRadius":.32})
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/"golden-retriever-master.blend"))
    export_selected(MODELS/"pet-golden-retriever.glb", [rig]+[o for o in bpy.context.scene.objects if o.get("pet_asset")])
    render_pet(rig)

def keyed(rig, action_name, seconds, poses, loop=False):
    action=bpy.data.actions.new(action_name); rig.animation_data_create(); rig.animation_data.action=action
    for second, pose in zip(seconds, poses):
        frame=round(second*30)+1
        for name,bone in rig.pose.bones.items():
            rot,loc=pose.get(name,((0,0,0),(0,0,0)))
            bone.rotation_euler=rot; bone.location=loc
            bone.keyframe_insert("rotation_euler",frame=frame,group=name); bone.keyframe_insert("location",frame=frame,group=name)
    track=rig.animation_data.nla_tracks.new(); track.name=action_name
    strip=track.strips.new(action_name,1,action); strip.name=action_name; track.mute=True
    action["loop"] = loop

def pose(**entries):
    return {name:(value if len(value)==2 and isinstance(value[0],tuple) else (value,(0,0,0))) for name,value in entries.items()}

def create_actions(rig):
    rig.animation_data_clear(); bpy.context.scene.render.fps=30
    neutral={}
    wag1=pose(**{"tail.01":(0,0,-.48),"tail.02":(0,0,-.38)})
    wag2=pose(**{"tail.01":(0,0,.48),"tail.02":(0,0,.38)})
    keyed(rig,"pet_idle",[0,1,2,3,4],[neutral,wag1,neutral,wag2,neutral],True)
    keyed(rig,"pet_look",[0,.7,1.5,2.2],[neutral,pose(head=(0,0,.28)),pose(head=(0,0,-.28)),neutral])
    def gait(run=False):
        keys=[]
        for i in range(9):
            w=math.sin(i/8*math.tau); a=.62 if run else .38
            keys.append(pose(**{"leg.FL":(a*w,0,0),"leg.BR":(a*w,0,0),"leg.FR":(-a*w,0,0),"leg.BL":(-a*w,0,0),"paw.FL":(-.32*max(0,w),0,0),"paw.BR":(-.32*max(0,w),0,0),"paw.FR":(-.32*max(0,-w),0,0),"paw.BL":(-.32*max(0,-w),0,0),"spine":((.05*w if run else .025*w,0,0),(0,0,.025*abs(w) if run else 0)),"tail.01":(0,0,.24*w)}))
        keyed(rig,"pet_run" if run else "pet_walk",[i/(8 if run else 5) for i in range(9)],keys,True)
    gait(); gait(True)
    sit=pose(spine=((-.24,0,0),(0,.08,-.12)),**{"leg.BL":(-1.15,0,0),"leg.BR":(-1.15,0,0),"paw.BL":(.7,0,0),"paw.BR":(.7,0,0),"head":(.18,0,0)})
    keyed(rig,"pet_sit_down",[0,.6,1.2],[neutral,pose(spine=((-.12,0,0),(0,.03,-.05))),sit])
    keyed(rig,"pet_seated",[0,1.8,3.6],[sit,{**sit,**wag1},sit],True)
    keyed(rig,"pet_stand_up",[0,.7,1.3],[sit,pose(spine=((-.1,0,0),(0,.02,-.04))),neutral])
    lie=pose(spine=((0,0,0),(0,.05,-.22)),head=((.18,0,0),(0,-.03,-.10)),**{"leg.FL":(-1.2,0,0),"leg.FR":(-1.2,0,0),"leg.BL":(-1.15,0,0),"leg.BR":(-1.15,0,0)})
    keyed(rig,"pet_lie_down",[0,.8,1.7],[neutral,sit,lie])
    keyed(rig,"pet_rest",[0,2.5,5],[lie,{**lie,"head":((.23,0,.08),(0,-.03,-.11))},lie],True)
    keyed(rig,"pet_get_up",[0,.9,1.8],[lie,sit,neutral])
    keyed(rig,"pet_sniff",[0,.5,1,1.6],[neutral,pose(head=(.42,0,0)),pose(head=(.52,0,.18)),neutral])
    keyed(rig,"pet_react",[0,.25,.65,1.2],[neutral,pose(head=(-.28,0,0),**{"ear.L":(-.25,0,0),"ear.R":(-.25,0,0)}),{**wag1,"head":((-.12,0,0),(0,0,0))},neutral])
    keyed(rig,"pet_play",[0,.4,.8,1.2,1.8],[neutral,pose(head=(.48,0,0),spine=((-.12,0,0),(0,-.06,-.06))),{**wag1,"head":((.4,0,-.15),(0,0,0))},{**wag2,"head":((.4,0,.15),(0,0,0))},neutral])
    keyed(rig,"pet_carry",[0,1,2],[pose(head=(.12,0,0)),{**wag1,"head":((.12,0,0),(0,0,0))},pose(head=(.12,0,0))],True)
    keyed(rig,"pet_celebrate",[0,.35,.7,1.2,1.8],[neutral,pose(spine=((-.18,0,0),(0,0,-.05))),pose(spine=((.12,0,0),(0,0,.18)),**{"leg.FL":(-.7,0,0),"leg.FR":(-.7,0,0)}),wag1,neutral])
    rig.animation_data.action=None

def export_selected(path, objects, animations=True):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects: obj.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.export_scene.gltf(filepath=str(path),export_format="GLB",use_selection=True,export_animations=animations,export_animation_mode="ACTIONS",export_nla_strips=True,export_force_sampling=True,export_extras=True,export_yup=True)

def look_at(obj, target): obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
def render_pet(rig):
    scene=bpy.context.scene; scene.render.engine="BLENDER_EEVEE"; scene.render.resolution_x=600; scene.render.resolution_y=600; scene.render.resolution_percentage=100
    scene.render.film_transparent=False; scene.render.image_settings.file_format="WEBP"; scene.render.image_settings.color_mode="RGB"
    scene.render.image_settings.color_depth="8"; scene.view_settings.look="AgX - Medium High Contrast"; scene.view_settings.exposure=-.7
    scene.world.color=(.055,.045,.04)
    world=scene.world; world.use_nodes=True; world.node_tree.nodes["Background"].inputs["Color"].default_value=(.055,.042,.035,1); world.node_tree.nodes["Background"].inputs["Strength"].default_value=.32
    bpy.ops.mesh.primitive_plane_add(size=8, location=(0,0,.015)); ground=bpy.context.object; ground.name="Studio_Ground"; ground.data.materials.append(mat("Studio_Warm",(.16,.105,.075),.9))
    bpy.ops.object.camera_add(location=(1.62,-2.92,1.48)); camera=bpy.context.object; camera.data.lens=56; look_at(camera,(0,-.05,.56)); scene.camera=camera
    bpy.ops.object.light_add(type="AREA", location=(-2.2,-2.8,3.2)); bpy.context.object.data.energy=620; bpy.context.object.data.color=(1,.70,.42); bpy.context.object.data.shape="DISK"; bpy.context.object.data.size=3
    bpy.ops.object.light_add(type="AREA", location=(2.3,-.3,2.4)); bpy.context.object.data.energy=300; bpy.context.object.data.color=(.58,.72,1); bpy.context.object.data.size=2.4
    bpy.ops.object.light_add(type="AREA", location=(0,2.2,2.6)); bpy.context.object.data.energy=390; bpy.context.object.data.color=(1,.42,.18); bpy.context.object.data.size=1.8
    scene.render.filepath=str(PREVIEWS/"golden-retriever.webp"); bpy.ops.render.render(write_still=True)

def export_prop(filename, builder):
    reset(); objects=builder(); export_selected(MODELS/(filename+".glb"),objects,False); bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/(filename+".blend")))

def bed():
    cream=mat("Bed_Cream",(.78,.67,.51)); blue=mat("Bed_Blue",(.10,.28,.43)); stitch=mat("Bed_Stitch",(.96,.82,.55))
    objects=[rounded("PetBed_Base",(0,0,.12),(.48,.38,.12),cream,.08),rounded("PetBed_Cushion",(0,0,.24),(.39,.30,.10),blue,.07)]
    for x,y in [(-.34,-.25),(.34,-.25),(-.34,.25),(.34,.25)]: objects.append(rounded("PetBed_Stitch",(x,y,.27),(.035,.035,.025),stitch,.012))
    return objects
def bowl():
    metal=mat("Bowl_Ceramic",(.20,.46,.60),.35); water=mat("Bowl_Water",(.16,.55,.76),.18)
    return [sphere("PetBowl",(0,0,.09),(.20,.20,.10),metal,subdivisions=2),sphere("PetWater",(0,0,.14),(.145,.145,.025),water,subdivisions=2)]
def basket():
    wicker=mat("Basket_Wicker",(.45,.22,.08)); cloth=mat("Basket_Cloth",(.82,.54,.25))
    objects=[rounded("ToyBasket",(0,0,.18),(.25,.20,.18),wicker,.045)]
    for x in (-.16,0,.16): objects.append(rounded("BasketWeave",(x,-.205,.19),(.025,.018,.15),cloth,.008))
    return objects
def ball():
    orange=mat("Ball_Orange",(.95,.32,.08)); ivory=mat("Ball_Ivory",(.95,.82,.56))
    return [sphere("PetBall",(0,0,.11),(.11,.11,.11),orange,subdivisions=2),rounded("BallStripe",(0,-.105,.11),(.03,.018,.09),ivory,.012)]
def rope():
    blue=mat("Rope_Blue",(.08,.28,.48)); gold=mat("Rope_Gold",(.90,.53,.13))
    return [rounded("RopeCenter",(0,0,.08),(.22,.045,.045),blue,.025),sphere("RopeKnotL",(-.25,0,.08),(.075,.075,.075),gold),sphere("RopeKnotR",(.25,0,.08),(.075,.075,.075),gold)]

if __name__ == "__main__":
    build_golden()
    for filename,builder in [("pet-bed-cozy",bed),("pet-bowl-cozy",bowl),("pet-toy-basket-cozy",basket),("pet-ball-cozy",ball),("pet-rope-cozy",rope)]: export_prop(filename,builder)
    (SOURCE/"pet-mvp-manifest.json").write_text(json.dumps({"pet":"pet-golden-retriever.glb","clips":["pet_idle","pet_look","pet_walk","pet_run","pet_sit_down","pet_seated","pet_stand_up","pet_lie_down","pet_rest","pet_get_up","pet_sniff","pet_react","pet_play","pet_carry","pet_celebrate"],"props":["pet-bed-cozy","pet-bowl-cozy","pet-toy-basket-cozy","pet-ball-cozy","pet-rope-cozy"]},indent=2),encoding="utf-8")
    print("PET_MVP_READY", flush=True)
