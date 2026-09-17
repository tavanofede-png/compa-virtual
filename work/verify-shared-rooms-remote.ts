// Disposable synthetic accounts in the explicitly selected Compa Virtual project.
// Credentials exist only in process memory and are never printed or written.
import {execFileSync} from "node:child_process";
import {createRequire} from "node:module";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {emptySnapshot,selectCharacter} from "../packages/domain/src/index";
const cli="C:/Users/tavan/AppData/Local/npm-cache/_npx/b96a6bd565c470ce/node_modules/@supabase/cli-windows-x64/bin/supabase.exe";
const ref="oaravhmdvcwcvjnyweig",url="https://"+ref+".supabase.co";
const keyResponse=JSON.parse(execFileSync(cli,["projects","api-keys","--project-ref",ref,"--reveal","--output","json"],{encoding:"utf8",stdio:["ignore","pipe","pipe"]}));
const keys=Array.isArray(keyResponse)?keyResponse:keyResponse.api_keys??keyResponse.keys;
if(!Array.isArray(keys))throw Error("Key response format not recognized.");
const service=keys.find(k=>k.name==="service_role")?.api_key,anon=keys.find(k=>k.name==="anon")?.api_key;
if(!service||!anon)throw Error("Required project keys unavailable.");
const {createClient}=createRequire(new URL("../packages/client/package.json",import.meta.url))("@supabase/supabase-js");
const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
const accounts:{id:string;client:ReturnType<typeof createClient>;token:string}[]=[];
const sessions:string[]=[];let passed=0;
const check=(name:string)=>{passed++;console.log("PASS "+name);};
async function rpc(user:string,command:Record<string,unknown>,operation=randomUUID()){
 const action=String(command.action);const {data,error}=await admin.rpc(action.startsWith("room.")?"shared_room_command":"collaboration_command",{p_user:user,p_operation:operation,p_command:command,...(action.startsWith("room.")?{p_appearance:{character_id:user===accounts[0].id?"milo":"harper"}}:{})});if(error)throw Error(error.message);return data;
}
async function read(user:string,sid?:string){const {data,error}=await admin.rpc("collaboration_read",{p_user:user,...(sid?{p_session:sid}:{})});if(error)throw Error(error.message);return data;}
async function api(index:number,type:string,payload:Record<string,unknown>={},operationId?:string){
 const response=await fetch(url+"/functions/v1/api",{method:"POST",headers:{authorization:"Bearer "+accounts[index].token,apikey:anon,"content-type":"application/json"},body:JSON.stringify({type,payload,...(operationId?{operationId}:{})})});return {status:response.status,data:await response.json()};
}
try{
 for(let i=0;i<3;i++){
  const email="compa-room-qa-"+randomUUID()+"@example.invalid",password=randomUUID()+randomUUID();
  const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true});if(error)throw Error("Cannot create isolated QA account: "+error.code);
  const client=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});const signed=await client.auth.signInWithPassword({email,password});
  accounts.push({id:data.user.id,client,token:signed.data.session?.access_token??""});assert.ok(signed.data.session);
  const state=emptySnapshot();state.profile={id:data.user.id,nickname:"QA sintética "+(i+1),birth_date:"1990-01-01",school_year:3,timezone:"America/Argentina/Buenos_Aires",country:"AR",sleep_start:1380,sleep_end:420,autonomy_level:2,onboarding_complete:true};state.companion=selectCharacter(i===0?"milo":"harper");
  const seeded=await admin.from("student_states").insert({user_id:data.user.id,version:0,state});if(seeded.error)throw Error(seeded.error.message);
  const identity=await admin.rpc("collaboration_identity",{p_user:data.user.id,p_nickname:state.profile.nickname});if(identity.error)throw Error(identity.error.message);
 }
 const [a,b,c]=accounts,ca=randomUUID(),cb=randomUUID();
 const created=await rpc(a.id,{action:"session.create",group_id:null,title:"QA sintética de salas",objective:"Verificar aislamiento; datos desechables",session_type:"review",space_template_id:"study",scheduled_start_at:new Date(Date.now()+60000).toISOString(),timezone:"UTC",planned_duration:25});
 const sid=created.session_id;sessions.push(sid);
 const invited=await rpc(a.id,{action:"invite.create",scope:"session",target_id:sid,contact_code:(await read(b.id)).contact_code});
 await rpc(b.id,{action:"invite.respond",invite_id:invited.invite_id,accept:true});
 check("Private invitation accepted through real PostgreSQL");
 await rpc(a.id,{action:"room.enter",session_id:sid,connection_id:ca});await rpc(b.id,{action:"room.enter",session_id:sid,connection_id:cb});
 const race=await Promise.allSettled([rpc(a.id,{action:"room.seat",session_id:sid,connection_id:ca,seat_id:"SEAT_06"}),rpc(b.id,{action:"room.seat",session_id:sid,connection_id:cb,seat_id:"SEAT_06"})]);assert.equal(race.filter(r=>r.status==="fulfilled").length,1);
 check("Concurrent requests cannot reserve the same seat");
 await assert.rejects(read(c.id,sid),/COLLAB_NOT_FOUND/);
 for(const client of [b.client,c.client]){const direct=await client.from("group_study_sessions").select("*");assert.ok(direct.error||direct.data.length===0);}
 check("Nonmember reads and direct RLS access denied");
 let invalidations=0,payloadSafe=true;
 // This project's realtime.send adds a random delivery UUID to an empty payload.
 // Verified against its SQL definition, not a room/user identifier.
 await new Promise<void>((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error("Private realtime subscription timed out")),20000);b.client.channel("compa-social:"+b.id,{config:{private:true}}).on("broadcast",{event:"changed"},(message: any)=>{invalidations++;const payload=message.payload??{};payloadSafe&&=Object.keys(payload).every(k=>k==="id")&&typeof payload.id==="string"&&/^[0-9a-f-]{36}$/.test(payload.id)&&![sid,a.id,b.id,c.id].includes(payload.id);}).subscribe((status:string)=>{if(status==="SUBSCRIBED"){clearTimeout(timeout);resolve();}else if(status==="CHANNEL_ERROR"){clearTimeout(timeout);reject(Error("Private realtime channel denied"));}});});
 await rpc(a.id,{action:"room.hand",session_id:sid,connection_id:ca,raised:true});
 for(let i=0;i<20&&invalidations===0;i++)await new Promise(r=>setTimeout(r,250));assert.ok(invalidations>0);assert.ok(payloadSafe);check("Authorized private broadcast carries no room content");
 let d=await read(a.id,sid);await rpc(a.id,{action:"session.start",session_id:sid,revision:d.session.revision});
 await rpc(a.id,{action:"room.timer",session_id:sid,revision:0,operation:"focus"});
 d=await read(b.id,sid);assert.equal(d.room.timer.running,true);assert.ok(Date.parse(d.room.timer.deadline)>Date.parse(d.server_time));
 await assert.rejects(rpc(b.id,{action:"room.timer",session_id:sid,revision:1,operation:"pause"}),/COLLAB_FORBIDDEN/);check("Shared timer uses server deadline and host permissions");
 const op=randomUUID(),goal={action:"room.goal.add",session_id:sid,title:"Objetivo de QA"};
 await Promise.all([rpc(a.id,goal,op),rpc(a.id,goal,op)]);assert.equal((await read(b.id,sid)).room.goals.length,1);check("Concurrent goal retries are idempotent");
 const signedApi=await api(0,"collaboration.overview");if(signedApi.data.enabled===false){console.log("INFO API rollout remains disabled; RPC and Realtime verified.");}else{
  assert.equal(signedApi.status,200);assert.equal(signedApi.data.user_id,a.id);
  const denied=await api(2,"collaboration.session",{session_id:sid});assert.equal(denied.status,404);
  const userDetail=await api(1,"collaboration.session",{session_id:sid});assert.equal(userDetail.status,200);assert.equal(userDetail.data.room.presence.length,2);check("Deployed authenticated API enforces membership");
 }
 d=await read(a.id,sid);await rpc(a.id,{action:"session.remove",session_id:sid,user_id:b.id,revision:d.session.revision});
 await assert.rejects(read(b.id,sid),/COLLAB_NOT_FOUND/);await assert.rejects(rpc(b.id,{action:"room.heartbeat",session_id:sid,connection_id:cb}),/COLLAB_NOT_FOUND/);check("Removal revokes read and control immediately");
 console.log("REMOTE_SHARED_ROOM_CHECKS_PASSED "+passed);
}finally{
 for(const {client} of accounts)await client.removeAllChannels();
 // Only IDs created and captured by this invocation are deleted.
 for(const id of sessions){const result=await admin.from("group_study_sessions").delete().eq("id",id).in("host_id",accounts.map(x=>x.id));if(result.error)console.error("QA session cleanup requires retry for generated fixture.");}
 for(const {id} of accounts){const result=await admin.auth.admin.deleteUser(id);if(result.error)console.error("QA account cleanup requires retry for generated fixture.");}
 console.log("Synthetic fixture cleanup finished.");
}
