import {classifyText} from "./categories.js";
function decode(v=""){return v.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)));}
function tag(b,n){const m=b.match(new RegExp("<"+n+"(?:\\s[^>]*)?>([\\s\\S]*?)</"+n+">","i"));return m?decode(m[1].trim()):"";}
async function hash(t){const d=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(t));return [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,"0")).join("");}
export async function collectDigitalRss(env){
 const s=await env.DB.prepare("SELECT id,url,terms_checked FROM sources WHERE id=? AND enabled=1").bind("digital_rss").first();
 if(!s)return {collected:0,skipped:true,reason:"source-disabled-or-missing"};
 if(!s.terms_checked)return {collected:0,skipped:true,reason:"source-terms-not-confirmed"};
 const r=await fetch(s.url,{headers:{"User-Agent":"RuleChangeLetter/0.1"}});
 if(!r.ok)throw new Error("RSS取得失敗: HTTP "+r.status);
 const xml=await r.text(),items=[...xml.matchAll(/<(item|entry)(?:\s[^>]*)?>[\s\S]*?<\/\1>/gi)].map(m=>m[0]);
 let count=0;
 for(const b of items.slice(0,100)){
  const title=tag(b,"title").replace(/<[^>]+>/g,"").trim(),lt=tag(b,"link"),atom=b.match(/<link[^>]+href=["']([^"']+)["'][^>]*\/?\s*>/i);
  const url=decode((lt||atom?.[1]||"").trim()),external=tag(b,"guid")||tag(b,"id")||url;
  const date=tag(b,"pubDate")||tag(b,"published")||tag(b,"updated")||null;
  const desc=(tag(b,"description")||tag(b,"summary")||tag(b,"content")).replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim().slice(0,3000);
  if(!title||!/^https:\/\//i.test(url)||!external)continue;
  const h=await hash([title,url,date||""].join("\n"));
  const ins=await env.DB.prepare("INSERT OR IGNORE INTO updates(source_id,external_id,title,url,published_at,description,content_hash) VALUES(?,?,?,?,?,?,?)").bind(s.id,external,title,url,date,desc,h).run();
  if(ins.meta?.changes){
   const cats=classifyText(title+" "+desc);
   await env.DB.prepare("INSERT OR IGNORE INTO articles(update_id,summary,what_changed,who_affected,action_needed,category_ids,status) SELECT id,?,?,?,?,?,'pending' FROM updates WHERE source_id=? AND external_id=?")
    .bind("公式発表の確認候補です。原文確認前の解説ではありません。","原文確認が必要です。","原文で対象者を確認してください。","施行日・適用条件を原文で確認してください。",JSON.stringify(cats),s.id,external).run();
   count++;
  }
 }
 await env.DB.prepare("UPDATE sources SET last_checked_at=CURRENT_TIMESTAMP,last_error=NULL WHERE id=?").bind(s.id).run();
 return {collected:count,scanned:items.length};
}
