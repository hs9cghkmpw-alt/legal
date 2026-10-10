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
 for(const base of ["","http://worker.example","javascript:alert(1)","https://worker.example/path","https://user:pass@worker.example"]){
  const res=await app.fetch(request(valid),{PRIVACY_URL:"https://worker.example/privacy",SIGNUP_ENABLED:"true",BASE_URL:base,DB:{prepare(){throw new Error("DB must not be touched")}}});
  assert.equal(res.status,503,base||"(missing)");
  assert.match((await res.json()).error,/BASE_URL/);
 }
});

test("local development may use localhost base URL",async()=>{
 await assert.rejects(()=>app.fetch(request(valid),{PRIVACY_URL:"https://worker.example/privacy",SIGNUP_ENABLED:"true",BASE_URL:"http://localhost:8787",DB:{prepare(){throw new Error("stop before database work")}}}),/stop before database work/);
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
 let sentEmail=null;
 const originalFetch=globalThis.fetch;
 globalThis.fetch=async(_url,options)=>{sentEmail=JSON.parse(options.body);return new Response(JSON.stringify({messageId:"test"}),{status:201,headers:{"content-type":"application/json"}})};
 try{
  const res=await app.fetch(request(valid),{PRIVACY_URL:"https://worker.example/privacy",SIGNUP_ENABLED:"true",BASE_URL:"https://worker.example",BREVO_API_KEY:"test",SENDER_EMAIL:"sender@example.jp",DB});
  assert.equal(res.status,202);
  assert.match(sentEmail.textContent,/確認リンクを開くまで登録・配信は開始されません/);
  assert.match(sentEmail.textContent,/登録した覚えがない場合は、このメールを無視してください/);
  assert.match(sentEmail.textContent,/https:\/\/worker\.example\/privacy/);
  assert.match(sentEmail.htmlContent,/プライバシー方針/);
  const purge=queries.findIndex(x=>x.sql.startsWith("DELETE FROM delivery_queue WHERE subscriber_id=? AND status!='sent'"));
  const rotate=queries.findIndex(x=>x.sql.startsWith("UPDATE subscribers SET confirmation_token="));
  assert.ok(purge>=0,"must delete stale unsent queue entries");
  assert.ok(rotate>purge,"must purge before reactivating the subscription");
 }finally{globalThis.fetch=originalFetch}
});

test("unsubscribe page offers deletion and GET does not mutate data",async()=>{
 const res=await app.fetch(new Request("https://worker.example/unsubscribe?token=valid-token"),{DB:{prepare(){throw new Error("GET must not touch DB")}}});
 assert.equal(res.status,200);
 const html=await res.text();
 assert.match(html,/配信を停止し、登録情報を削除する/);
 assert.match(html,/name="action" value="delete"/);
});

test("explicit deletion removes subscriber and its email rate-limit key",async()=>{
 const queries=[];
 const DB={prepare(sql){return {bind(...args){return {
  first:async()=>sql.includes("SELECT id,email FROM subscribers WHERE unsubscribe_token")?{id:7,email:"person@example.jp"}:null,
  run:async()=>{queries.push({sql,args});return {meta:{changes:1}}}
 }}}}};
 const req=new Request("https://worker.example/unsubscribe",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({token:"valid-token",action:"delete"})});
 const res=await app.fetch(req,{DB});
 assert.equal(res.status,200);
 assert.match(await res.text(),/登録情報を削除しました/);
 const rate=queries.findIndex(x=>x.sql.startsWith("DELETE FROM rate_limits WHERE rate_key=?"));
 const subscriber=queries.findIndex(x=>x.sql.startsWith("DELETE FROM subscribers WHERE id=?"));
 assert.ok(rate>=0);
 assert.ok(subscriber>rate);
 assert.equal(queries[rate].args[0],"email:person@example.jp");
 assert.equal(queries[subscriber].args[0],7);
});

test("subscription rejects malformed or non-HTTPS privacy policy URLs before database access",async()=>{
 for(const privacy of ["http://worker.example/privacy","https://","javascript:alert(1)"]){
  const res=await app.fetch(request(valid),{PRIVACY_URL:privacy,SIGNUP_ENABLED:"true",BASE_URL:"https://worker.example",DB:{prepare(){throw new Error("DB must not be touched")}}});
  assert.equal(res.status,503,privacy);
  assert.match((await res.json()).error,/プライバシー方針/);
 }
});


import { rateLimit } from "../src/index.js";

test("rate limit increments through one atomic conditional upsert", async () => {
  let captured;
  const env = { DB: { prepare(sql) {
    return { bind(...args) { return { async run() { captured = { sql, args }; return { meta: { changes: 1 } }; } }; } };
  } } };
  assert.equal(await rateLimit(env, "email:test@example.com", 3), true);
  assert.match(captured.sql, /ON CONFLICT\(rate_key,window_start\) DO UPDATE SET count=count\+1 WHERE rate_limits\.count < \?/);
  assert.equal(captured.args[0], "email:test@example.com");
  assert.equal(captured.args[2], 3);
});

test("rate limit rejects atomically when the conditional upsert makes no change", async () => {
  const env = { DB: { prepare() {
    return { bind() { return { async run() { return { meta: { changes: 0 } }; } }; } };
  } } };
  assert.equal(await rateLimit(env, "email:test@example.com", 3), false);
});
