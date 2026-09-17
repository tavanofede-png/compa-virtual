"""Author editable clips and room interactions without changing source masters."""
import bpy, math, json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'packages/assets/3d/motion'; OUT.mkdir(exist_ok=True)
rooms=['cozy','minimalista','tecnologia','naturaleza','urbano','biblioteca-moderna']
maps={}
def xyz(p): return [round(p[0],4),round(p[2],4),round(-p[1],4)]
for room in rooms:
    source=ROOT/'room_cozy_premium.blend' if room=='cozy' else ROOT/f'packages/assets/3d/source/rooms/{room}-master-v1.blend'
    bpy.ops.wm.open_mainfile(filepath=str(source))
    def bounds(name):
        o=bpy.data.objects[name]; vs=[o.matrix_world@Vector(c) for c in o.bound_box]
        return [min(v[i] for v in vs) for i in range(3)],[max(v[i] for v in vs) for i in range(3)]
    seat=bpy.data.objects['Desk_ChairSeat']; bed=bpy.data.objects['Bed_Mattress']; anchor=bpy.data.objects['Companion_RoomAnchor']
    slo,shi=bounds('Desk_ChairSeat'); blo,bhi=bounds('Bed_Mattress')
    m={'version':1,'source':source.name,'floor':round(anchor.location.z,4),'spawn':xyz(anchor.location),
       'chair':{'position':xyz([seat.location.x,seat.location.y,shi[2]]),'approach':[round(seat.location.x,4),.18,-.32],'yaw':math.pi,'height':round(shi[2],4)},
       'bed':{'position':xyz([bed.location.x,-.8,bhi[2]+.04]),'approach':[-.59,.18,-.15],'yaw':math.pi/2,'height':round(bhi[2]+.04,4)},
       'bounds':[-3.35,-2.2,3.25,2.05],
       'obstacles':[{'id':'bed','min':[round(blo[0],4),round(-bhi[1],4)],'max':[round(bhi[0],4),round(-blo[1],4)]},
                    {'id':'desk','min':[.12,-2.5],'max':[2.5,-1.64]},
                    {'id':'chair','min':[1.0,-1.52],'max':[1.72,-.82]},
                    {'id':'pouf','min':[-.84,1.0],'max':[.17,2.0]},
                    {'id':'lounge-table','min':[.42,.92],'max':[1.48,1.98]},
                    {'id':'shelf','min':[2.62,-2.5],'max':[3.65,-1.2]}],
       'waypoints':[[1.94,.18,-.3],[1.36,.18,-.32],[.34,.18,-.15],[-.59,.18,-.15],[2.15,.18,.65]],
       'stow':{'chair':[2.03,.18,-1.1],'bed':[-.64,.18,.47]}}
    maps[room]=m
    collection=bpy.data.collections.new('COMPA_INTERACTIONS');bpy.context.scene.collection.children.link(collection)
    for name,point in [('spawn',m['spawn']),('chair_approach',m['chair']['approach']),('chair_contact',m['chair']['position']),('bed_approach',m['bed']['approach']),('bed_contact',m['bed']['position'])]:
        o=bpy.data.objects.new('Interaction_'+name,None);collection.objects.link(o);o.location=(point[0],-point[2],point[1]);o.empty_display_size=.15;o['interaction']=name
    # Keep maps editable as an isolated small Blender scene; never rewrite art masters.
    for o in list(bpy.context.scene.objects):
        if o.name not in collection.objects:bpy.data.objects.remove(o,do_unlink=True)
    bpy.context.scene['room_map_json']=json.dumps(m)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/(room+'-interactions.blend')))
(ROOT/'packages/world3d/src/room-maps.json').write_text(json.dumps(maps,indent=2))
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'packages/assets/3d/app/milo-base-editable.blend'))
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
rig.animation_data_clear();bpy.context.scene.render.fps=30
for b in rig.pose.bones:b.rotation_mode='XYZ'
rest={n:(0,0,0) for n in [b.name for b in rig.pose.bones]}
def pose(**kw):
    r=dict(rest);r.update(kw);return r
