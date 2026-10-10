import test from "node:test";
import assert from "node:assert/strict";
import app from "../src/index.js";

const token = "admin-token-".padEnd(40, "x");
const url = "https://worker.example/api/admin/reconcile-delivery";

function request(body) {
  return new Request(url, {
    method: "POST",
    headers: {
      authorization: "Bearer " + token,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function fakeDb({ queue = { id: 7, run_id: "run-1", subscriber_id: 3, article_ids: "[11]", status: "failed", sending_started_at: null }, lock = null, oldEnough = 0, queueUpdateChanges = 1, sentInsertError = false, revertError = false, revertChanges = 1 } = {}) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              calls.push({ sql, args, operation: "first" });
              if (sql.startsWith("SELECT id,run_id,subscriber_id,article_ids,status,sending_started_at FROM delivery_queue")) return queue;
              if (sql.includes("FROM system_locks")) return lock;
              if (sql.includes("AS old_enough")) return { old_enough: oldEnough };
              return null;
            },
            async run() {
              calls.push({ sql, args, operation: "run" });
              if (sql.includes("INTO sent") && sentInsertError) throw new Error("simulated sent insert failure");
              if (sql.includes("last_error='manual-reconciliation-sent-record-write-failed'")) {
                if (revertError) throw new Error("simulated revert failure");
                return { meta: { changes: revertChanges } };
              }
              return { meta: { changes: sql.startsWith("UPDATE delivery_queue SET status='sent'") ? queueUpdateChanges : 1 } };
            },
            async all() {
              calls.push({ sql, args, operation: "all" });
              return { results: [] };
            },
          };
        },
        async first() {
          calls.push({ sql, operation: "first" });
          if (sql.includes("FROM system_locks")) return lock;
          return null;
        },
      };
    },
  };
}

async function invoke(body, DB) {
  const response = await app.fetch(request(body), { ADMIN_TOKEN: token, DB });
  return { response, body: await response.json() };
}

test("reconciliation rejects invalid queue IDs and actions before database access", async () => {
  for (const body of [
    { queue_id: 0, action: "mark_sent" },
    { queue_id: 1.5, action: "mark_sent" },
    { queue_id: "not-an-id", action: "mark_sent" },
    { queue_id: 7, action: "delete" },
  ]) {
    const DB = fakeDb();
    const { response } = await invoke(body, DB);
    assert.equal(response.status, 400);
    assert.equal(DB.calls.length, 0);
  }
});

test("reconciliation returns 404 for a queue that does not exist", async () => {
  const DB = fakeDb({ queue: null });
  const { response, body } = await invoke({ queue_id: 7, action: "mark_sent", provider_confirmed_accepted: true }, DB);
  assert.equal(response.status, 404);
  assert.match(body.error, /見つかりません/);
  assert.equal(DB.calls.filter(call => call.operation === "run").length, 0);
});

test("reconciliation refuses queue states outside sending or failed", async () => {
  const DB = fakeDb({ queue: { id: 7, status: "sent" } });
  const { response, body } = await invoke({ queue_id: 7, action: "mark_sent", provider_confirmed_accepted: true }, DB);
  assert.equal(response.status, 409);
  assert.match(body.error, /照合対象/);
  assert.equal(DB.calls.filter(call => call.operation === "run").length, 0);
});

test("reconciliation refuses changes while the delivery lock is active", async () => {
  const DB = fakeDb({ lock: { lock_token: "active", lock_until: "2999-01-01 00:00:00" } });
  const { response, body } = await invoke({ queue_id: 7, action: "mark_sent", provider_confirmed_accepted: true }, DB);
  assert.equal(response.status, 409);
  assert.match(body.error, /Workerが稼働中/);
  assert.equal(DB.calls.filter(call => call.operation === "run").length, 0);
});

test("mark_sent requires explicit provider acceptance confirmation", async () => {
  const DB = fakeDb();
  const { response, body } = await invoke({ queue_id: 7, action: "mark_sent" }, DB);
  assert.equal(response.status, 400);
  assert.match(body.error, /provider_confirmed_accepted=true/);
  assert.equal(DB.calls.filter(call => call.operation === "run").length, 0);
});

