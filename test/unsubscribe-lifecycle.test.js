import test from "node:test";
import assert from "node:assert/strict";
import app from "../src/index.js";

const token = "unsubscribe-token";
const url = "https://worker.example/unsubscribe";

function fakeDb(subscriber = { id: 8, email: "person@example.jp" }) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              calls.push({ sql, args, op: "first" });
              if (sql.includes("SELECT id,email FROM subscribers WHERE unsubscribe_token=?")) return subscriber;
              return null;
            },
            async run() {
              calls.push({ sql, args, op: "run" });
              return { meta: { changes: 1 } };
            },
          };
        },
      };
    },
  };
}

function post(action) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token, action }),
  });
}

test("unsubscribe GET only renders confirmation choices and does not mutate data", async () => {
  const DB = fakeDb();
  const response = await app.fetch(new Request(url + "?token=" + token), { DB });
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /配信を停止する/);
  assert.equal(DB.calls.length, 0);
});

test("unsubscribe POST deactivates the subscriber and removes pending queue rows", async () => {
  const DB = fakeDb();
  const response = await app.fetch(post("unsubscribe"), { DB });
  assert.equal(response.status, 200);
  assert.ok(DB.calls.some(c => c.sql.startsWith("UPDATE subscribers SET unsubscribed=1,confirmed=0") && c.args[0] === 8));
  assert.ok(DB.calls.some(c => c.sql.startsWith("DELETE FROM delivery_queue WHERE subscriber_id=? AND status='pending'") && c.args[0] === 8));
  assert.ok(!DB.calls.some(c => c.sql.startsWith("DELETE FROM subscribers")));
});

test("delete POST clears the email rate limit and deletes the subscriber", async () => {
  const DB = fakeDb();
  const response = await app.fetch(post("delete"), { DB });
  assert.equal(response.status, 200);
  assert.ok(DB.calls.some(c => c.sql.startsWith("DELETE FROM rate_limits WHERE rate_key=?") && c.args[0] === "email:person@example.jp"));
  assert.ok(DB.calls.some(c => c.sql.startsWith("DELETE FROM subscribers WHERE id=?") && c.args[0] === 8));
  assert.ok(!DB.calls.some(c => c.sql.startsWith("UPDATE subscribers SET unsubscribed=1")));
});

test("invalid unsubscribe token does not mutate data", async () => {
  const DB = fakeDb(null);
  const response = await app.fetch(post("unsubscribe"), { DB });
  assert.equal(response.status, 404);
  assert.equal(DB.calls.filter(c => c.op === "run").length, 0);
});


test("resubscribe clears pending queue rows but preserves sending and failed rows for reconciliation", async () => {
  const calls = [];
  const DB = {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              calls.push({ sql, args, op: "first" });
              if (sql.includes("SELECT id,confirmed,unsubscribed FROM subscribers WHERE email=?")) {
                return { id: 8, confirmed: 0, unsubscribed: 1 };
              }
              return null;
            },
            async run() {
              calls.push({ sql, args, op: "run" });
              return { meta: { changes: 1, last_row_id: 8 } };
            },
          };
        },
      };
    },
  };
  const request = new Request("https://worker.example/api/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "person@example.jp",
      roles: [],
      categories: ["consumer"],
      consent: true,
    }),
  });
  // No mail-provider credentials are supplied; the request stops at confirmation email delivery.
  const response = await app.fetch(request, {
    DB,
    SIGNUP_ENABLED: "true",
    PRIVACY_URL: "https://example.jp/privacy",
    BASE_URL: "https://worker.example",
  });
  assert.equal(response.status, 502);
  const cleanup = calls.find(c => c.sql.startsWith("DELETE FROM delivery_queue WHERE subscriber_id=?"));
  assert.ok(cleanup);
  assert.match(cleanup.sql, /status='pending'/);
  assert.doesNotMatch(cleanup.sql, /status!='sent'/);
  assert.ok(calls.some(c => c.sql.startsWith("UPDATE subscribers SET confirmation_token=")));
});
