import test from "node:test";
import assert from "node:assert/strict";
import {collectDigitalRss} from "../src/sources.js";

test("a retry repairs an update row whose article insert previously failed",async()=>{
 let updateAttempts=0,articleAttempts=0,failArticleOnce=true;
 const DB={prepare(sql){return {bind(...args){return {
  first:async()=>sql.includes("FROM sources WHERE id=?")?{id:"digital_rss",url:"https://example.jp/feed.xml",terms_checked:1}:null,
  run:async()=>{
   if(sql.startsWith("INSERT OR IGNORE INTO updates")){
    updateAttempts++;
    return {meta:{changes:updateAttempts===1?1:0}};
   }
   if(sql.startsWith("INSERT OR IGNORE INTO articles")){
    articleAttempts++;
    if(failArticleOnce){failArticleOnce=false;throw new Error("simulated interrupted article insert")}
    return {meta:{changes:1}};
   }
   return {meta:{changes:1}};
  }
 }}}}};
 const originalFetch=globalThis.fetch;
 globalThis.fetch=async()=>new Response('<rss><channel><item><title>制度変更</title><link>https://example.jp/law/1</link><guid>law-1</guid><description>労働制度の変更</description></item></channel></rss>',{status:200,headers:{"content-type":"application/rss+xml"}});
 try{
  await assert.rejects(()=>collectDigitalRss({DB}),/simulated interrupted/);
  const result=await collectDigitalRss({DB});
  assert.equal(result.scanned,1);
  assert.equal(result.collected,0,"the update row already existed on retry");
  assert.equal(updateAttempts,2);
  assert.equal(articleAttempts,2,"article insert must be retried even when update insert is ignored");
 }finally{globalThis.fetch=originalFetch}
});
