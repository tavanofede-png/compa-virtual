// Isolated QA fixture. No remote connection, secrets, real users or shipped route.
import { createServer } from "node:http";
import { readFile,writeFile,mkdir } from "node:fs/promises";
import { resolve,dirname,extname,isAbsolute } from "node:path";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
const root=resolve(import.meta.dirname,".."),out=resolve(root,"work/collaboration-review");
const requireWeb=createRequire(resolve(root,"apps/web/package.json"));
const {build}=createRequire(resolve(root,"packages/server/package.json"))("esbuild");
await mkdir(out,{recursive:true});
await build({entryPoints:[resolve(root,"work/collaboration-review.tsx")],bundle:true,outfile:resolve(out,"app.js"),format:"esm",platform:"browser",jsx:"automatic",define:{"process.env.NODE_ENV":'"development"'},tsconfigRaw:{compilerOptions:{jsx:"react-jsx",target:"es2022"}},plugins:[{name:"local-source",setup(ctx){
 ctx.onResolve({filter:/.*/},args=>{const base=args.importer||resolve(root,"apps/web/package.json");let path=args.path.startsWith(".")?resolve(dirname(base),args.path):args.path;
  if(isAbsolute(path)&&!extname(path)){if(existsSync(path+".ts"))path+=".ts";else if(existsSync(path+".tsx"))path+=".tsx";}
  try{path=createRequire(base).resolve(path);}catch{path=requireWeb.resolve(path);}return {path,namespace:"source"};});
 ctx.onLoad({filter:/.*/,namespace:"source"},async({path})=>({contents:await readFile(path,"utf8"),loader:extname(path).slice(1)==="tsx"?"tsx":extname(path).slice(1)==="ts"?"ts":extname(path).slice(1)==="css"?"css":extname(path).slice(1)==="json"?"json":"js"}));
}}]});
const db=new PGlite();await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);grant usage on schema public,auth to service_role;");
await db.exec(await readFile(resolve(root,"supabase/migrations/20260912203428_private_collaboration.sql"),"utf8"));
await db.exec(await readFile(resolve(root,"supabase/migrations/20260913015408_shared_room_runtime.sql"),"utf8"));
const users={a:"10000000-0000-4000-8000-000000000001",b:"10000000-0000-4000-8000-000000000002"};
for(const [key,id] of Object.entries(users)){await db.query("insert into auth.users values($1)",[id]);await db.query("select public.collaboration_identity($1,$2)",[id,key==="a"?"Ana (prueba)":"Bruno (prueba)"]);}
await db.exec("set role service_role");
const html='<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Compa Virtual · QA local de sesiones</title><link rel="stylesheet" href="/base.css"><link rel="stylesheet" href="/redesign.css"><link rel="stylesheet" href="/app.css"><div id="root"></div><script type="module" src="/app.js"></script></html>';
const staticFiles={"/app.js":[resolve(out,"app.js"),"text/javascript"],"/app.css":[resolve(out,"app.css"),"text/css"],"/base.css":[resolve(root,"apps/web/app/globals.css"),"text/css"],"/redesign.css":[resolve(root,"apps/web/app/redesign.css"),"text/css"],"/fonts/Outfit.ttf":[resolve(root,"apps/web/public/fonts/Outfit.ttf"),"font/ttf"]};
createServer(async(req,res)=>{try{
 const path=new URL(req.url,"http://localhost").pathname;
 if(path==="/qa-api"&&req.method==="POST"){
  if(req.headers.origin&&req.headers.origin!=="http://127.0.0.1:4388"){res.writeHead(403);res.end();return;}
  let raw="";for await(const part of req){raw+=part;if(raw.length>10000)throw Error("body too large");}const body=JSON.parse(raw),user=users[req.headers["x-fixture-user"]];
  if(!user)throw Error("fixture identity required");let result;
  if(body.type==="collaboration.command")result=body.payload.action.startsWith("room.")
    ? await db.query("select public.shared_room_command($1,$2,$3::jsonb,$4::jsonb) result",[user,body.operationId,JSON.stringify(body.payload),JSON.stringify({character_id:user===users.a?"milo":"harper"})])
    : await db.query("select public.collaboration_command($1,$2,$3::jsonb) result",[user,body.operationId,JSON.stringify(body.payload)]);
  else result=await db.query("select public.collaboration_read($1,$2) result",[user,body.payload?.session_id??null]);
  res.writeHead(200,{"content-type":"application/json","cache-control":"no-store"});res.end(JSON.stringify(result.rows[0].result));return;
 }
 if(path==="/"){res.writeHead(200,{"content-type":"text/html; charset=utf-8"});res.end(html);return;}
 if(/^\/selection\/(shared-spaces|characters|models)\/[a-z0-9_-]+\.(webp|glb|json)$/.test(path)){
  const asset=resolve(root,"apps/web/public",path.slice(1));
  res.writeHead(200,{"content-type":path.endsWith(".webp")?"image/webp":path.endsWith(".glb")?"model/gltf-binary":"application/json"});res.end(await readFile(asset));return;
 }
 const file=staticFiles[path];if(!file){res.writeHead(404);res.end();return;}
 res.writeHead(200,{"content-type":file[1]});res.end(await readFile(file[0]));
}catch(e){res.writeHead(400,{"content-type":"application/json"});res.end(JSON.stringify({error:e.message}));}}).listen(4388,"127.0.0.1",()=>console.log("QA local: http://127.0.0.1:4388"));
