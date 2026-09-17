"""Continuous skin under short garments; replaces disconnected v4 limb blocks.

Uses the same measured envelope and skeleton. Only fitted copies are changed.
"""
from mathutils import Vector
from wardrobe_geometry import MeshBuilder

def create_limb_shell(character,rig,collection):
    b=MeshBuilder({'id':character.id+'-continuous-limbs','slot':'body','color':'tan','family':'body','design':'skin'})
    color=character.skin_light
    for side,sgn in (('L',-1),('R',1)):
        b.part='arm_'+side;b.bone='upper_arm.'+side
        a=Vector((sgn*.23,0,1.23));e=Vector((sgn*.38,0,.98));w=Vector((sgn*.41,-.02,.75))
        stations=[-.08,.08,.33,.60,.80,.92,1,1.08,1.20,1.40,1.64,1.87,2.04]
        centers=[];rotations=[];profiles=[];weights=[]
        for t in stations:
            center=a+(e-a)*t if t<=1 else e+(w-e)*(t-1)
            delta=(e-a).lerp(w-e,max(0,min(1,(t-.8)/.4)))
            blend=max(0,min(1,(t-.80)/.4));width=.115 if t<.85 else .11 if t<1.4 else .104-(t-1.4)*.015
            centers.append(center);rotations.append(delta.to_track_quat('Z','Y'));profiles.append((0,width,width*1.16,0,0))
            weights.append({k:v for k,v in {'upper_arm.'+side:1-blend,'forearm.'+side:blend}.items() if v>0})
        b.rings(profiles,color,lambda i,p:centers[i]+rotations[i]@p,lambda i:weights[i])
        b.part='leg_'+side;b.bone='thigh.'+side;x=sgn*.135
        profiles=[];weights=[]
        for z in (.117,.15,.23,.32,.38,.41,.43,.45,.48,.55,.65,.75,.816):
            width=.142 if z<.35 else .153 if z<.50 else .162
            profiles.append((z,width,width*1.14,x,0));blend=max(0,min(1,(.49-z)/.115));weights.append({k:v for k,v in {'thigh.'+side:1-blend,'shin.'+side:blend}.items() if v>0})
        b.rings(profiles,character.skin,weights=lambda i:weights[i])
    return b.finish(collection,rig)
