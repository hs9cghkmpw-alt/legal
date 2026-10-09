const DEMO_UPDATES = [{
  id: "demo-001",
  category: "行政制度",
  title: "制度変更のお知らせ（サンプル）",
  summary: "画面確認用のダミー情報です。実在する改正情報ではありません。",
  effectiveDate: null,
  audience: "未設定",
  action: "公式情報を確認してください。",
  sourceUrl: "https://laws.e-gov.go.jp/",
  status: "demo"
}];

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/api/health") {
      return json({ ok: true, service: "legal-change-letter", mode: "prototype" });
    }
    if (url.pathname === "/api/updates") {
      return json({ items: DEMO_UPDATES, note: "サンプルデータです。実データではありません。" });
    }
    if (url.pathname !== "/") return new Response("Not Found", { status: 404 });
    return new Response(`<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>暮らしのルール変更レター（試作）</title>
<style>body{max-width:760px;margin:0 auto;padding:28px 18px;font:16px/1.7 system-ui,sans-serif}header{padding:20px 0;border-bottom:1px solid #aaa;margin-bottom:24px}.tag{display:inline-block;border:1px solid #888;border-radius:99px;padding:2px 10px;font-size:.85rem}article{border:1px solid #aaa;border-radius:14px;padding:18px;margin:16px 0}small{opacity:.75}</style></head>
<body><header><span class="tag">無料・試作版</span><h1>暮らしのルール変更レター</h1>
<p>法律・行政制度・生活に関わる重要ルールの変更を、生活者向けに短く整理して届けるサービスの試作です。</p></header>
<h2>変更情報のサンプル</h2><p><strong>注意：</strong>以下はダミー情報で、実際の法改正情報ではありません。</p>
<article><span class="tag">行政制度</span><h3>制度変更のお知らせ（サンプル）</h3>
<p>画面確認用のサンプルです。実際の変更内容は掲載していません。</p><p><strong>いつから：</strong>未確認</p>
<p><strong>誰に関係する：</strong>未設定</p><p><strong>何をすればいい：</strong>公式情報を確認してください。</p>
<small>情報源：<a href="https://laws.e-gov.go.jp/">e-Gov法令検索</a></small></article>
<h2>次に実装する機能</h2><ul><li>公式情報の取得と重複排除</li><li>変更点・施行日・対象者の整理</li><li>人が確認した情報だけを配信候補にする</li><li>週1回のメール配信</li></ul>
<p><small>本サービスは法的助言を提供するものではありません。重要な判断は公式資料等で確認してください。</small></p></body></html>`, { headers: { "content-type": "text/html; charset=utf-8" } });
  }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status, headers: { "content-type": "application/json; charset=utf-8" }
  });
}
