"""Export the eight skin-colored continuous limb shells, canonical bind space."""
import bpy,sys,json,hashlib
from pathlib import Path
from mathutils import Matrix
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'tools/blender'))
from build_companion_collection import CHARACTERS
from premium_glb import optimize_skin_attributes
OUT=ROOT/'packages/assets/3d/wardrobe';(OUT/'body-fits').mkdir(exist_ok=True)
records=[]
for c in CHARACTERS:
    bpy.ops.wm.open_mainfile(filepath=str(OUT/f'source/{c.id}-wardrobe-fitted.blend'))
    rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');rig.matrix_world=Matrix.Identity(4)
    bpy.ops.object.select_all(action='DESELECT')
    objects=list(bpy.data.collections['WARDROBE_CONTINUOUS_BODY'].objects)
    for o in [rig,*objects]:o.hide_set(False);o.hide_render=False;o.select_set(True)
    bpy.context.view_layer.update();bpy.context.view_layer.objects.active=rig
    path=OUT/f'body-fits/{c.id}.glb'
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_animations=False,export_apply=True,export_extras=True)
    optimize_skin_attributes(path)
    records.append({'character':c.id,'path':f'body-fits/{c.id}.glb','bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'replaces':['Body_UpperArm_L','Body_UpperArm_R','Body_Forearm_L','Body_Forearm_R','Body_Thigh_L','Body_Thigh_R','Body_Shin_L','Body_Shin_R'],'components':[o['compa_component'] for o in objects],'bindScale':1})
catalog=json.loads((OUT/'catalog.json').read_text(encoding='utf-8'));catalog['continuousBodies']=records
catalog['bodyMasks']={'replaceSourceLimbs':True,'continuousLimbAssets':'body-fits/{character}.glb','coveredComponents':{'longSleeves':['arm_L','arm_R'],'longPants':['leg_L','leg_R']},'headAndHands':'Preserve original head and hands. Harper fitted master uses a neutral mirrored left hand when not carrying books.'}
(OUT/'catalog.json').write_text(json.dumps(catalog,indent=2,ensure_ascii=False),encoding='utf-8')
print('EXPORTED_BODY_FITS',len(records),flush=True)
