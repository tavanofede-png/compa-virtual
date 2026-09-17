import {createRequire} from "node:module";
import {readFile} from "node:fs/promises";
import {existsSync} from "node:fs";
import {resolve,dirname,extname,isAbsolute} from "node:path";
const {build}=createRequire(new URL("../packages/server/package.json",import.meta.url))("esbuild");
const root=resolve(import.meta.dirname,"..");
await build({entryPoints:[resolve(root,"work/verify-shared-rooms-remote.ts")],bundle:true,platform:"node",format:"esm",target:"node24",tsconfigRaw:{compilerOptions:{target:"es2022"}},outfile:resolve(root,"work/verify-shared-rooms-remote.mjs"),plugins:[{name:"explicit-files",setup(ctx){
 ctx.onResolve({filter:/.*/},args=>{
  if(args.path.startsWith("node:"))return {path:args.path,external:true};
  const base=args.importer||resolve(root,"package.json");let path=args.path.startsWith(".")?resolve(dirname(base),args.path):args.path;
  if(isAbsolute(path)&&!extname(path)&&existsSync(path+".ts"))path+=".ts";
  return {path:createRequire(base).resolve(path),namespace:"source"};
 });
 ctx.onLoad({filter:/.*/,namespace:"source"},async({path})=>({contents:await readFile(path,"utf8"),loader:path.endsWith(".ts")?"ts":path.endsWith(".json")?"json":"js"}));
}}]});
