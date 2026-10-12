import test from "node:test";
import assert from "node:assert/strict";
import {sendEmail} from "../src/email.js";

test("provider 5xx response is treated as an uncertain delivery result",async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async()=>new Response("temporary server failure",{status:500});
 try{
  await assert.rejects(sendEmail({BREVO_API_KEY:"test",SENDER_EMAIL:"sender@example.com"},{to:"person@example.com",subject:"test",html:"",text:""}),error=>{
   assert.equal(error.deliveryUnknown,true);
   assert.match(error.message,/HTTP 500/);
   return true;
  });
 }finally{globalThis.fetch=original}
});
