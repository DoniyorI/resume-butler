import assert from "node:assert/strict";
import { test } from "node:test";
import { database } from "./helpers/database.mjs";

const realService = await import("@/server/watchlist/service");
// record_watch_check stamps the database's clock; the fake takes it from the `now` each call is given
const withClock = (fn) => (...args) => {
  const options = args.findLast((arg) => arg && typeof arg === "object" && "now" in arg);
  if (options) args[0].now = options.now;
  return fn(...args);
};
const service = { ...realService };
for (const name of ["refreshCompany", "addCompany", "checkCompany", "refreshStale", "runWatchlistCron"]) service[name] = withClock(realService[name]);
const { HttpError } = await import("@/server/http");
const { normalizePostingIdentity } = await import("@/lib/postingIdentity");

const user = "11111111-1111-4111-8111-111111111111";
const other = "99999999-9999-4999-8999-999999999999";
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const HOUR = 3_600_000;
const T0 = Date.parse("2026-11-13T12:00:00Z");
const iso = (ms) => new Date(ms).toISOString();

const post = (n, patch = {}) => ({
  postingId: String(1000 + n),
  title: `Backend Engineer ${n}`,
  location: "Remote",
  url: `https://job-boards.greenhouse.io/acme/jobs/${1000 + n}`,
  description: `Description ${n}`,
  workplaceType: "",
  employmentType: "",
  postedAt: iso(T0 - n * 86_400_000),
  ...patch,
});
const boardOf = (postings, total = postings.length) => ({ name: "", total, postings });
// A fetchBoard that serves `current.board` and records what it was asked for
function feed(board) {
  const state = { board, calls: [] };
  state.fetchBoard = async (request) => {
    state.calls.push(request);
    if (state.board instanceof Error) throw state.board;
    return state.board;
  };
  return state;
}
const company = (id, owner, patch = {}) => ({
  id, user_id: owner, platform: "greenhouse", board_token: "acme", name: "Acme", title_keywords: [],
  last_checked_at: null, last_error: "", open_count: null, created_at: iso(T0 - 1000), ...patch,
});
const stored = (id, owner, companyId, n, patch = {}) => ({
  id, user_id: owner, company_id: companyId, posting_id: String(1000 + n), title: `Backend Engineer ${n}`, location: "Remote",
  url: `https://job-boards.greenhouse.io/acme/jobs/${1000 + n}`, description: `Description ${n}`, workplace_type: "", employment_type: "",
  posted_at: iso(T0 - n * 86_400_000), first_seen_at: iso(T0 - 5 * HOUR), last_seen_at: iso(T0 - 5 * HOUR),
  closed_at: null, dismissed_at: null, saved_at: null, ...patch,
});
const rowsOf = (db, table, owner) => db.tables[table].filter((row) => !owner || row.user_id === owner);
const quiet = (t) => t.mock.method(console, "error", () => {});

test("refresh adds matching postings, then updates, closes and reopens them", async () => {
  const c = uuid(1);
  const db = database({ watched_companies: [company(c, user, { title_keywords: ["engineer"] })], watched_postings: [] });
  const board = feed(boardOf([post(1), post(2, { title: "Product Designer" }), post(3)], 3));

  let result = await service.refreshCompany(db, user, { id: c }, { now: T0, fetchBoard: board.fetchBoard });
  assert.deepEqual(result, { added: 2, updated: 0, closed: 0 });
  assert.deepEqual(board.calls, [{ platform: "greenhouse", token: "acme" }]);
  assert.deepEqual(rowsOf(db, "watched_postings").map((r) => r.posting_id).sort(), ["1001", "1003"]);
  const [first] = rowsOf(db, "watched_postings");
  assert.deepEqual([first.user_id, first.company_id, first.first_seen_at, first.closed_at ?? null], [user, c, iso(T0), null]);
  const [row] = rowsOf(db, "watched_companies");
  assert.deepEqual([row.last_checked_at, row.last_error, row.open_count], [iso(T0), "", 3]);

  // 1001 changes, 1003 leaves the board, 1004 appears
  board.board = boardOf([post(1, { title: "Backend Engineer I (updated)", description: "New text" }), post(4)], 2);
  result = await service.refreshCompany(db, user, { id: c }, { now: T0 + 2 * HOUR, fetchBoard: board.fetchBoard });
  assert.deepEqual(result, { added: 1, updated: 1, closed: 1 });
  const byId = Object.fromEntries(rowsOf(db, "watched_postings").map((r) => [r.posting_id, r]));
  assert.deepEqual([byId[1001].title, byId[1001].description, byId[1001].last_seen_at], ["Backend Engineer I (updated)", "New text", iso(T0 + 2 * HOUR)]);
  assert.equal(byId[1001].first_seen_at, iso(T0));
  assert.equal(byId[1003].closed_at, iso(T0 + 2 * HOUR));
  assert.equal(byId[1004].first_seen_at, iso(T0 + 2 * HOUR));

  // Unchanged: only last_seen_at moves
  result = await service.refreshCompany(db, user, { id: c }, { now: T0 + 4 * HOUR, fetchBoard: board.fetchBoard });
  assert.deepEqual(result, { added: 0, updated: 0, closed: 0 });
  assert.equal(rowsOf(db, "watched_postings").find((r) => r.posting_id === "1004").last_seen_at, iso(T0 + 4 * HOUR));
  assert.equal(rowsOf(db, "watched_postings").find((r) => r.posting_id === "1003").closed_at, iso(T0 + 2 * HOUR)); // still closed, not re-closed

  // 1003 comes back: reopened
  board.board = boardOf([post(1, { title: "Backend Engineer I (updated)", description: "New text" }), post(3), post(4)], 3);
  result = await service.refreshCompany(db, user, { id: c }, { now: T0 + 6 * HOUR, fetchBoard: board.fetchBoard });
  assert.deepEqual(result, { added: 0, updated: 1, closed: 0 });
  assert.equal(rowsOf(db, "watched_postings").find((r) => r.posting_id === "1003").closed_at, null);
});

