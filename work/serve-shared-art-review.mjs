import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname,extname,isAbsolute} from 'node:path';
import {existsSync} from 'node:fs';
import {createRequire} from 'node:module';
const root=resolve(import.meta.dirname,'..'),webRequire=createRequire(resolve(root,'apps/web/package.json'));
const {build}=createRequire(resolve(root,'packages/server/package.json'))('esbuild');
await build({entryPoints:[resolve(root,'work/shared-art-viewer.ts')],bundle:true,outfile:resolve(root,'work/shared-art-viewer.js'),format:'esm',platform:'browser',target:'es2022',plugins:[{name:'explicit-local-files',setup(ctx){
ctx.onResolve({filter:/.*/},a=>{const base=a.importer||resolve(root,'apps/web/package.json');let path=a.path.startsWith('.')?resolve(dirname(base),a.path):a.path;if(isAbsolute(path)&&!extname(path)&&existsSync(path+'.ts'))path+='.ts';try{path=createRequire(base).resolve(path)}catch{path=webRequire.resolve(path)}return {path,namespace:'source'}});
ctx.onLoad({filter:/.*/,namespace:'source'},async({path})=>({contents:await readFile(path,'utf8'),loader:path.endsWith('.ts')?'ts':path.endsWith('.json')?'json':'js'}));}}]});
const viewer='<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Compa Virtual · Sala 3D</title><style>body{margin:0;font:16px system-ui;background:#e9e3d9;color:#213440}header{padding:20px;display:flex;gap:20px;align-items:center;flex-wrap:wrap}h1{font-size:22px;margin:0}a{color:inherit}#scene{height:75dvh;min-height:360px;touch-action:none}footer{padding:16px 20px}button{min-height:48px;min-width:48px;border:1px solid #bbb2a3;border-radius:10px;background:#f6f1e7;color:#213440;padding:0 18px;font-size:16px;cursor:pointer}button:focus-visible{outline:3px solid #cb9028}#status{font-size:14px}</style><header><a href="/">← Las seis salas</a><h1>Sala 3D</h1></header><div id="scene" role="img" aria-label="Vista del modelo 3D de la sala"></div><footer><button id="closer" aria-label="Acercar">+</button> <button id="further" aria-label="Alejar">−</button> <button id="reset">Vista inicial</button><p id="status">Cargando el modelo…</p></footer><script type="module" src="/viewer.js"></script></html>';
createServer(async(req,res)=>{try{const path=new URL(req.url,'http://localhost').pathname;let file,type;
if(path==='/viewer'){res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(viewer);return;}
if(path==='/viewer.js'){file=resolve(root,'work/shared-art-viewer.js');type='text/javascript';}
else if(path==='/'){file=resolve(root,'renders/shared-spaces-v2/revision-salas.html');type='text/html; charset=utf-8';}
else if(/^\/(living|study|library|projects|patio|terrace|referencia)\.png$/.test(path)){file=resolve(root,'renders/shared-spaces-v2',path.slice(1));type='image/png';}
else if(/^\/models\/(living|study|library|projects|patio|terrace)(-reduced)?\.glb$/.test(path)){file=resolve(root,'work/shared-spaces-v2',path.split('/').pop());type='model/gltf-binary';}
else if(/^\/packages\/assets\/3d\/source\/shared-spaces\/v2\/(living|study|library|projects|patio|terrace)-master\.blend$/.test(path)){file=resolve(root,path.slice(1));type='application/octet-stream';}
else if(/^\/renders\/shared-spaces\/(living|study|library|projects|patio|terrace)\.png$/.test(path)){file=resolve(root,path.slice(1));type='image/png';}
else if(path==='/fonts/Outfit.ttf'){file=resolve(root,'apps/web/public/fonts/Outfit.ttf');type='font/ttf';}
else{res.writeHead(404);res.end();return;}
let content=await readFile(file);if(path==='/'){let html=content.toString().replaceAll("../../apps/web/public/fonts/Outfit.ttf","/fonts/Outfit.ttf").replaceAll('../shared-spaces/','/renders/shared-spaces/');html=html.replace(/<a href="\.\.\/\.\.\/work\/shared-spaces-v2\/(\w+)\.glb">Modelo GLB ↗<\/a>/g,'<a href="/viewer?room=$1">Explorar el modelo 3D ↗</a>');content=Buffer.from(html);}
res.writeHead(200,{'content-type':type,'cache-control':'no-store'});res.end(content);
}catch{res.writeHead(404);res.end('Recurso de revisión todavía no disponible.');}}).listen(4389,'127.0.0.1',()=>console.log('Art review: http://127.0.0.1:4389'));
