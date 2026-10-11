export function sourceAttribution(sourceId){
 if(sourceId==="digital_rss")return {
  label:"デジタル庁 RSS",
  note:"編集・加工：ルール便が情報を抽出・編集しています。"
 };
 if(sourceId==="egov_law_api")return {
  label:"e-Gov法令検索（法令API Version 2）",
  note:"編集・加工：ルール便が改正候補を抽出しています。改正内容の解説は行政機関による公式見解ではありません。"
 };
 return {
  label:"各記事の公式情報リンク",
  note:"編集・加工：ルール便が情報を編集しています。"
 };
}