test("a changed keyword list closes postings that no longer match", async () => {
  const c = uuid(1);
  const db = database({ watched_companies: [company(c, user, { title_keywords: ["engineer"] })], watched_postings: [] });
  const board = feed(boardOf([post(1), post(2, { title: "Senior Designer" })]));
  await service.refreshCompany(db, user, { id: c }, { now: T0, fetchBoard: board.fetchBoard });
  assert.equal(rowsOf(db, "watched_postings").length, 1);
  await service.updateKeywords(db, user, c, ["DESIGNER", "designer ", " "]);
  assert.deepEqual(rowsOf(db, "watched_companies")[0].title_keywords, ["designer"]);
  const result = await service.refreshCompany(db, user, { id: c }, { now: T0 + HOUR, fetchBoard: board.fetchBoard });
  assert.deepEqual(result, { added: 1, updated: 0, closed: 1 });
});

test("with no keywords the 100 most recently posted are kept, never more", async () => {
  const c = uuid(1);
  const db = database({ watched_companies: [company(c, user)], watched_postings: [] });
  const postings = Array.from({ length: 150 }, (_, i) => post(i + 1)); // post(n) is n days old
  postings.push(post(500, { postedAt: null }));
  const board = feed(boardOf(postings.reverse(), 151));
  const result = await service.refreshCompany(db, user, { id: c }, { now: T0, fetchBoard: board.fetchBoard });
  assert.equal(result.added, 100);
  const ids = rowsOf(db, "watched_postings").map((r) => r.posting_id);
  assert.equal(ids.includes("1001"), true); // newest
  assert.equal(ids.includes("1100"), true);
  assert.equal(ids.includes("1101"), false);
  assert.equal(ids.includes("1500"), false); // undated goes last
  assert.equal(rowsOf(db, "watched_companies")[0].open_count, 151);

  // keywords apply the same cap, and ties keep board order
  const tied = Array.from({ length: 120 }, (_, i) => post(i + 1, { postedAt: iso(T0 - 1000) }));
  const second = database({ watched_companies: [company(c, user, { title_keywords: ["backend"] })], watched_postings: [] });
  await service.refreshCompany(second, user, { id: c }, { now: T0, fetchBoard: feed(boardOf(tied)).fetchBoard });
  assert.deepEqual(rowsOf(second, "watched_postings").map((r) => r.posting_id).sort(), tied.slice(0, 100).map((p) => p.postingId).sort());
});

test("closed postings are forgotten after 30 days unless saved", async () => {
  const c = uuid(1);
  const old = iso(T0 - 31 * 86_400_000);
  const recent = iso(T0 - 29 * 86_400_000);
  const db = database({
    watched_companies: [company(c, user)],
    watched_postings: [
      stored(uuid(11), user, c, 11, { closed_at: old }),
      stored(uuid(12), user, c, 12, { closed_at: old, saved_at: old }),
      stored(uuid(13), user, c, 13, { closed_at: recent }),
      stored(uuid(14), user, c, 14, { closed_at: old, dismissed_at: old }),
    ],
  });
  // Another user's old closed posting is never touched
  db.tables.watched_companies.push(company(uuid(2), other));
  db.tables.watched_postings.push(stored(uuid(21), other, uuid(2), 21, { closed_at: old }));
  await service.refreshCompany(db, user, { id: c }, { now: T0, fetchBoard: feed(boardOf([post(1)])).fetchBoard });
  const kept = rowsOf(db, "watched_postings", user).map((r) => r.posting_id).sort();
  assert.deepEqual(kept, ["1001", "1012", "1013"]); // the new one, the saved one, the one closed 29 days ago
  assert.equal(rowsOf(db, "watched_postings", other).length, 1);
});

test("a closed posting that returns after 30 days is reopened, not deleted", async () => {
  const c = uuid(1);
  const old = iso(T0 - 40 * 86_400_000);
  const db = database({ watched_companies: [company(c, user)], watched_postings: [stored(uuid(11), user, c, 1, { closed_at: old })] });
  await service.refreshCompany(db, user, { id: c }, { now: T0, fetchBoard: feed(boardOf([post(1)])).fetchBoard });
  const rows = rowsOf(db, "watched_postings");
  assert.deepEqual(rows.map((r) => [r.id, r.closed_at]), [[uuid(11), null]]);
});

test("throttle: 10 minutes normally, one minute even when forced", async () => {
  const c = uuid(1);
  const db = database({ watched_companies: [company(c, user, { last_checked_at: iso(T0) })], watched_postings: [] });
  const board = feed(boardOf([post(1)]));
  const run = (offsetMs, force) => service.refreshCompany(db, user, { id: c }, { now: T0 + offsetMs, force, fetchBoard: board.fetchBoard });
  assert.deepEqual(await run(5 * 60_000, false), { skipped: true });
  assert.deepEqual(await run(30_000, true), { skipped: true });
  assert.deepEqual(await run(9 * 60_000, false), { skipped: true });
  assert.equal(board.calls.length, 0);
  assert.equal((await run(61_000, true)).added, 1);
  assert.equal((await run(61_000 + 5 * 60_000, false)).skipped, true);
  assert.equal((await run(61_000 + 10 * 60_000, false)).skipped, undefined);
  assert.equal(board.calls.length, 2);
});

