import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

test("landing page gives a low-effort starting choice and explains the service", async () => {
  const response = await worker.fetch(new Request("https://example.test/"), {});
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /法律や制度の変化を/);
  assert.match(html, /暮らしのこと/);
  assert.match(html, /働くこと/);
  assert.match(html, /事業・フリーランス/);
  assert.match(html, /分野を細かく調整する/);
  assert.match(html, /該当情報がない週は配信しない/);
  assert.match(html, /個別の法律相談/);
  assert.match(html, /網羅性を保証するものではありません/);
  assert.match(html, /期限管理や法律・税務などの専門家への相談の代わりにはなりません/);
  assert.match(html, /登録前に分野を追加・解除できます/);
  assert.doesNotMatch(html, /あとから分野を調整できます/);
  assert.match(html, /複数分野にしたい場合は、下の詳細設定で調整できます/);
  assert.match(html, /確認メールのリンクを開きます/);
  assert.match(html, /ルール便/);
  assert.match(html, /情報源の利用条件と原文確認の運用が整うまで、実際の配信は開始しません/);
  assert.match(html, /id="signup"/);
  assert.match(html, /@media\(max-width:760px\)/);
  assert.match(html, /配信イメージ/);
  assert.match(html, /商標・ドメイン等の確認は未実施/);
});

test("signup remains visibly and interactively paused until a privacy policy URL exists", async () => {
  const response = await worker.fetch(new Request("https://example.test/"), {});
  const html = await response.text();
  assert.match(html, /プライバシー方針は公開準備中です/);
  assert.match(html, /必要な準備が完了するまで登録を受け付けません/);
  assert.match(html, /id="submit" disabled/);
  assert.match(html, /name="consent" required disabled/);
});

test("a privacy policy URL alone does not enable signup before readiness approval", async () => {
  const response = await worker.fetch(new Request("https://example.test/"), {
    PRIVACY_URL: "https://example.test/privacy"
  });
  const html = await response.text();
  assert.ok(html.includes('href="https://example.test/privacy"'));
  assert.match(html, /必要な準備が完了するまで登録を受け付けません/);
  assert.match(html, /id="submit" disabled/);
});

test("a configured HTTPS privacy policy enables signup controls and links to the policy", async () => {
  const response = await worker.fetch(new Request("https://example.test/"), {
    PRIVACY_URL: "https://example.test/privacy",
    SIGNUP_ENABLED: "true"
  });
  const html = await response.text();
  assert.ok(html.includes('href="https://example.test/privacy"'));
  assert.match(html, /プライバシー方針を確認のうえ登録できます/);
  assert.doesNotMatch(html, /現在は公開準備中です/);
  assert.doesNotMatch(html, /必要な準備が完了するまで登録を受け付けません/);
  assert.match(html, /id="submit">確認メールを送る/);
  assert.match(html, /name="consent" required>/);
});

test("inline onboarding JavaScript is syntactically valid after server rendering", async () => {
  const response = await worker.fetch(new Request("https://example.test/"), {
    PRIVACY_URL: "https://example.test/privacy",
    SIGNUP_ENABLED: "true"
  });
  const html = await response.text();
  const script = html.split("<script>")[1]?.split("</script>")[0];
  assert.ok(script, "landing page should include its onboarding script");
  assert.doesNotThrow(() => new Function(script));
});

test("confirmation page explains the final step and accidental-signup handling", async () => {
  const response = await worker.fetch(new Request("https://example.test/confirm?token=test-token"), {});
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /ボタンを押すと登録が完了します/);
  assert.match(html, /登録した覚えがない場合は、このページを閉じてください/);
});

test("an invalid or non-HTTPS privacy URL does not enable signup", async () => {
  for (const privacyUrl of ["http://example.test/privacy", "https://", "javascript:alert(1)"]) {
    const response = await worker.fetch(new Request("https://example.test/"), { PRIVACY_URL: privacyUrl });
    const html = await response.text();
    assert.match(html, /必要な準備が完了するまで登録を受け付けません/);
    assert.match(html, /id="submit" disabled/);
  }
});
