export const ROLES = [
 {id:"individual",label:"個人・生活者"},
 {id:"employee",label:"会社員・従業員"},
 {id:"sole_proprietor",label:"個人事業主・フリーランス"},
 {id:"corporate_leader",label:"法人経営者・役員"},
 {id:"hr_labor",label:"人事・労務担当者"},
 {id:"general_legal",label:"総務・法務担当者"},
 {id:"other",label:"その他"}
];
export const CATEGORIES = [
 {id:"labor",label:"労働・雇用",description:"労働条件、雇用、職場の安全"},
 {id:"tax",label:"税金・会計",description:"税制、申告、会計上の変更"},
 {id:"social_insurance",label:"社会保険・年金",description:"年金、健康保険、給付制度"},
 {id:"business",label:"事業・取引",description:"許認可、取引、事業者の義務"},
 {id:"consumer",label:"消費者・契約",description:"契約、表示、消費者保護"},
 {id:"digital_privacy",label:"デジタル・個人情報",description:"個人情報、情報セキュリティ、電子手続き"},
 {id:"daily_life",label:"交通・生活",description:"交通、防災、日常生活のルール"},
 {id:"other",label:"その他の重要制度",description:"ほかのカテゴリに収まらない重要な変更"}
];
const MAP={
 individual:["consumer","daily_life","social_insurance"],
 employee:["labor","tax","social_insurance"],
 sole_proprietor:["tax","business","labor","social_insurance"],
 corporate_leader:["business","tax","labor","digital_privacy"],
 hr_labor:["labor","social_insurance","tax"],
 general_legal:["business","digital_privacy","labor"],
 other:["other","daily_life"]
};
export function recommendCategories(ids=[]){return [...new Set(ids.flatMap(id=>MAP[id]||[]))];}
export function classifyText(text=""){
 const v=String(text);
 const rules=[
 ["labor",/労働|雇用|賃金|最低賃金|育児休業|介護休業|労働時間|ハラスメント/],
 ["tax",/税|所得|法人税|消費税|確定申告|インボイス|源泉徴収/],
 ["social_insurance",/年金|健康保険|社会保険|雇用保険|介護保険|給付金/],
 ["business",/事業者|許認可|取引|下請|フリーランス|会社法|電子帳簿/],
 ["consumer",/消費者|契約|景品表示|特定商取引|製品安全|リコール/],
 ["digital_privacy",/個人情報|サイバー|デジタル|電子署名|マイナンバー/],
 ["daily_life",/道路交通|交通|防災|住宅|食品|生活|運転免許/]
 ];
 const result=rules.filter(([,re])=>re.test(v)).map(([id])=>id);
 return result.length?result:["other"];
}