test("a board that can't be read is recorded, keeps the postings, and clears on success", async (t) => {
  quiet(t);
  const c = uuid(1);
  const db = database({ watched_companies: [company(c, user)], watched_postings: [stored(uuid(11), user, c, 1)] });
  const board = feed(new HttpError(502, "Could not read that job board right now."));
  let result = await service.refreshCompany(db, user, { id: c }, { now: T0, fetchBoard: board.fetchBoard });
  assert.deepEqual(result, { added: 0, updated: 0, closed: 0, error: "Could not read that job board right now." });
  let [row] = rowsOf(db, "watched_companies");
  assert.deepEqual([row.last_checked_at, row.last_error], [iso(T0), "Could not read that job board right now."]);
  assert.equal(rowsOf(db, "watched_postings")[0].closed_at ?? null, null);

  board.board = new HttpError(404, "That job board was not found. Check the link.");
  result = await service.refreshCompany(db, user, { id: c }, { now: T0 + HOUR, fetchBoard: board.fetchBoard });
  assert.equal(result.error, "That job board was not found. Check the link.");

  board.board = new Error("SECRET internals");
  result = await service.refreshCompany(db, user, { id: c }, { now: T0 + 2 * HOUR, fetchBoard: board.fetchBoard });
  assert.equal(result.error, "Could not read that job board right now.");

  board.board = boardOf([post(1)], 1);
  result = await service.refreshCompany(db, user, { id: c }, { now: T0 + 3 * HOUR, fetchBoard: board.fetchBoard });
  assert.equal(result.error, undefined);
  [row] = rowsOf(db, "watched_companies");
  assert.deepEqual([row.last_error, row.open_count], ["", 1]);
});

test("addCompany reads the board once, stores the company and runs the first refresh", async () => {
  const db = database({ watched_companies: [], watched_postings: [] });
  const board = feed({ name: "Acme Corp", total: 2, postings: [post(1), post(2, { title: "Cook" })] });
  const added = await service.addCompany(db, user, { link: "https://boards.greenhouse.io/acme/jobs/5", keywords: " Engineer, engineer, DATA " }, { now: T0, fetchBoard: board.fetchBoard });
  assert.equal(board.calls.length, 1);
  assert.deepEqual(board.calls[0], { platform: "greenhouse", token: "acme" });
  assert.deepEqual([added.added, added.updated, added.closed], [1, 0, 0]);
  assert.deepEqual(
    [added.company.name, added.company.platform, added.company.boardToken, added.company.keywords, added.company.openCount, added.company.lastCheckedAt],
    ["Acme Corp", "greenhouse", "acme", ["engineer", "data"], 2, iso(T0)]
  );
  assert.equal(rowsOf(db, "watched_companies")[0].user_id, user);
  assert.equal(rowsOf(db, "watched_postings").length, 1);

  // The name falls back to the token, and a name the user typed wins
  const second = database({ watched_companies: [], watched_postings: [] });
  const bare = feed(boardOf([]));
  assert.equal((await service.addCompany(second, user, { link: "ashby:Zed-Co" }, { now: T0, fetchBoard: bare.fetchBoard })).company.name, "Zed-Co");
  assert.equal((await service.addCompany(second, user, { link: "lever:zed", name: " Zed Inc " }, { now: T0, fetchBoard: bare.fetchBoard })).company.name, "Zed Inc");
});

test("addCompany refuses bad input before any request, and maps database errors", async () => {
  const db = database({ watched_companies: [], watched_postings: [] });
  const board = feed(boardOf([]));
  const add = (input) => service.addCompany(db, user, input, { now: T0, fetchBoard: board.fetchBoard });
  const refused = (status, message) => (e) => e instanceof HttpError && e.status === status && (!message || message.test(e.message));
  await assert.rejects(add({ link: "https://evil.test/acme" }), refused(400, /greenhouse:company/));
  await assert.rejects(add({ link: "" }), refused(400));
  await assert.rejects(add({}), refused(400));
  await assert.rejects(add({ link: "lever:acme", keywords: Array.from({ length: 13 }, (_, i) => `k${i}`) }), refused(400, /up to 12/));
  await assert.rejects(add({ link: "lever:acme", keywords: ["k".repeat(61)] }), refused(400, /60 characters/));
  await assert.rejects(add({ link: "lever:acme", keywords: [5] }), refused(400));
  assert.equal(board.calls.length, 0);

  db.fail("watched_companies", "insert", { code: "23505", message: "dup" });
  await assert.rejects(add({ link: "lever:acme" }), refused(409, /already watch/));
  db.fail("watched_companies", "insert", { code: "54000", message: "cap" });
  await assert.rejects(add({ link: "lever:acme" }), refused(429, /up to 20/));
  db.fail("watched_companies", "insert", { code: "42P01", message: "missing" });
  await assert.rejects(add({ link: "lever:acme" }), refused(503, /^Watchlist needs migration 021\.$/));

  board.board = new HttpError(404, "That job board was not found. Check the link.");
  await assert.rejects(add({ link: "lever:acme" }), refused(404));
  assert.equal(rowsOf(db, "watched_companies").length, 0);
});

