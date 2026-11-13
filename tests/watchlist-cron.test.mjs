import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { database } from "./helpers/database.mjs";

const admin = { current: database({ watched_companies: [], watched_postings: [] }), created: 0 };
mock.module("@/server/supabaseAdmin", {
  namedExports: { createAdminClient: () => { admin.created++; return admin.current; } },
});
const { GET, maxDuration, dynamic } = await import("@/app/api/cron/watchlist/route");

const call = (headers = {}) => GET(new Request("https://app.test/api/cron/watchlist", { headers }));
const SECRET = "s3cret-value";

test("the cron route refuses callers without the secret and never touches the database", async () => {
  const saved = process.env.CRON_SECRET;
  try {
    delete process.env.CRON_SECRET;
    assert.equal((await call()).status, 401);
    assert.equal((await call({ authorization: "Bearer undefined" })).status, 401);
    assert.equal((await call({ authorization: "Bearer " })).status, 401);

    process.env.CRON_SECRET = SECRET;
    assert.equal((await call()).status, 401);
    assert.equal((await call({ authorization: "Bearer wrong-secret" })).status, 401);
    assert.equal((await call({ authorization: SECRET })).status, 401);
    assert.equal((await call({ authorization: `Bearer ${SECRET}x` })).status, 401);
    assert.equal(admin.created, 0);
  } finally {
    if (saved === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = saved;
  }
});

test("the cron route runs with the secret and answers with counts only", async () => {
  const saved = process.env.CRON_SECRET;
  try {
    process.env.CRON_SECRET = SECRET;
    admin.current = database({
      watched_companies: [{ id: "00000000-0000-4000-8000-000000000001", user_id: "11111111-1111-4111-8111-111111111111", platform: "ashby", board_token: "x", name: "SecretCo", title_keywords: [], last_checked_at: new Date().toISOString() }],
      watched_postings: [],
    });
    const response = await call({ authorization: `Bearer ${SECRET}` });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(Object.keys(body).sort(), ["added", "closed", "companies", "failed", "refreshed", "skipped", "updated"]);
    assert.deepEqual([body.companies, body.skipped], [1, 1]); // checked moments ago: no request made
    assert.equal(JSON.stringify(body).includes("SecretCo"), false);
    assert.equal(admin.created, 1);
  } finally {
    if (saved === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = saved;
  }
});

test("before migration 021 the cron route answers setupPending", async () => {
  const saved = process.env.CRON_SECRET;
  try {
    process.env.CRON_SECRET = SECRET;
    admin.current = database({});
    admin.current.fail("watched_companies", "select", { code: "42P01", message: "missing" });
    const response = await call({ authorization: `Bearer ${SECRET}` });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { setupPending: true });
  } finally {
    if (saved === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = saved;
  }
});

test("the route has the Hobby-plan limits and is never cached", () => {
  assert.equal(maxDuration, 60);
  assert.equal(dynamic, "force-dynamic");
});
