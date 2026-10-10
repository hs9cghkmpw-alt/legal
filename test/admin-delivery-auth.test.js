import test from "node:test";
import assert from "node:assert/strict";
import app from "../src/index.js";

const routes = [
  { method: "GET", path: "/api/admin/delivery-issues" },
  { method: "POST", path: "/api/admin/reconcile-delivery", body: { queue_id: 1, action: "mark_sent" } },
];

test("delivery reconciliation admin endpoints reject missing or invalid admin tokens before database access", async () => {
  const DB = {
    prepare() {
      throw new Error("unauthorized request must not touch the database");
    },
  };
  const cases = [
    { name: "missing token", env: { ADMIN_TOKEN: "a".repeat(40) }, headers: {} },
    { name: "short configured token", env: { ADMIN_TOKEN: "short" }, headers: { authorization: "Bearer short" } },
    { name: "wrong token", env: { ADMIN_TOKEN: "a".repeat(40) }, headers: { authorization: "Bearer " + "b".repeat(40) } },
  ];

  for (const route of routes) {
    for (const scenario of cases) {
      const headers = { ...scenario.headers };
      if (route.body) headers["content-type"] = "application/json";
      const req = new Request("https://worker.example" + route.path, {
        method: route.method,
        headers,
        body: route.body ? JSON.stringify(route.body) : undefined,
      });
      const res = await app.fetch(req, { ...scenario.env, DB });
      assert.equal(res.status, 401, route.method + " " + route.path + " / " + scenario.name);
      assert.match((await res.json()).error, /管理者認証/);
    }
  }
});
