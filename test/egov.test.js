import test from "node:test";
import assert from "node:assert/strict";
import {collectEgovLawUpdates} from "../src/egov.js";

function mockDb({termsChecked=1}={}){
 const updates=[],articles=[],sourceUpdates=[];
 const source={id:"egov_law_api",url:"https://laws.e-gov.go.jp/api/2/laws",terms_checked:termsChecked,scan_offset:0,scan_cutoff:null,scan_page_payload:null,scan_item_offset:0};
 const DB={prepare(sql){return {bind(...args){return {
  first:async()=>sql.includes("FROM sources WHERE id=?")?source:null,
  run:async()=>{
   if(sql.startsWith("INSERT OR IGNORE INTO updates")){
    const [sourceId,externalId,title,url,publishedAt,description,contentHash]=args;
    if(updates.some(x=>x.sourceId===sourceId&&x.externalId===externalId))return {meta:{changes:0}};
    updates.push({sourceId,externalId,title,url,publishedAt,description,contentHash});return {meta:{changes:1}};
   }
   if(sql.startsWith("INSERT OR IGNORE INTO articles")){
    articles.push(args);return {meta:{changes:1}};
   }
   if(sql.startsWith("UPDATE sources SET scan_offset=0")){
    source.scan_offset=0;source.scan_cutoff=null;source.scan_page_payload=null;source.scan_item_offset=0;sourceUpdates.push(args);
   }else if(sql.startsWith("UPDATE sources SET scan_offset=?")){
    source.scan_offset=args[0];source.scan_cutoff=args[1];
    if(sql.includes("scan_page_payload=?")){source.scan_page_payload=args[2];source.scan_item_offset=args[3]}
    else{source.scan_page_payload=null;source.scan_item_offset=0}
    sourceUpdates.push(args);
   }
   return {meta:{changes:1}};
  }
 }}}}};
 return {DB,updates,articles,sourceUpdates,source};
}
const law=(id,date,title=id,opts={})=>({law_info:{law_id:id,law_title:"関連法令 "+id,promulgation_date:"2020-01-01"},revision_info:{law_revision_id:id+"_revision",amendment_law_id:id+"_amend",amendment_law_title:title,amendment_promulgate_date:date,amendment_type:"3",mission:"Partial",...opts}});
function response(laws,next_offset=null){return new Response(JSON.stringify({laws,count:laws.length,next_offset}),{status:200,headers:{"content-type":"application/json"}})}

test("does not call the API before source terms are confirmed",async()=>{
 const {DB}=mockDb({termsChecked:0});let calls=0;
 const result=await collectEgovLawUpdates({DB},{fetchImpl:async()=>{calls++;throw Error("must not fetch")},now:new Date("2026-10-10T00:00:00Z")});
 assert.equal(result.skipped,true);assert.equal(calls,0);
});

test("collects recent amendments, ignores older ones, and groups revisions by amendment law",async()=>{
 const {DB,updates,articles}=mockDb();const urls=[];
 const fetchImpl=async url=>{urls.push(new URL(url));return response([
  law("A","2026-10-09","労働制度改正法"),
  law("A","2026-10-08","労働制度改正法"),
  law("B","2026-09-20","古い改正法")
 ])};
 const result=await collectEgovLawUpdates({DB},{fetchImpl,now:new Date("2026-10-10T12:00:00Z")});
 assert.equal(result.collected,1);
 assert.equal(result.withinWindow,2);
 assert.equal(updates.length,1);
 assert.equal(updates[0].externalId,"A_revision");
 assert.equal(updates[0].publishedAt,"2026-10-09");
 assert.match(updates[0].url,/laws\.e-gov\.go\.jp\/law\/A$/);
 assert.equal(articles.length,1);
 assert.equal(urls[0].searchParams.get("order"),null);
 assert.equal(urls[0].searchParams.get("limit"),"100");
});


test("does not stop at an old record before later pages",async()=>{
 const {DB,updates,source}=mockDb();
 const first=await collectEgovLawUpdates({DB},{fetchImpl:async url=>{
  assert.equal(new URL(url).searchParams.get("offset"),"0");
  return response([law("OLD","2026-09-01","古い改正法")],100);
 },now:new Date("2026-10-10T12:00:00Z")});
 assert.equal(first.hasMore,true);
 assert.equal(first.collected,0);
 assert.equal(source.scan_offset,100);

 const second=await collectEgovLawUpdates({DB},{fetchImpl:async url=>{
  assert.equal(new URL(url).searchParams.get("offset"),"100");
  return response([law("RECENT","2026-10-09","最近の改正法")],null);
 },now:new Date("2026-10-11T12:00:00Z")});
 assert.equal(second.hasMore,false);
 assert.equal(second.collected,1);
 assert.equal(updates[0].externalId,"RECENT_revision");
});

test("caps candidate writes per invocation and resumes inside the saved page",async()=>{
 const {DB,source,updates}=mockDb();
 const laws=Array.from({length:20},(_,i)=>law("LAW"+i,"2026-10-09","改正法"+i));
 const first=await collectEgovLawUpdates({DB},{fetchImpl:async()=>response(laws,null),now:new Date("2026-10-10T12:00:00Z")});
 assert.equal(first.collected,15);
 assert.equal(first.hasMore,true);
 assert.equal(updates.length,15);
 assert.equal(source.scan_offset,0);
 assert.equal(source.scan_item_offset,15);
 assert.ok(source.scan_page_payload);

 let calls=0;
 const second=await collectEgovLawUpdates({DB},{fetchImpl:async()=>{calls++;throw Error("saved page should be reused")},now:new Date("2026-10-11T12:00:00Z")});
 assert.equal(calls,0);
 assert.equal(second.collected,5);
 assert.equal(second.hasMore,false);
 assert.equal(updates.length,20);
 assert.equal(source.scan_offset,0);
 assert.equal(source.scan_cutoff,null);
 assert.equal(source.scan_page_payload,null);
 assert.equal(source.scan_item_offset,0);
});

test("fails closed when API response is malformed or unavailable",async()=>{
 const {DB}=mockDb();
 await assert.rejects(()=>collectEgovLawUpdates({DB},{fetchImpl:async()=>new Response("not json",{status:200}),now:new Date("2026-10-10T00:00:00Z")}),/JSON/);
 await assert.rejects(()=>collectEgovLawUpdates({DB},{fetchImpl:async()=>new Response("",{status:503}),now:new Date("2026-10-10T00:00:00Z")}),/HTTP 503/);
});
