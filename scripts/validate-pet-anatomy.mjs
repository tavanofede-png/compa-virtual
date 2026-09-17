import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const require3d = createRequire(resolve(root, 'packages/world3d/package.json'));
const T = await import(pathToFileURL(require3d.resolve('three')));
const { GLTFLoader } = await import(pathToFileURL(require3d.resolve('three/addons/loaders/GLTFLoader.js')));
globalThis.ProgressEvent ??= class ProgressEvent { constructor(type, details) { this.type=type; Object.assign(this,details); } };
const ids = process.argv.slice(2).length ? process.argv.slice(2) : ['hamster','orange-tabby','black-cat','siamese','ragdoll','british-shorthair','maine-coon','calico','sphynx'];
const required = ['pet_idle','pet_walk','pet_run','pet_lie_down','pet_rest','pet_get_up','pet_react','pet_celebrate'];
const results=[];
for (const id of ids) {
  const bytes=await readFile(resolve(root,`renders/pet-anatomy-v2/pet-${id}.glb`));
  const data=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
  const gltf=await new GLTFLoader().parseAsync(data,'');
  const scene=gltf.scene;
  const names=gltf.animations.map(c=>c.name);
  const missing=required.filter(name=>!names.includes(name));
  if(missing.length)throw Error(`${id}: missing ${missing.join(', ')}`);
  const meshes=[];let vertices=0,triangles=0,colored=0;
  scene.traverse(obj=>{
    if(!obj.isMesh)return;
    meshes.push(obj);
    vertices+=obj.geometry.attributes.position.count;
    triangles+=(obj.geometry.index?.count??obj.geometry.attributes.position.count)/3;
    if(obj.geometry.attributes.color)colored++;
    if(/brow|fur.?tuft|coat.?tuft/i.test(obj.name))throw Error(`${id}: obsolete decorative geometry ${obj.name}`);
  });
  const mixer=new T.AnimationMixer(scene);
  const bounds=[];
  for(const name of required) {
    const clip=gltf.animations.find(c=>c.name===name);
    const action=mixer.clipAction(clip).setLoop(T.LoopOnce,1);action.clampWhenFinished=true;
    let minY=Infinity,maxY=-Infinity,maxSpan=0;
    for(const t of [0,.25,.5,.75,.99]) {
      mixer.stopAllAction();action.reset().play();mixer.setTime(clip.duration*t);
      scene.updateMatrixWorld(true);
      const box=new T.Box3();
      for(const mesh of meshes) {
        if(mesh.isSkinnedMesh)mesh.skeleton.update();
        const attr=mesh.geometry.attributes.position;
        // Inspect the actual skinned vertices, not the static GLB bounds.
        for(let i=0;i<attr.count;i+=Math.max(1,Math.floor(attr.count/220))) {
          const v=new T.Vector3().fromBufferAttribute(attr,i);
          if(mesh.isSkinnedMesh)mesh.applyBoneTransform(i,v);
          v.applyMatrix4(mesh.matrixWorld);
          if(![v.x,v.y,v.z].every(Number.isFinite))throw Error(`${id}/${name}: non-finite pose`);
          box.expandByPoint(v);
        }
      }
      minY=Math.min(minY,box.min.y);maxY=Math.max(maxY,box.max.y);
      maxSpan=Math.max(maxSpan,box.getSize(new T.Vector3()).length());
    }
    bounds.push({clip:name,minY:+minY.toFixed(4),maxY:+maxY.toFixed(4),maxSpan:+maxSpan.toFixed(4)});
    if(maxSpan>2.4)throw Error(`${id}/${name}: exploding mesh bounds ${maxSpan}`);
  }
  mixer.stopAllAction();mixer.uncacheRoot(scene);
  results.push({id,bytes:bytes.length,meshes:meshes.length,vertices,triangles,vertexColorMeshes:colored,clips:names.length,bounds});
  console.log(`${id}: ${(bytes.length/1048576).toFixed(2)} MB · ${Math.round(triangles)} triangles · ${names.length} clips · ${colored} colored surfaces`);
}
await writeFile(resolve(root,'renders/pet-anatomy-v2/validation.json'),JSON.stringify(results,null,2));
console.log('GLB parsing, skinning, semantic clips and finite animation bounds verified.');
