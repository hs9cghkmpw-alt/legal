import {ROLES,CATEGORIES,recommendCategories} from "./categories.js";
import {collectDigitalRss} from "./sources.js";
import {sendEmail,escapeHtml} from "./email.js";

const json=(v,status=200)=>new Response(JSON.stringify(v,null,2),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
const page=(title,body,status=200)=>new Response('<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+escapeHtml(title)+'</title><style>body{font:16px/1.65 system-ui;max-width:760px;margin:30px auto;padding:0 18px}fieldset{margin:16px 0;padding:14px;border:1px solid #aaa;border-radius:10px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px}label{display:block;padding:5px}small{display:block;color:#666}input[type=email]{padding:10px;width:min(95%,400px)}button{padding:10px 18px;background:#2563eb;color:white;border:0;border-radius:8px}</style><body>'+body+'</body></html>',{status,headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store"}});
function landing(){
 const roles=ROLES.map(r=>'<label><input type="checkbox" name="roles" value="'+r.id+'"> '+escapeHtml(r.label)+'</label>').join("");
 const cats=CATEGORIES.map(c=>'<label><input type="checkbox" name="categories" value="'+c.id+'"> <b>'+escapeHtml(c.label)+'</b><small>'+escapeHtml(c.description)+'</small></label>').join("");
 const map=JSON.stringify(Object.fromEntries(ROLES.map(r=>[r.id,recommendCategories([r.id])])));
 return page("ルール変更レター",'<h1>ルール変更レター</h1><p>法律・行政制度・生活や事業のルール変更を、必要な分野だけ週1回お届けします。</p><form id="f"><fieldset><legend>メールアドレス</legend><input type="email" name="email" required maxlength="254" autocomplete="email"></fieldset><fieldset><legend>あなたの立場（複数選択可）</legend><p>立場に応じてカテゴリを提案します。立場そのものでは配信対象を決めません。</p><div class="grid">'+roles+'</div></fieldset><fieldset><legend>受け取りたいカテゴリ（複数選択可）</legend><div class="grid" id="cats">'+cats+'</div></fieldset><label><input type="checkbox" required> プライバシー方針を確認し、配信に同意します。</label><p><button>確認メールを送る</button></p><p id="msg" role="status"></p></form><p>開発中の試作版です。記事は公式情報を確認してから配信します。個別の法律相談を提供するものではありません。</p><script>const map='+map+';let touched=false;const f=document.querySelector("#f"),boxes=[...document.querySelectorAll("[name=categories]")];boxes.forEach(b=>b.onchange=()=>touched=true);document.querySelectorAll("[name=roles]").forEach(b=>b.onchange=()=>{if(touched)return;const s=new Set([...document.querySelectorAll("[name=roles]:checked")].flatMap(x=>map[x.value]||[]));boxes.forEach(x=>x.checked=s.has(x.value))});f.onsubmit=async e=>{e.preventDefault();const d=new FormData(f),m=document.querySelector("#msg");m.textContent="送信中…";try{const r=await fetch("/api/subscribe",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email:d.get("email"),roles:d.getAll("roles"),categories:d.getAll("categories")})});const j=await r.json();m.textContent=r.ok?j.message:(j.error||"登録に失敗しました")}catch{m.textContent="通信に失敗しました"}};</script>');
}
const isAdmin=(req,env)=>Boolean(env.ADMIN_TOKEN&&env.ADMIN_TOKEN.length>=32&&req.headers.get("authorization")==="Bearer "+env.ADMIN_TOKEN);
const denied=()=>json({error:"管理者認証が必要です。ADMIN_TOKEN（32文字以上）を設定してください。"},401);
const base=env=>(env.BASE_URL||"http://localhost:8787").replace(/\/$/,"");

async function subscribe(req,env){
 let d;try{d=await req.json()}catch{return json({error:"JSON形式で送信してください"},400)}
 const email=String(d.email||"").trim().toLowerCase();
 const roles=[...new Set(Array.isArray(d.roles)?d.roles:[])].filter(x=>ROLES.some(r=>r.id===x));
 const cats=[...new Set(Array.isArray(d.categories)?d.categories:[])].filter(x=>CATEGORIES.some(c=>c.id===x));
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return json({error:"メールアドレスを確認してください"},400);
 if(!cats.length)return json({error:"カテゴリを1つ以上選択してください"},400);
 const token=crypto.randomUUID()+crypto.randomUUID().replace(/-/g,"");
 let p=await env.DB.prepare("SELECT id FROM subscribers WHERE email=?").bind(email).first();
 if(p)await env.DB.prepare("UPDATE subscribers SET confirmation_token=?,confirmed=0,unsubscribed=0 WHERE id=?").bind(token,p.id).run();
 else {const x=await env.DB.prepare("INSERT INTO subscribers(email,confirmation_token) VALUES(?,?)").bind(email,token).run();p={id:x.meta.last_row_id};}
 await env.DB.prepare("DELETE FROM subscriber_roles WHERE subscriber_id=?").bind(p.id).run();
 await env.DB.prepare("DELETE FROM subscriber_categories WHERE subscriber_id=?").bind(p.id).run();
 for(const id of roles)await env.DB.prepare("INSERT OR IGNORE INTO subscriber_roles(subscriber_id,role_id) VALUES(?,?)").bind(p.id,id).run();
 for(const id of cats)await env.DB.prepare("INSERT OR IGNORE INTO subscriber_categories(subscriber_id,category_id) VALUES(?,?)").bind(p.id,id).run();
 const link=base(env)+"/confirm?token="+encodeURIComponent(token);
 try{await sendEmail(env,{to:email,subject:"【ルール変更レター】メールアドレスの確認",text:"登録を完了するには次のURLを開いてください。\n"+link+"\n心当たりがなければ無視してください。",html:'<p>登録を完了するには次のリンクを開いてください。</p><p><a href="'+escapeHtml(link)+'">メールアドレスを確認する</a></p><p>心当たりがなければ無視してください。</p>'})}
 catch(e){return json({error:"確認メールを送信できませんでした。送信設定を確認してください。",detail:String(e.message||e)},502)}
 return json({message:"確認メールを送信しました。メール内のリンクを開いて登録を完了してください。"},202);
}
async function confirm(url,env){
 const token=url.searchParams.get("token")||"";
 if(!token||token.length>100)return page("確認できません","<h1>確認リンクが無効です</h1>",400);
 const r=await env.DB.prepare("UPDATE subscribers SET confirmed=1,confirmed_at=CURRENT_TIMESTAMP WHERE confirmation_token=? AND unsubscribed=0").bind(token).run();
 return r.meta.changes?page("登録完了","<h1>登録が完了しました</h1><p>選択したカテゴリに関係する情報をお届けします。</p>"):page("確認できません","<h1>リンクが無効か、配信停止済みです</h1>",400);
}
async function unsubscribe(url,env){
 const token=url.searchParams.get("token")||"";
 if(!token||token.length>100)return page("配信停止","<h1>リンクが無効です</h1>",400);
 const r=await env.DB.prepare("UPDATE subscribers SET unsubscribed=1 WHERE confirmation_token=?").bind(token).run();
 return r.meta.changes?page("配信停止","<h1>配信を停止しました</h1>"):page("配信停止","<h1>リンクが無効です</h1>",404);
}
async function collect(req,env){
 if(!isAdmin(req,env))return denied();
 try{return json(await collectDigitalRss(env))}catch(e){await env.DB.prepare("UPDATE sources SET last_error=? WHERE id='digital_rss'").bind(String(e.message||e).slice(0,500)).run();return json({error:String(e.message||e)},502)}
}
async function listUpdates(req,env){
 if(!isAdmin(req,env))return denied();
 const r=await env.DB.prepare("SELECT a.id article_id,a.status,a.category_ids,a.summary,u.title,u.url,u.published_at,u.description FROM articles a JOIN updates u ON u.id=a.update_id WHERE a.status='pending' ORDER BY u.collected_at DESC LIMIT 100").all();
 return json(r.results||[]);
}
async function approve(req,env){
 if(!isAdmin(req,env))return denied();
 let d;try{d=await req.json()}catch{return json({error:"JSON形式で送信してください"},400)}
 const id=Number(d.article_id);
 if(!Number.isSafeInteger(id)||id<1)return json({error:"article_id が不正です"},400);
 if(d.status==="rejected"){
  const rejected=await env.DB.prepare("UPDATE articles SET status='rejected',reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'").bind(id).run();
  return rejected.meta.changes?json({ok:true,article_id:id,status:"rejected"}):json({error:"承認待ち記事が見つかりません"},404);
 }
 const fields=["summary","what_changed","who_affected","action_needed"];
 for(const key of fields)if(typeof d[key]!=="string"||!d[key].trim())return json({error:key+" は必須です。原文確認後の内容を入力してください。"},400);
 const cats=[...new Set(Array.isArray(d.category_ids)?d.category_ids:[])].filter(x=>CATEGORIES.some(c=>c.id===x));
 if(!cats.length)return json({error:"有効な category_ids を1つ以上指定してください"},400);
 const effectiveDate=typeof d.effective_date==="string"?d.effective_date.trim():"";
 const result=await env.DB.prepare("UPDATE articles SET summary=?,what_changed=?,effective_date=?,who_affected=?,action_needed=?,category_ids=?,status='approved',reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'")
  .bind(d.summary.trim(),d.what_changed.trim(),effectiveDate,d.who_affected.trim(),d.action_needed.trim(),JSON.stringify(cats),id).run();
 return result.meta.changes?json({ok:true,article_id:id,status:"approved"}):json({error:"承認待ち記事が見つかりません"},404);
}
async function dispatch(env){
 const a=await env.DB.prepare("SELECT a.id,a.summary,a.what_changed,a.effective_date,a.who_affected,a.action_needed,a.category_ids,u.title,u.url FROM articles a JOIN updates u ON u.id=a.update_id WHERE a.status='approved' ORDER BY u.collected_at DESC LIMIT 100").all();
 const people=await env.DB.prepare("SELECT id,email,confirmation_token FROM subscribers WHERE confirmed=1 AND unsubscribed=0 ORDER BY id LIMIT 20").all();
 let sent=0,errors=0,skipped=0;
 for(const p of people.results||[]){
  const cr=await env.DB.prepare("SELECT category_id FROM subscriber_categories WHERE subscriber_id=?").bind(p.id).all();
  const chosen=new Set((cr.results||[]).map(x=>x.category_id));
  const sr=await env.DB.prepare("SELECT article_id FROM sent WHERE subscriber_id=?").bind(p.id).all();
  const prior=new Set((sr.results||[]).map(x=>x.article_id));
  const match=(a.results||[]).filter(x=>JSON.parse(x.category_ids||"[]").some(c=>chosen.has(c))&&!prior.has(x.id));
  if(!match.length){skipped++;continue}
  const unsub=base(env)+"/unsubscribe?token="+encodeURIComponent(p.confirmation_token);
  const body=match.map(x=>"<article><h2>"+escapeHtml(x.title)+"</h2><p>"+escapeHtml(x.summary)+"</p><p><b>変更点：</b>"+escapeHtml(x.what_changed)+"</p><p><b>施行日：</b>"+escapeHtml(x.effective_date||"原文で確認してください")+"</p><p><b>対象者：</b>"+escapeHtml(x.who_affected)+"</p><p><b>対応：</b>"+escapeHtml(x.action_needed)+"</p><p><a href=\""+escapeHtml(x.url)+"\">公式情報</a></p></article><hr>").join("");
  try{
   await sendEmail(env,{to:p.email,subject:"【ルール変更レター】今週のルール変更情報",html:"<h1>今週のルール変更情報</h1>"+body+'<p><a href="'+escapeHtml(unsub)+'">配信停止</a></p><p>公式情報を確認してください。本メールは個別の法律相談ではありません。</p>',text:match.map(x=>x.title+"\n"+x.summary+"\n"+x.url).join("\n\n---\n\n")+"\n配信停止: "+unsub});
   for(const x of match)await env.DB.prepare("INSERT OR IGNORE INTO sent(subscriber_id,article_id) VALUES(?,?)").bind(p.id,x.id).run();
   sent++;
  }catch(e){errors++;console.error("mail failed",p.id,String(e.message||e))}
 }
 return {ok:errors===0,subscribersConsidered:(people.results||[]).length,sent,skipped,errors,note:"1回最大20人の制限。超過分の複数バッチ処理は未実装。"};
}
export default {
 async fetch(req,env){
  const u=new URL(req.url);
  if(req.method==="GET"&&u.pathname==="/")return landing();
  if(req.method==="GET"&&u.pathname==="/health")return json({ok:true,service:"rule-change-letter",time:new Date().toISOString()});
  if(req.method==="GET"&&u.pathname==="/api/categories")return json({roles:ROLES,categories:CATEGORIES,recommendations:Object.fromEntries(ROLES.map(r=>[r.id,recommendCategories([r.id])]))});
  if(req.method==="POST"&&u.pathname==="/api/subscribe")return subscribe(req,env);
  if(req.method==="GET"&&u.pathname==="/confirm")return confirm(u,env);
  if(req.method==="GET"&&u.pathname==="/unsubscribe")return unsubscribe(u,env);
  if(req.method==="GET"&&u.pathname==="/api/admin/collect")return collect(req,env);
  if(req.method==="GET"&&u.pathname==="/api/admin/updates")return listUpdates(req,env);
  if(req.method==="POST"&&u.pathname==="/api/admin/approve")return approve(req,env);
  if(req.method==="GET"&&u.pathname==="/api/admin/send"){if(!isAdmin(req,env))return denied();return json(await dispatch(env))}
  return page("Not Found","<h1>404</h1><p>ページが見つかりません。</p>",404);
 },
 async scheduled(event,env,ctx){
  ctx.waitUntil((async()=>{
   if(event.cron==="0 22 * * *"){try{await collectDigitalRss(env)}catch(e){await env.DB.prepare("UPDATE sources SET last_error=? WHERE id='digital_rss'").bind(String(e.message||e).slice(0,500)).run();console.error(e)}}
   else if(event.cron==="0 23 * * SUN")await dispatch(env);
  })());
 }
};