test("missing tables: reads say setup is pending, writes a 503, the cron a flag", async () => {
  const missing = { code: "42P01", message: "relation does not exist" };
  const db = database({});
  db.fail("watched_companies", "select", missing, 99);
  db.fail("watched_postings", "select", missing, 99);
  assert.deepEqual(await service.listWatchlist(db, user), { companies: [], setupPending: true });
  assert.deepEqual(await service.listPostings(db, user), { postings: [], setupPending: true });
  assert.deepEqual(await service.runWatchlistCron(db), { setupPending: true });
  assert.equal((await service.refreshStale(db, user)).setupPending, true);
  for (const code of ["PGRST205", "PGRST200", "PGRST204", "42703"]) {
    const other = database({});
    other.fail("watched_companies", "select", { code }, 1);
    assert.equal((await service.listWatchlist(other, user)).setupPending, true, code);
  }
  db.fail("watched_companies", "delete", missing);
  await assert.rejects(service.removeCompany(db, user, uuid(1)), (e) => e.status === 503 && e.message === "Watchlist needs migration 021.");
  await assert.rejects(service.dismissPosting(db, user, uuid(1)), (e) => e.status === 503);
  await assert.rejects(service.savePosting(db, user, uuid(1)), (e) => e.status === 503);
  // A real error is not hidden as "setup pending"
  const broken = database({});
  broken.fail("watched_companies", "select", { code: "XX000", message: "boom" });
  await assert.rejects(service.listWatchlist(broken, user), (e) => e.code === "XX000");
});

test("every function refuses another user's company or posting and changes nothing", async () => {
  const mine = uuid(1), theirs = uuid(2);
  const db = database({
    watched_companies: [company(mine, user), company(theirs, other, { title_keywords: ["secret"] })],
    watched_postings: [stored(uuid(11), user, mine, 1), stored(uuid(21), other, theirs, 2)],
  });
  const before = JSON.stringify(db.tables);
  const board = feed(boardOf([post(1)]));
  const notFound = (e) => e instanceof HttpError && e.status === 404;
  await assert.rejects(service.updateKeywords(db, user, theirs, ["x"]), notFound);
  await assert.rejects(service.removeCompany(db, user, theirs), notFound);
  await assert.rejects(service.checkCompany(db, user, theirs, { now: T0, fetchBoard: board.fetchBoard }), notFound);
  await assert.rejects(service.refreshCompany(db, user, { id: theirs }, { now: T0, fetchBoard: board.fetchBoard }), notFound);
  await assert.rejects(service.dismissPosting(db, user, uuid(21)), notFound);
  await assert.rejects(service.savePosting(db, user, uuid(21)), notFound);
  await assert.rejects(service.updateKeywords(db, user, "not-a-uuid", ["x"]), notFound);
  await assert.rejects(service.dismissPosting(db, user, "not-a-uuid"), notFound);
  assert.equal(board.calls.length, 0);
  assert.equal(JSON.stringify(db.tables), before);

  assert.deepEqual((await service.listWatchlist(db, user)).companies.map((c) => c.id), [mine]);
  assert.deepEqual((await service.listPostings(db, user)).postings.map((p) => p.id), [uuid(11)]);
  assert.deepEqual((await service.listPostings(db, other)).postings.map((p) => p.id), [uuid(21)]);
  // Refreshing my company never writes under their user id
  await service.refreshCompany(db, user, { id: mine, user_id: other }, { now: T0, fetchBoard: board.fetchBoard });
  assert.equal(rowsOf(db, "watched_postings", other).length, 1);
});

test("listPostings returns open, undismissed, unsaved postings newest first with the company", async () => {
  const c = uuid(1), d = uuid(2);
  const at = (h) => iso(T0 - h * HOUR);
  // Lever and Ashby posting ids are UUIDs: a link can only be rebuilt from an id of that shape
  const pid = (n) => uuid(500 + n).toUpperCase();
  const db = database({
    watched_companies: [company(c, user, { name: "Acme", platform: "lever" }), company(d, user, { name: "Beta", platform: "ashby", board_token: "beta" })],
    watched_postings: [
      stored(uuid(11), user, c, 1, { posting_id: pid(1), first_seen_at: at(3) }),
      stored(uuid(12), user, d, 2, { posting_id: pid(2), first_seen_at: at(1) }),
      stored(uuid(13), user, c, 3, { posting_id: pid(3), first_seen_at: at(2), closed_at: at(1) }),
      stored(uuid(14), user, c, 4, { posting_id: pid(4), first_seen_at: at(2), dismissed_at: at(1) }),
      stored(uuid(15), user, c, 5, { posting_id: pid(5), first_seen_at: at(2), saved_at: at(1) }),
    ],
  });
  const { postings, setupPending } = await service.listPostings(db, user, { limit: 10 });
  assert.equal(setupPending, false);
  assert.deepEqual(postings.map((p) => [p.id, p.companyName, p.platform]), [[uuid(12), "Beta", "ashby"], [uuid(11), "Acme", "lever"]]);
  // The link is rebuilt from platform, token and posting id (lower-cased), never the stored url column
  assert.deepEqual(postings.map((p) => p.url), [`https://jobs.ashbyhq.com/beta/${pid(2).toLowerCase()}`, `https://jobs.lever.co/acme/${pid(1).toLowerCase()}`]);
  assert.equal((await service.listPostings(db, user, { limit: 1 })).postings.length, 1);
  assert.equal((await service.listPostings(db, user, { limit: 99999 })).postings.length, 2);
});

test("dismissPosting and removeCompany; removing a company drops its postings", async () => {
  const c = uuid(1);
  const db = database({ watched_companies: [company(c, user)], watched_postings: [stored(uuid(11), user, c, 1)] });
  await service.dismissPosting(db, user, uuid(11));
  assert.ok(rowsOf(db, "watched_postings")[0].dismissed_at);
  assert.deepEqual((await service.listPostings(db, user)).postings, []);
  assert.deepEqual(await service.removeCompany(db, user, c), { id: c });
  assert.equal(rowsOf(db, "watched_companies").length, 0);
  await assert.rejects(service.removeCompany(db, user, c), (e) => e.status === 404);
});

