"""Reauthor poses in world axes and bake ground contact into the root bone."""
import bpy, math, sys, json
from pathlib import Path
from mathutils import Vector, Quaternion
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from build_pet_mvp import keyed, export_selected, mat
STAGE=ROOT/'renders/pet-anatomy-v2'


def world_pose(rig,rotations=None,translations=None):
    result={}
    for name in set(rotations or {})|set(translations or {}):
        axes=rig.data.bones[name].matrix_local.to_3x3()
        q=axes.to_quaternion()
        r=(rotations or {}).get(name,(0,0,0))
        world=Quaternion((1,0,0),r[0]) @ Quaternion((0,1,0),r[1]) @ Quaternion((0,0,1),r[2])
        local=q.inverted() @ world @ q
        delta=axes.inverted() @ Vector((translations or {}).get(name,(0,0,0)))
        result[name]=(tuple(local.to_euler('XYZ')),tuple(delta))
    return result


def author(rig,small):
    rig.animation_data_clear()
    for action in list(bpy.data.actions):bpy.data.actions.remove(action)
    p=lambda r=None,t=None:world_pose(rig,r,t)
    neutral={}
    breathe=p({'head':(.012,0,0)})
    left=p({'head':(0,0,.13 if small else .2)})
    right=p({'head':(0,0,-.13 if small else -.2)})
    if small:
        sit=p({'head':(.07,0,0)})
        lie=p({'head':(.16,0,0)}, {'spine':(0,0,-.025)})
    else:
        sit=p({'spine':(-.14,0,0),'leg.BL':(-1.1,0,0),'leg.BR':(-1.1,0,0),'head':(.08,0,0)}, {'spine':(0,.02,-.10)})
        lie=p({'leg.FL':(-1.15,0,0),'leg.FR':(-1.15,0,0),'leg.BL':(-1.12,0,0),'leg.BR':(-1.12,0,0),'paw.FL':(1.15,0,0),'paw.FR':(1.15,0,0),'paw.BL':(1.12,0,0),'paw.BR':(1.12,0,0),'head':(.10,0,0)}, {'spine':(0,0,-.12),'head':(0,-.005,-.016)})
    sleep={**lie,**p({'head':(.17,0,.03)})}
    tail_l=p({'tail.01':(0,.06,.04 if small else .12),'tail.02':(0,.04,.03 if small else .11)})
    tail_r=p({'tail.01':(0,-.06,-.04 if small else -.12),'tail.02':(0,-.04,-.03 if small else -.11)})
    clips={
        'pet_idle':([0,2,4],[neutral,{**breathe,**tail_l},neutral],True),
        'pet_look':([0,.8,1.6,2.4],[neutral,left,right,neutral],False),
        'pet_react':([0,.3,.8,1.2],[neutral,{**left,**tail_l},breathe,neutral],False),
        'pet_sit_down':([0,.6,1.2],[neutral,p(t={'spine':(0,0,-.04 if not small else 0)}),sit],False),
        'pet_seated':([0,2,4],[sit,{**sit,**tail_l},sit],True),
        'pet_stand_up':([0,.6,1.2],[sit,p(t={'spine':(0,0,-.04 if not small else 0)}),neutral],False),
        'pet_lie_down':([0,.8,1.7],[neutral,sit,lie],False),
        'pet_rest':([0,2.5,5],[lie,sleep,lie],True),
        'pet_get_up':([0,.9,1.8],[lie,sit,neutral],False),
        'pet_sniff':([0,.4,.8,1.6],[neutral,p({'head':(.13,0,0)}),p({'head':(.19,0,.06)}),neutral],False),
        'pet_play':([0,.4,.9,1.8],[neutral,left,right,neutral],False),
        'pet_carry':([0,1,2],[neutral,breathe,neutral],True),
        'pet_celebrate':([0,.35,.7,1.2,1.8],[neutral,p({'head':(-.06,0,0)}),p({'head':(-.10,0,0)},{'root':(0,0,.035 if small else .075)}),tail_r,neutral],False),
    }
    for name,(times,poses,loop) in clips.items():keyed(rig,name,times,poses,loop)
    for run in (False,True):
        poses=[]
        for i in range(17):
            w=math.sin(i/16*math.tau);a=.18 if small else (.48 if run else .30)
            rotations={'leg.BL':(-a*w,0,0),'leg.BR':(a*w,0,0)}
            if not small:rotations.update({'leg.FL':(a*w,0,0),'leg.FR':(-a*w,0,0)})
            poses.append(p(rotations))
        keyed(rig,'pet_run' if run else 'pet_walk',[i/(20 if run else 12) for i in range(17)],poses,True)
    rig.animation_data.action=None
    for bone in rig.pose.bones:bone.location=(0,0,0);bone.rotation_euler=(0,0,0)


