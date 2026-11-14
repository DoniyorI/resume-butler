// Disposable real-Postgres checks of migration 021 (watchlist); no production access.
// PGLITE_MODULE=/path/to/@electric-sql/pglite/dist/index.js node --import ./tests/register.mjs scripts/qa-watchlist-sql.mjs
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
if (!process.env.PGLITE_MODULE) throw new Error("Set PGLITE_MODULE.");
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const pg = new PGlite();
let assertions = 0;
const equal = (a, b) => { assert.deepEqual(a, b); assertions++; };
const rejects = async (promise, code) => { await assert.rejects(promise, e => e.code === code || assert.fail(`expected ${code}, got ${e.code}: ${e.message}`)); assertions++; };
const scalar = async (sql, args = []) => (await pg.query(sql, args)).rows[0]?.result;
const rows = async (sql, args = []) => (await pg.query(sql, args)).rows;
async function role(name, id = "") {
  await pg.exec(`reset role; set role ${name}`);
  await pg.query("select set_config('request.jwt.claim.role',$1,false),set_config('request.jwt.claim.sub',$2,false)", [name, id]);
}
const insertInto = (table, row) => {
  const keys = Object.keys(row);
  return pg.query(`insert into public.${table}(${keys.join(",")}) values(${keys.map((_, i) => `$${i + 1}`).join(",")}) returning id`, Object.values(row));
};
const user = randomUUID(), other = randomUUID();
const uuid0 = () => randomUUID();
try {
  await pg.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.role() returns text language sql stable as $$ select current_setting('request.jwt.claim.role',true) $$;
    create function public.uuid_generate_v4() returns uuid language sql as $$ select gen_random_uuid() $$;
    alter default privileges in schema public grant all on tables to service_role;
    grant usage on schema public,auth to anon,authenticated,service_role;
    grant execute on all functions in schema auth to anon,authenticated,service_role;`);
  const directory = new URL("../supabase/migrations/", import.meta.url);
  const files = (await readdir(directory)).filter(f => /^\d{3}_.*\.sql$/.test(f)).sort();
  assert.ok(files.includes("021_watchlist.sql")); assertions++;
  for (const file of files) {
    await pg.exec((await readFile(new URL(file, directory), "utf8")).replace('create extension if not exists "uuid-ossp";', ""));
    if (file.startsWith("012_")) await pg.exec("grant all on all tables in schema public to authenticated,service_role");
  }
  assertions++; // all migrations applied

  await pg.query("insert into auth.users(id,email) values($1,'watch-qa@example.test'),($2,'other-qa@example.test')", [user, other]);

  const company = (patch = {}) => insertInto("watched_companies", { user_id: user, platform: "ashby", board_token: "acme", name: "Acme", ...patch });
  const posting = (companyId, patch = {}) => insertInto("watched_postings", { user_id: user, company_id: companyId, posting_id: "p1", title: "Engineer", url: "https://jobs.ashbyhq.com/acme/p1", ...patch });

  // Owner: insert, read, update, delete through RLS on both tables
  await role("authenticated", user);
  const c1 = (await company()).rows[0].id;
  const [{ updated_at: created }] = await rows("select updated_at from public.watched_companies where id=$1", [c1]);
  await new Promise(r => setTimeout(r, 5));
  await pg.query("update public.watched_companies set name='Acme Inc', title_keywords=array['engineer'] where id=$1", [c1]);
  const [edited] = await rows("select name,title_keywords,open_count,last_error,updated_at from public.watched_companies where id=$1", [c1]);
  equal([edited.name, edited.title_keywords, edited.open_count, edited.last_error], ["Acme Inc", ["engineer"], null, ""]);
  assert.ok(edited.updated_at > created); assertions++;
  const p1 = (await posting(c1)).rows[0].id;
  const p2 = (await posting(c1, { posting_id: "p2", title: "Designer" })).rows[0].id;
  equal(await scalar("select count(*)::int as result from public.watched_postings"), 2);
  await pg.query("update public.watched_postings set dismissed_at=now(), saved_at=now(), closed_at=now(), description='text' where id=$1", [p1]);
  equal(await scalar("select description as result from public.watched_postings where id=$1", [p1]), "text");

  // Users cannot write the check columns; they may edit name and keywords
  const refused = (sql, args = []) => rejects(pg.query(sql, args), "42501");
  await refused("update public.watched_companies set last_checked_at=null where id=$1", [c1]);
  await refused("update public.watched_companies set last_checked_at=now() where id=$1", [c1]);
  await refused("update public.watched_companies set last_error='x' where id=$1", [c1]);
  await refused("update public.watched_companies set open_count=1 where id=$1", [c1]);
  await refused("update public.watched_companies set created_at=now() where id=$1", [c1]);
  await refused("update public.watched_companies set updated_at=now() where id=$1", [c1]);
  await refused("update public.watched_companies set id=gen_random_uuid() where id=$1", [c1]);
  await refused("update public.watched_companies set user_id=user_id where id=$1", [c1]);
  await refused("update public.watched_companies set platform='lever' where id=$1", [c1]);
  equal((await pg.query("update public.watched_companies set name='Acme Two', title_keywords=array['a','b'] where id=$1", [c1])).affectedRows, 1);
  await refused("insert into public.watched_companies(user_id,platform,board_token,name,last_checked_at) values($1,'ashby','ins1','N',null)", [user]);
  await refused("insert into public.watched_companies(user_id,platform,board_token,name,created_at) values($1,'ashby','ins2','N',now())", [user]);
  await refused("insert into public.watched_companies(user_id,platform,board_token,name,open_count) values($1,'ashby','ins3','N',3)", [user]);
  await pg.query("insert into public.watched_companies(user_id,platform,board_token,name,title_keywords) values($1,'ashby','ins4','N',array['x'])", [user]); assertions++;
  const [fresh] = await rows("select last_checked_at,last_error,open_count from public.watched_companies where board_token='ins4'");
  equal([fresh.last_checked_at, fresh.last_error, fresh.open_count], [null, "", null]);
  await pg.query("delete from public.watched_companies where board_token='ins4'");

  // record_watch_check: the only way the check columns move
  const check = (id, error, count) => pg.query("select public.record_watch_check($1,$2,$3)", [id, error, count]);
  const state = async (id) => (await rows("select last_checked_at,last_error,open_count from public.watched_companies where id=$1", [id]))[0];
  await role("service_role");
  await pg.query("update public.watched_companies set last_checked_at=now()-interval '2 days' where id=$1", [c1]);
  await role("authenticated", user);
  await check(c1, "boom", 7);
  let after = await state(c1);
  assert.ok(Math.abs(Date.now() - new Date(after.last_checked_at).getTime()) < 60_000); assertions++;
  equal([after.last_error, after.open_count], ["boom", 7]);
  await check(c1, null, -1);
  after = await state(c1);
  equal([after.last_error, after.open_count], ["", 7]); // a negative count is ignored, a null error clears
  await check(c1, "again", null);
  equal((await state(c1)).open_count, 7);
  await check(c1, "e".repeat(500), 0);
  after = await state(c1);
  equal([after.last_error.length, after.open_count], [300, 0]);
  await rejects(check(uuid0(), "x", 1), "P0002");
  await role("authenticated", other);
  const seen = await rows("select last_checked_at,last_error,open_count from public.watched_companies where id=$1", [c1]).catch(() => []);
  equal(seen, []); // not even visible
  await rejects(check(c1, "hijack", 99), "P0002");
  await role("service_role");
  equal(await state(c1), after); // nothing changed
  await role("anon");
  await rejects(check(c1, "anon", 1), "42501");
  await role("service_role");
  await check(c1, "from the job", 3);
  equal([(await state(c1)).last_error, (await state(c1)).open_count], ["from the job", 3]);
  await check((await rows("select id from public.watched_companies limit 1"))[0].id, "", 1); assertions++;
  await role("authenticated", user);

  // Another user: no read, update, delete on either table; no forging; no attaching to my company
  await role("authenticated", other);
  equal(await scalar("select count(*)::int as result from public.watched_companies"), 0);
  equal(await scalar("select count(*)::int as result from public.watched_postings"), 0);
  equal((await pg.query("update public.watched_companies set name='Hijack' where id=$1", [c1])).affectedRows, 0);
  equal((await pg.query("update public.watched_postings set title='Hijack' where id=$1", [p1])).affectedRows, 0);
  equal((await pg.query("delete from public.watched_companies where id=$1", [c1])).affectedRows, 0);
  equal((await pg.query("delete from public.watched_postings where id=$1", [p1])).affectedRows, 0);
  await rejects(company({ user_id: user, board_token: "forged" }), "42501");
  await rejects(posting(c1, { user_id: user, posting_id: "forged" }), "42501");
  await rejects(posting(c1, { user_id: other, posting_id: "attach" }), "23503");
  const otherCompany = (await company({ user_id: other })).rows[0].id; // same platform and token as mine: a different user may watch it
  const own = (await posting(otherCompany, { user_id: other, posting_id: "o1" })).rows[0].id;
  await rejects(pg.query("update public.watched_postings set company_id=$1 where id=$2", [c1, own]), "23503");
  await rejects(pg.query("update public.watched_postings set user_id=$1 where id=$2", [user, own]), "42501");
  await rejects(pg.query("update public.watched_companies set user_id=$1 where id=$2", [user, otherCompany]), "42501");

  // Anon: nothing
  await role("anon");
  for (const table of ["watched_companies", "watched_postings"]) {
    await rejects(pg.query(`select count(*) from public.${table}`), "42501");
    await rejects(pg.query(`delete from public.${table}`), "42501");
  }
  await rejects(company(), "42501");
  await rejects(posting(c1), "42501");
  await rejects(pg.query("update public.watched_companies set name='Anon'"), "42501");
  await rejects(pg.query("update public.watched_postings set title='Anon'"), "42501");

  // Duplicates
  await role("authenticated", user);
  await rejects(company(), "23505");
  await rejects(posting(c1), "23505");
  const sameBoardOtherPlatform = (await company({ platform: "lever" })).rows[0].id; // same token, other platform: allowed
  await posting(sameBoardOtherPlatform); assertions++; // same posting id under another company: allowed

  // Each CHECK rejects its bad value
  await rejects(company({ platform: "workday", board_token: "w1" }), "23514");
  await rejects(company({ board_token: "has/slash" }), "23514");
  await rejects(company({ board_token: "has.dot" }), "23514");
  await rejects(company({ board_token: "" }), "23514");
  await rejects(company({ board_token: "t".repeat(101) }), "23514");
  await rejects(company({ board_token: "n1", name: "   " }), "23514");
  await rejects(company({ board_token: "n2", name: "x".repeat(201) }), "23514");
  await rejects(company({ board_token: "n3", title_keywords: Array.from({ length: 13 }, (_, i) => `k${i}`) }), "23514");
  await role("service_role"); // users cannot name these columns at all; the CHECKs still guard the server's writes
  await rejects(company({ board_token: "n4", last_error: "e".repeat(301) }), "23514");
  await rejects(company({ board_token: "n5", open_count: -1 }), "23514");
  await role("authenticated", user);
  await rejects(posting(c1, { posting_id: "" }), "23514");
  await rejects(posting(c1, { posting_id: "i".repeat(201) }), "23514");
  await rejects(posting(c1, { posting_id: "b1", title: "  " }), "23514");
  await rejects(posting(c1, { posting_id: "b2", title: "t".repeat(301) }), "23514");
  await rejects(posting(c1, { posting_id: "b3", location: "l".repeat(301) }), "23514");
  await rejects(posting(c1, { posting_id: "b4", url: "http://jobs.ashbyhq.com/acme/b4" }), "23514");
  await rejects(posting(c1, { posting_id: "b5", url: "javascript:alert(1)" }), "23514");
  await rejects(posting(c1, { posting_id: "b6", url: "https://x.test/" + "u".repeat(2000) }), "23514");
  await rejects(posting(c1, { posting_id: "b7", description: "d".repeat(20001) }), "23514");
  await rejects(posting(c1, { posting_id: "b8", workplace_type: "moon" }), "23514");
  await rejects(posting(c1, { posting_id: "b9", employment_type: "e".repeat(41) }), "23514");
  equal(await scalar("select count(*)::int as result from public.watched_postings"), 3);

  // Keywords: total length is bounded too (800 characters joined with commas)
  await rejects(company({ board_token: "k1", title_keywords: Array.from({ length: 12 }, () => "k".repeat(70)) }), "23514");
  await pg.query("delete from public.watched_companies where board_token='k1'");
  await company({ board_token: "k2", title_keywords: Array.from({ length: 8 }, () => "k".repeat(99)) }); assertions++; // 8*99 + 7 commas = 799
  await pg.query("delete from public.watched_companies where board_token='k2'");
  const spread = (last) => [...Array.from({ length: 7 }, () => "k".repeat(99)), "k".repeat(last)];
  await company({ board_token: "k3", title_keywords: spread(100) }); assertions++; // exactly 800 characters joined
  await pg.query("delete from public.watched_companies where board_token='k3'");
  await rejects(company({ board_token: "k4", title_keywords: spread(101) }), "23514"); // 801

  // The limiter keeps every earlier key's limit and gains the two watchlist keys
  const limits = { "generate-resume": 20, "generate-cover-letter": 20, "suggest-bullets": 30, "rewrite-bullet": 120, "parse-resume": 10,
    "scan-emails": 10, "download-resume": 60, "submission-capture": 60, "watchlist-add": 20, "watchlist-check": 60 };
  for (const [key, limit] of Object.entries(limits)) {
    const outcomes = [];
    for (let i = 0; i < limit + 1; i++) outcomes.push(await scalar("select public.consume_rate_limit($1) as result", [key]));
    equal([outcomes.slice(0, limit).every(Boolean), outcomes[limit]], [true, false]);
  }
  await rejects(pg.query("select public.consume_rate_limit('nope')"), "P0001");
  await role("authenticated", other);
  equal(await scalar("select public.consume_rate_limit('watchlist-add') as result"), true); // another user has their own window
  await role("anon");
  await rejects(pg.query("select public.consume_rate_limit('watchlist-add')"), "42501");
  await role("authenticated"); // signed in as no one: auth.uid() is null, so nothing is allowed
  equal(await scalar("select public.consume_rate_limit('watchlist-add') as result"), false);
  await role("authenticated", user);

  // Deleting a company removes its postings (only those)
  equal((await pg.query("delete from public.watched_companies where id=$1", [sameBoardOtherPlatform])).affectedRows, 1);
  equal(await scalar("select count(*)::int as result from public.watched_postings"), 2);
  await role("service_role");
  equal(await scalar("select count(*)::int as result from public.watched_postings where user_id=$1", [other]), 1);

  // The caps hold for a direct insert, per user: 20 companies, 2,500 postings
  await pg.query("insert into public.watched_companies(user_id,platform,board_token,name) select $1,'greenhouse','b'||g,'Board '||g from generate_series(1,18) g", [user]);
  await role("authenticated", user);
  equal(await scalar("select count(*)::int as result from public.watched_companies"), 19 + 0); // acme + 18
  await company({ board_token: "twentieth" });
  await rejects(company({ board_token: "twenty-first" }), "54000");
  await role("authenticated", other);
  await company({ user_id: other, board_token: "unaffected" }); assertions++;
  await role("service_role");
  await pg.query("insert into public.watched_postings(user_id,company_id,posting_id,title,url) select $1,$2,'bulk'||g,'Role '||g,'https://jobs.ashbyhq.com/acme/bulk'||g from generate_series(1,2498) g", [user, c1]);
  await role("authenticated", user);
  equal(await scalar("select count(*)::int as result from public.watched_postings"), 2500);
  await rejects(posting(c1, { posting_id: "over" }), "54000");
  await role("authenticated", other);
  await posting(otherCompany, { user_id: other, posting_id: "fine" }); assertions++;

  // Applying 021 again fails and leaves nothing half-done
  await pg.exec("reset role");
  const count = () => scalar("select count(*)::int as result from pg_trigger where tgrelid in ('public.watched_companies'::regclass,'public.watched_postings'::regclass) and not tgisinternal");
  const before = await count();
  const sql = await readFile(new URL("021_watchlist.sql", directory), "utf8");
  await assert.rejects(pg.exec(sql)); assertions++;
  await pg.exec("rollback").catch(() => {});
  equal(await count(), before);
  equal(await scalar("select count(*)::int as result from public.watched_postings where user_id=$1", [user]), 2500);
  console.log(`Watchlist SQL: ${assertions} assertions passed`);
} finally { await pg.close(); }