test("savePosting saves a job from the canonical link, never an application", async () => {
  const c = uuid(1);
  const lever = "0a1b2c3d-1111-4222-8333-444455556666";
  const db = database({
    watched_companies: [company(c, user, { name: "Acme Inc", platform: "lever", board_token: "acme" })],
    watched_postings: [
      stored(uuid(11), user, c, 1, {
        posting_id: lever, title: "Staff Engineer", location: "Remote, US", url: `https://jobs.lever.co/acme/${lever}`,
        description: "Build things.\n- Python", workplace_type: "remote", employment_type: "Full-time",
      }),
    ],
    applications: [],
  });
  const rpcCalls = [];
  const jobId = uuid(77);
  db.rpc = async (name, args) => { rpcCalls.push({ name, args }); return { data: { id: jobId }, error: null }; };

  assert.equal(await service.savePosting(db, user, uuid(11)), jobId);
  assert.equal(rpcCalls.length, 1);
  const [{ name, args }] = rpcCalls;
  assert.equal(name, "save_job_opportunity");
  assert.equal(args.p_user_id, user);
  assert.equal(args.p_resume_id, null);
  const payload = args.p_payload;
  assert.deepEqual(
    [payload.company, payload.role, payload.location, payload.portal_link, payload.job_description, payload.workplace_type, payload.employment_type, payload.source_site],
    ["Acme Inc", "Staff Engineer", "Remote, US", `https://jobs.lever.co/acme/${lever}`, "Build things.\n- Python", "remote", "Full-time", "lever"]
  );
  assert.equal(normalizePostingIdentity({ url: payload.portal_link }).platform, "lever");
  assert.equal(rowsOf(db, "applications").length, 0);
  assert.ok(rowsOf(db, "watched_postings")[0].saved_at);
  assert.deepEqual((await service.listPostings(db, user)).postings, []);
});

test("savePosting leaves the posting unsaved when saving the job fails", async () => {
  const c = uuid(1);
  const db = database({ watched_companies: [company(c, user)], watched_postings: [stored(uuid(11), user, c, 1)] });
  db.rpc = async () => ({ data: null, error: { code: "54000", message: "cap" } });
  await assert.rejects(service.savePosting(db, user, uuid(11)), (e) => e.status === 429);
  assert.equal(rowsOf(db, "watched_postings")[0].saved_at, null);
});

test("refreshStale checks the user's oldest unchecked companies, at most `max`, within the deadline", async () => {
  const ids = [1, 2, 3, 4].map(uuid);
  const db = database({
    watched_companies: [
      company(ids[0], user, { board_token: "a", last_checked_at: iso(T0 - 1 * HOUR) }), // fresh: skipped
      company(ids[1], user, { board_token: "b", last_checked_at: iso(T0 - 30 * HOUR) }),
      company(ids[2], user, { board_token: "c", last_checked_at: null }),
      company(ids[3], user, { board_token: "d", last_checked_at: iso(T0 - 20 * HOUR) }),
      company(uuid(9), other, { board_token: "z", last_checked_at: null }),
    ],
    watched_postings: [],
  });
  const board = feed(boardOf([post(1)]));
  const result = await service.refreshStale(db, user, { max: 2, now: T0, fetchBoard: board.fetchBoard });
  assert.deepEqual(board.calls.map((c) => c.token), ["c", "b"]);
  assert.deepEqual([result.refreshed, result.added], [2, 2]);

  const none = feed(boardOf([]));
  assert.equal((await service.refreshStale(db, user, { deadlineMs: 0, now: T0 + 40 * HOUR, fetchBoard: none.fetchBoard })).refreshed, 0);
  assert.equal(none.calls.length, 0);
  const rest = await service.refreshStale(db, user, { now: T0 + 40 * HOUR, fetchBoard: none.fetchBoard });
  assert.equal(rest.refreshed, 4);
  assert.equal(none.calls.some((c) => c.token === "z"), false);
});

test("checkCompany forces a check but still waits a minute", async () => {
  const c = uuid(1);
  const db = database({ watched_companies: [company(c, user, { last_checked_at: iso(T0 - 5 * 60_000) })], watched_postings: [] });
  const board = feed(boardOf([post(1)]));
  assert.equal((await service.checkCompany(db, user, c, { now: T0, fetchBoard: board.fetchBoard })).added, 1);
  assert.deepEqual(await service.checkCompany(db, user, c, { now: T0 + 10_000, fetchBoard: board.fetchBoard }), { skipped: true });
});

