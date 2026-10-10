import test from "node:test";
import assert from "node:assert/strict";
import { drainQueue } from "../src/index.js";

test("drainQueue skips provider send when subscriber unsubscribes after queue claim", async () => {
  const calls = [];
  const queue = {
    id: 17,
    subscriber_id: 4,
    article_ids: "[31]",
    email: "person@example.jp",
    unsubscribe_token: "unsubscribe-token",
  };
  const article = {
    id: 31,
    summary: "summary",
    what_changed: "change",
    effective_date: "2027-04-01",
    who_affected: "people",
    action_needed: "check the source",
    title: "title",
    url: "https://example.jp/source",
    source_id: "digital_rss",
  };
  const DB = {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              calls.push({ sql, args, op: "first" });
              if (sql.includes("SELECT q.id,q.subscriber_id,q.article_ids,s.email,s.unsubscribe_token")) return null;
              if (sql.includes("SELECT id FROM subscribers WHERE id=? AND confirmed=1 AND unsubscribed=0")) return null;
              return null;
            },
            async all() {
              calls.push({ sql, args, op: "all" });
              if (sql.includes("SELECT q.id,q.subscriber_id,q.article_ids,s.email,s.unsubscribe_token")) return { results: [queue] };
              if (sql.includes("SELECT a.id,a.summary,a.what_changed")) return { results: [article] };
              return { results: [] };
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
  const result = await drainQueue({
    DB,
    SIGNUP_ENABLED: "true",
    BASE_URL: "https://worker.example",
  });
  assert.equal(result.sent, 0);
  assert.equal(result.errors, 1);
  assert.ok(calls.some(c => c.sql.includes("subscriber-inactive-before-provider-send")));
  assert.ok(!calls.some(c => c.sql.includes("INSERT OR IGNORE INTO sent")));
});
