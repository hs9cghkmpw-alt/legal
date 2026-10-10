import {ROLES,CATEGORIES,recommendCategories} from "./categories.js";
import {collectDigitalRss} from "./sources.js";
import {collectEgovLawUpdates} from "./egov.js";
import {sourceAttribution} from "./attribution.js";
import {sendEmail,escapeHtml} from "./email.js";

const securityHeaders={"X-Content-Type-Options":"nosniff","X-Frame-Options":"DENY","Referrer-Policy":"no-referrer","Permissions-Policy":"camera=(), microphone=(), geolocation=()","Content-Security-Policy":"default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'"};
const json=(v,status=200)=>new Response(JSON.stringify(v,null,2),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...securityHeaders}});
const page=(title,body,status=200)=>new Response('<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+escapeHtml(title)+'</title><style>body{font:16px/1.65 system-ui;max-width:760px;margin:30px auto;padding:0 18px}fieldset{margin:16px 0;padding:14px;border:1px solid #aaa;border-radius:10px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px}label{display:block;padding:5px}small{display:block;color:#666}input[type=email]{padding:10px;width:min(95%,400px)}button{padding:10px 18px;background:#2563eb;color:white;border:0;border-radius:8px}</style><body>'+body+'</body></html>',{status,headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store",...securityHeaders}});
function privacyPolicyUrl(env){
 try{
  const u=new URL(String(env.PRIVACY_URL||""));
  if(u.protocol==="https:"&&u.hostname&&!u.username&&!u.password)return u.href;
 }catch{}
 return "";
}
function landing(env){
 const roles=ROLES.map(r=>'<label class="role"><input type="checkbox" name="roles" value="'+r.id+'"> '+escapeHtml(r.label)+'</label>').join("");
 const cats=CATEGORIES.map(x=>'<label class="category"><input type="checkbox" name="categories" value="'+x.id+'"><span><b>'+escapeHtml(x.label)+'</b><small>'+escapeHtml(x.description)+'</small></span></label>').join("");
 const map=JSON.stringify(Object.fromEntries(ROLES.map(r=>[r.id,recommendCategories([r.id])])));
 const privacyUrl=privacyPolicyUrl(env), privacy=privacyUrl?'<a href="'+escapeHtml(privacyUrl)+'" target="_blank" rel="noopener noreferrer">プライバシー方針</a>':'<strong>プライバシー方針は公開準備中です</strong>', signupEnabled=Boolean(privacyUrl&&String(env.SIGNUP_ENABLED||"").toLowerCase()==="true"), disabled=signupEnabled?"":" disabled";
 const presets=[
  {label:"暮らしのこと",hint:"契約・交通・年金など",cats:["consumer","daily_life","social_insurance"],mark:"暮"},
  {label:"働くこと",hint:"労働・社会保険・税金",cats:["labor","social_insurance","tax"],mark:"働"},
  {label:"事業・フリーランス",hint:"取引・税金・雇用など",cats:["business","tax","labor","digital_privacy"],mark:"事"},
  {label:"デジタルのこと",hint:"個人情報・電子手続きなど",cats:["digital_privacy","consumer","daily_life"],mark:"情"}
 ];
 const presetHtml=presets.map(p=>'<button type="button" class="preset" data-categories="'+p.cats.join(",")+'" aria-pressed="false"><i>'+p.mark+'</i><span><b>'+p.label+'</b><small>'+p.hint+'</small></span></button>').join("");
 const privacyNotice=signupEnabled?"確認メールのリンクを開くと登録完了です。該当する変更情報がない週はメールを送りません。":"現在は公開準備中です。必要な準備が完了するまで登録を受け付けません。";
 return page("ルール便｜暮らし・仕事・事業のルール変更を、必要な分だけ",`<style>
:root{--ink:#1b302c;--muted:#5c6c66;--green:#245d4f;--pale:#edf3e5;--line:#dce4d9;--paper:#fbfaf6}*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:24px}body{margin:0!important;padding:0!important;max-width:none!important;background:var(--paper);color:var(--ink);font:16px/1.7 -apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",sans-serif}a{color:var(--green)}.site{overflow:hidden}.wrap{width:min(1060px,calc(100% - 40px));margin:auto}.top{display:flex;align-items:center;justify-content:space-between;padding:20px 0}.brand{display:flex;gap:10px;align-items:center;color:var(--ink);text-decoration:none;font-size:1.25rem;font-weight:900;letter-spacing:-.04em}.mark{display:grid;place-items:center;width:38px;height:38px;border-radius:12px;background:var(--green);color:white}.navnote{font-size:.85rem;color:var(--muted)}.hero{padding:54px 0 70px;background:radial-gradient(ellipse at 90% 15%,#e6ecd8,transparent 38%),var(--paper)}.hero-grid{display:grid;grid-template-columns:1.1fr .9fr;align-items:center;gap:48px}.eyebrow{display:inline-block;padding:5px 12px;border-radius:30px;background:#edf3e5;border:1px solid #d1ddc9;color:var(--green);font-size:.82rem;font-weight:800}.hero h1{font-size:clamp(2.3rem,5vw,4rem);line-height:1.23;letter-spacing:-.055em;margin:20px 0}.hero h1 em{font-style:normal;color:var(--green);text-decoration:underline;text-decoration-color:#d9e8b8;text-decoration-thickness:9px;text-underline-offset:2px}.lead{font-size:1.05rem;line-height:1.9;color:#4b5e57;max-width:590px;margin-bottom:26px}.cta{display:inline-flex;gap:14px;align-items:center;padding:14px 20px;border-radius:12px;background:var(--green);color:#fff;text-decoration:none;font-weight:850;box-shadow:0 5px 0 #d7e0d3}.micro{font-size:.82rem;color:var(--muted);margin-left:12px}.preview{padding:22px;background:white;border:1px solid var(--line);border-radius:20px;box-shadow:0 22px 60px #234c3515;transform:rotate(1deg)}.preview-top{display:flex;justify-content:space-between;align-items:center;padding-bottom:13px;border-bottom:1px solid #edf0e9;font-weight:850}.pill{font-size:.7rem;padding:4px 7px;border-radius:6px;background:var(--pale);color:var(--green)}.preview small{color:var(--muted)}.preview h2{font-size:1.15rem;line-height:1.5;margin:14px 0 8px}.preview p{font-size:.88rem;color:var(--muted)}.preview-row{display:flex;gap:12px;padding:12px 0;border-top:1px solid #edf0e9}.num{display:grid;place-items:center;flex:0 0 31px;height:31px;border-radius:9px;background:var(--pale);color:var(--green);font-weight:900}.preview-row b{display:block;font-size:.88rem}.preview-row small{display:block;font-size:.78rem}.preview-foot{background:#f7f8f2;padding:9px 11px;border-radius:8px;font-size:.74rem;color:var(--muted)}.trust{background:white;border-block:1px solid var(--line)}.trust-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;padding:21px 0}.trust-item{display:flex;align-items:center;gap:11px;font-size:.88rem;font-weight:750}.check{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;background:var(--pale);color:var(--green);font-weight:900}.section{padding:72px 0}.heading{text-align:center;max-width:680px;margin:0 auto 34px}.kicker{font-size:.77rem;letter-spacing:.12em;font-weight:900;color:var(--green)}.heading h2{font-size:clamp(1.8rem,3.5vw,2.6rem);line-height:1.35;letter-spacing:-.04em;margin:10px 0}.heading p{color:var(--muted);margin:0}.cards,.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.card{padding:24px;background:#fff;border:1px solid var(--line);border-radius:16px}.card-icon{display:grid;place-items:center;width:44px;height:44px;border-radius:13px;background:var(--pale);color:var(--green);font-weight:900}.card h3{font-size:1.05rem;margin:15px 0 8px}.card p,.step p{font-size:.9rem;color:var(--muted);margin:0}.steps-bg{background:#f0f2e9}.step{padding:22px;background:#fff;border:1px solid var(--line);border-radius:14px}.step b{font-size:.76rem;letter-spacing:.1em;color:var(--green)}.step h3{margin:9px 0;font-size:1rem}.honesty{display:grid;grid-template-columns:.8fr 1.2fr;gap:28px;padding:27px 30px;border-radius:18px;background:#e8efdd}.honesty h2{font-size:1.5rem;line-height:1.4;margin:0}.honesty p{margin:0;font-size:.9rem;color:#43564d}.signup{padding:74px 0;background:white}.signup-grid{display:grid;grid-template-columns:.72fr 1.28fr;gap:42px;align-items:start}.signup-intro{position:sticky;top:20px}.signup-intro h2{font-size:2.15rem;line-height:1.3;letter-spacing:-.04em;margin:12px 0}.signup-intro p{color:var(--muted)}.signup-intro ul{list-style:none;padding:0;font-size:.9rem;color:#40564d}.signup-intro li{margin:9px 0}.signup-intro li:before{content:"✓";color:var(--green);font-weight:900;margin-right:9px}.form-card{padding:clamp(18px,4vw,30px);border:1px solid var(--line);border-radius:20px;box-shadow:0 18px 45px #234c3510}.form-card fieldset{margin:0 0 23px;padding:0;border:0}.form-card legend{font-weight:850;font-size:1.02rem;margin-bottom:5px}.help{font-size:.83rem;color:var(--muted);margin:0 0 13px}.presets{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.preset{display:flex;align-items:center;gap:10px;min-height:76px;padding:11px;border:1px solid #d5ddd2;border-radius:12px;background:white;color:var(--ink);text-align:left;cursor:pointer;font:inherit}.preset[aria-pressed="true"]{border:2px solid var(--green);background:#f0f5e9;padding:10px}.preset i{display:grid;place-items:center;flex:0 0 35px;height:35px;border-radius:10px;background:var(--pale);color:var(--green);font-style:normal;font-weight:900}.preset b{display:block;font-size:.88rem}.preset small{display:block;color:var(--muted);font-size:.76rem}.selection{min-height:1.5em;color:var(--green);font-size:.82rem;margin:10px 0 0}.form-card details{padding:12px 0;border-top:1px solid #e7ebe4}.form-card summary{cursor:pointer;font-size:.89rem;font-weight:750}.category{display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-bottom:1px solid #eef0ea}.category input,.role input,.consent input{margin-top:6px;accent-color:var(--green)}.category b{font-size:.88rem}.category small{display:block;font-size:.78rem;color:var(--muted)}.roles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px}.role{font-size:.85rem;padding:7px 2px}.form-card input[type=email]{width:100%;border:1px solid #cbd5cb;border-radius:10px;padding:13px;font:inherit;background:white}.consent{display:flex;gap:10px;align-items:flex-start;font-size:.85rem}.notice{padding:12px 14px;background:#f3f5ef;border-radius:9px;color:#4b5c53;font-size:.82rem}.submit{width:100%;border:0;border-radius:11px;padding:15px;background:var(--green);color:white;font:inherit;font-weight:850;cursor:pointer}.submit:disabled{opacity:.45;cursor:not-allowed}.msg{color:var(--green);font-size:.9rem;overflow-wrap:anywhere}.muted{color:var(--muted);font-size:.82rem}.footer{padding:30px 0;background:#1c3932;color:#eaf0e8}.footer-grid{display:flex;justify-content:space-between;align-items:flex-start;gap:24px}.footer .brand{color:white}.footer p{max-width:650px;margin:0;color:#d1ded5;font-size:.78rem}
button:focus-visible,a:focus-visible,input:focus-visible,summary:focus-visible{outline:3px solid #a8c879;outline-offset:3px}
@media(max-width:760px){.wrap{width:calc(100% - 32px)}.top{padding:15px 0}.navnote{font-size:.74rem;max-width:150px;text-align:right}.hero{padding:34px 0 45px}.hero-grid{grid-template-columns:1fr;gap:28px}.hero h1{font-size:clamp(2.2rem,9.5vw,3.2rem)}.preview{max-width:470px;width:100%;margin:auto;transform:none}.trust-grid{grid-template-columns:1fr;gap:12px;padding:17px 0}.section,.signup{padding:54px 0}.cards,.steps{grid-template-columns:1fr}.card{padding:21px}.honesty{grid-template-columns:1fr;gap:12px;padding:23px}.signup-grid{grid-template-columns:1fr;gap:22px}.signup-intro{position:static}.signup-intro h2{font-size:1.9rem}.footer-grid{flex-direction:column}.cta{display:flex;width:100%;justify-content:center}.micro{display:block;margin:12px 0 0;text-align:center}}
@media(max-width:390px){.presets{grid-template-columns:1fr}.hero h1{font-size:2.15rem}.form-card{padding:16px}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
</style><div class="site"><header class="wrap top"><a class="brand" href="/" aria-label="ルール便 トップ"><span class="mark">ル</span>ルール便</a><span class="navnote">暮らし・仕事・事業のルール更新</span></header><main><section class="hero"><div class="wrap hero-grid"><div><span class="eyebrow">知っておきたい変化を、見逃さない</span><h1>法律や制度の変化を、<em>あなたに関係ある分だけ。</em></h1><p class="lead">暮らし、仕事、事業に関わるルール変更を、公式情報をもとに整理してメールでお届け。全部を追いかけなくても、自分に必要な情報から確認できます。</p><a class="cta" href="#signup">受け取りたい情報を選ぶ <span aria-hidden="true">→</span></a><span class="micro">登録無料・メールでお届け</span></div><aside class="preview" aria-label="メールレターのイメージ"><div class="preview-top"><span class="brand"><span class="mark" style="width:28px;height:28px;border-radius:9px;font-size:.8rem">ル</span>ルール便</span><span class="pill">配信イメージ</span></div><small>RULE LETTER / お届け内容の例</small><h2>自分に関係する変更を、ひと目で。</h2><p>実際の配信では、公式情報へのリンクと、変更内容・対象者・確認したいことを整理してお届けします。</p><div class="preview-row"><span class="num">01</span><div><b>何が変わる？</b><small>変更点を短く整理</small></div></div><div class="preview-row"><span class="num">02</span><div><b>誰に関係する？</b><small>対象になる人や事業者</small></div></div><div class="preview-row"><span class="num">03</span><div><b>何を確認する？</b><small>施行日・条件・公式情報</small></div></div><div class="preview-foot">※配信形式のイメージです。実際の改正情報ではありません。</div></aside></div></section><section class="trust"><div class="wrap trust-grid"><div class="trust-item"><span class="check">✓</span>選んだ分野に絞ってお届け</div><div class="trust-item"><span class="check">↗</span>公式情報のリンクを確認できる</div><div class="trust-item"><span class="check">−</span>該当情報がない週は配信しない</div></div></section><section class="section"><div class="wrap"><div class="heading"><span class="kicker">WHY IT HELPS</span><h2>ルールを全部追うのは、大変だから。</h2><p>大事な変更を見つける負担を減らし、必要なときに公式情報へたどり着ける入口をつくります。</p></div><div class="cards"><article class="card"><span class="card-icon">01</span><h3>自分に関係する情報から</h3><p>暮らし・働き方・事業など、受け取りたい分野を登録前に選べます。詳細設定で分野を追加・解除できます。</p></article><article class="card"><span class="card-icon">02</span><h3>変更点を整理して把握</h3><p>何が変わったか、誰に関係するか、いつからか。原文を確認するための要点をつかみやすくします。</p></article><article class="card"><span class="card-icon">03</span><h3>必要なときだけメールで</h3><p>週1回を基本に、選んだ分野に該当する情報がある場合にお届け。配信停止はいつでもできます。</p></article></div></div></section><section class="section steps-bg"><div class="wrap"><div class="heading"><span class="kicker">HOW IT WORKS</span><h2>始め方は、3ステップ。</h2><p>立場の登録は必須ではありません。受け取りたい分野を選ぶだけで始められます。</p></div><div class="steps"><article class="step"><b>STEP 01</b><h3>分野を選ぶ</h3><p>おすすめセットから選択。カテゴリは自分で調整できます。</p></article><article class="step"><b>STEP 02</b><h3>メールを確認する</h3><p>メールアドレスを入力し、届いた確認メールのリンクを開きます。</p></article><article class="step"><b>STEP 03</b><h3>必要な情報を受け取る</h3><p>選んだ分野に該当する情報がある週にお届けします。</p></article></div></div></section><section class="section"><div class="wrap honesty"><h2>大切なことも、先にお伝えします。</h2><p>ルール便は行政機関ではなく、個別の法律相談を行うサービスでもありません。情報を整理して公式情報へ案内するサービスです。法令や制度は個別事情で適用が異なる場合があるため、重要な判断の前には必ずリンク先の原文や担当窓口をご確認ください。配信対象の網羅性を保証するものではありません。期限管理や法律・税務などの専門家への相談の代わりにはなりません。情報源の利用条件と原文確認の運用が整うまで、実際の配信は開始しません。</p></div></section><section class="signup" id="signup"><div class="wrap signup-grid"><div class="signup-intro"><span class="kicker">GET STARTED</span><h2>あなたに必要なルールから、受け取ろう。</h2><p>まずは近いテーマを選んでください。登録前に分野を追加・解除できます。</p><ul><li>登録確認メールを送信</li><li>該当情報がない週は配信なし</li><li>いつでも配信停止・登録情報削除が可能</li></ul><p class="muted">${signupEnabled ? "プライバシー方針を確認のうえ登録できます。" : "現在は公開準備中です。必要な準備が完了するまで登録を受け付けません。"}</p></div><div class="form-card"><form id="f"><fieldset><legend>1. 受け取りたい情報を選ぶ</legend><p class="help">セットを選ぶと配信分野が入れ替わります。複数分野にしたい場合は、下の詳細設定で調整できます。</p><div class="presets">${presetHtml}</div><p id="selection" class="selection" aria-live="polite">まだ分野が選ばれていません。</p><details><summary>分野を細かく調整する</summary><p class="help">選択した分野だけが配信対象です。</p><div>${cats}</div><p><button type="button" id="clear" class="submit" style="background:#65766d;padding:9px 12px;font-size:.85rem">分野の選択をクリア</button></p></details><details><summary>立場からおすすめを選ぶ（任意）</summary><p class="help">立場はおすすめの提案にだけ使います。立場そのものでは配信対象を決めません。</p><div class="roles">${roles}</div></details></fieldset><fieldset><legend>2. メールアドレス</legend><p class="help">確認メールを受け取れるアドレスを入力してください。</p><input type="email" name="email" required maxlength="254" autocomplete="email" placeholder="you@example.com"></fieldset><fieldset><legend>3. 配信への同意</legend><label class="consent"><input type="checkbox" name="consent" required${disabled}><span >${privacy} を確認し、選択した分野のメール配信に同意します。</span></label></fieldset><p class="notice" role="status" >${privacyNotice}</p><button class="submit" id="submit"${disabled}>確認メールを送る</button><p id="msg" class="msg" role="status" aria-live="polite"></p></form></div></div></section></main><footer class="footer"><div class="wrap footer-grid"><a class="brand" href="/"><span class="mark">ル</span>ルール便</a><p>情報提供サービスであり、行政機関による公式見解や法律相談の代替ではありません。重要な判断は、各記事の公式情報をご確認ください。<br>名称「ルール便」はMVP上の仮称です。商標・ドメイン等の確認は未実施です。</p></div></footer></div><script>const map=${map};const f=document.querySelector("#f"),boxes=[...document.querySelectorAll("[name=categories]")],roleBoxes=[...document.querySelectorAll("[name=roles]")],selection=document.querySelector("#selection"),presetButtons=[...document.querySelectorAll("[data-categories]")];let categoriesTouched=false;function update(){const selected=boxes.filter(x=>x.checked).map(x=>x.value);selection.textContent=selected.length?"選択中："+selected.map(id=>boxes.find(x=>x.value===id).parentElement.querySelector("b").textContent).join("、"):"まだ分野が選ばれていません。";presetButtons.forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.categories.split(",").every(id=>selected.includes(id))&&selected.length===b.dataset.categories.split(",").length)));}function setCategories(ids){const chosen=new Set(ids);boxes.forEach(x=>x.checked=chosen.has(x.value));update()}presetButtons.forEach(b=>b.addEventListener("click",()=>{categoriesTouched=true;setCategories(b.dataset.categories.split(","))}));boxes.forEach(b=>b.addEventListener("change",()=>{categoriesTouched=true;update()}));document.querySelector("#clear").addEventListener("click",()=>{categoriesTouched=true;setCategories([])});roleBoxes.forEach(b=>b.addEventListener("change",()=>{if(categoriesTouched)return;const chosen=new Set(roleBoxes.filter(x=>x.checked).flatMap(x=>map[x.value]||[]));setCategories([...chosen])}));f.addEventListener("submit",async e=>{e.preventDefault();const d=new FormData(f),m=document.querySelector("#msg");if(!boxes.some(x=>x.checked)){m.textContent="受け取りたい分野を1つ以上選んでください。";return}m.textContent="確認メールを送信中…";document.querySelector("#submit").disabled=true;try{const r=await fetch("/api/subscribe",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email:d.get("email"),roles:d.getAll("roles"),categories:d.getAll("categories"),consent:d.get("consent")==="on"})});const j=await r.json();m.textContent=r.ok?j.message:(j.error||"登録に失敗しました");if(!r.ok)document.querySelector("#submit").disabled=false}catch{m.textContent="通信に失敗しました。時間をおいて再度お試しください。";document.querySelector("#submit").disabled=false}});update();</script></div>`);
}
export async function rateLimit(env,key,limit=5){
 const stamp=new Date(Math.floor(Date.now()/3600000)*3600000).toISOString();
 // Enforce the limit in one atomic statement; SELECT-then-UPDATE can overshoot under concurrency.
 const result=await env.DB.prepare("INSERT INTO rate_limits(rate_key,window_start,count) VALUES(?,?,1) ON CONFLICT(rate_key,window_start) DO UPDATE SET count=count+1 WHERE rate_limits.count < ?").bind(key,stamp,limit).run();
 return Number(result.meta?.changes)===1;
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
 if(!privacyPolicyUrl(env))return json({error:"有効なHTTPSのプライバシー方針URLが未設定のため登録を停止しています"},503);
 if(String(env.SIGNUP_ENABLED||"").toLowerCase()!=="true")return json({error:"公開準備が完了していないため登録を停止しています"},503);
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
 const policyUrl=privacyPolicyUrl(env);
 const confirmationText=["ルール便への登録申請を受け付けました。","このメールはメールアドレスの確認のために送信しています。確認リンクを開くまで登録・配信は開始されません。","登録した覚えがない場合は、このメールを無視してください。確認しなければ登録されません。","確認リンク：\n"+link,"配信は、選択した分野に該当する情報がある週に週1回を基本とします。","メールが見つからない場合は、迷惑メールフォルダと入力したアドレスをご確認ください。確認リンクを開くまで登録は完了しません。","プライバシー方針：\n"+policyUrl].join("\n\n");
 const confirmationHtml='<h1>ルール便</h1><p>登録申請を受け付けました。</p><p>このメールはメールアドレスの確認のために送信しています。確認リンクを開くまで登録・配信は開始されません。</p><p>登録した覚えがない場合は、このメールを無視してください。確認しなければ登録されません。</p><p><a href="'+escapeHtml(link)+'">メールアドレスを確認する</a></p><p>配信は、選択した分野に該当する情報がある週に週1回を基本とします。</p><p><a href="'+escapeHtml(policyUrl)+'">プライバシー方針</a></p>';
 try{await sendEmail(env,{to:email,subject:"【ルール便】メールアドレスの確認",text:confirmationText,html:confirmationHtml})}
 catch(e){console.error("confirmation mail failed",String(e.message||e));return json({error:"確認メールを送信できませんでした"},502)}
 return json({message:"確認メールを送信しました。リンク先で登録を完了してください"},202);
}
async function confirm(req,url,env){
 let t=url.searchParams.get("token")||"";
 if(req.method==="POST"){try{t=String((await req.formData()).get("token")||"")}catch{}}
 if(!t||t.length>100)return page("確認できません","<h1>確認リンクが無効です</h1>",400);
 if(req.method==="GET")return page("登録確認",'<h1>メールアドレスの確認</h1><p>ボタンを押すと登録が完了します。</p><form method="post" action="/confirm"><input type="hidden" name="token" value="'+escapeHtml(t)+'"><button>登録を完了する</button></form><p>登録した覚えがない場合は、このページを閉じてください。</p>');
 const r=await env.DB.prepare("UPDATE subscribers SET confirmed=1,confirmed_at=CURRENT_TIMESTAMP WHERE confirmation_token=? AND unsubscribed=0").bind(t).run();
 return r.meta.changes?page("登録完了","<h1>登録が完了しました</h1><p>選択した分野に該当する情報がある週に、週1回を基本としてメールをお届けします。</p><p>メールが届かない場合は、迷惑メールフォルダをご確認ください。</p><p>配信停止・登録情報の削除は、配信メールに記載するリンクから行えます。</p>"):page("確認できません","<h1>リンクが無効です</h1><p>リンクの期限切れ、または登録済みの可能性があります。</p>",400);
}
async function unsubscribe(req,url,env){
 let t=url.searchParams.get("token")||"",action="unsubscribe";
 if(req.method==="POST"){
  try{const form=await req.formData();t=String(form.get("token")||"");action=String(form.get("action")||"unsubscribe")}catch{}
 }
 if(!t||t.length>100)return page("配信停止","<h1>リンクが無効です</h1>",400);
 if(!["unsubscribe","delete"].includes(action))return page("配信停止","<h1>操作が無効です</h1>",400);
 if(req.method==="GET")return page("配信停止",'<h1>配信停止・登録情報削除</h1><p>配信を停止するか、登録情報を削除できます。</p><form method="post" action="/unsubscribe"><input type="hidden" name="token" value="'+escapeHtml(t)+'"><p><button name="action" value="unsubscribe">配信を停止する</button></p><p><button name="action" value="delete">配信を停止し、登録情報を削除する</button></p></form>');
 const subscriber=await env.DB.prepare("SELECT id,email FROM subscribers WHERE unsubscribe_token=?").bind(t).first();
 if(!subscriber)return page("配信停止","<h1>リンクが無効です</h1>",404);
 if(action==="delete"){
  // Explicit POST action removes the subscriber and all related rows protected by FK cascades.
  await env.DB.prepare("DELETE FROM rate_limits WHERE rate_key=?").bind("email:"+subscriber.email).run();
  await env.DB.prepare("DELETE FROM subscribers WHERE id=?").bind(subscriber.id).run();
  return page("登録情報削除","<h1>登録情報を削除しました</h1><p>配信は停止されました。処理中のメール送信は停止要求と競合する場合があります。</p>");
 }
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
 const source=await env.DB.prepare("SELECT scan_offset,scan_page_payload,terms_checked FROM sources WHERE id='egov_law_api' AND enabled=1").first();
 if(!source||!source.terms_checked||(!Number(source.scan_offset||0)&&!source.scan_page_payload))return {skipped:true};
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
 // Pause scheduled queue creation until the operator explicitly enables the service.
 if(String(env.SIGNUP_ENABLED||"").toLowerCase()!=="true")return {skipped:true,reason:"service-not-ready"};
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
   // Reserve articles already queued or with unresolved/terminal delivery outcomes across all runs.
   const prior=await env.DB.prepare("SELECT article_ids FROM delivery_queue WHERE subscriber_id=? AND status IN ('pending','sending','failed')").bind(person.id).all();
   const reservedIds=new Set();
   for(const row of prior.results||[]){try{for(const id of JSON.parse(row.article_ids||"[]"))reservedIds.add(id)}catch{}}
   const ids=articles.filter(article=>{
    let categories=[];try{categories=JSON.parse(article.category_ids||"[]")}catch{}
    return categories.some(id=>chosen.has(id))&&!sentIds.has(article.id)&&!reservedIds.has(article.id);
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
export async function drainQueue(env,limit=20){
 // Defense in depth: queued messages must not be sent while readiness is disabled.
 if(String(env.SIGNUP_ENABLED||"").toLowerCase()!=="true")return {skipped:true,sent:0,errors:0,reason:"service-not-ready"};
 const lease=newToken();
 const lock=await env.DB.prepare("UPDATE system_locks SET lock_token=?,lock_until=datetime('now','+8 minutes') WHERE lock_name='delivery' AND (lock_until IS NULL OR lock_until<CURRENT_TIMESTAMP)").bind(lease).run();
 if(!lock.meta.changes)return {busy:true,sent:0,errors:0};
 let sent=0,errors=0;
 try{
  // A stale 'sending' row may already have been accepted by the provider. Never auto-retry it.
  // Manual reconciliation is safer than automatically risking a duplicate email.
  const rows=await env.DB.prepare("SELECT q.id,q.subscriber_id,q.article_ids,s.email,s.unsubscribe_token FROM delivery_queue q JOIN subscribers s ON s.id=q.subscriber_id WHERE q.status='pending' AND q.attempts<5 AND (q.next_attempt_at IS NULL OR q.next_attempt_at<=CURRENT_TIMESTAMP) AND s.confirmed=1 AND s.unsubscribed=0 ORDER BY q.id LIMIT ?").bind(limit).all();
  for(const p of rows.results||[]){
   const renewed=await env.DB.prepare("UPDATE system_locks SET lock_until=datetime('now','+8 minutes') WHERE lock_name='delivery' AND lock_token=? AND lock_until>CURRENT_TIMESTAMP").bind(lease).run();
   if(!renewed.meta.changes)break;
   const claimed=await env.DB.prepare("UPDATE delivery_queue SET status='sending',sending_started_at=CURRENT_TIMESTAMP,attempts=attempts+1 WHERE id=? AND status='pending'").bind(p.id).run();
   if(!claimed.meta.changes)continue;
   let providerAccepted=false;
   try{
    const ids=JSON.parse(p.article_ids),marks=ids.map(()=>"?").join(",");
    const articles=await env.DB.prepare("SELECT a.id,a.summary,a.what_changed,a.effective_date,a.who_affected,a.action_needed,u.title,u.url,u.source_id FROM articles a JOIN updates u ON u.id=a.update_id WHERE a.status='approved' AND a.id IN ("+marks+")").bind(...ids).all();
    if(!articles.results?.length)throw Error("approved-articles-not-found");
    const unsub=base(env)+"/unsubscribe?token="+encodeURIComponent(p.unsubscribe_token);
    const html=articles.results.map(x=>{const a=sourceAttribution(x.source_id);return "<article><h2>"+escapeHtml(x.title)+"</h2><p>"+escapeHtml(x.summary)+"</p><p><b>変更点：</b>"+escapeHtml(x.what_changed)+"</p><p><b>施行日：</b>"+escapeHtml(x.effective_date||"原文で確認してください")+"</p><p><b>対象者：</b>"+escapeHtml(x.who_affected)+"</p><p><b>対応：</b>"+escapeHtml(x.action_needed)+"</p><p><a href=\""+escapeHtml(x.url)+"\">公式情報・出典："+escapeHtml(a.label)+"</a></p><p><small>"+escapeHtml(a.note)+"</small></p></article><hr>"}).join("");
    // Recheck immediately before contacting the provider: unsubscribe may have raced with queue claiming or rendering.
    const active=await env.DB.prepare("SELECT id FROM subscribers WHERE id=? AND confirmed=1 AND unsubscribed=0").bind(p.subscriber_id).first();
    if(!active){
     await env.DB.prepare("UPDATE delivery_queue SET status='failed',sending_started_at=NULL,last_error='subscriber-inactive-before-provider-send' WHERE id=? AND status='sending'").bind(p.id).run();
     errors++;
     continue;
    }
    await sendEmail(env,{to:p.email,subject:"【ルール便】今週のルール変更情報",html:"<h1>今週のルール変更情報</h1>"+html+'<p><a href="'+escapeHtml(unsub)+'">配信停止</a></p>',text:articles.results.map(x=>{const a=sourceAttribution(x.source_id);return x.title+"\n"+x.summary+"\n出典: "+a.label+"\n原文: "+x.url+"\n"+a.note}).join("\n\n---\n\n")+"\n配信停止: "+unsub});
    providerAccepted=true;
    for(const x of articles.results)await env.DB.prepare("INSERT OR IGNORE INTO sent(subscriber_id,article_id) VALUES(?,?)").bind(p.subscriber_id,x.id).run();
    await env.DB.prepare("UPDATE delivery_queue SET status='sent',sent_at=CURRENT_TIMESTAMP,sending_started_at=NULL,last_error=NULL WHERE id=?").bind(p.id).run();sent++;
   }catch(e){
    errors++;
    const uncertain=providerAccepted||e.deliveryUnknown===true;
    const status=uncertain||Number(p.attempts)>=5?"failed":"pending";
    const reason=(uncertain?"delivery-result-uncertain: ":"")+String(e.message||e).slice(0,450);
    await env.DB.prepare("UPDATE delivery_queue SET status=?,sending_started_at=NULL,next_attempt_at=CASE WHEN ?='pending' THEN datetime('now','+' || MIN(60,5*attempts) || ' minutes') ELSE next_attempt_at END,last_error=? WHERE id=?").bind(status,status,reason,p.id).run();
   }
  }
  await env.DB.prepare("UPDATE delivery_runs SET status=CASE WHEN enqueue_complete=0 OR EXISTS(SELECT 1 FROM delivery_queue q WHERE q.run_id=delivery_runs.run_id AND q.status IN ('pending','sending')) THEN 'queued' WHEN EXISTS(SELECT 1 FROM delivery_queue q WHERE q.run_id=delivery_runs.run_id AND q.status='failed') THEN 'partial_failure' ELSE 'completed' END,updated_at=CURRENT_TIMESTAMP WHERE status='queued'").run();
  return {sent,errors,processed:rows.results?.length||0};
 }finally{await env.DB.prepare("UPDATE system_locks SET lock_token=NULL,lock_until=NULL WHERE lock_name='delivery' AND lock_token=?").bind(lease).run()}
}
async function listDeliveryIssues(req,env){
 if(!isAdmin(req,env))return denied();
 const rows=await env.DB.prepare("SELECT q.id,q.run_id,q.subscriber_id,s.email,q.article_ids,q.status,q.attempts,q.sending_started_at,q.created_at,q.last_error FROM delivery_queue q JOIN subscribers s ON s.id=q.subscriber_id WHERE q.status IN ('sending','failed') OR (q.status='sent' AND q.last_error='manually-confirmed-provider-accepted') ORDER BY CASE q.status WHEN 'sending' THEN 0 WHEN 'failed' THEN 1 ELSE 2 END,q.id LIMIT 100").all();
 return json({items:rows.results||[],policy:{staleSendingAfterMinutes:20,actionsRequireProviderLog:true,manualSentRecordWriteAnomaly:"sent with last_error=manually-confirmed-provider-accepted requires manual inspection; do not reconcile or retry automatically"}});
}
async function reconcileDelivery(req,env){
 if(!isAdmin(req,env))return denied();
 let d;try{d=await req.json()}catch{return json({error:"JSON形式で送信してください"},400)}
 const id=Number(d.queue_id),action=String(d.action||"");
 if(!Number.isSafeInteger(id)||id<1)return json({error:"queue_id が不正です"},400);
 if(!["mark_sent","retry_confirmed_not_sent"].includes(action))return json({error:"action が不正です"},400);
 const q=await env.DB.prepare("SELECT id,run_id,subscriber_id,article_ids,status,sending_started_at FROM delivery_queue WHERE id=?").bind(id).first();
 if(!q)return json({error:"配信キューが見つかりません"},404);
 if(!["sending","failed"].includes(q.status))return json({error:"この状態のキューは照合対象ではありません"},409);
 const activeLock=await env.DB.prepare("SELECT lock_token,lock_until FROM system_locks WHERE lock_name='delivery'").first();
 if(activeLock?.lock_token&&activeLock.lock_until&&activeLock.lock_until>=new Date().toISOString().replace("T"," ").slice(0,19))return json({error:"配信Workerが稼働中の可能性があるため、ロック解除後に再試行してください"},409);
 if(action==="mark_sent"){
  if(d.provider_confirmed_accepted!==true)return json({error:"事業者ログで受理を確認した場合のみ provider_confirmed_accepted=true を指定してください"},400);
  let ids;try{ids=JSON.parse(q.article_ids)}catch{return json({error:"article_ids が壊れているため手動確認が必要です"},409)}
  if(!Array.isArray(ids)||!ids.length||ids.some(x=>typeof x!=="number"||!Number.isSafeInteger(x)||x<1))return json({error:"article_ids が不正です"},409);
  const marked=await env.DB.prepare("UPDATE delivery_queue SET status='sent',sent_at=COALESCE(sent_at,CURRENT_TIMESTAMP),sending_started_at=NULL,last_error='manually-confirmed-provider-accepted' WHERE id=? AND status IN ('sending','failed')").bind(id).run();
  if(Number(marked.meta?.changes)!==1)return json({error:"配信キューの状態が変わったため照合を中止しました。最新状態を再確認してください"},409);
  try{
   for(const articleId of ids)await env.DB.prepare("INSERT OR IGNORE INTO sent(subscriber_id,article_id) VALUES(?,?)").bind(q.subscriber_id,articleId).run();
   const finalized=await env.DB.prepare("UPDATE delivery_queue SET last_error=NULL WHERE id=? AND status='sent' AND last_error='manually-confirmed-provider-accepted'").bind(id).run();
   if(Number(finalized.meta?.changes)!==1)return json({error:"配信履歴は保存しましたが、照合状態の確定を確認できませんでした。管理者がキューと配信履歴を確認してください。",queue_id:id,recovery:"manual-database-inspection-required"},500);
  }catch(e){
   console.error("manual-reconciliation-sent-record-write-failed", {queueId:id, error:String(e)});
   try{
    const reverted=await env.DB.prepare("UPDATE delivery_queue SET status='failed',sending_started_at=NULL,last_error='manual-reconciliation-sent-record-write-failed' WHERE id=? AND status='sent' AND last_error='manually-confirmed-provider-accepted'").bind(id).run();
    if(Number(reverted.meta?.changes)===1){
     return json({error:"配信済み履歴の保存に失敗しました。キューは failed に戻しました。事業者ログと配信履歴を確認し、解消するまで自動再試行しないでください。",queue_id:id,recovery:"queue-reverted-to-failed"},500);
    }
    console.error("manual-reconciliation-queue-revert-not-applied", {queueId:id, changes:reverted.meta?.changes});
   }catch(revertError){
    console.error("manual-reconciliation-queue-revert-failed", {queueId:id, error:String(revertError)});
   }
   return json({error:"配信済み履歴の保存に失敗し、キュー状態の復旧も確認できませんでした。自動再試行せず、delivery_queue と sent を管理者が手動確認してください。",queue_id:id,recovery:"manual-database-inspection-required"},500);
  }
 }else{
  if(d.provider_confirmed_not_accepted!==true)return json({error:"事業者ログで未受理を確認した場合のみ provider_confirmed_not_accepted=true を指定してください"},400);
  if(q.status==="sending"){
   const age=await env.DB.prepare("SELECT CASE WHEN sending_started_at IS NOT NULL AND datetime(sending_started_at)<=datetime('now','-20 minutes') THEN 1 ELSE 0 END AS old_enough FROM delivery_queue WHERE id=?").bind(id).first();
   if(Number(age?.old_enough)!==1)return json({error:"sending は開始から20分以上経過した行だけ再試行できます。Workerの停止と事業者ログも確認してください"},409);
  }
  const retried=await env.DB.prepare("UPDATE delivery_queue SET status='pending',attempts=0,next_attempt_at=CURRENT_TIMESTAMP,sending_started_at=NULL,last_error='manual-retry-confirmed-not-sent' WHERE id=? AND status IN ('sending','failed')").bind(id).run();
  if(Number(retried.meta?.changes)!==1)return json({error:"配信キューの状態が変わったため再試行設定を中止しました。最新状態を再確認してください"},409);
 }
 await env.DB.prepare("UPDATE delivery_runs SET status=CASE WHEN enqueue_complete=0 OR EXISTS(SELECT 1 FROM delivery_queue q WHERE q.run_id=delivery_runs.run_id AND q.status IN ('pending','sending')) THEN 'queued' WHEN EXISTS(SELECT 1 FROM delivery_queue q WHERE q.run_id=delivery_runs.run_id AND q.status='failed') THEN 'partial_failure' ELSE 'completed' END,updated_at=CURRENT_TIMESTAMP WHERE run_id=?").bind(q.run_id).run();
 return json({ok:true,queue_id:id,action,status:action==="mark_sent"?"sent":"pending",note:"事業者側の配信ログを確認した記録を運用ログにも残してください。"});
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
  if(req.method==="GET"&&u.pathname==="/api/admin/delivery-issues")return listDeliveryIssues(req,env);
  if(req.method==="POST"&&u.pathname==="/api/admin/reconcile-delivery")return reconcileDelivery(req,env);
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
