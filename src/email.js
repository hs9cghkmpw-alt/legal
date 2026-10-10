export async function sendEmail(env,m){
 if(!env.BREVO_API_KEY)throw new Error("BREVO_API_KEY が未設定です");
 if(!env.SENDER_EMAIL||env.SENDER_EMAIL.includes("replace-with-"))throw new Error("SENDER_EMAIL を認証済み送信元に設定してください");
 let r;
 try{
  r=await fetch("https://api.brevo.com/v3/smtp/email",{method:"POST",headers:{"accept":"application/json","api-key":env.BREVO_API_KEY,"content-type":"application/json"},body:JSON.stringify({sender:{name:env.SENDER_NAME||"ルール変更レター",email:env.SENDER_EMAIL},to:[{email:m.to}],subject:m.subject,htmlContent:m.html,textContent:m.text}),signal:AbortSignal.timeout(15000)});
 }catch(error){
  throw Object.assign(new Error("メール送信結果不明: "+String(error?.message||error)),{deliveryUnknown:true});
 }
 if(!r.ok){const message="メール送信失敗: HTTP "+r.status+" "+(await r.text()).slice(0,300);if(r.status>=500)throw Object.assign(new Error("メール送信結果不明: "+message),{deliveryUnknown:true});throw new Error(message)}
 return r.json().catch(()=>({}));
}
export function escapeHtml(v=""){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
