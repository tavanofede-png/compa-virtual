import React from "react";
import { createRoot } from "react-dom/client";
import { Together } from "../apps/web/src/Together";
import { createCollaborationRepository } from "../packages/client/src/collaboration";
const user=new URLSearchParams(location.search).get("user")==="b"?"b":"a";
const cache={getItem:async(k:string)=>localStorage.getItem(k),setItem:async(k:string,v:string)=>localStorage.setItem(k,v),removeItem:async(k:string)=>localStorage.removeItem(k)};
const repo=createCollaborationRepository(async body=>{const r=await fetch("/qa-api",{method:"POST",headers:{"content-type":"application/json","x-fixture-user":user},body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw Object.assign(Error(data.error),{status:r.status});return data;},cache,user);
createRoot(document.getElementById("root")!).render(<><aside style={{background:"#101e32",color:"white",padding:12,marginBottom:24}}>PRUEBA LOCAL · Personas ficticias · PostgreSQL en memoria · <a href="/?user=a" style={{color:"white"}}>Ana</a> / <a href="/?user=b" style={{color:"white"}}>Bruno</a> · Viendo {user==="a"?"Ana":"Bruno"}</aside><main style={{padding:"0 20px 60px"}}><Together repo={repo} back={()=>location.assign("/?user="+user)}/></main></>);
