// Functional design prototype. Dimensions are authoring targets, not measurements of raster concepts.
export const clone = value => structuredClone(value);
export const GRID = 0.05;
export const BODY_RADIUS = 0.26;
export const snap = (n, step = GRID) => Math.round(n / step) * step;
const finite = n => typeof n === 'number' && Number.isFinite(n);
const rad = deg => deg * Math.PI / 180;
export function corners(item) {
  const a=rad(item.yaw||0),c=Math.cos(a),s=Math.sin(a);
  return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>[item.x+u*item.w/2*c-v*item.d/2*s,item.z+u*item.w/2*s+v*item.d/2*c]);
}
export function overlap(a,b,margin=0) {
  const aa=corners({...a,w:a.w+margin*2,d:a.d+margin*2}),bb=corners(b);
  for(const poly of [aa,bb]) for(let i=0;i<4;i++) {
    const next=poly[(i+1)%4],axis=[-(next[1]-poly[i][1]),next[0]-poly[i][0]];
    const ap=aa.map(p=>p[0]*axis[0]+p[1]*axis[1]),bp=bb.map(p=>p[0]*axis[0]+p[1]*axis[1]);
    if(Math.max(...ap)<=Math.min(...bp)+1e-8||Math.max(...bp)<=Math.min(...ap)+1e-8)return false;
  }
  return true;
}
export function worldItem(layout,item) {
  if(!item.parentId)return {...item};
  const parent=layout.items.find(i=>i.id===item.parentId);if(!parent)return null;
  const a=rad(parent.yaw||0),c=Math.cos(a),s=Math.sin(a);
  return {...item,x:parent.x+item.x*c-item.z*s,z:parent.z+item.x*s+item.z*c,yaw:(parent.yaw||0)+(item.yaw||0)};
}
export function inside(item,width,depth) {
  return corners(item).every(([x,z])=>x>=-1e-6&&z>=-1e-6&&x<=width+1e-6&&z<=depth+1e-6);
}
export function canStand(layout,p,radius=BODY_RADIUS,ignore=[]) {
  if(!p.every(finite)||p[0]<radius||p[1]<radius||p[0]>layout.width-radius||p[1]>layout.depth-radius)return false;
  return !layout.items.filter(i=>!i.parentId&&!ignore.includes(i.id)&&i.role!=='rug').some(i=>{
    const a=rad(-(i.yaw||0)),dx=p[0]-i.x,dz=p[1]-i.z,x=dx*Math.cos(a)-dz*Math.sin(a),z=dx*Math.sin(a)+dz*Math.cos(a);
    const qx=Math.max(Math.abs(x)-i.w/2,0),qz=Math.max(Math.abs(z)-i.d/2,0);
    return qx*qx+qz*qz<radius*radius-1e-8;
  });
}
export function clearSegment(layout,a,b,radius=BODY_RADIUS) {
  const distance=Math.hypot(a[0]-b[0],a[1]-b[1]),count=Math.max(1,Math.ceil(distance/.04));
  for(let n=0;n<=count;n++)if(!canStand(layout,[a[0]+(b[0]-a[0])*n/count,a[1]+(b[1]-a[1])*n/count],radius))return false;
  return true;
}
export function route(layout,to) {
  const start=layout.spawn;if(!canStand(layout,start)||!canStand(layout,to))return null;
  if(clearSegment(layout,start,to))return [start,to];
  const step=.1,points=[],indices=new Map();
  for(let x=.3,ix=0;x<layout.width-.25;x+=step,ix++)for(let z=.3,iz=0;z<layout.depth-.25;z+=step,iz++)if(canStand(layout,[x,z])){indices.set(ix+','+iz,points.length);points.push({p:[x,z],ix,iz});}
  const previous=new Map(),queue=[];
  points.forEach((p,i)=>{if(Math.hypot(p.p[0]-start[0],p.p[1]-start[1])<.3&&clearSegment(layout,start,p.p)){previous.set(i,-1);queue.push(i);}});
  for(let q=0;q<queue.length;q++){
    const u=queue[q],node=points[u];
    if(Math.hypot(node.p[0]-to[0],node.p[1]-to[1])<.3&&clearSegment(layout,node.p,to)){
      const path=[to];let at=u;while(at!==-1){path.unshift(points[at].p);at=previous.get(at);}path.unshift(start);
      const simplified=[start];let index=0;
      while(index<path.length-1){let far=index+1;while(far+1<path.length&&clearSegment(layout,path[index],path[far+1]))far++;simplified.push(path[far]);index=far;}
      return simplified;
    }
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){
      const v=indices.get((node.ix+dx)+','+(node.iz+dz));
      if(v!==undefined&&!previous.has(v)&&clearSegment(layout,node.p,points[v].p)){previous.set(v,u);queue.push(v);}
    }
  }
  return null;
}
export function studyZoneResult(layout,zone) {
  const surface=layout.items.find(i=>i.id===zone.surfaceId),seat=layout.items.find(i=>i.id===zone.seatId);
  const errors=[];
  if(!surface||surface.role!=='work-surface')errors.push('Falta una superficie de estudio.');
  if(!seat||seat.role!=='study-seat')errors.push('Falta un asiento compatible.');
  if(errors.length)return {id:zone.id,valid:false,errors,route:null};
  if(surface.parentId||seat.parentId)errors.push('La mesa y el asiento necesitan apoyo en el piso.');
  const a=rad(surface.yaw||0),dx=seat.x-surface.x,dz=seat.z-surface.z;
  const localX=dx*Math.cos(a)+dz*Math.sin(a),localZ=-dx*Math.sin(a)+dz*Math.cos(a);
  if(Math.abs(localX)>.22||localZ<surface.d/2+seat.d/2+.02||localZ>surface.d/2+seat.d/2+.38)errors.push('Alineá el asiento con la superficie de estudio.');
  const diff=((seat.yaw-surface.yaw)%360+540)%360-180;if(Math.abs(diff)>15)errors.push('El asiento debe mirar hacia la mesa.');
  if(surface.h-seat.h<.2||surface.h-seat.h>.38)errors.push('La altura del asiento no es compatible con esta mesa.');
  if(zone.workArea.w<.6||zone.workArea.d<.35||zone.workArea.w>surface.w||zone.workArea.d>surface.d)errors.push('No queda suficiente superficie útil para estudiar.');
  const zoneRect={...zone.workArea,x:zone.workArea.x||0,z:zone.workArea.z||0,yaw:0};
  if(layout.items.some(i=>i.parentId===surface.id&&i.role==='surface-prop'&&i.definitionId!=='notebooks'&&i.definitionId!=='laptop'&&overlap(i,zoneRect)))errors.push('Un objeto tapa el área útil de estudio.');
  const approach=zone.approach,expected=[seat.x-Math.sin(a)*.575,seat.z+Math.cos(a)*.575];
  if(!approach||Math.hypot(expected[0]-approach[0],expected[1]-approach[1])>.25)errors.push('El acceso al asiento quedó desalineado.');
  const path=approach?route(layout,approach):null;
  if(!path)errors.push('Bloquea el acceso al escritorio.');
  return {id:zone.id,valid:errors.length===0,errors,route:path};
}
export function validateLayout(layout) {
  const errors=[],ids=new Set();
  if(!finite(layout.width)||!finite(layout.depth)||layout.width<=0||layout.depth<=0||!Array.isArray(layout.spawn)||!layout.spawn.every(finite))return {valid:false,errors:['Las dimensiones del espacio no son válidas.'],studyZones:[],validStudyZones:0};
  for(const item of layout.items){
    if(ids.has(item.id))errors.push('Hay identificadores de objetos repetidos.');ids.add(item.id);
    if(![item.x,item.z,item.w,item.d,item.h,item.yaw].every(finite)||item.w<=0||item.d<=0||item.h<0){errors.push('Las medidas de '+item.name+' no son válidas.');continue;}
    if(item.parentId){
      const parent=layout.items.find(i=>i.id===item.parentId);
      if(!parent||parent.parentId||!['work-surface','furniture'].includes(parent.role)){errors.push(item.name+': necesita una superficie de apoyo.');continue;}
      const local={...item,x:item.x+parent.w/2,z:item.z+parent.d/2};
      if(!inside(local,parent.w,parent.d))errors.push(item.name+': no entra en esta superficie.');
    } else if(!inside(item,layout.width,layout.depth))errors.push(item.name+': queda fuera del espacio.');
  }
  const floor=layout.items.filter(i=>!i.parentId&&i.role!=='rug');
  for(let i=0;i<floor.length;i++)for(let j=i+1;j<floor.length;j++)if(overlap(floor[i],floor[j]))errors.push(floor[i].name+' se superpone con '+floor[j].name+'.');
  const props=layout.items.filter(i=>i.parentId);
  for(let i=0;i<props.length;i++)for(let j=i+1;j<props.length;j++)if(props[i].parentId===props[j].parentId&&overlap(props[i],props[j]))errors.push('Dos objetos ocupan el mismo apoyo.');
  const studyZones=(layout.studyZones||[]).map(z=>studyZoneResult(layout,z));
  const validStudyZones=studyZones.filter(z=>z.valid).length;
  if(!validStudyZones)errors.push('Esta distribución necesita una zona de estudio funcional.');
  if(!canStand(layout,layout.spawn))errors.push('La entrada debe quedar libre.');
  return {valid:errors.length===0,errors:[...new Set(errors)],studyZones,validStudyZones};
}
export function placementPreview(layout,ids,dx,dz,rotation=0) {
  const next=clone(layout),selected=new Set(ids),items=next.items.filter(i=>selected.has(i.id));
  if(!items.length)return {candidate:next,valid:false,errors:['Elegí un objeto.'],snapped:[0,0]};
  const pivot=items.find(i=>i.role==='work-surface')||items[0],px=pivot.x,pz=pivot.z;
  const a=rad(rotation),c=Math.cos(a),s=Math.sin(a),sx=snap(dx),sz=snap(dz);
  for(const i of items){const x=i.x-px,z=i.z-pz;i.x=px+x*c-z*s+sx;i.z=pz+x*s+z*c+sz;i.yaw=(i.yaw+rotation+360)%360;}
  for(const zone of next.studyZones||[])if(selected.has(zone.surfaceId)&&selected.has(zone.seatId)){
    const x=zone.approach[0]-px,z=zone.approach[1]-pz;zone.approach=[px+x*c-z*s+sx,pz+x*s+z*c+sz];
  }
  const result=validateLayout(next);return {...result,candidate:next,snapped:[sx,sz],ghost:{opacity:.45,tone:result.valid?'green':'red',icon:result.valid?'check':'alert',message:result.valid?'Podés colocarlo acá.':result.errors[0]}};
}
export function applyPreview(current,preview) {return preview.valid?clone(preview.candidate):clone(current);}
export function removePreview(layout,id){const next=clone(layout);next.items=next.items.filter(i=>i.id!==id&&i.parentId!==id);return {...validateLayout(next),candidate:next};}
export function replaceSurface(layout,replacement){
  const next=clone(layout),surface=next.items.find(i=>i.id==='desk');Object.assign(surface,replacement);
  const returned=[];next.items=next.items.filter(i=>{if(i.parentId!==surface.id)return true;const fits=inside({...i,x:i.x+surface.w/2,z:i.z+surface.d/2},surface.w,surface.d);if(!fits)returned.push(i);return fits;});
  return {...validateLayout(next),candidate:next,returned};
}
