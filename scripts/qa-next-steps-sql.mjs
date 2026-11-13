// Disposable real-Postgres checks of migration 020 (application activities); no production access.
// PGLITE_MODULE=/path/to/@electric-sql/pglite/dist/index.js node scripts/qa-next-steps-sql.mjs
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
const user = randomUUID(), other = randomUUID(), app = randomUUID(), otherApp = randomUUID();
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
  equal(files.at(-1), "020_application_activities.sql");
  for (const file of files) {
    await pg.exec((await readFile(new URL(file, directory), "utf8")).replace('create extension if not exists "uuid-ossp";', ""));
    if (file.startsWith("012_")) await pg.exec("grant all on all tables in schema public to authenticated,service_role");
  }
  assertions++; // 001-020 applied

  await pg.query("insert into auth.users(id,email) values($1,'steps-qa@example.test'),($2,'other-qa@example.test')", [user, other]);
  await role("service_role");
  await pg.query("insert into public.applications(id,user_id,company) values($1,$2,'Mine'),($3,$4,'Theirs')", [app, user, otherApp, other]);

  // Owner: insert, read, update, done, reopen, delete through RLS
  await role("authenticated", user);
  const insert = (patch = {}) => {
    const row = { user_id: user, application_id: app, kind: "assessment", title: "Take-home", due_on: "2026-11-13", ...patch };
    const keys = Object.keys(row);
    return pg.query(`insert into public.application_activities(${keys.join(",")}) values(${keys.map((_, i) => `$${i + 1}`).join(",")}) returning id,updated_at`, Object.values(row));
  };
  const { id, updated_at: created } = (await insert()).rows[0];
  equal(await scalar("select count(*)::int as result from public.application_activities"), 1);
  await new Promise(r => setTimeout(r, 5));
  await pg.query("update public.application_activities set title='Take-home v2', due_on='2026-11-14' where id=$1", [id]);
  const [edited] = await rows("select title,due_on::text,updated_at from public.application_activities where id=$1", [id]);
  equal([edited.title, edited.due_on], ["Take-home v2", "2026-11-14"]);
  assert.ok(edited.updated_at > created); assertions++;
  await pg.query("update public.application_activities set status='done',completed_at=now() where id=$1", [id]);
  equal(await scalar("select status as result from public.application_activities where id=$1", [id]), "done");
  await pg.query("update public.application_activities set status='open',completed_at=null where id=$1", [id]);
  const timed = (await insert({ kind: "interview", title: "Onsite", starts_at: "2026-11-13T15:00:00Z", time_zone: "America/New_York", link: "https://example.test/meet" })).rows[0].id;

  // Another user: no read, update, delete; no forged user_id; no attaching to my application
  await role("authenticated", other);
  equal(await scalar("select count(*)::int as result from public.application_activities"), 0);
  equal((await pg.query("update public.application_activities set title='Hijack' where id=$1", [id])).affectedRows, 0);
  equal((await pg.query("delete from public.application_activities where id=$1", [id])).affectedRows, 0);
  await rejects(insert({ user_id: user }), "42501");
  await rejects(insert({ user_id: other, application_id: app }), "23503");
  const own = (await insert({ user_id: other, application_id: otherApp })).rows[0].id;
  await rejects(pg.query("update public.application_activities set application_id=$1 where id=$2", [app, own]), "23503");
  await rejects(pg.query("update public.application_activities set user_id=$1 where id=$2", [user, own]), "42501");

  // Anon: nothing
  await role("anon");
  await rejects(pg.query("select count(*) from public.application_activities"), "42501");
  await rejects(insert(), "42501");
  await rejects(pg.query("delete from public.application_activities"), "42501");
  await rejects(pg.query("update public.application_activities set title='Anon'"), "42501");

  // Each CHECK rejects its bad value
  await role("authenticated", user);
  await rejects(insert({ kind: "coffee" }), "23514");
  await rejects(insert({ title: "   " }), "23514");
  await rejects(insert({ title: "x".repeat(201) }), "23514");
  await rejects(insert({ status: "done" }), "23514");
  await rejects(insert({ status: "open", completed_at: "2026-11-13T00:00:00Z" }), "23514");
  await rejects(insert({ status: "archived" }), "23514");
  await rejects(insert({ due_on: null, starts_at: "2026-11-13T15:00:00Z" }), "23514");
  await rejects(insert({ link: "javascript:alert(1)" }), "23514");
  await rejects(insert({ notes: "n".repeat(4001) }), "23514");
  await rejects(insert({ contact_channel: "pigeon" }), "23514");
  await rejects(insert({ time_zone: "" }), "23514");
  equal(await scalar("select count(*)::int as result from public.application_activities"), 2);

  // Owner delete, then deleting the application removes its activities
  equal((await pg.query("delete from public.application_activities where id=$1", [timed])).affectedRows, 1);
  await role("service_role");
  await pg.query("delete from public.applications where id=$1", [app]);
  equal(await scalar("select count(*)::int as result from public.application_activities where user_id=$1", [user]), 0);
  equal(await scalar("select count(*)::int as result from public.application_activities where user_id=$1", [other]), 1);

  // The 2,000 cap holds for a direct insert, per user
  await pg.query("insert into public.applications(id,user_id,company) values($1,$2,'Mine again')", [app, user]);
  await pg.query("insert into public.application_activities(user_id,application_id,kind,title) select $1,$2,'task','Step '||g from generate_series(1,2000) g", [user, app]);
  await role("authenticated", user);
  await rejects(insert(), "54000");
  await role("authenticated", other);
  await insert({ user_id: other, application_id: otherApp }); assertions++;

  // Applying 020 again fails and leaves nothing half-done
  await role("service_role");
  await pg.exec("reset role");
  const before = await scalar("select count(*)::int as result from pg_trigger where tgrelid='public.application_activities'::regclass and not tgisinternal");
  const sql = await readFile(new URL("020_application_activities.sql", directory), "utf8");
  await assert.rejects(pg.exec(sql)); assertions++;
  await pg.exec("rollback").catch(() => {});
  equal(await scalar("select count(*)::int as result from pg_trigger where tgrelid='public.application_activities'::regclass and not tgisinternal"), before);
  equal(await scalar("select count(*)::int as result from public.application_activities"), 2002);
  console.log(`Application activities SQL: ${assertions} assertions passed`);
} finally { await pg.close(); }
