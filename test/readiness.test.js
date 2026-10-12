import test from "node:test";
import assert from "node:assert/strict";
import {enqueueWeekly,drainQueue} from "../src/index.js";

function noDatabase(){
 return {prepare(){throw new Error("database must not be touched while readiness is disabled")}};
}

test("weekly enqueue is paused unless readiness is explicitly enabled",async()=>{
 for(const flag of [undefined,"false","TRUE-ish","1",""]){
  const result=await enqueueWeekly({DB:noDatabase(),SIGNUP_ENABLED:flag});
  assert.deepEqual(result,{skipped:true,reason:"service-not-ready"});
 }
});

test("email queue drain is paused unless readiness is explicitly enabled",async()=>{
 for(const flag of [undefined,"false","TRUE-ish","1",""]){
  const result=await drainQueue({DB:noDatabase(),SIGNUP_ENABLED:flag});
  assert.deepEqual(result,{skipped:true,sent:0,errors:0,reason:"service-not-ready"});
 }
});
