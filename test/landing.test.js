import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

test("landing page gives a low-effort starting choice and explains the service", async () => {
  const response = await worker.fetch(new Request("https://example.test/"), {});
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /法律や行政制度の変更から/);
  assert.match(html, /生活のルール/);
  assert.match(html, /働く人/);
  assert.match(html, /事業・会社/);
  assert.match(html, /受け取る分野を細かく調整する/);
  assert.match(html, /該当情報がない週は配信しません/);
  assert.match(html, /個別の法律相談/);
  assert.match(html, /確認メールのリンクを開く/);
});

test("signup remains visibly and interactively paused until a privacy policy URL exists", async () => {
  const response = await worker.fetch(new Request("https://example.test/"), {});
  const html = await response.text();
  assert.match(html, /プライバシー方針は公開準備中です/);
  assert.match(html, /登録は一時停止中です/);
  assert.match(html, /id="submit" disabled/);
  assert.match(html, /name="consent" required disabled/);
});

test("a configured HTTPS privacy policy enables signup controls and links to the policy", async () => {
  const response = await worker.fetch(new Request("https://example.test/"), {
    PRIVACY_URL: "https://example.test/privacy"
  });
  const html = await response.text();
  assert.match(html, /href="https://example.test/privacy"/);
  assert.doesNotMatch(html, /登録は一時停止中です/);
  assert.match(html, /id="submit">確認メールを送る/);
  assert.match(html, /name="consent" required>/);
});

test("inline onboarding JavaScript is syntactically valid after server rendering", async () => {
  const response = await worker.fetch(new Request("https://example.test/"), {
    PRIVACY_URL: "https://example.test/privacy"
  });
  const html = await response.text();
  const match = html.match(/<script>([\\s\\S]*?)<\\/script>/);
  assert.ok(match, "landing page should include its onboarding script");
  assert.doesNotThrow(() => new Function(match[1]));
});
