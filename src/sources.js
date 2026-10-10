import {classifyText} from "./categories.js";

function decode(value=""){
 return value
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1")
  .replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16)))
  .replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)))
  .replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">")
  .replace(/&quot;/g,'"').replace(/&apos;/g,"'");
}
function tag(block,name){
 const re=new RegExp("<(?:[\\w.-]+:)?"+name+"(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w.-]+:)?"+name+"\\s*>","i");
 const m=block.match(re);
 return m?decode(m[1].trim()):"";
}
function atomLink(block){
 const links=[...block.matchAll(/<(?:[\w.-]+:)?link\b([^>]*)\/?\s*>/gi)];
 for(const m of links){
  const attrs=m[1],href=attrs.match(/\bhref\s*=\s*(["'])(.*?)\1/i)?.[2];
  const rel=attrs.match(/\brel\s*=\s*(["'])(.*?)\1/i)?.[2]||"alternate";
  if(href&&rel==="alternate")return decode(href.trim());
 }
 return "";
}
export function parseFeedItems(xml=""){
 const blocks=[...xml.matchAll(/<(?:[\w.-]+:)?(item|entry)\b[^>]*>[\s\S]*?<\/(?:[\w.-]+:)?\1\s*>/gi)].map(m=>m[0]);
 return blocks.map(block=>{
  const title=tag(block,"title").replace(/<[^>]+>/g,"").trim();
  const url=(tag(block,"link")||atomLink(block)).trim();
  const external=(tag(block,"guid")||tag(block,"id")||url).trim();
  const published_at=tag(block,"pubDate")||tag(block,"published")||tag(block,"updated")||null;
  const description=(tag(block,"description")||tag(block,"summary")||tag(block,"content")).replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim().slice(0,3000);
  return {title,url,external,published_at,description};
 });
}
async function hash(text){
 const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text));
 return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
export async function collectDigitalRss(env){
 const source=await env.DB.prepare("SELECT id,url,terms_checked FROM sources WHERE id=? AND enabled=1").bind("digital_rss").first();
 if(!source)return {collected:0,skipped:true,reason:"source-disabled-or-missing"};
 if(!source.terms_checked)return {collected:0,skipped:true,reason:"source-terms-not-confirmed"};
 const response=await fetch(source.url,{headers:{"User-Agent":"RuleChangeLetter/0.1"}});
 if(!response.ok)throw new Error("RSS取得失敗: HTTP "+response.status);
 const xml=await response.text(),items=parseFeedItems(xml);
 let count=0;
 for(const item of items.slice(0,100)){
  const {title,url,external,published_at,description}=item;
  if(!title||!/^https:\/\//i.test(url)||!external)continue;
  const contentHash=await hash([title,url,published_at||""].join("\n"));
  const inserted=await env.DB.prepare("INSERT OR IGNORE INTO updates(source_id,external_id,title,url,published_at,description,content_hash) VALUES(?,?,?,?,?,?,?)")
   .bind(source.id,external,title,url,published_at,description,contentHash).run();
  if(inserted.meta?.changes){
   const categories=classifyText(title+" "+description);
   await env.DB.prepare("INSERT OR IGNORE INTO articles(update_id,summary,what_changed,who_affected,action_needed,category_ids,status) SELECT id,?,?,?,?,?,'pending' FROM updates WHERE source_id=? AND external_id=?")
    .bind("公式発表の確認候補です。原文確認前の解説ではありません。","原文確認が必要です。","原文で対象者を確認してください。","施行日・適用条件を原文で確認してください。",JSON.stringify(categories),source.id,external).run();
   count++;
  }
 }
 await env.DB.prepare("UPDATE sources SET last_checked_at=CURRENT_TIMESTAMP,last_error=NULL WHERE id=?").bind(source.id).run();
 return {collected:count,scanned:items.length};
}
