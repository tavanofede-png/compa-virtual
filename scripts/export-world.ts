import { mkdir, writeFile } from 'node:fs/promises';
import { GLTFExporter } from '../packages/world3d/src/exporter';
import { avatarModel, roomModel, equipmentModel, disposeModel } from '../packages/world3d/src/index';
import { avatarPresets, defaultCompanion, catalog } from '../packages/domain/src/index';
// GLTFExporter uses FileReader even when exporting untextured binary geometry.
class NodeFileReader {
  result: ArrayBuffer|string|null=null;
  onloadend:(()=>void)|null=null;
  onerror:((error:unknown)=>void)|null=null;
  readAsArrayBuffer(blob:Blob){void blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();}).catch(error=>this.onerror?.(error));}
  readAsDataURL(blob:Blob){void blob.arrayBuffer().then(result=>{this.result='data:'+blob.type+';base64,'+Buffer.from(result).toString('base64');this.onloadend?.();}).catch(error=>this.onerror?.(error));}
}
Object.assign(globalThis,{FileReader:NodeFileReader});
const destination=new URL('../packages/assets/3d/',import.meta.url);
await mkdir(destination,{recursive:true});
const exporter=new GLTFExporter();
const files:{file:string;bytes:number}[]=[];
async function save(name:string,model:ReturnType<typeof avatarModel>) {
  const result=await exporter.parseAsync(model,{binary:true,onlyVisible:true});
  if(!(result instanceof ArrayBuffer))throw Error('Se esperaba un GLB binario.');
  await writeFile(new URL(name,destination),Buffer.from(result));
  files.push({file:name,bytes:result.byteLength});disposeModel(model);
}
await save('habitacion-adolescente.glb',roomModel(defaultCompanion));
for(const preset of avatarPresets)await save('compa-'+preset.name.toLowerCase()+'.glb',avatarModel({...defaultCompanion,...preset}));
for(const item of catalog)await save('objeto-'+item.id+'.glb',equipmentModel(item.id));
await writeFile(new URL('catalog.json',destination),JSON.stringify({format:'glTF 2.0 / GLB',units:'meters',upAxis:'Y',generator:'Compa Virtual procedural models',files},null,2)+'\n');
console.info(JSON.stringify({models:files.length,totalBytes:files.reduce((n,f)=>n+f.bytes,0)}));
