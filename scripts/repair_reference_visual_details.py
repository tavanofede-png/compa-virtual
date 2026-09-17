import bpy,math,sys
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[1];sys.path.insert(0,str(R/'scripts'))
from build_distinct_reference_rooms import *
def repair(theme):
 bpy.ops.wm.open_mainfile(filepath=str(OUT/(theme+'-review.blend')));k=RoomKit()
 if theme=='habitacion-invernadero':
  # Replace swollen placeholder leaves with shaped blades, central ridge and veins.
  for o in list(bpy.context.scene.objects):
   if not(o.type=='MESH' and o.name.startswith('GARDEN_Specimen') and '_Leaf' in o.name):continue
   mat=o.data.materials[0];verts=[]
   levels=[(-.16,.002),(-.115,.027),(-.05,.057),(.03,.065),(.105,.044),(.16,.013),(.18,.001)]
   for z,w in levels:verts.extend([(-w,0,z),(0,-.013*math.sin((z+.16)/.34*math.pi),z),(w,0,z)])
   faces=[]
   for j in range(len(levels)-1):
    for a in (0,1):faces.append((j*3+a,j*3+a+1,(j+1)*3+a+1,(j+1)*3+a))
   mesh=bpy.data.meshes.new(o.name+'_Blade');mesh.from_pydata(verts,[],faces);mesh.materials.append(mat);o.data=mesh
   vein=k.tube(o.name+'_Midrib',[(0,-.004,-.16),(0,-.016,0),(0,-.005,.18)],.0015,'sage_light','BOTANICAL_REFINEMENT',parent=o)
   for z in (-.09,-.02,.06):
    for side in (-1,1):k.tube(o.name+'_Vein',[(0,-.014,z-.02),(side*.035,-.005,z+.025)],.0008,'sage_light','BOTANICAL_REFINEMENT',parent=o)
  for o in bpy.context.scene.objects:
   if o.name.startswith('GARDEN_HangingCord'):
    bottom=o.location.z-o.dimensions.z/2;top=4.4-abs(o.location.x-.6)*1.2/3.7
    o.dimensions.z=max(.03,top-bottom);o.location.z=(top+bottom)/2
 elif theme=='sala-control-gamer':
  for o in bpy.context.scene.objects:
   if o.type=='LIGHT' and not o.name.startswith(('GAMER_','TECH_')):o.data.energy*=.30
  D.lamp(k,'GAMER_FinalBlueAmbient',(1.2,2.2,2.8),160,(.18,.25,1),1.8,(1.4,1.2,.7))
  D.lamp(k,'GAMER_FinalPurpleFill',(-2.5,.4,2.6),110,(.40,.12,1),1.3,(-1.5,.8,.8))
  glow=D.glow(k,'final_gamer_blue','#5268FF',3)
  k.box('GAMER_NeonPosterBacking',(-2.976,-.78,1.99),(.02,.86,1.48),'ink','FINAL_DETAILS',.005)
  k.tube('GAMER_PosterNeonFrame',[(-2.957,-1.21,1.25),(-2.957,-.35,1.25),(-2.957,-.35,2.73),(-2.957,-1.21,2.73)],.008,glow,'FINAL_DETAILS',True)
  k.box('GAMER_DeskUnderlight',(1.22,1.67,1.005),(2.23,.018,.022),glow,'FINAL_DETAILS',.003)
  for j in range(2):
   x=-1.98+j*.4
   for dx in (-.112,.112):k.sphere('GAMER_ControllerGrip',(x+dx,-1.612,.687),(.047,.065,.032),'cream','FINAL_DETAILS',12,6)
   for q in range(4):k.cylinder('GAMER_ControllerButton',(x+.047+.018*math.cos(q*math.pi/2),-1.582+.018*math.sin(q*math.pi/2),.735),.007,.006,('pink','sage','gold','dusk')[q],'FINAL_DETAILS',8)
 elif theme=='rincon-explorador':
  remove(('PRM_BOT_MainShelf','PRM_BOT_ShelfHerb'))
  for o in bpy.context.scene.objects:
   if not o.parent and o.name.startswith(('Premium_Bookcase_TopJournals','STUDY_ShelfBook_3')):o.location+=Vector((-3.70,.15,.34))
   if o.name.startswith('EXP_Globe'):o.location.z-=.028
 elif theme=='estudio-musical':
  remove(('Desk_Speaker',))
  for key,color in [('MAT_FLOOR','#876044'),('MAT_FLOOR_LIGHT','#AC815B'),('MAT_FLOOR_DARK','#604431')]:
   mat=bpy.data.materials.get(key)
   if mat and mat.use_nodes:mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=D.rgba(color)
 elif theme=='rincon-urbano':
  k.box('CITY_GlazingJunctionPier',(.15,2.63,1.81),(.30,.18,3.26),'wall','NEW_STRUCTURE',.002)
 scene=bpy.context.scene;scene['reference_visual_repair']=True;bpy.ops.wm.save_as_mainfile(filepath=str(OUT/(theme+'-review.blend')),compress=True)
 scene.render.filepath=str(PRE/(theme+'-review.png'));bpy.ops.render.render(write_still=True)
 target={'habitacion-invernadero':(3.1,-.5,1),'rincon-explorador':(-1.60,.5,1.8),'estudio-musical':(1.05,1.9,1.7),'sala-control-gamer':(1.75,1.4,1.53),'rincon-urbano':(1.70,1.7,1.65)}[theme]
 scene.camera.location=Vector(target)+Vector((5,-7,4.2));look_at(scene.camera,target);scene.camera.data.ortho_scale=4.2
 scene.render.resolution_x=1000;scene.render.resolution_y=1000;scene.cycles.samples=20
 scene.render.filepath=str(PRE/(theme+'-detail.png'));bpy.ops.render.render(write_still=True)
 (OUT/(theme+'-review.json')).write_text(json.dumps({'theme':theme,'objects':len(scene.objects),'status':'review master','app_integrated':False,'full_collision_audit':False},indent=2))
 print('VISUAL_REPAIR_DONE',theme,flush=True)
for name in sys.argv[sys.argv.index('--')+1:]:repair(name)
