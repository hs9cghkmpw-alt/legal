const EGOV_BASE = "https://laws.e-gov.go.jp/api/1/updatelawlists";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return json({
        ok: true,
        service: "legal-change-letter",
        databaseConfigured: Boolean(env.DB),
        mode: env.DB ? "database" : "prototype"
      });
    }

    if (url.pathname === "/api/updates") {
      if (!env.DB) return json({ items: [], note: "D1未設定です。READMEのセットアップ手順を実行してください。" });
      const result = await env.DB.prepare(
        "SELECT id, title, source_url, published_at, category, status, detected_at FROM updates ORDER BY detected_at DESC LIMIT 100"
      ).all();
      return json({ items: result.results || [] });
    }

    if (url.pathname === "/api/collect" && request.method === "POST") {
      if (!env.DB) return json({ error: "D1 database binding (DB) is not configured." }, 503);
      if (!env.COLLECT_TOKEN || request.headers.get("authorization") !== `Bearer ${env.COLLECT_TOKEN}`) {
        return json({ error: "Unauthorized" }, 401);
      }
      try {
        return json(await collectRecent(env.DB));
      } catch (error) {
        return json({ error: "Collection failed", detail: String(error?.message || error) }, 502);
      }
    }

    if (url.pathname !== "/") return new Response("Not Found", { status: 404 });

    const items = env.DB
      ? await env.DB.prepare("SELECT title, source_url, published_at, category, status FROM updates ORDER BY detected_at DESC LIMIT 20").all()
      : { results: [] };
    return new Response(renderPage(items.results || [], !env.DB), {
      headers: { "content-type": "text/html; charset=utf-8" }
    });
  },

  async scheduled(controller, env, ctx) {
    if (!env.DB) {
      console.error("Scheduled collection skipped: D1 binding DB is missing.");
      return;
    }
    ctx.waitUntil(collectRecent(env.DB).then(
      result => console.log("Legal update collection complete", JSON.stringify(result)),
      error => console.error("Legal update collection failed", String(error))
    ));
  }
};

async function collectRecent(db) {
  let checkedDates = 0;
  let inserted = 0;
  let skipped = 0;
  const failures = [];
  const today = new Date();

  // Check the last three calendar days to reduce the chance of missing updates
  // after a temporary outage. The API is read-only; no AI text is generated here.
  for (let offset = 0; offset < 3; offset++) {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - offset);
    const ymd = date.toISOString().slice(0, 10).replaceAll("-", "");
    checkedDates++;
    const response = await fetch(`${EGOV_BASE}/${ymd}`, {
      headers: { accept: "application/xml,text/xml" }
    });
    if (!response.ok) {
      failures.push({ date: ymd, status: response.status });
      continue;
    }
    const xml = await response.text();
    if (!xml.includes("<DataRoot")) {
      failures.push({ date: ymd, error: "Unexpected API response format" });
      continue;
    }

    const blocks = [...xml.matchAll(/<LawNameListInfo>([\s\S]*?)<\/LawNameListInfo>/g)];
    for (const match of blocks) {
      const block = match[1];
      const lawName = xmlValue(block, "LawName");
      const lawNo = xmlValue(block, "LawNo");
      const lawType = xmlValue(block, "LawTypeName") || xmlValue(block, "LawType");
      const lawId = xmlValue(block, "LawId");
      const amendName = xmlValue(block, "AmendName");
      const amendNo = xmlValue(block, "AmendNo");
      const amendDate = xmlValue(block, "AmendPromulgationDate");
      const effectiveDate = xmlValue(block, "EnforcementDate");
      const lawUrl = xmlValue(block, "LawUrl");
      const title = [amendName || lawName, amendNo ? `(${amendNo})` : ""].filter(Boolean).join(" ");
      if (!title) continue;

      // Stable across the three-day overlap: the same amendment should only be stored once.
      const externalId = [lawId, amendNo, amendDate, title].filter(Boolean).join(":");
      const digestInput = new TextEncoder().encode(externalId);
      const digest = await crypto.subtle.digest("SHA-256", digestInput);
      const hash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
      const sourceUrl = lawUrl || (lawId ? `https://laws.e-gov.go.jp/law/${encodeURIComponent(lawId)}` : "https://laws.e-gov.go.jp/");
      const raw = JSON.stringify({
        lawName, lawNo, lawType, lawId, amendName, amendNo,
        amendmentPromulgationDate: amendDate,
        effectiveDate, enforcementComment: xmlValue(block, "EnforcementComment"),
        enforcementFlag: xmlValue(block, "EnforcementFlg"),
        authorityConfirmationFlag: xmlValue(block, "AuthFlg")
      });

      const result = await db.prepare(`
        INSERT OR IGNORE INTO updates
          (external_id, title, source_url, published_at, effective_date, law_id, law_number, law_type, category, content_hash, raw_text, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'detected')
      `).bind(
        externalId, title, sourceUrl, formatDate(amendDate) || formatDate(ymd),
        formatDate(effectiveDate), lawId || null, lawNo || null, lawType || null,
        classify(lawType), hash, raw
      ).run();

      if (result.meta?.changes) inserted++;
      else skipped++;
    }
  }
  return { ok: failures.length === 0, checkedDates, inserted, skipped, failures };
}

