import {ROLES,CATEGORIES,recommendCategories} from "./categories.js";
import {collectDigitalRss} from "./sources.js";
import {collectEgovLawUpdates} from "./egov.js";
import {sendEmail,escapeHtml} from "./email.js";

const json=(v,status=200)=>new Response(JSON.stringify(v,null,2),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
const page=(title,body,status=200)=>new Response('<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+escapeHtml(title)+'</title><style>body{font:16px/1.65 system-ui;max-width:760px;margin:30px auto;padding:0 18px}fieldset{margin:16px 0;padding:14px;border:1px solid #aaa;border-radius:10px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px}label{display:block;padding:5px}small{display:block;color:#666}input[type=email]{padding:10px;width:min(95%,400px)}button{padding:10px 18px;background:#2563eb;color:white;border:0;border-radius:8px}</style><body>'+body+'</body></html>',{status,headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store"}});
function landing(env){
 const roles=ROLES.map(r=>'<label><input type="checkbox" name="roles" value="'+r.id+'"> '+escapeHtml(r.label)+'</label>').join("");
 const cats=CATEGORIES.map(x=>'<label><input type="checkbox" name="categories" value="'+x.id+'"> <b>'+escapeHtml(x.label)+'</b><small>'+escapeHtml(x.description)+'</small></label>').join("");
 const map=JSON.stringify(Object.fromEntries(ROLES.map(r=>[r.id,recommendCategories([r.id])])));
 const privacyUrl=env.PRIVACY_URL||"";
 const privacy=privacyUrl?'<a href="'+escapeHtml(privacyUrl)+'" target="_blank" rel="noopener noreferrer">プライバシー方針</a>':'<strong>プライバシー方針は公開準備中です</strong>';
 return page("ルール変更レター",'<h1>ルール変更レター</h1><p>法律・行政制度・生活や事業のルール変更を、必要な分野だけ週1回お届けします。</p><form id="f"><fieldset><legend>メールアドレス</legend><input type="email" name="email" required maxlength="254" autocomplete="email"></fieldset><fieldset><legend>あなたの立場（複数選択可）</legend><p>立場に応じてカテゴリを提案します。立場そのものでは配信対象を決めません。</p><div class="grid">'+roles+'</div></fieldset><fieldset><legend>受け取りたいカテゴリ（複数選択可）</legend><div class="grid">'+cats+'</div></fieldset><label><input type="checkbox" name="consent" required> '+privacy+' を確認し、配信に同意します。</label><p><button>確認メールを送る</button></p><p id="msg" role="status"></p></form><p>試作版です。記事は公式情報を確認してから配信します。個別の法律相談を提供するものではありません。</p><script>const map='+map+';let touched=false;const f=document.querySelector("#f"),boxes=[...document.querySelectorAll("[name=categories]")];boxes.forEach(b=>b.onchange=()=>touched=true);document.querySelectorAll("[name=roles]").forEach(b=>b.onchange=()=>{if(touched)return;const s=new Set([...document.querySelectorAll("[name=roles]:checked")].flatMap(x=>map[x.value]||[]));boxes.forEach(x=>x.checked=s.has(x.value))});f.onsubmit=async e=>{e.preventDefault();const d=new FormData(f),m=document.querySelector("#msg");m.textContent="送信中…";try{const r=await fetch("/api/subscribe",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email:d.get("email"),roles:d.getAll("roles"),categories:d.getAll("categories"),consent:d.get("consent")==="on"})});const j=await r.json();m.textContent=r.ok?j.message:(j.error||"登録に失敗しました")}catch{m.textContent="通信に失敗しました"}};</script>');
}
async function rateLimit(env,key,limit=5){
 const stamp=new Date(Math.floor(Date.now()/3600000)*3600000).toISOString();
 const row=await env.DB.prepare("SELECT count FROM rate_limits WHERE rate_key=? AND window_start=?").bind(key,stamp).first();
 if((row?.count||0)>=limit)return false;
 await env.DB.prepare("INSERT INTO rate_limits(rate_key,window_start,count) VALUES(?,?,1) ON CONFLICT(rate_key,window_start) DO UPDATE SET count=count+1").bind(key,stamp).run();
 return true;
}
const newToken=()=>crypto.randomUUID()+crypto.randomUUID().replace(/-/g,"");
const isAdmin=(req,env)=>Boolean(env.ADMIN_TOKEN&&env.ADMIN_TOKEN.length>=32&&req.headers.get("authorization")==="Bearer "+env.ADMIN_TOKEN);
const denied=()=>json({error:"管理者認証が必要です。ADMIN_TOKEN（32文字以上）を設定してください。"},401);
const base=env=>{
 const value=String(env.BASE_URL||"").replace(/\/$/,"");
 try{
  const u=new URL(value);
  const originOnly=u.pathname==="/"&&!u.search&&!u.hash&&!u.username&&!u.password;
  if(originOnly&&u.protocol==="https:")return u.origin;
  if(originOnly&&u.protocol==="http:"&&u.hostname==="localhost")return u.origin;
 }catch{}
 throw new Error("BASE_URL must be an HTTPS origin or localhost origin for local development");
};

async function subscribe(req,env){
 let d;try{d=await req.json()}catch{return json({error:"JSON形式で送信してください"},400)}
 const email=String(d.email||"").trim().toLowerCase();
 const roles=[...new Set(Array.isArray(d.roles)?d.roles:[])].filter(x=>ROLES.some(r=>r.id===x));
 const cats=[...new Set(Array.isArray(d.categories)?d.categories:[])].filter(x=>CATEGORIES.some(c=>c.id===x));
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return json({error:"メールアドレスを確認してください"},400);
 if(!cats.length)return json({error:"カテゴリを1つ以上選択してください"},400);
 if(d.consent!==true)return json({error:"配信への同意が必要です"},400);
 if(!env.PRIVACY_URL||!env.PRIVACY_URL.startsWith("https://"))return json({error:"プライバシー方針の公開URLが未設定のため登録を停止しています"},503);
 try{base(env)}catch{return json({error:"BASE_URL が未設定または不正です。公開環境ではHTTPSのWorker URLを設定してください"},503)}
 const ip=req.headers.get("CF-Connecting-IP")||"unknown";
 if(!(await rateLimit(env,"ip:"+ip,10))||!(await rateLimit(env,"email:"+email,3)))return json({error:"操作回数が上限に達しました。時間をおいて再度お試しください"},429);
 const old=await env.DB.prepare("SELECT id,confirmed,unsubscribed FROM subscribers WHERE email=?").bind(email).first();
 if(old?.confirmed&&!old.unsubscribed)return json({message:"このメールアドレスは登録済みです"},200);
 const ct=newToken(),ut=newToken();let id;
 if(old){
  // A new subscription must not inherit stale, unsent articles from a previous subscription.
  await env.DB.prepare("DELETE FROM delivery_queue WHERE subscriber_id=? AND status!='sent'").bind(old.id).run();
  await env.DB.prepare("UPDATE subscribers SET confirmation_token=?,unsubscribe_token=?,confirmed=0,unsubscribed=0,confirmed_at=NULL,consent_at=CURRENT_TIMESTAMP,consent_version=? WHERE id=?").bind(ct,ut,env.PRIVACY_VERSION||"draft-1",old.id).run();id=old.id
 }
 else{const r=await env.DB.prepare("INSERT INTO subscribers(email,confirmation_token,unsubscribe_token,consent_at,consent_version) VALUES(?,?,?,?,?)").bind(email,ct,ut,new Date().toISOString(),env.PRIVACY_VERSION||"draft-1").run();id=r.meta.last_row_id}
 await env.DB.prepare("DELETE FROM subscriber_roles WHERE subscriber_id=?").bind(id).run();
 await env.DB.prepare("DELETE FROM subscriber_categories WHERE subscriber_id=?").bind(id).run();
 for(const x of roles)await env.DB.prepare("INSERT OR IGNORE INTO subscriber_roles(subscriber_id,role_id) VALUES(?,?)").bind(id,x).run();
 for(const x of cats)await env.DB.prepare("INSERT OR IGNORE INTO subscriber_categories(subscriber_id,category_id) VALUES(?,?)").bind(id,x).run();
 const link=base(env)+"/confirm?token="+encodeURIComponent(ct);
 try{await sendEmail(env,{to:email,subject:"【ルール変更レター】メールアドレスの確認",text:"登録確認リンクを開いてください。\n"+link,html:'<p>登録確認リンクを開いてください。</p><p><a href="'+escapeHtml(link)+'">メールアドレスを確認する</a></p>'})}
 catch(e){console.error("confirmation mail failed",String(e.message||e));return json({error:"確認メールを送信できませんでした"},502)}
 return json({message:"確認メールを送信しました。リンク先で登録を完了してください"},202);
}
async function confirm(req,url,env){
 let t=url.searchParams.get("token")||"";
 if(req.method==="POST"){try{t=String((await req.formData()).get("token")||"")}catch{}}
 if(!t||t.length>100)return page("確認できません","<h1>確認リンクが無効です</h1>",400);
 if(req.method==="GET")return page("登録確認",'<h1>メールアドレスの確認</h1><form method="post" action="/confirm"><input type="hidden" name="token" value="'+escapeHtml(t)+'"><button>登録を完了する</button></form>');
 const r=await env.DB.prepare("UPDATE subscribers SET confirmed=1,confirmed_at=CURRENT_TIMESTAMP WHERE confirmation_token=? AND unsubscribed=0").bind(t).run();
 return r.meta.changes?page("登録完了","<h1>登録が完了しました</h1>"):page("確認できません","<h1>リンクが無効です</h1>",400);
}
async function unsubscribe(req,url,env){
 let t=url.searchParams.get("token")||"";
 if(req.method==="POST"){try{t=String((await req.formData()).get("token")||"")}catch{}}
 if(!t||t.length>100)return page("配信停止","<h1>リンクが無効です</h1>",400);
 if(req.method==="GET")return page("配信停止",'<h1>配信停止の確認</h1><form method="post" action="/unsubscribe"><input type="hidden" name="token" value="'+escapeHtml(t)+'"><button>配信を停止する</button></form>');
 const subscriber=await env.DB.prepare("SELECT id FROM subscribers WHERE unsubscribe_token=?").bind(t).first();
 if(!subscriber)return page("配信停止","<h1>リンクが無効です</h1>",404);
 await env.DB.prepare("UPDATE subscribers SET unsubscribed=1,confirmed=0 WHERE id=?").bind(subscriber.id).run();
 await env.DB.prepare("DELETE FROM delivery_queue WHERE subscriber_id=? AND status='pending'").bind(subscriber.id).run();
 return page("配信停止","<h1>配信を停止しました</h1>");
}
async function collectAllSources(env){
 const sources=[["digital_rss",()=>collectDigitalRss(env)],["egov_law_api",()=>collectEgovLawUpdates(env)]];
 const results={};
 for(const [id,run] of sources){
  try{results[id]=await run()}
  catch(e){const message=String(e.message||e).slice(0,500);await env.DB.prepare("UPDATE sources SET last_error=? WHERE id=?").bind(message,id).run();results[id]={error:message}}
 }
 return results;
}
async function resumeEgovScanIfNeeded(env){
 const source=await env.DB.prepare("SELECT scan_offset,terms_checked FROM sources WHERE id='egov_law_api' AND enabled=1").first();
 if(!source||!source.terms_checked||!Number(source.scan_offset||0))return {skipped:true};
 try{return await collectEgovLawUpdates(env)}
 catch(e){
  const message=String(e.message||e).slice(0,500);
  await env.DB.prepare("UPDATE sources SET last_error=? WHERE id='egov_law_api'").bind(message).run();
  console.error("e-Gov continuation failed",e);
  return {error:message};
 }
}
async function collect(req,env){
 if(!isAdmin(req,env))return denied();
 const results=await collectAllSources(env);
 const failed=Object.values(results).some(x=>x&&x.error);
 return json(results,failed?502:200);
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

export async function enqueueWeekly(env,runId=newToken(),limit=50){
 let run=await env.DB.prepare("SELECT run_id,enqueue_complete,last_subscriber_id,article_snapshot FROM delivery_runs WHERE run_id=?").bind(runId).first();
 if(!run){
  const snapshot=await env.DB.prepare("SELECT id,category_ids FROM articles WHERE status='approved' ORDER BY id LIMIT 500").all();
  const articleSnapshot=JSON.stringify(snapshot.results||[]);
  await env.DB.prepare("INSERT INTO delivery_runs(run_id,status,queued_count,skipped_count,enqueue_complete,last_subscriber_id,article_snapshot) VALUES(?,'queued',0,0,0,0,?)").bind(runId,articleSnapshot).run();
  run={run_id:runId,enqueue_complete:0,last_subscriber_id:0,article_snapshot:articleSnapshot};
 }
 if(run.enqueue_complete)return {runId,alreadyQueued:true,enqueueComplete:true};
 let articles=[];try{articles=JSON.parse(run.article_snapshot||"[]")}catch{}
 const people=await env.DB.prepare("SELECT id,confirmed,unsubscribed FROM subscribers WHERE id>? ORDER BY id LIMIT ?").bind(run.last_subscriber_id||0,limit).all();
 let lastId=run.last_subscriber_id||0;
 for(const person of people.results||[]){
  lastId=person.id;
  if(person.confirmed===1&&person.unsubscribed===0){
   const cats=await env.DB.prepare("SELECT category_id FROM subscriber_categories WHERE subscriber_id=?").bind(person.id).all();
   const chosen=new Set((cats.results||[]).map(x=>x.category_id));
   const history=await env.DB.prepare("SELECT article_id FROM sent WHERE subscriber_id=?").bind(person.id).all();
   const sentIds=new Set((history.results||[]).map(x=>x.article_id));
   const ids=articles.filter(article=>{
    let categories=[];try{categories=JSON.parse(article.category_ids||"[]")}catch{}
    return categories.some(id=>chosen.has(id))&&!sentIds.has(article.id);
   }).map(article=>article.id);
   if(ids.length){
    await env.DB.prepare("INSERT OR IGNORE INTO delivery_queue(run_id,subscriber_id,article_ids,status) VALUES(?,?,?,'pending')").bind(runId,person.id,JSON.stringify(ids)).run();
   }
  }
  await env.DB.prepare("UPDATE delivery_runs SET last_subscriber_id=? WHERE run_id=?").bind(lastId,runId).run();
 }
 const more=await env.DB.prepare("SELECT id FROM subscribers WHERE id>? ORDER BY id LIMIT 1").bind(lastId).first();
 if(!more){
  const count=await env.DB.prepare("SELECT COUNT(*) AS n FROM delivery_queue WHERE run_id=?").bind(runId).first();
  const eligible=await env.DB.prepare("SELECT COUNT(*) AS n FROM subscribers WHERE confirmed=1 AND unsubscribed=0").first();
  const queued=Number(count?.n||0),total=Number(eligible?.n||0);
  await env.DB.prepare("UPDATE delivery_runs SET enqueue_complete=1,queued_count=?,skipped_count=?,updated_at=CURRENT_TIMESTAMP WHERE run_id=?").bind(queued,Math.max(0,total-queued),runId).run();
  return {runId,queued,skipped:Math.max(0,total-queued),enqueueComplete:true};
 }
 const count=await env.DB.prepare("SELECT COUNT(*) AS n FROM delivery_queue WHERE run_id=?").bind(runId).first();
 return {runId,queuedSoFar:Number(count?.n||0),lastSubscriberId:lastId,enqueueComplete:false};
}
async function continueEnqueues(env){
 const runs=await env.DB.prepare("SELECT run_id FROM delivery_runs WHERE enqueue_complete=0 ORDER BY id LIMIT 1").all();
 const results=[];
 for(const run of runs.results||[])results.push(await enqueueWeekly(env,run.run_id,50));
 return results;
}
async function drainQueue(env,limit=20){
 const lease=newToken();
 const lock=await env.DB.prepare("UPDATE system_locks SET lock_token=?,lock_until=datetime('now','+8 minutes') WHERE lock_name='delivery' AND (lock_until IS NULL OR lock_until<CURRENT_TIMESTAMP)").bind(lease).run();
 if(!lock.meta.changes)return {busy:true,sent:0,errors:0};
 let sent=0,errors=0;
 try{
  await env.DB.prepare("UPDATE delivery_queue SET status=CASE WHEN attempts>=5 THEN 'failed' ELSE 'pending' END,next_attempt_at=CURRENT_TIMESTAMP WHERE status='sending'").run();
  const rows=await env.DB.prepare("SELECT q.id,q.subscriber_id,q.article_ids,s.email,s.unsubscribe_token FROM delivery_queue q JOIN subscribers s ON s.id=q.subscriber_id WHERE q.status='pending' AND q.attempts<5 AND (q.next_attempt_at IS NULL OR q.next_attempt_at<=CURRENT_TIMESTAMP) AND s.confirmed=1 AND s.unsubscribed=0 ORDER BY q.id LIMIT ?").bind(limit).all();
  for(const p of rows.results||[]){
   await env.DB.prepare("UPDATE delivery_queue SET status='sending',attempts=attempts+1 WHERE id=? AND status='pending'").bind(p.id).run();
   try{
    const ids=JSON.parse(p.article_ids),marks=ids.map(()=>"?").join(",");
    const articles=await env.DB.prepare("SELECT a.id,a.summary,a.what_changed,a.effective_date,a.who_affected,a.action_needed,u.title,u.url FROM articles a JOIN updates u ON u.id=a.update_id WHERE a.status='approved' AND a.id IN ("+marks+")").bind(...ids).all();
    if(!articles.results?.length)throw Error("approved-articles-not-found");
    const unsub=base(env)+"/unsubscribe?token="+encodeURIComponent(p.unsubscribe_token);
    const html=articles.results.map(x=>"<article><h2>"+escapeHtml(x.title)+"</h2><p>"+escapeHtml(x.summary)+"</p><p><b>変更点：</b>"+escapeHtml(x.what_changed)+"</p><p><b>施行日：</b>"+escapeHtml(x.effective_date||"原文で確認してください")+"</p><p><b>対象者：</b>"+escapeHtml(x.who_affected)+"</p><p><b>対応：</b>"+escapeHtml(x.action_needed)+"</p><p><a href=\""+escapeHtml(x.url)+"\">公式情報</a></p></article><hr>").join("");
    await sendEmail(env,{to:p.email,subject:"【ルール変更レター】今週のルール変更情報",html:"<h1>今週のルール変更情報</h1>"+html+'<p><a href="'+escapeHtml(unsub)+'">配信停止</a></p>',text:articles.results.map(x=>x.title+"\n"+x.summary+"\n"+x.url).join("\n\n---\n\n")+"\n配信停止: "+unsub});
    for(const x of articles.results)await env.DB.prepare("INSERT OR IGNORE INTO sent(subscriber_id,article_id) VALUES(?,?)").bind(p.subscriber_id,x.id).run();
    await env.DB.prepare("UPDATE delivery_queue SET status='sent',sent_at=CURRENT_TIMESTAMP,last_error=NULL WHERE id=?").bind(p.id).run();sent++;
   }catch(e){errors++;await env.DB.prepare("UPDATE delivery_queue SET status=CASE WHEN attempts>=5 THEN 'failed' ELSE 'pending' END,next_attempt_at=datetime('now','+' || MIN(60,5*attempts) || ' minutes'),last_error=? WHERE id=?").bind(String(e.message||e).slice(0,500),p.id).run();}
  }
  await env.DB.prepare("UPDATE delivery_runs SET status=CASE WHEN enqueue_complete=0 OR EXISTS(SELECT 1 FROM delivery_queue q WHERE q.run_id=delivery_runs.run_id AND q.status IN ('pending','sending')) THEN 'queued' WHEN EXISTS(SELECT 1 FROM delivery_queue q WHERE q.run_id=delivery_runs.run_id AND q.status='failed') THEN 'partial_failure' ELSE 'completed' END,updated_at=CURRENT_TIMESTAMP WHERE status='queued'").run();
  return {sent,errors,processed:rows.results?.length||0};
 }finally{await env.DB.prepare("UPDATE system_locks SET lock_token=NULL,lock_until=NULL WHERE lock_name='delivery' AND lock_token=?").bind(lease).run()}
}
async function sendNow(req,env){
 if(!isAdmin(req,env))return denied();
 const incomplete=await env.DB.prepare("SELECT run_id FROM delivery_runs WHERE enqueue_complete=0 ORDER BY id LIMIT 1").first();
 const pending=await env.DB.prepare("SELECT id FROM delivery_queue WHERE status IN ('pending','sending') LIMIT 1").first();
 const run=incomplete?await enqueueWeekly(env,incomplete.run_id,50):pending?{alreadyQueued:true,note:"既存キューを処理します"}:await enqueueWeekly(env);
 const drain=await drainQueue(env,20);
 return json({run,drain});
}

export default {
 async fetch(req,env){
  const u=new URL(req.url);
  if(req.method==="GET"&&u.pathname==="/")return landing(env);
  if(req.method==="GET"&&u.pathname==="/health")return json({ok:true,service:"rule-change-letter",time:new Date().toISOString()});
  if(req.method==="GET"&&u.pathname==="/api/categories")return json({roles:ROLES,categories:CATEGORIES,recommendations:Object.fromEntries(ROLES.map(r=>[r.id,recommendCategories([r.id])]))});
  if(req.method==="POST"&&u.pathname==="/api/subscribe")return subscribe(req,env);
  if((req.method==="GET"||req.method==="POST")&&u.pathname==="/confirm")return confirm(req,u,env);
  if((req.method==="GET"||req.method==="POST")&&u.pathname==="/unsubscribe")return unsubscribe(req,u,env);
  if(req.method==="POST"&&u.pathname==="/api/admin/collect")return collect(req,env);
  if(req.method==="GET"&&u.pathname==="/api/admin/updates")return listUpdates(req,env);
  if(req.method==="POST"&&u.pathname==="/api/admin/approve")return approve(req,env);
  if(req.method==="POST"&&u.pathname==="/api/admin/send")return sendNow(req,env);
  return page("Not Found","<h1>404</h1><p>ページが見つかりません。</p>",404);
 },
 async scheduled(event,env,ctx){
  ctx.waitUntil((async()=>{
   if(event.cron==="0 22 * * *"){try{await env.DB.prepare("DELETE FROM rate_limits WHERE julianday(window_start)<julianday('now','-48 hours')").run();await collectAllSources(env)}catch(e){console.error(e)}}
   else if(event.cron==="0 23 * * SUN"){try{await enqueueWeekly(env,"weekly-"+new Date().toISOString().slice(0,10))}catch(e){console.error(e)}}
   else if(event.cron==="*/10 * * * *"){try{await resumeEgovScanIfNeeded(env);await continueEnqueues(env);await drainQueue(env,20)}catch(e){console.error(e)}}
  })());
 }
};
