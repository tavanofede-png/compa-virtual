import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..'),rows=[];
for(const id of ['living','study','library','projects','patio','terrace']){
 const meta=JSON.parse(await readFile(resolve(root,'work/shared-spaces-v2',id+'.json'),'utf8'));
 for(const suffix of ['','-reduced']){
  const bytes=await readFile(resolve(root,'work/shared-spaces-v2',id+suffix+'.glb'));
  const doc=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)).trim());
  if(bytes.toString('ascii',0,4)!=='glTF'||bytes.length!==bytes.readUInt32LE(8))throw Error('Broken GLB '+id+suffix);
  const primitives=doc.meshes.flatMap(m=>m.primitives);
  if(!primitives.every(p=>p.attributes.NORMAL!==undefined&&p.attributes.COLOR_0!==undefined))throw Error('Missing normals/contact colours: '+id+suffix);
  const tris=primitives.reduce((n,p)=>n+doc.accessors[p.indices].count/3,0);
  if(!Number.isFinite(tris)||tris<10000)throw Error('Missing scene geometry: '+id+suffix);
  if((doc.images??[]).some(i=>i.uri)||doc.buffers.some(b=>b.uri))throw Error('External asset dependency: '+id+suffix);
  const scenery=doc.nodes.filter(n=>n.extras?.scenic_panel).length;
  if(['library','patio','terrace'].includes(id)&&!scenery)throw Error('Missing scenery: '+id);
  rows.push({id,variant:suffix?'reduced':'full',bytes:bytes.length,triangles:tris,primitives:primitives.length,scenery,capacity:meta.anchors.length});
 }
}
await writeFile(resolve(root,'renders/shared-spaces-v2/asset-validation.json'),JSON.stringify(rows,null,2));
console.log(JSON.stringify(rows));
