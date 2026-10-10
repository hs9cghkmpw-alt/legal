import test from "node:test";
import assert from "node:assert/strict";
import app from "../src/index.js";

function request(body){
 return new Request("https://worker.example/api/subscribe",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
}
const valid={email:"person@example.jp",roles:["individual"],categories:["daily_life"],consent:true};

test("subscription fails closed when public privacy URL is missing",async()=>{
 const res=await app.fetch(request(valid),{PRIVACY_URL:"",BASE_URL:"https://worker.example",DB:{prepare(){throw new Error("DB must not be touched")}}});
 assert.equal(res.status,503);
 assert.match((await res.json()).error,/プライバシー方針/);
});

test("subscription fails closed when BASE_URL is missing or unsafe",async()=>{
 for(const base of ["","http://worker.example","javascript:alert(1)"]){
  const res=await app.fetch(request(valid),{PRIVACY_URL:"https://worker.example/privacy",BASE_URL:base,DB:{prepare(){throw new Error("DB must not be touched")}}});
  assert.equal(res.status,503,base||"(missing)");
  assert.match((await res.json()).error,/BASE_URL/);
 }
});

test("local development may use localhost base URL",async()=>{
 await assert.rejects(()=>app.fetch(request(valid),{PRIVACY_URL:"https://worker.example/privacy",BASE_URL:"http://localhost:8787",DB:{prepare(){throw new Error("stop before database work")}}}),/stop before database work/);
 // The request passed URL validation and reached the database stub.
});

test("resubscription removes stale unsent queue rows before rotating tokens",async()=>{
 const queries=[];
 const DB={prepare(sql){return {bind(...args){return {
  first:async()=>{
   if(sql.includes("FROM rate_limits"))return null;
   if(sql.includes("FROM subscribers WHERE email"))return {id:7,confirmed:0,unsubscribed:1};
   return null;
  },
  run:async()=>{queries.push({sql,args});return {meta:{changes:1,last_row_id:7}}},
  all:async()=>({results:[]})
 }}}}};
 const originalFetch=globalThis.fetch;
 globalThis.fetch=async()=>new Response(JSON.stringify({messageId:"test"}),{status:201,headers:{"content-type":"application/json"}});
 try{
  const res=await app.fetch(request(valid),{PRIVACY_URL:"https://worker.example/privacy",BASE_URL:"https://worker.example",BREVO_API_KEY:"test",SENDER_EMAIL:"sender@example.jp",DB});
  assert.equal(res.status,202);
  const purge=queries.findIndex(x=>x.sql.startsWith("DELETE FROM delivery_queue WHERE subscriber_id=? AND status!='sent'"));
  const rotate=queries.findIndex(x=>x.sql.startsWith("UPDATE subscribers SET confirmation_token="));
  assert.ok(purge>=0,"must delete stale unsent queue entries");
  assert.ok(rotate>purge,"must purge before reactivating the subscription");
 }finally{globalThis.fetch=originalFetch}
});
