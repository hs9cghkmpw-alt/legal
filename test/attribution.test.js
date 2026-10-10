import test from "node:test";
import assert from "node:assert/strict";
import {sourceAttribution} from "../src/attribution.js";

test("identifies Digital Agency RSS as a source and marks editing",()=>{
 const value=sourceAttribution("digital_rss");
 assert.equal(value.label,"デジタル庁 RSS");
 assert.match(value.note,/編集・加工/);
});

test("identifies e-Gov law API and avoids implying official legal advice",()=>{
 const value=sourceAttribution("egov_law_api");
 assert.equal(value.label,"e-Gov法令検索（法令API Version 2）");
 assert.match(value.note,/行政機関による公式見解ではありません/);
});

test("uses a safe generic attribution for unknown sources",()=>{
 const value=sourceAttribution("unknown");
 assert.match(value.label,/公式情報/);
 assert.match(value.note,/ルール変更レター/);
});
