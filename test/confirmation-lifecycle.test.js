import test from "node:test";
import assert from "node:assert/strict";
import app from "../src/index.js";

const token = "confirmation-token";
const url = "https://worker.example/confirm";

function fakeDb({ changes = 1 } = {}) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async run() {
              calls.push({ sql, args });
              return { meta: { changes } };
            },
          };
        },
      };
    },
  };
}

function post(tokenValue = token) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token: tokenValue }),
  });
}

test("confirmation GET displays an explicit action and does not confirm automatically", async () => {
  const DB = fakeDb();
  const response = await app.fetch(new Request(url + "?token=" + token), { DB });
  assert.equal(response.status, 200);
  assert.match(await response.text(), /ボタンを押すと登録が完了/);
  assert.equal(DB.calls.length, 0);
});

test("confirmation POST confirms only with the current token and an active subscription", async () => {
  const DB = fakeDb({ changes: 1 });
  const response = await app.fetch(post(), { DB });
  assert.equal(response.status, 200);
  assert.match(await response.text(), /登録が完了しました/);
  assert.equal(DB.calls.length, 1);
  assert.match(DB.calls[0].sql, /WHERE confirmation_token=\? AND unsubscribed=0 AND confirmed=0/);
  assert.equal(DB.calls[0].args[0], token);
});

test("confirmation POST does not reactivate an unsubscribed subscriber", async () => {
  const DB = fakeDb({ changes: 0 });
  const response = await app.fetch(post(), { DB });
  assert.equal(response.status, 400);
  assert.match(await response.text(), /リンクが無効/);
  assert.match(DB.calls[0].sql, /unsubscribed=0/);
});

test("missing confirmation token is rejected without database access", async () => {
  const DB = fakeDb();
  const response = await app.fetch(new Request(url), { DB });
  assert.equal(response.status, 400);
  assert.equal(DB.calls.length, 0);
});
