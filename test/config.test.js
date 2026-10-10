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
