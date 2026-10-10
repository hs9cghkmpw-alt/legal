import {classifyText} from "./categories.js";

const API_URL="https://laws.e-gov.go.jp/api/2/laws";
const DAY_MS=24*60*60*1000;
const MAX_PAGES_PER_RUN=10;

function validDate(value){
 if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const date=new Date(value+"T00:00:00Z");
 return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
}
async function hash(text){
 const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text));
 return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
function revisionOf(law){
 return law?.current_revision_info||law?.revision_info||null;
}
function normalizeLaw(law){
 const revision=revisionOf(law);
 const lawId=law?.law_info?.law_id;
 if(!revision||!lawId)return null;
 // law_info.promulgation_date is the original law's promulgation date, not an amendment date.
 // Do not use it as a fallback: doing so would mislabel old laws as recent amendments.
 const promulgated=revision.amendment_promulgate_date||"";
 const mission=revision.mission||"";
 const hasAmendment=Boolean(revision.amendment_law_id);
 const isNewEnactment=String(revision.amendment_type||"")==="1"&&mission==="New";
 if(!validDate(promulgated)||(!hasAmendment&&!isNewEnactment&&mission!=="Partial"))return null;
 const revisionId=revision.law_revision_id||"";
 const externalId=revisionId||String(lawId)+"_"+promulgated;
 const amendmentTitle=revision.amendment_law_title||"";
 const affectedTitle=revision.law_title||law?.law_info?.law_title||String(lawId);
 const title=amendmentTitle
  ? amendmentTitle+"（対象法令："+affectedTitle+"）"
  : affectedTitle;
 return {
  id:String(externalId),
  title:String(title).trim(),
  date:promulgated,
  revisionId,
  lawId:String(lawId),
  lawTitle:String(affectedTitle),
  amendmentTitle,
  mission,
  type:String(revision.amendment_type||""),
  revision
 };
}

export async function collectEgovLawUpdates(env,{fetchImpl=fetch,now=new Date()}={}){
 const source=await env.DB.prepare("SELECT id,url,terms_checked,scan_offset,scan_cutoff FROM sources WHERE id=? AND enabled=1").bind("egov_law_api").first();
 if(!source)return {collected:0,skipped:true,reason:"source-disabled-or-missing"};
 if(!source.terms_checked)return {collected:0,skipped:true,reason:"source-terms-not-confirmed"};

 const savedOffset=Number(source.scan_offset||0);
 const resume=validDate(source.scan_cutoff)&&Number.isSafeInteger(savedOffset)&&savedOffset>0;
 const cutoff=resume?source.scan_cutoff:new Date(now.getTime()-7*DAY_MS).toISOString().slice(0,10);
 const endpoint=source.url||API_URL;
 const grouped=new Map();
 let offset=resume?savedOffset:0,pages=0,scanned=0,done=false,nextOffset=offset;
 while(pages<MAX_PAGES_PER_RUN&&!done){
  const url=new URL(endpoint);
  url.searchParams.set("limit","100");
  url.searchParams.set("offset",String(offset));
  // Do not rely on order to terminate the scan: the API may sort within a page,
  // so a later page can still contain newer records.
  url.searchParams.set("response_format","json");
  const response=await fetchImpl(url.toString(),{headers:{"Accept":"application/json","User-Agent":"RuleChangeLetter/0.1"}});
  if(!response.ok)throw new Error("e-Gov法令API取得失敗: HTTP "+response.status);
  let payload;try{payload=await response.json()}catch{throw new Error("e-Gov法令APIのJSONを解析できません")}
  if(!payload||!Array.isArray(payload.laws))throw new Error("e-Gov法令APIの応答形式が想定外です");
  pages++;scanned+=payload.laws.length;
  for(const law of payload.laws){
   const item=normalizeLaw(law);
   if(!item||item.date<cutoff)continue;
   const prior=grouped.get(item.id);
   if(!prior||item.date>prior.date)grouped.set(item.id,item);
  }
  const next=payload.next_offset;
  if(next===null||next===undefined||payload.laws.length===0){done=true;nextOffset=0}
  else{
   nextOffset=Number(next);
   if(!Number.isSafeInteger(nextOffset)||nextOffset<=offset)throw new Error("e-Gov法令APIのページ位置が不正です");
   offset=nextOffset;
  }
 }
 let count=0;
 for(const item of grouped.values()){
  const lawUrl="https://laws.e-gov.go.jp/law/"+encodeURIComponent(item.lawId);
  const description=[
   "e-Gov法令API Version 2 から取得した改正候補です。",
   "改正法令: "+(item.amendmentTitle||"新規制定・改正情報"),
   "対象法令: "+item.lawTitle,
   "公布日: "+item.date,
   "改正区分: "+(item.mission||item.type||"不明"),
   "法令履歴ID: "+item.revisionId,
   "注意: 改正本文・施行日・経過措置は原文で確認してください。"
  ].join("\n");
  const contentHash=await hash([item.id,item.title,item.date,item.revisionId].join("\n"));
  const inserted=await env.DB.prepare("INSERT OR IGNORE INTO updates(source_id,external_id,title,url,published_at,description,content_hash) VALUES(?,?,?,?,?,?,?)")
   .bind(source.id,item.id,item.title,lawUrl,item.date,description,contentHash).run();
  const categories=classifyText(item.title+" "+item.lawTitle+" "+description);
  await env.DB.prepare("INSERT OR IGNORE INTO articles(update_id,summary,what_changed,who_affected,action_needed,category_ids,status) SELECT id,?,?,?,?,?,'pending' FROM updates WHERE source_id=? AND external_id=?")
   .bind("e-Gov法令APIで検出した改正候補です。配信前に原文確認が必要です。","法令の改正履歴から候補を検出しました。具体的な条文変更は未解析です。","対象法令と適用対象者を原文で確認してください。","改正法令本文・施行期日・経過措置・対象者を確認してください。",JSON.stringify(categories),source.id,item.id).run();
  if(inserted.meta?.changes)count++;
 }
 // Persist progress only after this batch's candidate inserts complete. A failed batch
 // retries the same page; INSERT OR IGNORE keeps repeated candidates idempotent.
 if(done){
  await env.DB.prepare("UPDATE sources SET scan_offset=0,scan_cutoff=NULL,last_checked_at=CURRENT_TIMESTAMP,last_error=NULL WHERE id=?").bind(source.id).run();
 }else{
  await env.DB.prepare("UPDATE sources SET scan_offset=?,scan_cutoff=?,last_checked_at=CURRENT_TIMESTAMP,last_error=NULL WHERE id=?").bind(nextOffset,cutoff,source.id).run();
 }
 return {collected:count,scanned,pages,withinWindow:grouped.size,cutoff,hasMore:!done,nextOffset:done?null:nextOffset};
}
