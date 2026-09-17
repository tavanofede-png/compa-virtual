import bpy,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'renders/app-redesign';OUT.mkdir(exist_ok=True)
rooms=['cozy','minimalista','tecnologia','naturaleza','urbano','biblioteca-moderna']
for room in rooms:
    source=ROOT/'room_cozy_premium.blend' if room=='cozy' else ROOT/f'packages/assets/3d/source/rooms/{room}-master-v1.blend'
    bpy.ops.wm.open_mainfile(filepath=str(source))
    anchor=bpy.data.objects.get('Companion_RoomAnchor')
    if anchor:
        for child in anchor.children_recursive:child.hide_render=True
    scene=bpy.context.scene
    scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
    scene.render.resolution_x=1200;scene.render.resolution_y=900;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.filepath=str(OUT/(room+'.png'))
    bpy.ops.render.render(write_still=True)
    print('POSTER_DONE',room,flush=True)