test("the daily run refreshes each company under its own user and survives failures", async (t) => {
  quiet(t);
  const a = uuid(1), b = uuid(2), c = uuid(3), d = uuid(4);
  const db = database({
    watched_companies: [
      company(a, user, { board_token: "same", last_checked_at: iso(T0 - 5 * HOUR) }),
      company(b, other, { board_token: "same", last_checked_at: null }),
      company(c, other, { board_token: "boom", name: "SecretCo", last_checked_at: iso(T0 - 9 * HOUR) }),
      company(d, user, { board_token: "fresh", last_checked_at: iso(T0 - 1000) }),
    ],
    watched_postings: [],
  });
  const asked = [];
  const fetchBoard = async ({ token }) => {
    asked.push(token);
    if (token === "boom") throw new Error("vendor exploded");
    return boardOf([post(1)]);
  };
  const result = await service.runWatchlistCron(db, { now: T0, fetchBoard });
  assert.deepEqual(asked, ["same", "boom", "same"]); // never-checked first, then oldest
  assert.deepEqual(result, { companies: 4, refreshed: 2, skipped: 1, failed: 1, added: 2, updated: 0, closed: 0 });
  assert.deepEqual(rowsOf(db, "watched_postings").map((r) => [r.user_id, r.company_id]).sort(), [[user, a], [other, b]].sort());
  assert.equal(rowsOf(db, "watched_companies").find((r) => r.id === c).last_error, "Could not read that job board right now.");
  const text = JSON.stringify(result);
  assert.equal(text.includes("SecretCo") || text.includes(user) || text.includes(other), false);

  // A failure that throws (not recorded) is counted, and the run goes on
  const flaky = database({ watched_companies: [company(a, user), company(b, other)], watched_postings: [] });
  flaky.fail("watched_postings", "select", { code: "XX000", message: "boom" });
  const counted = await service.runWatchlistCron(flaky, { now: T0, fetchBoard: async () => boardOf([post(1)]) });
  assert.deepEqual([counted.failed, counted.refreshed], [1, 1]);

  const limited = await service.runWatchlistCron(db, { maxCompanies: 1, now: T0 + 30 * HOUR, fetchBoard });
  assert.equal(limited.companies, 1);
  const out = await service.runWatchlistCron(db, { deadlineMs: 0, now: T0 + 30 * HOUR, fetchBoard });
  assert.deepEqual([out.refreshed, out.failed], [0, 0]);
});

// ---------- failed and empty reads ----------

const NOT_FOUND = "That job board was not found. Check the link.";
const UNREADABLE = "Could not read that job board right now.";
const openCompany = (c, patch) => database({
  watched_companies: [company(c, user, patch)],
  watched_postings: [stored(uuid(11), user, c, 1), stored(uuid(12), user, c, 2)],
});
const closedIds = (db) => rowsOf(db, "watched_postings").filter((r) => r.closed_at).map((r) => r.id).sort();

test("an empty board is believed only on the second check in a row", async () => {
  const c = uuid(1);
  const db = openCompany(c, { open_count: 2 });
  const board = feed(boardOf([], 0));

  let result = await service.refreshCompany(db, user, { id: c }, { now: T0, fetchBoard: board.fetchBoard });
  assert.deepEqual(result, { added: 0, updated: 0, closed: 0 });
  assert.deepEqual(closedIds(db), []); // the first empty check closes nothing
  let [row] = rowsOf(db, "watched_companies");
  assert.deepEqual([row.open_count, row.last_error, row.last_checked_at], [0, "", iso(T0)]); // and remembers it

  result = await service.refreshCompany(db, user, { id: c }, { now: T0 + HOUR, fetchBoard: board.fetchBoard });
  assert.deepEqual(result, { added: 0, updated: 0, closed: 2 });
  assert.deepEqual(closedIds(db), [uuid(11), uuid(12)]);
  [row] = rowsOf(db, "watched_companies");
  assert.deepEqual([row.open_count, row.last_error], [0, ""]);
});

test("a board that reports postings but yields none is a failed read and closes nothing", async () => {
  const c = uuid(1);
  // open_count 0 would make an empty board believable; a non-empty total must still never close anything
  const db = openCompany(c, { open_count: 0 });
  const result = await service.refreshCompany(db, user, { id: c }, { now: T0, fetchBoard: feed(boardOf([], 7)).fetchBoard });
  assert.deepEqual(result, { added: 0, updated: 0, closed: 0, error: UNREADABLE });
  assert.deepEqual(closedIds(db), []);
  const [row] = rowsOf(db, "watched_companies");
  assert.deepEqual([row.last_error, row.last_checked_at, row.open_count], [UNREADABLE, iso(T0), 0]);
});

test("a 404 closes the company's open postings; a 502 or a timeout closes nothing", async (t) => {
  quiet(t);
  const c = uuid(1);
  const db = openCompany(c);
  db.tables.watched_postings.push(stored(uuid(13), user, c, 3, { closed_at: iso(T0 - 86_400_000) }));
  db.tables.watched_companies.push(company(uuid(2), other));
  db.tables.watched_postings.push(stored(uuid(21), other, uuid(2), 9));

  for (const [offset, failure] of [[0, new HttpError(502, UNREADABLE)], [HOUR, Object.assign(new Error("timed out"), { name: "TimeoutError" })]]) {
    const result = await service.refreshCompany(db, user, { id: c }, { now: T0 + offset, fetchBoard: feed(failure).fetchBoard });
    assert.deepEqual(result, { added: 0, updated: 0, closed: 0, error: UNREADABLE });
    assert.deepEqual(closedIds(db), [uuid(13)]);
  }

  const result = await service.refreshCompany(db, user, { id: c }, { now: T0 + 2 * HOUR, fetchBoard: feed(new HttpError(404, NOT_FOUND)).fetchBoard });
  assert.deepEqual(result, { added: 0, updated: 0, closed: 2, error: NOT_FOUND });
  const [row] = rowsOf(db, "watched_companies", user);
  assert.deepEqual([row.last_error, row.last_checked_at], [NOT_FOUND, iso(T0 + 2 * HOUR)]);
  assert.deepEqual(closedIds(db), [uuid(11), uuid(12), uuid(13)]);
  assert.equal(rowsOf(db, "watched_postings").find((r) => r.id === uuid(13)).closed_at, iso(T0 - 86_400_000)); // not re-closed
  assert.equal(rowsOf(db, "watched_postings").find((r) => r.id === uuid(21)).closed_at ?? null, null); // another user's untouched
});

