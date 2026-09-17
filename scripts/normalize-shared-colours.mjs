// Upgrade exports produced before the explicit COLOR_0 exporter setting.
// Blender's material-only mode emitted an unused white layer before contact AO.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
for(const id of ['living','study','library','projects','patio','terrace'])for(const suffix of ['','-reduced']){
 const path=resolve(root,'work/shared-spaces-v2',id+suffix+'.glb'),b=await readFile(path),n=b.readUInt32LE(12);
 const doc=JSON.parse(b.toString('utf8',20,20+n));let changed=false;
 const isWhite=index=>{
  const a=doc.accessors[index],v=doc.bufferViews[a.bufferView],o=28+n+(v.byteOffset??0)+(a.byteOffset??0);
  const size=a.componentType===5121?1:a.componentType===5123?2:4;
  const stride=v.byteStride??size*4;
  for(let i=0;i<a.count;i++)for(let c=0;c<3;c++){
   const at=o+i*stride+c*size,value=size===1?b[at]/255:size===2?b.readUInt16LE(at)/65535:b.readFloatLE(at);
   if(value<.999)return false;
  }return true;
 };
 for(const mesh of doc.meshes)for(const p of mesh.primitives){
  if(p.attributes.COLOR_1!==undefined&&isWhite(p.attributes.COLOR_0)){
   p.attributes.COLOR_0=p.attributes.COLOR_1;delete p.attributes.COLOR_1;changed=true;
  }
 }
 if(changed){
  let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
  const bin=b.subarray(20+n),head=Buffer.alloc(20);head.write('glTF');head.writeUInt32LE(2,4);head.writeUInt32LE(20+json.length+bin.length,8);head.writeUInt32LE(json.length,12);head.write('JSON',16);
  await writeFile(path,Buffer.concat([head,json,bin]));
 }
 console.log(id+suffix,changed?'contact layer restored':'already correct');
}
