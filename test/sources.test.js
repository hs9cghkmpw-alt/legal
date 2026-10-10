import test from "node:test";
import assert from "node:assert/strict";
import {parseFeedItems} from "../src/sources.js";

test("parses RSS item fields and decodes XML entities",()=>{
 const xml=`<rss><channel><item><title>税制 &amp; 手続き</title><link>https://example.jp/law?a=1&amp;b=2</link><guid>urn:law:1</guid><pubDate>Fri, 09 Oct 2026 00:00:00 GMT</pubDate><description><![CDATA[<p>対象者 &#12354; </p>]]></description></item></channel></rss>`;
 const [item]=parseFeedItems(xml);
 assert.equal(item.title,"税制 & 手続き");
 assert.equal(item.url,"https://example.jp/law?a=1&b=2");
 assert.equal(item.external,"urn:law:1");
 assert.equal(item.published_at,"Fri, 09 Oct 2026 00:00:00 GMT");
 assert.equal(item.description,"対象者 あ");
});

test("parses Atom entry and prefers alternate link",()=>{
 const xml=`<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>制度のお知らせ</title><id>urn:entry:42</id><link rel="self" href="https://example.jp/api/42"/><link rel="alternate" href="https://example.jp/news/42"/><updated>2026-10-09T08:00:00Z</updated><summary>概要です</summary></entry></feed>`;
 const [item]=parseFeedItems(xml);
 assert.equal(item.title,"制度のお知らせ");
 assert.equal(item.url,"https://example.jp/news/42");
 assert.equal(item.external,"urn:entry:42");
 assert.equal(item.published_at,"2026-10-09T08:00:00Z");
 assert.equal(item.description,"概要です");
});

test("parses namespaced feed tags",()=>{
 const items=parseFeedItems(`<feed><atom:entry><atom:title>告知</atom:title><atom:id>urn:x</atom:id><atom:link href="https://example.jp/x"/><atom:content>内容</atom:content></atom:entry></feed>`);
 assert.equal(items.length,1);
 assert.equal(items[0].url,"https://example.jp/x");
});

test("returns an empty list for malformed or irrelevant XML",()=>{
 assert.deepEqual(parseFeedItems("<html><p>not a feed</p></html>"),[]);
 assert.deepEqual(parseFeedItems("<rss><item><title>unfinished"),[]);
});

test("limits description length",()=>{
 const long="x".repeat(5000);
 const [item]=parseFeedItems(`<rss><item><title>長文</title><link>https://example.jp/x</link><description>${long}</description></item></rss>`);
 assert.equal(item.description.length,3000);
});