test("a failure while applying a board is recorded on the company, not thrown", async (t) => {
  quiet(t);
  const c = uuid(1);
  const db = database({ watched_companies: [company(c, user)], watched_postings: [] });
  db.fail("watched_postings", "select", { code: "XX000", message: "SECRET internals" });
  const result = await service.refreshCompany(db, user, { id: c }, { now: T0, fetchBoard: feed(boardOf([post(1)])).fetchBoard });
  assert.deepEqual(result, { added: 0, updated: 0, closed: 0, error: UNREADABLE });
  const [row] = rowsOf(db, "watched_companies");
  assert.deepEqual([row.last_error, row.last_checked_at], [UNREADABLE, iso(T0)]);
});

test("refreshStale carries on past a company that fails", async (t) => {
  quiet(t);
  const [a, b, c] = [1, 2, 3].map(uuid);
  const db = database({
    watched_companies: [
      company(a, user, { board_token: "first", last_checked_at: iso(T0 - 40 * HOUR) }),
      company(b, user, { board_token: "boom", last_checked_at: iso(T0 - 30 * HOUR) }),
      company(c, user, { board_token: "third", last_checked_at: iso(T0 - 20 * HOUR) }),
    ],
    watched_postings: [],
  });
  const asked = [];
  const fetchBoard = async ({ token }) => {
    asked.push(token);
    if (token === "boom") throw new Error("vendor exploded");
    return boardOf([post(1)]);
  };
  const result = await service.refreshStale(db, user, { now: T0, fetchBoard });
  assert.deepEqual(asked, ["first", "boom", "third"]);
  assert.deepEqual([result.refreshed, result.failed, result.added], [2, 1, 2]);
  const byId = Object.fromEntries(rowsOf(db, "watched_companies").map((r) => [r.id, r]));
  assert.deepEqual([byId[a].last_checked_at, byId[a].last_error], [iso(T0), ""]);
  assert.deepEqual([byId[b].last_checked_at, byId[b].last_error], [iso(T0), UNREADABLE]);
  assert.deepEqual([byId[c].last_checked_at, byId[c].last_error], [iso(T0), ""]);
  assert.equal(JSON.stringify(result).includes("vendor exploded"), false);
});

test("addCompany keeps the company when its first check fails, and a repeat add is a 409", async (t) => {
  quiet(t);
  const db = database({ watched_companies: [], watched_postings: [] });
  // The real table is unique on (user_id, platform, board_token); the fake has no such constraint
  const from = db.from;
  db.from = (table) => {
    const query = from(table);
    if (table !== "watched_companies") return query;
    const insert = query.insert.bind(query);
    query.insert = (value) => {
      const row = [].concat(value)[0];
      if (db.tables.watched_companies.some((r) => r.user_id === row.user_id && r.platform === row.platform && r.board_token === row.board_token)) {
        db.fail("watched_companies", "insert", { code: "23505", message: "duplicate key" });
      }
      return insert(value);
    };
    return query;
  };
  const broken = feed({ name: "Acme Corp", total: 4, postings: [] }); // postings it cannot read
  const added = await service.addCompany(db, user, { link: "greenhouse:acme" }, { now: T0, fetchBoard: broken.fetchBoard });
  assert.equal(added.error, UNREADABLE);
  assert.deepEqual([added.added, added.updated, added.closed], [0, 0, 0]);
  assert.deepEqual([added.company.name, added.company.lastError, added.company.lastCheckedAt], ["Acme Corp", UNREADABLE, iso(T0)]);
  assert.equal(rowsOf(db, "watched_companies", user).length, 1);

  await assert.rejects(
    service.addCompany(db, user, { link: "https://boards.greenhouse.io/acme" }, { now: T0, fetchBoard: broken.fetchBoard }),
    (e) => e instanceof HttpError && e.status === 409 && /already watch/.test(e.message)
  );
  assert.equal(rowsOf(db, "watched_companies", user).length, 1);
});

// ---------- links and saving ----------

const LEVER = "0a1b2c3d-1111-4222-8333-444455556666";

test("a stored url column is ignored: listings and saving use the rebuilt link", async () => {
  const c = uuid(1);
  const evil = `https://evil.example/jobs/${LEVER}`;
  const db = database({
    watched_companies: [company(c, user, { name: "Acme Inc", platform: "lever", board_token: "acme" })],
    watched_postings: [
      stored(uuid(11), user, c, 1, { posting_id: LEVER.toUpperCase(), url: evil, title: "Staff Engineer" }),
      stored(uuid(12), user, c, 2, { posting_id: "not-a-uuid", url: `https://jobs.lever.co/acme/${LEVER}` }),
    ],
    applications: [],
  });
  const payloads = [];
  db.rpc = async (name, args) => { payloads.push(args.p_payload); return { data: { id: uuid(77) }, error: null }; };

  // The posting whose id cannot make a link is left out of the list
  const { postings } = await service.listPostings(db, user);
  assert.deepEqual(postings.map((p) => [p.id, p.url]), [[uuid(11), `https://jobs.lever.co/acme/${LEVER}`]]);

  await service.savePosting(db, user, uuid(11));
  assert.equal(payloads[0].portal_link, `https://jobs.lever.co/acme/${LEVER}`);
  assert.equal(JSON.stringify(payloads).includes("evil.example"), false);

  // A link that cannot be verified is refused and nothing is saved
  await assert.rejects(service.savePosting(db, user, uuid(12)), (e) => e instanceof HttpError && e.status === 400 && /could not be verified/.test(e.message));
  assert.equal(payloads.length, 1);
  assert.equal(rowsOf(db, "watched_postings").find((r) => r.id === uuid(12)).saved_at, null);
});

