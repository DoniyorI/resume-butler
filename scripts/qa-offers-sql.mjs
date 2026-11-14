// Disposable real-Postgres checks of migration 022 (application offers, rate-limit keys); no production access.
// PGLITE_MODULE=/path/to/@electric-sql/pglite/dist/index.js node scripts/qa-offers-sql.mjs
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
const user = randomUUID(), other = randomUUID(), app = randomUUID(), app2 = randomUUID(), otherApp = randomUUID();
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
  assert.ok(files.includes("022_offers_and_portability.sql")); assertions++;
  for (const file of files) {
    await pg.exec((await readFile(new URL(file, directory), "utf8")).replace('create extension if not exists "uuid-ossp";', ""));
    if (file.startsWith("012_")) await pg.exec("grant all on all tables in schema public to authenticated,service_role");
  }
  assertions++; // all migrations applied

  await pg.query("insert into auth.users(id,email) values($1,'offers-qa@example.test'),($2,'other-qa@example.test')", [user, other]);
  await role("service_role");
  await pg.query("insert into public.applications(id,user_id,company) values($1,$2,'Mine'),($3,$4,'Theirs'),($5,$2,'Second')", [app, user, otherApp, other, app2]);

  // Owner: insert, read, update, delete through RLS
  await role("authenticated", user);
  const insert = (patch = {}) => {
    const row = { user_id: user, application_id: app, base_amount: 150000, ...patch };
    const keys = Object.keys(row);
    return pg.query(`insert into public.application_offers(${keys.join(",")}) values(${keys.map((_, i) => `$${i + 1}`).join(",")}) returning id,updated_at`, Object.values(row));
  };
  const { id, updated_at: created } = (await insert()).rows[0];
  equal(await scalar("select count(*)::int as result from public.application_offers"), 1);
  const [defaults] = await rows("select base_period,currency,bonus,decision,decided_on from public.application_offers where id=$1", [id]);
  equal(defaults, { base_period: "year", currency: "USD", bonus: "", decision: "pending", decided_on: null });
  await new Promise(r => setTimeout(r, 5));
  await pg.query("update public.application_offers set bonus='10%',decision='accepted',decided_on='2026-11-12' where id=$1", [id]);
  const [edited] = await rows("select bonus,decision,decided_on::text,updated_at from public.application_offers where id=$1", [id]);
  equal([edited.bonus, edited.decision, edited.decided_on], ["10%", "accepted", "2026-11-12"]);
  assert.ok(edited.updated_at > created); assertions++;
  await pg.query("update public.application_offers set decision='pending',decided_on=null where id=$1", [id]);
  equal(await scalar("select decision as result from public.application_offers where id=$1", [id]), "pending");

  // Unique per application
  await rejects(insert(), "23505");

  // Another user: no read, update, delete; no forged user_id; no attaching to my application
  await role("authenticated", other);
  equal(await scalar("select count(*)::int as result from public.application_offers"), 0);
  equal((await pg.query("update public.application_offers set bonus='Hijack' where id=$1", [id])).affectedRows, 0);
  equal((await pg.query("delete from public.application_offers where id=$1", [id])).affectedRows, 0);
  await rejects(insert({ user_id: user }), "42501");
  await rejects(insert({ user_id: other, application_id: app2 }), "23503");
  const own = (await insert({ user_id: other, application_id: otherApp })).rows[0].id;
  await rejects(pg.query("update public.application_offers set application_id=$1 where id=$2", [app2, own]), "23503");
  await rejects(pg.query("update public.application_offers set user_id=$1 where id=$2", [user, own]), "42501");

  // Anon: nothing
  await role("anon");
  await rejects(pg.query("select count(*) from public.application_offers"), "42501");
  await rejects(insert(), "42501");
  await rejects(pg.query("delete from public.application_offers"), "42501");
  await rejects(pg.query("update public.application_offers set bonus='Anon'"), "42501");

  // Each CHECK rejects its bad value (on the owner's second application)
  await role("authenticated", user);
  const bad = (patch) => rejects(insert({ application_id: app2, ...patch }), "23514");
  await bad({ base_amount: -1 });
  await bad({ base_period: "decade" });
  await bad({ currency: "usd" });
  await bad({ currency: "US" });
  await bad({ bonus: "b".repeat(501) });
  await bad({ equity: "e".repeat(501) });
  await bad({ benefits: "b".repeat(1001) });
  await bad({ notes: "n".repeat(5001) });
  await bad({ decision: "maybe" });
  await bad({ decision: "accepted" }); // a decision needs its date
  await bad({ decision: "declined", decided_on: null });
  await bad({ decision: "pending", decided_on: "2026-11-12" }); // pending has no date
  equal(await scalar("select count(*)::int as result from public.application_offers"), 1);
  await insert({ application_id: app2, base_amount: null, decision: "declined", decided_on: "2026-11-12", currency: "EUR", base_period: "hour" }); assertions++;

  // Owner delete, then deleting the application removes its offer
  equal((await pg.query("delete from public.application_offers where application_id=$1", [app2])).affectedRows, 1);
  await role("service_role");
  await pg.query("delete from public.applications where id=$1", [app]);
  equal(await scalar("select count(*)::int as result from public.application_offers where user_id=$1", [user]), 0);
  equal(await scalar("select count(*)::int as result from public.application_offers where user_id=$1", [other]), 1);

  // The rate limiter takes the two new keys, keeps the old ones and still refuses unknown ones
  await role("authenticated", user);
  equal(await scalar("select public.consume_rate_limit('export-data') as result"), true);
  equal(await scalar("select public.consume_rate_limit('import-applications') as result"), true);
  equal(await scalar("select public.consume_rate_limit('watchlist-add') as result"), true);
  equal(await scalar("select public.consume_rate_limit('generate-resume') as result"), true);
  for (let i = 0; i < 9; i++) await pg.query("select public.consume_rate_limit('export-data')");
  equal(await scalar("select public.consume_rate_limit('export-data') as result"), false); // the 11th in the hour
  await rejects(pg.query("select public.consume_rate_limit('not-a-key')"), "P0001");
  await role("anon");
  await rejects(pg.query("select public.consume_rate_limit('export-data')"), "42501");

  // Applying 022 again fails and leaves nothing half-done
  await pg.exec("reset role");
  const triggers = "select count(*)::int as result from pg_trigger where tgrelid='public.application_offers'::regclass and not tgisinternal";
  const before = await scalar(triggers);
  const sql = await readFile(new URL("022_offers_and_portability.sql", directory), "utf8");
  await assert.rejects(pg.exec(sql)); assertions++;
  await pg.exec("rollback").catch(() => {});
  equal(await scalar(triggers), before);
  equal(await scalar("select count(*)::int as result from public.application_offers"), 1);
  console.log(`Application offers SQL: ${assertions} assertions passed`);
} finally { await pg.close(); }
