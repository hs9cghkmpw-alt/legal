import test from "node:test";
import assert from "node:assert/strict";
import {enqueueWeekly} from "../src/index.js";

function fakeDb(total){
 const run={run_id:null,enqueue_complete:0,last_subscriber_id:0,article_snapshot:"[]"};
 const people=Array.from({length:total},(_,i)=>({id:i+1,confirmed:1,unsubscribed:0}));
 return {
  run,
  prepare(sql){return {all:async()=>({results:[]}),bind(...args){return {
   first:async()=>{
    if(sql.startsWith("SELECT run_id,enqueue_complete,last_subscriber_id,article_snapshot"))return run.run_id?{...run}:null;
    if(sql.startsWith("SELECT id FROM subscribers WHERE id>?"))return people.find(p=>p.id>args[0])||null;
    if(sql.startsWith("SELECT COUNT(*) AS n FROM delivery_queue"))return {n:0};
    if(sql.startsWith("SELECT COUNT(*) AS n FROM subscribers WHERE confirmed=1"))return {n:total};
    return null;
   },
   all:async()=>{
    if(sql.startsWith("SELECT id,category_ids FROM articles"))return {results:[]};
    if(sql.startsWith("SELECT id,confirmed,unsubscribed FROM subscribers WHERE id>?")){
     return {results:people.filter(p=>p.id>args[0]).slice(0,args[1])};
    }
    return {results:[]};
   },
   run:async()=>{
    if(sql.startsWith("INSERT INTO delivery_runs")){run.run_id=args[0];run.article_snapshot=args[1];run.enqueue_complete=0;run.last_subscriber_id=0}
    if(sql.startsWith("UPDATE delivery_runs SET last_subscriber_id"))run.last_subscriber_id=args[0];
    if(sql.startsWith("UPDATE delivery_runs SET enqueue_complete=1")){run.enqueue_complete=1;run.queued_count=args[0];run.skipped_count=args[1]}
    return {meta:{changes:1}};
   }
  }}}}
 };
}

test("weekly enqueue resumes in bounded batches and completes only after all subscribers are scanned",async()=>{
 const db=fakeDb(120),env={DB:db};
 const first=await enqueueWeekly(env,"weekly-test",50);
 assert.equal(first.enqueueComplete,false);
 assert.equal(first.lastSubscriberId,50);
 assert.equal(db.run.enqueue_complete,0);
 const second=await enqueueWeekly(env,"weekly-test",50);
 assert.equal(second.enqueueComplete,false);
 assert.equal(second.lastSubscriberId,100);
 assert.equal(db.run.enqueue_complete,0);
 const third=await enqueueWeekly(env,"weekly-test",50);
 assert.equal(third.enqueueComplete,true);
 assert.equal(third.queued,0);
 assert.equal(third.skipped,120);
 assert.equal(db.run.last_subscriber_id,120);
 assert.equal(db.run.enqueue_complete,1);
});
