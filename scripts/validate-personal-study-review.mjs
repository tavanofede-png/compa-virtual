import {readFile,writeFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {validateLayout,removePreview,applyPreview} from '../design/personal-spaces-v1/spatial.mjs';
const root=resolve(import.meta.dirname,'..'),base=resolve(root,'design/personal-spaces-v1');
const ids=['library','terrace','pergola','cafe','minimal','tech','pavilion','loft'];
const report={date:new Date().toISOString(),scope:'Static source, render, glTF and authored furniture-map checks. Not a native or full geometry collision certification.',rooms:[]};
for(const id of ids){
 const layout=JSON.parse(await readFile(resolve(base,'data',id+'-model-layout.json'),'utf8'));
 const result=validateLayout(layout);
 const invalid=removePreview(layout,'desk');
 const unchanged=JSON.stringify(applyPreview(layout,invalid))===JSON.stringify(layout);
 const images={};
 for(const suffix of ['hero','model-hero','detail']){
  try{const p=resolve(base,'images',`${id}-${suffix}.png`),buf=await readFile(p);images[suffix]={bytes:buf.length,width:buf.readUInt32BE(16),height:buf.readUInt32BE(20),validSignature:buf.subarray(1,4).toString()==='PNG'};}
  catch{images[suffix]={missing:true};}
 }
 let model;
 try{
  const buf=await readFile(resolve(base,'models',id+'.glb'));if(buf.readUInt32LE(0)!==0x46546c67)throw Error('Invalid GLB header');
  const gltf=JSON.parse(buf.subarray(20,20+buf.readUInt32LE(12)).toString('utf8').trim());
  const positions=(gltf.meshes||[]).flatMap(m=>m.primitives.map(p=>gltf.accessors[p.attributes.POSITION]));
  model={bytes:buf.length,version:gltf.asset.version,meshes:gltf.meshes.length,materials:gltf.materials.length,images:gltf.images?.length||0,editableNodes:gltf.nodes.filter(n=>n.extras?.placeable_id).length,finiteBounds:positions.every(p=>[...(p.min||[]),...(p.max||[])].every(Number.isFinite)),validDeclaredLength:buf.readUInt32LE(8)===buf.length};
 }catch(e){model={missingOrInvalid:String(e)};}
 const source=await stat(resolve(root,'packages/assets/3d/source/personal-spaces/v1',id+'-master.blend'));
 report.rooms.push({id,sourceBytes:source.size,layout:{...result,obstacleCoverage:'Registered major furniture only; exhaustive mesh intersections and runtime pathfinding remain to validate.'},lastStudyZoneProtected:!invalid.valid&&unchanged,images,model});
}
report.passed=report.rooms.every(r=>r.layout.valid&&r.lastStudyZoneProtected&&r.images['model-hero'].width===1800&&r.images.detail.width===1500&&r.model.finiteBounds&&r.model.validDeclaredLength);
await writeFile(resolve(base,'data','review-validation.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({passed:report.passed,rooms:report.rooms.map(r=>({id:r.id,zone:r.layout.validStudyZones,layout:r.layout.valid,errors:r.layout.errors,protected:r.lastStudyZoneProtected,hero:r.images['model-hero'].width,detail:r.images.detail.width,modelMB:r.model.bytes?+(r.model.bytes/1e6).toFixed(1):null}))},null,2));
if(!report.passed)process.exitCode=1;
