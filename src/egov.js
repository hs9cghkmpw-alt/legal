import {classifyText} from "./categories.js";

const API_URL="https://laws.e-gov.go.jp/api/2/laws";
const DAY_MS=24*60*60*1000;
const MAX_CANDIDATES_PER_RUN=15;

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
  id:String(externalId),title:String(title).trim(),date:promulgated,revisionId,
  lawId:String(lawId),lawTitle:String(affectedTitle),amendmentTitle,
  mission,type:String(revision.amendment_type||"")
 };
}

export async function collectEgovLawUpdates(env,{fetchImpl=fetch,now=new Date()}={}){
 const source=await env.DB.prepare("SELECT id,url,terms_checked,scan_offset,scan_cutoff,scan_page_payload,scan_item_offset FROM sources WHERE id=? AND enabled=1").bind("egov_law_api").first();
 if(!source)return {collected:0,skipped:true,reason:"source-disabled-or-missing"};
 if(!source.terms_checked)return {collected:0,skipped:true,reason:"source-terms-not-confirmed"};

 const savedOffset=Number(source.scan_offset||0);
 const resume=validDate(source.scan_cutoff)&&Number.isSafeInteger(savedOffset)&&savedOffset>=0&&
  (savedOffset>0||Boolean(source.scan_page_payload));
 const cutoff=resume?source.scan_cutoff:new Date(now.getTime()-7*DAY_MS).toISOString().slice(0,10);
 const offset=resume?savedOffset:0;
 const endpoint=source.url||API_URL;
 let payload;
 if(source.scan_page_payload){
  try{payload=JSON.parse(source.scan_page_payload)}catch{throw new Error("e-Gov収集チェックポイントのJSONが壊れています")}
  if(!payload||!Array.isArray(payload.laws))throw new Error("e-Gov収集チェックポイントの形式が不正です");
 }else{
  const url=new URL(endpoint);
  url.searchParams.set("limit","100");
  url.searchParams.set("offset",String(offset));
  url.searchParams.set("response_format","json");
  const response=await fetchImpl(url.toString(),{headers:{"Accept":"application/json","User-Agent":"RuleChangeLetter/0.1"}});
  if(!response.ok)throw new Error("e-Gov法令API取得失敗: HTTP "+response.status);
  try{payload=await response.json()}catch{throw new Error("e-Gov法令APIのJSONを解析できません")}
  if(!payload||!Array.isArray(payload.laws))throw new Error("e-Gov法令APIの応答形式が想定外です");
 }
 const laws=payload.laws;
 let index=resume?Number(source.scan_item_offset||0):0;
 if(!Number.isSafeInteger(index)||index<0||index>laws.length)throw new Error("e-Gov収集チェックポイントの位置が不正です");
 let insertedCount=0,candidateCount=0;
 for(;index<laws.length;index++){
  const item=normalizeLaw(laws[index]);
  if(!item||item.date<cutoff)continue;
  // Keep this invocation below the Workers Free D1-query budget: two D1 writes per
  // candidate, plus source read/checkpoint write. Save the raw page and item cursor.
  if(candidateCount>=MAX_CANDIDATES_PER_RUN)break;
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
  if(inserted.meta?.changes)insertedCount++;
  candidateCount++;
 }
 const pageComplete=index>=laws.length;
 const next=payload.next_offset;
 const hasNext=next!==null&&next!==undefined&&laws.length>0;
 if(!pageComplete){
  const pageJson=JSON.stringify(payload);
  if(pageJson.length>1_500_000)throw new Error("e-Gov収集ページが保存上限に近いため、安全のためチェックポイントを保存できません");
  await env.DB.prepare("UPDATE sources SET scan_offset=?,scan_cutoff=?,scan_page_payload=?,scan_item_offset=?,last_checked_at=CURRENT_TIMESTAMP,last_error=NULL WHERE id=?")
   .bind(offset,cutoff,pageJson,index,source.id).run();
  return {collected:insertedCount,scanned:index-(resume?Number(source.scan_item_offset||0):0),pages:1,withinWindow:candidateCount,cutoff,hasMore:true,nextOffset:offset,resumeItemOffset:index};
 }
 if(hasNext){
  const nextOffset=Number(next);
  if(!Number.isSafeInteger(nextOffset)||nextOffset<=offset)throw new Error("e-Gov法令APIのページ位置が不正です");
  await env.DB.prepare("UPDATE sources SET scan_offset=?,scan_cutoff=?,scan_page_payload=NULL,scan_item_offset=0,last_checked_at=CURRENT_TIMESTAMP,last_error=NULL WHERE id=?")
   .bind(nextOffset,cutoff,source.id).run();
  return {collected:insertedCount,scanned:laws.length, pages:1,withinWindow:candidateCount,cutoff,hasMore:true,nextOffset};
 }
 await env.DB.prepare("UPDATE sources SET scan_offset=0,scan_cutoff=NULL,scan_page_payload=NULL,scan_item_offset=0,last_checked_at=CURRENT_TIMESTAMP,last_error=NULL WHERE id=?").bind(source.id).run();
 return {collected:insertedCount,scanned:laws.length,pages:1,withinWindow:candidateCount,cutoff,hasMore:false,nextOffset:null};
}