function xmlValue(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  if (!match) return "";
  return match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, "&").trim();
}

function formatDate(value) {
  return /^\d{8}$/.test(value || "") ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}` : null;
}

function classify(lawType) {
  const type = String(lawType || "");
  if (type.includes("法律")) return "法律";
  if (type.includes("政令") || type.includes("勅令")) return "政令";
  if (type.includes("省令") || type.includes("府令") || type.includes("規則")) return "省令・規則";
  if (type.includes("条例")) return "条例";
  return "法令";
}

function renderPage(items, demoMode) {
  const cards = items.length
    ? items.map(item => `<article><span class="tag">${escapeHtml(item.category || "法令")}</span><h3>${escapeHtml(item.title)}</h3><p>公布日：${escapeHtml(item.published_at || "未確認")}</p><p><a href="${escapeHtml(item.source_url)}" rel="noopener noreferrer" target="_blank">公式情報を確認する ↗</a></p><small>状態：${escapeHtml(item.status || "検知済み")}</small></article>`).join("")
    : `<article><h3>${demoMode ? "D1を設定してください" : "まだ収集データがありません"}</h3><p>${demoMode ? "READMEの手順に沿って専用D1データベースを設定すると、実際の更新法令を収集できます。" : "収集処理が動作すると、ここに更新候補が表示されます。"}</p></article>`;
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>暮らしのルール変更レター</title>
<style>body{max-width:780px;margin:0 auto;padding:28px 18px;font:16px/1.7 system-ui,sans-serif;color:#20242a}header{padding:22px 0;border-bottom:1px solid #ddd;margin-bottom:24px}.tag{display:inline-block;border:1px solid #888;border-radius:99px;padding:2px 10px;font-size:.85rem}article{border:1px solid #ddd;border-radius:14px;padding:18px;margin:16px 0}small{color:#555}a{overflow-wrap:anywhere}footer{border-top:1px solid #ddd;margin-top:32px;padding-top:16px;color:#555;font-size:.9rem}</style></head><body>
<header><span class="tag">無料・試作版</span><h1>暮らしのルール変更レター</h1><p>法律・行政制度・生活に関わる重要ルールの変更を、生活者向けに整理するサービスです。</p><p>掲載情報は公式資料へのリンクから確認できます。重要な判断は必ず原文をご確認ください。</p></header>
<h2>検知した更新法令</h2><p>自動収集した法令の更新候補です。検知したこと自体は、生活への影響が大きい改正であることや、施行済みであることを意味しません。</p>
${cards}<footer>試作版：AIによる解説、行政ニュース収集、メール配信は未実装です。公布日と施行日は区別して確認してください。</footer></body></html>`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status, headers: { "content-type": "application/json; charset=utf-8" }
  });
}
