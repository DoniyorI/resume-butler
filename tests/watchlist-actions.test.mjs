import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { database } from "./helpers/database.mjs";

const user = "11111111-1111-4111-8111-111111111111";
const companyId = "00000000-0000-4000-8000-000000000001";
const events = [];
const state = { db: null, allow: false };

mock.module("@/server/auth", {
  namedExports: { requireUser: async () => ({ supabase: state.db, user: { id: user } }) },
});
mock.module("next/cache", { namedExports: { revalidatePath() {} } });

const { watchCompany, checkCompanyNow } = await import("@/features/watchlist/actions");

const freshDb = () => {
  const db = database({
    watched_companies: [{
      id: companyId, user_id: user, platform: "greenhouse", board_token: "acme", name: "Acme", title_keywords: [],
      last_checked_at: null, last_error: "", open_count: null, created_at: "2026-11-01T00:00:00.000Z",
    }],
    watched_postings: [],
  });
  db.rpc = async (name, args) => {
    events.push(`rpc:${args.p_key}`);
    return { data: state.allow, error: null };
  };
  return db;
};

test("the add and check actions spend the rate limit before any request to a job board", async (t) => {
  t.mock.method(console, "warn", () => {});
  t.mock.method(globalThis, "fetch", async () => {
    events.push("fetch");
    return new Response(JSON.stringify({ jobs: [] }), { status: 200 });
  });

  // Refused: a 429 and no request left the server
  state.db = freshDb();
  state.allow = false;
  const added = await watchCompany({ link: "greenhouse:newco" });
  assert.deepEqual([added.ok, added.status], [false, 429]);
  const checked = await checkCompanyNow(companyId);
  assert.deepEqual([checked.ok, checked.status], [false, 429]);
  assert.deepEqual(events, ["rpc:watchlist-add", "rpc:watchlist-check"]);
  assert.equal(state.db.tables.watched_companies.length, 1);

  // Allowed: the limiter is consulted first, then the board is read
  events.length = 0;
  state.allow = true;
  assert.equal((await watchCompany({ link: "greenhouse:newco" })).ok, true);
  assert.deepEqual(events.slice(0, 2), ["rpc:watchlist-add", "fetch"]);
  events.length = 0;
  assert.equal((await checkCompanyNow(companyId)).ok, true);
  assert.deepEqual(events, ["rpc:watchlist-check", "fetch"]);
});