test("retry requires explicit provider non-acceptance confirmation", async () => {
  const DB = fakeDb();
  const { response, body } = await invoke({ queue_id: 7, action: "retry_confirmed_not_sent" }, DB);
  assert.equal(response.status, 400);
  assert.match(body.error, /provider_confirmed_not_accepted=true/);
  assert.equal(DB.calls.filter(call => call.operation === "run").length, 0);
});

test("a sending queue younger than 20 minutes cannot be retried", async () => {
  const DB = fakeDb({ queue: { id: 7, run_id: "run-1", subscriber_id: 3, article_ids: "[11]", status: "sending", sending_started_at: "recent" }, oldEnough: 0 });
  const { response, body } = await invoke({ queue_id: 7, action: "retry_confirmed_not_sent", provider_confirmed_not_accepted: true }, DB);
  assert.equal(response.status, 409);
  assert.match(body.error, /20分以上経過/);
  assert.equal(DB.calls.filter(call => call.operation === "run").length, 0);
});

test("mark_sent rejects malformed article_ids before any database mutation", async () => {
  const invalidArticleIds = [
    "{invalid-json", "[]", "{}", "null", "[0]", "[-1]", "[1.5]",
    "[11,0]", '["11"]', "[true]", "[null]", "[9007199254740992]",
  ];
  for (const article_ids of invalidArticleIds) {
    const DB = fakeDb({ queue: {
      id: 7, run_id: "run-1", subscriber_id: 3, article_ids,
      status: "failed", sending_started_at: null,
    }});
    const { response, body } = await invoke({
      queue_id: 7, action: "mark_sent", provider_confirmed_accepted: true,
    }, DB);
    assert.equal(response.status, 409, article_ids);
    assert.match(body.error, /article_ids/);
    assert.equal(DB.calls.filter(call => call.operation === "run").length, 0, article_ids);
    assert.equal(DB.calls.filter(call => call.sql.includes("INTO sent")).length, 0, article_ids);
    assert.equal(DB.calls.filter(call => call.sql.includes("UPDATE delivery_queue") || call.sql.includes("UPDATE delivery_runs")).length, 0, article_ids);
  }
});



test("mark_sent does not write sent records when the queue state update affects no rows", async () => {
  const DB = fakeDb({ queueUpdateChanges: 0 });
  const { response, body } = await invoke({
    queue_id: 7, action: "mark_sent", provider_confirmed_accepted: true,
  }, DB);
  assert.equal(response.status, 409);
  assert.match(body.error, /状態が変わった/);
  assert.equal(DB.calls.filter(call => call.sql.includes("INTO sent")).length, 0);
  assert.equal(DB.calls.filter(call => call.sql.includes("UPDATE delivery_queue SET status='sent'")).length, 1);
});


test("mark_sent reports when sent history insert fails but queue revert succeeds", async () => {
  const DB = fakeDb({ sentInsertError: true, revertChanges: 1 });
  const { response, body } = await invoke({
    queue_id: 7, action: "mark_sent", provider_confirmed_accepted: true,
  }, DB);
  assert.equal(response.status, 500);
  assert.equal(body.queue_id, 7);
  assert.equal(body.recovery, "queue-reverted-to-failed");
  assert.match(body.error, /キューは failed に戻しました/);
  assert.equal(DB.calls.filter(call => call.sql.includes("last_error='manual-reconciliation-sent-record-write-failed'")).length, 1);
});

test("mark_sent clearly reports when sent history insert and queue revert both fail", async () => {
  const DB = fakeDb({ sentInsertError: true, revertError: true });
  const { response, body } = await invoke({
    queue_id: 7, action: "mark_sent", provider_confirmed_accepted: true,
  }, DB);
  assert.equal(response.status, 500);
  assert.equal(body.queue_id, 7);
  assert.equal(body.recovery, "manual-database-inspection-required");
  assert.match(body.error, /自動再試行せず/);
});

test("mark_sent reports when sent history insert fails and queue revert affects zero rows", async () => {
  const DB = fakeDb({ sentInsertError: true, revertChanges: 0 });
  const { response, body } = await invoke({
    queue_id: 7, action: "mark_sent", provider_confirmed_accepted: true,
  }, DB);
  assert.equal(response.status, 500);
  assert.equal(body.recovery, "manual-database-inspection-required");
});
