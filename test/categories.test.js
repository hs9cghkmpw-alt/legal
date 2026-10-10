import test from "node:test";
import assert from "node:assert/strict";
import {ROLES,CATEGORIES,recommendCategories,classifyText} from "../src/categories.js";

test("role and category IDs are unique",()=>{
 assert.equal(new Set(ROLES.map(x=>x.id)).size,ROLES.length);
 assert.equal(new Set(CATEGORIES.map(x=>x.id)).size,CATEGORIES.length);
});
test("role recommendations return only known category IDs",()=>{
 const known=new Set(CATEGORIES.map(x=>x.id));
 for(const role of ROLES){
  const result=recommendCategories([role.id]);
  assert.ok(result.length>0,role.id+" should have a recommendation");
  assert.ok(result.every(id=>known.has(id)),role.id+" includes an unknown category");
 }
});
test("multiple roles merge recommendations without duplicates",()=>{
 const result=recommendCategories(["individual","employee"]);
 assert.ok(result.includes("consumer"));
 assert.ok(result.includes("labor"));
 assert.equal(new Set(result).size,result.length);
});
test("classification can assign multiple categories",()=>{
 const result=classifyText("労働時間と社会保険の制度変更");
 assert.ok(result.includes("labor"));
 assert.ok(result.includes("social_insurance"));
});
test("unknown topics go to other",()=>{
 assert.deepEqual(classifyText("珍しい制度変更"),["other"]);
});