test("saving the same posting twice at once leaves one saved job, one saved_at and no application", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: T0 });
  const c = uuid(1);
  const db = database({
    watched_companies: [company(c, user, { name: "Acme Inc", platform: "lever", board_token: "acme" })],
    watched_postings: [stored(uuid(11), user, c, 1, { posting_id: LEVER, title: "Staff Engineer" })],
    applications: [],
    job_opportunities: [],
  });
  // save_job_opportunity is one row per posting link; the second call is the first one's update
  let calls = 0;
  db.rpc = async (name, args) => {
    assert.equal(name, "save_job_opportunity");
    const nth = ++calls;
    if (nth === 2) {
      await new Promise((resolve) => setImmediate(resolve)); // the slower caller lands later...
      t.mock.timers.tick(5000); // ...and the clock has moved on
    }
    const link = args.p_payload.portal_link;
    let job = db.tables.job_opportunities.find((j) => j.portal_link === link);
    if (!job) { job = { id: uuid(70), user_id: args.p_user_id, portal_link: link }; db.tables.job_opportunities.push(job); }
    return { data: { id: job.id }, error: null };
  };

  const ids = await Promise.all([service.savePosting(db, user, uuid(11)), service.savePosting(db, user, uuid(11))]);
  assert.deepEqual(ids, [uuid(70), uuid(70)]);
  assert.equal(db.tables.job_opportunities.length, 1);
  assert.equal(rowsOf(db, "applications").length, 0);
  assert.equal(rowsOf(db, "watched_postings")[0].saved_at, iso(T0)); // set by the first save, not moved by the second
  assert.deepEqual((await service.listPostings(db, user)).postings, []);
});

// ---------- what the server may write ----------

// Records every payload sent to watched_companies by insert or update
function recording(db) {
  const sent = [];
  const from = db.from;
  db.from = (table) => {
    const query = from(table);
    if (table !== "watched_companies") return query;
    for (const operation of ["insert", "update"]) {
      const original = query[operation].bind(query);
      query[operation] = (value) => { sent.push({ operation, value }); return original(value); };
    }
    return query;
  };
  return sent;
}

test("the server never writes last_checked_at, last_error or open_count to watched_companies directly", async (t) => {
  quiet(t);
  const db = database({ watched_companies: [], watched_postings: [] });
  const sent = recording(db);
  const ok = feed({ name: "Acme", total: 1, postings: [post(1)] });
  const { company: added } = await service.addCompany(db, user, { link: "greenhouse:acme", keywords: "engineer" }, { now: T0, fetchBoard: ok.fetchBoard });
  await service.updateKeywords(db, user, added.id, ["data"]);
  await service.checkCompany(db, user, added.id, { now: T0 + HOUR, fetchBoard: feed(new HttpError(404, NOT_FOUND)).fetchBoard });
  await service.checkCompany(db, user, added.id, { now: T0 + 2 * HOUR, fetchBoard: ok.fetchBoard });
  await service.refreshStale(db, user, { now: T0 + 40 * HOUR, fetchBoard: ok.fetchBoard });
  await service.runWatchlistCron(db, { now: T0 + 80 * HOUR, fetchBoard: ok.fetchBoard });

  assert.ok(sent.length >= 2);
  for (const { operation, value } of sent) {
    const keys = Object.keys(value).sort();
    const allowed = operation === "insert" ? ["board_token", "name", "platform", "title_keywords", "user_id"] : ["name", "title_keywords"];
    assert.ok(keys.every((key) => allowed.includes(key)), `${operation} sent ${keys}`);
  }
  // Checks went through the function, which is how the row's check columns changed
  const calls = db.rpcCalls.filter((c) => c.name === "record_watch_check");
  assert.ok(calls.length >= 4);
  assert.ok(calls.every((c) => c.args.p_company_id === added.id));
  assert.deepEqual(Object.keys(calls[0].args).sort(), ["p_company_id", "p_error", "p_open_count"]);
  assert.ok(calls.some((c) => c.args.p_error === NOT_FOUND));
});

test("a database without the check function reads as setup pending", async (t) => {
  quiet(t);
  const c = uuid(1);
  const db = database({ watched_companies: [company(c, user)], watched_postings: [] });
  const realRpc = db.rpc;
  db.rpc = async (name, args) => (name === "record_watch_check" ? { data: null, error: { code: "PGRST202", message: "missing" } } : realRpc(name, args));
  // The failed read can't be recorded either: the refresh still answers with the error instead of throwing
  const result = await service.refreshCompany(db, user, { id: c }, { now: T0, fetchBoard: feed(boardOf([post(1)])).fetchBoard });
  assert.equal(typeof result.error, "string");
  assert.equal(service.isSetupPending({ code: "PGRST202" }) && service.isSetupPending({ code: "42883" }), true);
});

test("the daily run gives every user a turn: at most 5 companies per user, oldest first", async () => {
  const mine = Array.from({ length: 20 }, (_, i) => company(uuid(100 + i), user, { board_token: `m${i}`, last_checked_at: null }));
  const theirs = [0, 1].map((i) => company(uuid(200 + i), other, { board_token: `o${i}`, last_checked_at: iso(T0 - 50 * HOUR) }));
  const db = database({ watched_companies: [...mine, ...theirs], watched_postings: [] });
  const asked = [];
  const fetchBoard = async ({ token }) => { asked.push(token); return boardOf([]); };
  const result = await service.runWatchlistCron(db, { now: T0, maxCompanies: 30, fetchBoard });
  assert.equal(result.companies, 7);
  assert.equal(asked.filter((t) => t.startsWith("m")).length, 5);
  assert.deepEqual(asked.filter((t) => t.startsWith("o")).sort(), ["o0", "o1"]); // reached despite 20 never-checked companies ahead of them
  // The overall cap still applies
  const again = await service.runWatchlistCron(db, { now: T0 + 30 * HOUR, maxCompanies: 3, fetchBoard });
  assert.equal(again.companies, 3);
});
