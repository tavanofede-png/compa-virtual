import bpy,math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'renders/app-redesign'
for action in ['stand','sit','rest']:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(OUT/('motion-'+action+'.glb')))
    scene=bpy.context.scene
    scene.world=bpy.data.worlds.new('World');scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.78,.74,.68,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.5
    light=bpy.data.lights.new('Softbox','AREA');light.energy=1400;light.shape='DISK';light.size=5
    o=bpy.data.objects.new('Softbox',light);scene.collection.objects.link(o);o.location=(-3,-4,7);o.rotation_euler=((Vector((0,0,0))-o.location).to_track_quat('-Z','Y').to_euler())
    data=bpy.data.cameras.new('Camera');cam=bpy.data.objects.new('Camera',data);scene.collection.objects.link(cam)
    cam.location=(7.7,-10.3,7.1);target=Vector((0,0,1.05));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();data.type='ORTHO';data.ortho_scale=10.1;scene.camera=cam
    scene.render.engine='CYCLES';scene.cycles.samples=16;scene.cycles.use_denoising=True
    scene.render.resolution_x=1100;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.filepath=str(OUT/('motion-'+action+'.png'))
    bpy.ops.render.render(write_still=True);print('REVIEW_RENDER',action,flush=True)
