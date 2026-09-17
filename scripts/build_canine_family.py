"""Derive seven production canine silhouettes from the approved detailed canine rig."""
import bpy, math, json, sys
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"scripts"))
from build_pet_mvp import rounded, mat, export_selected

SOURCE=ROOT/"packages/assets/3d/source/pets"
MODELS=ROOT/"apps/web/public/selection/models"
PREVIEWS=ROOT/"apps/web/public/selection/pets"
MASTER=SOURCE/"golden-retriever-master.blend"

SPECS={
 "border-collie": {"label":"Border collie","primary":(.035,.025,.022),"secondary":(.78,.74,.65),"accent":(.18,.24,.14),"shape":"athletic","ears":"semi"},
 "corgi": {"label":"Corgi","primary":(.58,.19,.025),"secondary":(.90,.62,.25),"accent":(.50,.055,.025),"shape":"low","ears":"upright"},
 "dachshund": {"label":"Dachshund","primary":(.20,.055,.018),"secondary":(.54,.18,.035),"accent":(.12,.20,.10),"shape":"long","ears":"floppy"},
 "french-bulldog": {"label":"French bulldog","primary":(.34,.27,.19),"secondary":(.72,.59,.39),"accent":(.10,.20,.34),"shape":"stocky","ears":"bat"},
 "shiba-inu": {"label":"Shiba inu","primary":(.86,.39,.045),"secondary":(.98,.72,.27),"accent":(.16,.30,.12),"shape":"compact","ears":"upright"},
 "poodle": {"label":"Poodle","primary":(.62,.30,.11),"secondary":(.88,.55,.24),"accent":(.72,.10,.32),"shape":"poodle","ears":"curly"},
 "husky": {"label":"Husky","primary":(.12,.15,.18),"secondary":(.65,.69,.70),"accent":(.06,.24,.46),"shape":"tall","ears":"upright"},
}

def materialize(spec):
    primary=mat("Breed_Primary",spec["primary"]); secondary=mat("Breed_Secondary",spec["secondary"])
    dark=mat("Breed_Dark",tuple(max(.01,c*.28) for c in spec["primary"])); accent=mat("Breed_Accent",spec["accent"])
    for obj in [o for o in bpy.context.scene.objects if o.type=="MESH" and o.get("pet_asset")]:
        name=obj.name.lower()
        if any(key in name for key in ("eye","pupil","nose","smile")): continue
        if "bandana" in name: obj.data.materials[0]=accent; continue
        if any(key in name for key in ("muzzle","chest","ruff","toe","paw")): obj.data.materials[0]=secondary
        elif any(key in name for key in ("brow","nosebridge")): obj.data.materials[0]=dark
        elif (sum(ord(c) for c in name)%5)==0: obj.data.materials[0]=secondary
        else: obj.data.materials[0]=primary
    return primary,secondary,dark,accent

def world_shift(obj,dx=0,dy=0,dz=0):
    obj.matrix_world.translation += Vector((dx,dy,dz))

def scale_named(keys,scale):
    for obj in bpy.context.scene.objects:
        if obj.type=="MESH" and any(key.lower() in obj.name.lower() for key in keys):
            obj.scale.x*=scale[0]; obj.scale.y*=scale[1]; obj.scale.z*=scale[2]

def delete_named(keys):
    for obj in list(bpy.context.scene.objects):
        if any(key.lower() in obj.name.lower() for key in keys): bpy.data.objects.remove(obj,do_unlink=True)

def erect_ears(rig,primary,secondary,mode):
    delete_named(["Golden_Ear"])
    height=.22 if mode=="bat" else .18
    width=.115 if mode=="bat" else .085
    for side,x,sign in (("L",-.23,-1),("R",.23,1)):
        outer=rounded(f"Breed_Ear_{side}",(x,-.43,.96),(width,.075,height),primary,.045,rig,"ear."+side)
        outer.rotation_euler.y=sign*.18
        inner=rounded(f"Breed_EarInner_{side}",(x,-.506,.97),(width*.52,.018,height*.62),secondary,.018,rig,"ear."+side)
        inner.rotation_euler.y=sign*.18

