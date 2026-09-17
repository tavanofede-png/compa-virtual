import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve,extname,sep } from "node:path";
const root=resolve(import.meta.dirname,"../apps/web/out");
const mime={".html":"text/html; charset=utf-8",".css":"text/css",".js":"text/javascript",".json":"application/json",".webp":"image/webp",".png":"image/png",".svg":"image/svg+xml",".ttf":"font/ttf"};
createServer(async(req,res)=>{try{const path=decodeURIComponent(new URL(req.url,"http://localhost").pathname);const file=resolve(root,"."+(path==="/"?"/index.html":path));if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}const data=await readFile(file);res.writeHead(200,{"content-type":mime[extname(file)]??"application/octet-stream"});res.end(data);}catch{res.writeHead(404);res.end();}}).listen(4389,"127.0.0.1",()=>console.log("Compa export local: http://127.0.0.1:4389"));