sit=pose(**{'thigh.L':(-math.pi/2,0,0),'thigh.R':(-math.pi/2,0,0),'shin.L':(math.pi/2,0,0),'shin.R':(math.pi/2,0,0),'forearm.L':(-.85,0,0),'forearm.R':(-.85,0,0),'upper_arm.L':(.12,0,-.13),'upper_arm.R':(.12,0,.13)})
study=dict(sit);study.update({'spine':(.08,0,0),'head':(.13,0,0),'upper_arm.L':(-.35,0,-.16),'upper_arm.R':(-.35,0,.16),'forearm.L':(-1.0,0,0),'forearm.R':(-1.0,0,0)})
recline=pose(**{'forearm.L':(-.15,0,0),'forearm.R':(-.15,0,0),'upper_arm.L':(0,0,-.1),'upper_arm.R':(0,0,.1)})
clips={
 'idle':[(0,pose()),(2,pose(head=(0,.075,0))),(4,pose())],
 'greet':[(0,pose()),(.5,pose(**{'upper_arm.R':(0,0,-1.9),'forearm.R':(-.6,0,0)})),(.85,pose(**{'upper_arm.R':(0,0,-1.9),'forearm.R':(-.6,0,.4)})),(1.2,pose(**{'upper_arm.R':(0,0,-1.9),'forearm.R':(-.6,0,-.25)})),(1.6,pose(**{'upper_arm.R':(0,0,-1.9),'forearm.R':(-.6,0,.3)})),(2.1,pose())],
 'sit_down':[(0,pose()),(.5,pose(spine=(.16,0,0))),(1.3,sit)],
 'seated':[(0,sit),(3,{**sit,'head':(0,.065,0)}),(6,sit)],
 'stand_up':[(0,sit),(1,pose(spine=(.15,0,0))),(1.5,pose())],
 'study':[(0,study),(1.2,{**study,'hand.R':(.12,0,0)}),(2.4,study)],
 'lie_down':[(0,sit),(.8,{**sit,'spine':(-.2,0,0)}),(2,recline)],
 'rest':[(0,recline),(4,{**recline,'head':(0,.025,0)}),(8,recline)],
 'get_up':[(0,recline),(1.8,sit),(3,pose())],
 'celebrate':[(0,pose()),(.45,pose(**{'upper_arm.L':(0,0,1.3),'upper_arm.R':(0,0,-1.3),'forearm.L':(-1,0,0),'forearm.R':(-1,0,0)})),(.9,pose(**{'upper_arm.L':(0,0,1.55),'upper_arm.R':(0,0,-1.55),'forearm.L':(-.7,0,0),'forearm.R':(-.7,0,0)})),(1.8,pose())],
 'turn':[(0,pose()),(.4,pose(head=(0,.12,0))),(1,pose())],
 'stop':[(0,pose(**{'thigh.L':(-.12,0,0),'thigh.R':(.12,0,0)})),(.35,pose())]}
walk=[]
for i in range(17):
    t=i/16;wave=math.sin(t*math.tau)
    walk.append((t,pose(**{'thigh.L':(.42*wave,0,0),'thigh.R':(-.42*wave,0,0),'shin.L':(.48*max(0,-wave),0,0),'shin.R':(.48*max(0,wave),0,0),'upper_arm.L':(-.26*wave,0,0),'upper_arm.R':(.26*wave,0,0),'forearm.L':(-.12,0,0),'forearm.R':(-.12,0,0)})))
clips['walk']=walk
rig.animation_data_create()
for name,keys in clips.items():
    action=bpy.data.actions.new(name);rig.animation_data.action=action
    for seconds,p in keys:
        for b in rig.pose.bones:
            b.rotation_euler=p[b.name];b.keyframe_insert(data_path='rotation_euler',frame=round(seconds*30)+1,group=b.name)
    track=rig.animation_data.nla_tracks.new();track.name=name
    strip=track.strips.new(name,1,action);strip.name=name;track.mute=True
rig.animation_data.action=None
for b in rig.pose.bones:b.rotation_euler=(0,0,0)
bpy.context.scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'companion-motion-library.blend'))
# Minimal skinned mesh retains the complete named bone hierarchy in the glTF library.
mesh=bpy.data.meshes.new('MotionProxy');mesh.from_pydata([(0,0,0),(.001,0,0),(0,.001,0)],[],[(0,1,2)])
proxy=bpy.data.objects.new('MotionProxy',mesh);bpy.context.scene.collection.objects.link(proxy);proxy.parent=rig
for bone in rig.data.bones:
    g=proxy.vertex_groups.new(name=bone.name)
    if bone.name=='root':g.add([0,1,2],1,'REPLACE')
proxy.modifiers.new('Skin','ARMATURE').object=rig
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);proxy.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(OUT/'rig-animations.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_nla_strips=True,export_force_sampling=True,export_extras=True)
(ROOT/'apps/web/public/selection/models/rig-animations.glb').write_bytes((OUT/'rig-animations.glb').read_bytes())
print('MOTION_LIBRARY_READY',list(clips),flush=True)
