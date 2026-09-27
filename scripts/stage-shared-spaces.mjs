import { createRequire } from "node:module";
import { writeFile, readFile, copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { compactStudyGlb } from "./compact-study-glb.mjs";
const root=resolve(import.meta.dirname,"..");
const sharp=createRequire(resolve(root,"apps/web/package.json"))("sharp");
const ids=["living","study","library","projects","patio","terrace"];
const layouts={};
const sourceV2=process.argv.includes('--v2');
const digest=createHash('sha256');
const compacted=new Map();
// Preflight every room before replacing any of the app's assets.
for(const id of ids){
 const folder=sourceV2?'work/shared-spaces-v2':'apps/web/public/selection/shared-spaces';
 const metadata=JSON.parse(await readFile(resolve(root,folder,id+'.json'),'utf8'));
 if(sourceV2&&metadata.version!==2)throw Error('Wrong art version: '+id);
 if(metadata.anchors.length!==6||new Set(metadata.anchors.map(x=>x.id)).size!==6)throw Error('Six distinct seats required: '+id);
 for(const seat of metadata.anchors){
  if(seat.position.length!==3||![...seat.position,seat.yaw,seat.height].every(Number.isFinite))throw Error('Invalid anchor: '+id+'/'+seat.id);
  if(Math.abs(seat.position[0])>3.9||Math.abs(seat.position[2])>2.9)throw Error('Seat outside the floor: '+id+'/'+seat.id);
 }
 layouts[id]=metadata.anchors.map(({id,position,yaw,height})=>({id,position,yaw,height}));
 digest.update(JSON.stringify(layouts[id]));
 for(const suffix of ['.glb','-reduced.glb']){
  const bytes=await readFile(resolve(root,folder,id+suffix));
  if(bytes.toString('ascii',0,4)!=='glTF'||bytes.readUInt32LE(8)!==bytes.length)throw Error('Invalid GLB: '+id+suffix);
  const staged=sourceV2&&suffix==='-reduced.glb'?compactStudyGlb(bytes).buffer:bytes;
  if(sourceV2&&suffix==='-reduced.glb')compacted.set(id,staged);
  digest.update(staged);
 }
}
for(const id of ids){
 const base=resolve(root,"apps/web/public/selection/shared-spaces",id);
 if(sourceV2){
  for(const ext of ['.glb','.json'])await copyFile(resolve(root,'work/shared-spaces-v2',id+ext),base+ext);
  await writeFile(base+'-reduced.glb',compacted.get(id));
 }
 await sharp(resolve(root,sourceV2?"renders/shared-spaces-v2":"renders/shared-spaces",id+".png")).resize(1100).webp({quality:90}).toFile(base+".webp");
 const metadata=JSON.parse(await readFile(base+".json","utf8"));
 if(metadata.anchors.length!==6||new Set(metadata.anchors.map(x=>x.id)).size!==6)throw Error("Six seats required: "+id);
}
await writeFile(resolve(root,'packages/domain/src/shared-room-layouts.ts'),'// Generated from Blender anchors by scripts/stage-shared-spaces.mjs.\nimport type { SharedSpaceId } from "./collaboration";\nimport type { SharedSeat } from "./shared-rooms";\nexport const sharedRoomAssetRevision='+JSON.stringify('rooms-'+digest.digest('hex').slice(0,12))+';\nexport const sharedRoomLayouts: Record<SharedSpaceId, SharedSeat[]> = '+JSON.stringify(layouts,null,2)+';\n');
await promisify(execFile)(process.execPath,[resolve(root,"scripts/verify-shared-runtime.mjs"),"--write"],{cwd:root});
console.log("Six shared environments and their runtime manifest staged.");