def apply_shape(spec,rig,primary,secondary,dark):
    shape=spec["shape"]
    if shape=="low":
        scale_named(["Body","Shoulder"],(1,1.16,.86)); scale_named(["Leg","Feather"],(1,1,.58)); scale_named(["Head","Forehead"],(1.08,.94,1.04))
        for obj in bpy.context.scene.objects:
            if any(k in obj.name for k in ("Leg","Feather")): world_shift(obj,dz=-.075)
    elif shape=="long":
        scale_named(["Body","Shoulder","BackCoat","BodyDetail"],(.88,1.48,.78)); scale_named(["Leg","Feather"],(.88,1,.48)); scale_named(["Head","Forehead"],(.90,1.12,.90)); scale_named(["Muzzle"],(.88,1.22,.88))
        for obj in bpy.context.scene.objects:
            if any(k in obj.name for k in ("Leg","Feather")): world_shift(obj,dz=-.09)
    elif shape=="stocky":
        scale_named(["Body","Shoulder","Chest"],(1.18,.82,1.05)); scale_named(["Head","Forehead"],(1.17,.79,1.12)); scale_named(["Muzzle"],(1.04,.62,.78)); scale_named(["Leg"],(1.08,1,.75))
    elif shape=="compact":
        scale_named(["Body","Shoulder"],(.95,.92,1)); scale_named(["Head"],(1.04,.88,1.02)); scale_named(["Muzzle"],(.90,.82,.82))
        # curled tail, reinforced with a visible upper curl
        rounded("Shiba_Tail_Curl",(.10,.64,.87),(.13,.14,.12),primary,.06,rig,"tail.02").rotation_euler.y=.7
    elif shape=="poodle":
        scale_named(["Body","Shoulder"],(.88,.88,1.05)); scale_named(["Leg"],(.82,.82,1.13)); scale_named(["Head"],(.96,.90,.94))
        for ring,(y,z,radius,count) in enumerate([(-.45,.98,.26,14),(-.39,.88,.29,16),(.02,.62,.33,16)]):
            for i in range(count):
                a=math.tau*i/count; x=math.cos(a)*radius; zz=z+math.sin(a)*radius*.55
                rounded(f"Poodle_Curl_{ring}_{i}",(x,y,zz),(.052,.05,.052),secondary if i%4==0 else primary,.025,rig,"head" if ring<2 else "spine")
        for side,x in (("L",-.23),("R",.23)):
            for i in range(5): rounded(f"Poodle_EarCurl_{side}_{i}",(x,-.45,.86-i*.065),(.07,.065,.07),primary,.032,rig,"ear."+side)
    elif shape=="tall":
        scale_named(["Body","Shoulder"],(.95,1.0,1.07)); scale_named(["Leg","Feather"],(.92,.92,1.15)); scale_named(["Head"],(1.03,.94,1.04))
        # husky mask is modelled as separate brow and cheek plates
        for x in (-.13,.13): rounded("Husky_Mask",(x,-.744,.855),(.10,.012,.12),secondary,.028,rig,"head")
    elif shape=="athletic":
        scale_named(["Body","Shoulder"],(.90,1.06,1.03)); scale_named(["Leg"],(.82,.88,1.10)); scale_named(["Head"],(.94,.91,.96))
        rounded("Collie_Blaze",(0,-.724,.89),(.055,.018,.17),secondary,.022,rig,"head")
    if spec["ears"] in ("upright","bat"): erect_ears(rig,primary,secondary,spec["ears"])
    elif spec["ears"]=="semi":
        erect_ears(rig,primary,secondary,"upright")
        scale_named(["Breed_Ear"],(1,1,.82))

def look_at(obj,target): obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
def render(identifier):
    scene=bpy.context.scene; scene.render.engine="BLENDER_EEVEE"; scene.render.resolution_x=480; scene.render.resolution_y=480; scene.render.resolution_percentage=100
    scene.render.film_transparent=False; scene.render.image_settings.file_format="WEBP"; scene.render.image_settings.color_mode="RGB"; scene.view_settings.look="AgX - Medium High Contrast"; scene.view_settings.exposure=-.65
    scene.world.color=(.045,.038,.035)
    bpy.ops.mesh.primitive_plane_add(size=7,location=(0,0,.015)); bpy.context.object.data.materials.append(mat("Breed_Studio",(.14,.09,.065),.9))
    bpy.ops.object.camera_add(location=(2.0,-3.55,1.58)); camera=bpy.context.object; camera.data.lens=58; look_at(camera,(0,-.02,.51)); scene.camera=camera
    for loc,energy,color,size in [((-2,-2.6,3),620,(1,.69,.40),3),((2,.2,2.2),300,(.58,.72,1),2.2),((0,2.2,2.5),380,(1,.4,.18),1.8)]:
        bpy.ops.object.light_add(type="AREA",location=loc); light=bpy.context.object; light.data.energy=energy; light.data.color=color; light.data.size=size
    scene.render.filepath=str(PREVIEWS/(identifier+".webp")); bpy.ops.render.render(write_still=True)

for identifier,spec in SPECS.items():
    bpy.ops.wm.open_mainfile(filepath=str(MASTER))
    rig=bpy.data.objects.get("pet-canine-rig")
    primary,secondary,dark,accent=materialize(spec)
    apply_shape(spec,rig,primary,secondary,dark)
    for obj in bpy.context.scene.objects:
        if obj.get("pet_asset"): obj.name=obj.name.replace("Golden_",identifier.title().replace('-','')+"_")
    bpy.context.scene["asset_manifest"]=json.dumps({"id":identifier,"schema":"compa-pet-v1","rig":"canine-standard","breed":spec["label"]})
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/(identifier+"-master.blend")))
    export_selected(MODELS/("pet-"+identifier+".glb"),[rig]+[o for o in bpy.context.scene.objects if o.get("pet_asset")])
    render(identifier)
    print("CANINE_READY",identifier,flush=True)
