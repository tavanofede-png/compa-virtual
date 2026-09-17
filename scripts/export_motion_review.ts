import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import * as T from '../packages/world3d/node_modules/three/build/three.module.js';
import {GLTFExporter} from '../packages/world3d/node_modules/three/examples/jsm/exporters/GLTFExporter.js';
import {createPremiumWorld,disposeModel} from '../packages/world3d/src/index';
import {selectCharacter} from '../packages/domain/src/index';
class Reader{
  result:unknown=null;onloadend?:()=>void;
  readAsArrayBuffer(blob:Blob){void blob.arrayBuffer().then(b=>{this.result=b;this.onloadend?.()})}
  readAsDataURL(blob:Blob){void blob.arrayBuffer().then(b=>{this.result='data:'+blob.type+';base64,'+Buffer.from(b).toString('base64');this.onloadend?.()})}
}
Object.assign(globalThis,{FileReader:Reader});
const root=resolve('apps/web/public/selection/models'),out=resolve('renders/app-redesign');await mkdir(out,{recursive:true});
const read=async(url:string)=>{const bytes=await readFile(url);return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer};
const world=await createPremiumWorld(selectCharacter('milo'),'room',root,read);const c=world.controller!;
c.context({enabled:false});world.scene.traverse(o=>{if(o.userData.roomAction)o.visible=false});
for(const action of ['stand','sit','rest'] as const){
  c.request(action);for(let i=0;i<30*30;i++)c.update(1/30);
  world.scene.updateMatrixWorld(true);world.avatar.traverse(o=>{if(o instanceof T.SkinnedMesh)o.skeleton.update()});
  // Bake evaluated posed meshes only for visual review. Editable originals stay rigged.
  const scene=new T.Scene();
  world.scene.traverseVisible(o=>{
    if(!(o instanceof T.Mesh))return;
    const geometry=o.geometry.clone(),position=geometry.getAttribute('position'),v=new T.Vector3();
    for(let i=0;i<position.count;i++){o.getVertexPosition(i,v);v.applyMatrix4(o.matrixWorld);position.setXYZ(i,v.x,v.y,v.z)}
    geometry.deleteAttribute('skinIndex');geometry.deleteAttribute('skinWeight');geometry.computeVertexNormals();
    const mesh=new T.Mesh(geometry,o.material);scene.add(mesh);
  });
  const glb=await new GLTFExporter().parseAsync(scene,{binary:true});
  await writeFile(resolve(out,'motion-'+action+'.glb'),Buffer.from(glb as ArrayBuffer));
  scene.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose()});console.log('REVIEW',action,c.state);
}
c.dispose();disposeModel(world.scene);
