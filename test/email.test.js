import test from "node:test";
import assert from "node:assert/strict";
import {sendEmail} from "../src/email.js";

const env={BREVO_API_KEY:"test-key",SENDER_EMAIL:"sender@example.com",SENDER_NAME:"test"};

test("network failure is marked as delivery-uncertain",async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async()=>{throw new Error("connection reset")};
 try{
  await assert.rejects(sendEmail(env,{to:"recipient@example.com",subject:"test",html:"",text:""}),error=>{
   assert.equal(error.deliveryUnknown,true);
   assert.match(error.message,/結果不明/);
   return true;
  });
 }finally{globalThis.fetch=original}
});

test("explicit provider rejection is not marked as delivery-uncertain",async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async()=>new Response("invalid sender",{status:400});
 try{
  await assert.rejects(sendEmail(env,{to:"recipient@example.com",subject:"test",html:"",text:""}),error=>{
   assert.notEqual(error.deliveryUnknown,true);
   assert.match(error.message,/HTTP 400/);
   return true;
  });
 }finally{globalThis.fetch=original}
});
