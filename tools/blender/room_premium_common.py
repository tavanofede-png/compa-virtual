"""Small data-only geometry kit for the editable Cozy v2 environment.

All locations are metres, Z up. A parent makes supplied transforms local.
Avoiding mesh operators keeps construction fast even for thousands of details.
"""
import math
import bpy
from mathutils import Vector
from build_harper import material as make_material


class RoomKit:
    def __init__(self):
        self.created=[]
        self.removed=[]
        self.original_names=set(bpy.data.objects.keys())

    def collection(self,name):
        collection=bpy.data.collections.get(name)
        if collection is None:
            collection=bpy.data.collections.new(name)
            root=bpy.data.collections.get('ROOM_COZY_MODERN_MASTER')
            (root or bpy.context.scene.collection).children.link(collection)
        return collection

    def mat(self,key):
        if isinstance(key,bpy.types.Material):return key
        mat=bpy.data.materials.get('MAT_'+key.upper())
        if mat is None:raise KeyError('Missing room material: '+key)
        return mat

    def material(self,key,color,roughness=.7,metallic=0):
        existing=bpy.data.materials.get('MAT_'+key.upper())
        if existing:return existing
        return make_material('MAT_'+key.upper(),color,roughness,metallic)

    def link(self,obj,collection,parent=None):
        self.collection(collection).objects.link(obj)
        if parent is not None:obj.parent=parent
        obj['compa_room_category']=collection
        obj['compa_room_version']=2
        self.created.append(obj.name)
        return obj

    def group(self,name,loc,rotation=(0,0,0),collection='DECOR'):
        obj=bpy.data.objects.new(name,None)
        self.link(obj,collection)
        obj.location=loc;obj.rotation_euler=rotation
        obj['compa_room_prop']=True
        return obj

    def remove_prefixes(self,prefixes):
        removed=[]
        for obj in list(bpy.data.objects):
            if any(obj.name.startswith(prefix) for prefix in prefixes):
                removed.append(obj.name)
                bpy.data.objects.remove(obj,do_unlink=True)
        self.removed.extend(removed)
        return removed

    def mesh(self,name,verts,faces,matkey,collection='DECOR',bevel=.002,parent=None):
        data=bpy.data.meshes.new(name+'Geometry')
        data.from_pydata(verts,[],faces);data.update()
        obj=bpy.data.objects.new(name,data)
        self.link(obj,collection,parent)
        data.materials.append(self.mat(matkey))
        if bevel:
            mod=obj.modifiers.new('Crafted edge radius','BEVEL')
            mod.width=bevel;mod.segments=2;mod.limit_method='ANGLE'
        return obj

    def box(self,name,loc,dims,matkey,collection='DECOR',bevel=.008,rotation=(0,0,0),parent=None):
        vertices=[(x*dims[0]/2,y*dims[1]/2,z*dims[2]/2)
                  for x,y,z in ((-1,-1,-1),(-1,-1,1),(-1,1,-1),(-1,1,1),(1,-1,-1),(1,-1,1),(1,1,-1),(1,1,1))]
        faces=[(2,6,4,0),(5,7,3,1),(4,5,1,0),(3,7,6,2),(1,3,2,0),(6,7,5,4)]
        obj=self.mesh(name,vertices,faces,matkey,collection,min(bevel,min(dims)*.24),parent)
        obj.location=loc;obj.rotation_euler=rotation
        return obj

    def cylinder(self,name,loc,radius,depth,matkey,collection='DECOR',vertices=16,radius_top=None,parent=None):
        top=radius if radius_top is None else radius_top
        coords=[]
        for z,r in ((-depth/2,radius),(depth/2,top)):
            coords.extend((r*math.cos(i*math.tau/vertices),r*math.sin(i*math.tau/vertices),z) for i in range(vertices))
        faces=[tuple(reversed(range(vertices))),tuple(range(vertices,2*vertices))]
        faces.extend((i,(i+1)%vertices,(i+1)%vertices+vertices,i+vertices) for i in range(vertices))
        obj=self.mesh(name,coords,faces,matkey,collection,min(.004,depth*.08,radius*.04),parent)
        obj.location=loc
        return obj

    def sphere(self,name,loc,scale,matkey,collection='DECOR',segments=12,rings=8,parent=None):
        coords=[(0,0,scale[2])]
        for ring in range(1,rings):
            theta=math.pi*ring/rings
            for i in range(segments):
                angle=i*math.tau/segments
                coords.append((math.sin(theta)*math.cos(angle)*scale[0],math.sin(theta)*math.sin(angle)*scale[1],math.cos(theta)*scale[2]))
        coords.append((0,0,-scale[2]));bottom=len(coords)-1
        faces=[]
        for i in range(segments):faces.append((0,1+i,1+(i+1)%segments))
        for row in range(rings-2):
            for i in range(segments):
                a=1+row*segments+i;b=1+row*segments+(i+1)%segments
                faces.append((a,a+segments,b+segments,b))
        start=1+(rings-2)*segments
        for i in range(segments):faces.append((start+i,bottom,start+(i+1)%segments))
        obj=self.mesh(name,coords,faces,matkey,collection,0,parent)
        obj.location=loc
        for face in obj.data.polygons:face.use_smooth=True
        return obj

    def tube(self,name,points,radius,matkey,collection='DECOR',cyclic=False,parent=None):
        curve=bpy.data.curves.new(name+'Path','CURVE')
        curve.dimensions='3D';curve.resolution_u=1
        curve.bevel_depth=radius;curve.bevel_resolution=1
        curve.use_fill_caps=True
        spline=curve.splines.new('POLY');spline.points.add(len(points)-1)
        for point,co in zip(spline.points,points):point.co=(*co,1)
        spline.use_cyclic_u=cyclic
        obj=bpy.data.objects.new(name,curve)
        self.link(obj,collection,parent)
        curve.materials.append(self.mat(matkey))
        return obj

    def text(self,name,body,loc,size,matkey,collection='WALL_STORY',rotation=(0,0,0),parent=None,align='CENTER'):
        data=bpy.data.curves.new(name+'Text','FONT')
        data.body=body;data.size=size;data.align_x=align;data.align_y='CENTER'
        data.extrude=.0005;data.bevel_depth=.0002;data.bevel_resolution=0
        obj=bpy.data.objects.new(name,data)
        self.link(obj,collection,parent)
        obj.location=loc;obj.rotation_euler=rotation
        obj.data.materials.append(self.mat(matkey))
        return obj

    def book(self,name,loc,width=.18,height=.27,depth=.04,color='sage',rotation=(0,0,0),collection='DECOR',flat=False):
        root=self.group(name,loc,rotation,collection)
        parent=root
        if flat:
            parent=self.group(name+'_FlatBinding',(-height/2,0,width/2),(0,math.pi/2,0),collection)
            parent.parent=root
        self.box(name+'_Paper',(0,.004,height/2),(max(.008,width-.009),depth-.012,height-.014),'paper',collection,.001,parent=parent)
        for sign in (-1,1):
            self.box(name+'_Cover_'+str(sign),(sign*width/2,0,height/2),(.004,depth,height),color,collection,.001,parent=parent)
        self.box(name+'_Spine',(0,-depth/2,height/2),(width+.003,.007,height),color,collection,.001,parent=parent)
        for z in (.035,height-.035):
            self.box(name+'_SpineBand_'+str(z),(0,-depth/2-.004,z),(width*.83,.002,.009),'gold',collection,.0004,parent=parent)
        self.box(name+'_SpineLabel',(0,-depth/2-.005,height*.55),(width*.64,.002,height*.30),'cream',collection,.0005,parent=parent)
        for row in range(3):
            self.box(name+'_LabelLine_'+str(row),(0,-depth/2-.007,height*.63-row*.022),(width*.45,.001,.003),'ink',collection,0,parent=parent)
        for row in range(4):
            xx=-width*.35+row*width*.23
            self.box(name+'_PageEdge_'+str(row),(xx,depth/2-.005,height/2),(.0007,.001,height-.025),'linen_shadow',collection,0,parent=parent)
        return root