def ground_clips(rig):
    scene=bpy.context.scene
    meshes=[o for o in scene.objects if o.type=='MESH' and o.get('pet_asset')]
    root=rig.pose.bones['root'];root_axes=rig.data.bones['root'].matrix_local.to_3x3()
    report=[]
    for action in list(bpy.data.actions):
        rig.animation_data.action=action
        start,end=map(int,action.frame_range)
        # First measure unmodified motion, then insert corrections. This keeps
        # interpolation from compounding corrections measured on earlier frames.
        samples=[]
        for frame in range(start,end+1):
            scene.frame_set(frame);bpy.context.view_layer.update()
            deps=bpy.context.evaluated_depsgraph_get()
            min_z=min((o.evaluated_get(deps).matrix_world @ Vector(corner)).z for o in meshes for corner in o.evaluated_get(deps).bound_box)
            hop=0
            if action.name=='pet_celebrate':
                t=(frame-start)/30
                hop=max(0,1-abs(t-.7)/.35)*(.035 if 'small' in rig.name else .075)
            loc=root.location.copy()+root_axes.inverted()@Vector((0,0,-min_z+hop))
            samples.append((frame,loc,min_z))
        for frame,loc,_ in samples:
            scene.frame_set(frame)
            root.location=loc;root.keyframe_insert('location',frame=frame,group='root')
        measured=[]
        for frame in range(start,end+1):
            scene.frame_set(frame);bpy.context.view_layer.update()
            deps=bpy.context.evaluated_depsgraph_get()
            measured.append(min((o.evaluated_get(deps).matrix_world @ Vector(corner)).z for o in meshes for corner in o.evaluated_get(deps).bound_box))
        report.append({'clip':action.name,'contactSamples':len(samples),'originalMin':min(s[2] for s in samples),'correctedMin':min(measured),'correctedMax':max(measured)})
    rig.animation_data.action=None
    for bone in rig.pose.bones:bone.location=(0,0,0);bone.rotation_euler=(0,0,0)
    scene.frame_set(1);bpy.context.view_layer.update()
    return report


ids=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['hamster','orange-tabby']
for identifier in ids:
    if identifier.startswith('--'):continue
    path=STAGE/(identifier+'-master.blend')
    bpy.ops.wm.open_mainfile(filepath=str(path))
    rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
    author(rig,identifier=='hamster')
    report=ground_clips(rig)
    bpy.ops.wm.save_as_mainfile(filepath=str(path))
    export_selected(STAGE/('pet-'+identifier+'.glb'),[rig]+[o for o in bpy.context.scene.objects if o.get('pet_asset')])
    (STAGE/(identifier+'-contacts.json')).write_text(json.dumps(report,indent=2),encoding='utf-8')
    if '--review' in ids:
        scene=bpy.context.scene
        camera=scene.camera
        camera.location=(1.30,-2.55,1.16)
        target=Vector((0,-.035,.295 if identifier=='hamster' else .47))
        camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
        camera.data.ortho_scale=.9 if identifier=='hamster' else 1.45
        scene.cycles.samples=20
        for clip,t in (('pet_walk',.35),('pet_rest',.2)):
            rig.animation_data.action=bpy.data.actions[clip]
            scene.frame_set(int(t*30)+1)
            scene.render.filepath=str(STAGE/(identifier+'-'+clip+'.png'))
            bpy.ops.render.render(write_still=True)
    print('CONTACT_READY',identifier,flush=True)
