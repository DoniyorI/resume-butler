// Disposable PostgreSQL/WASM verification, no network or production data.
// PGLITE_MODULE may point to an externally installed @electric-sql/pglite.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { recordApplication, recordApplicationInput } from "../src/server/extension/applications.js";
const location = process.env.PGLITE_MODULE;
const { PGlite } = await import(location ? pathToFileURL(location).href : "@electric-sql/pglite");
const pg = new PGlite();
const userId = randomUUID(), otherId = randomUUID();
let assertions = 0;
const equal = (actual, expected) => { assert.deepEqual(actual, expected); assertions++; };
async function scalar(sql, args = []) { return (await pg.query(sql, args)).rows[0]?.result; }
async function role(name, id = "") {
  await pg.exec(`reset role; set role ${name};`);
  await pg.query("select set_config('request.jwt.claim.role',$1,false), set_config('request.jwt.claim.sub',$2,false)", [name, id]);
}
const rpc = async (name, args) => {
  const keys = Object.keys(args);
  try { return { data: await scalar(`select public.${name}(${keys.map((key, index) => `${key} => $${index + 1}`).join(",")}) as result`, keys.map(key => typeof args[key] === "object" && args[key] !== null ? JSON.stringify(args[key]) : args[key])), error: null }; }
  catch (error) { return { data: null, error }; }
};
const payload = (overrides = {}) => recordApplicationInput.parse({ company: "QA Acme", role: "Backend Engineer", url: "https://boards.greenhouse.io/acme/jobs/123", detectedBy: "greenhouse", postingId: "123", appliedDate: new Date().toISOString().slice(0, 10), eventId: randomUUID(), ...overrides });
try {
  await pg.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.role() returns text language sql stable as $$ select current_setting('request.jwt.claim.role',true) $$;
    create function public.uuid_generate_v4() returns uuid language sql as $$ select gen_random_uuid() $$;
    alter default privileges in schema public grant all on tables to service_role;
    grant usage on schema public,auth to anon,authenticated,service_role;
    grant execute on all functions in schema auth to anon,authenticated,service_role;`);
  const migrations = new URL("../supabase/migrations/", import.meta.url);
  for (const file of (await readdir(migrations)).filter(name => /^0(0[1-9]|1[012])_.*\.sql$/.test(name)).sort()) {
    const sql = (await readFile(new URL(file, migrations), "utf8")).replace('create extension if not exists "uuid-ossp";', "");
    await pg.exec(sql);
    if (file.startsWith("011_")) await pg.exec("grant all on all tables in schema public to authenticated,service_role;");
  }
  await pg.query("insert into auth.users(id,email) values($1,'identity-qa@example.test'),($2,'other-qa@example.test')", [userId, otherId]);
  // The bootstrap replaces only Supabase auth and UUID-extension plumbing.
  // All application tables, constraints, triggers and RPCs are actual migrations.
  await role("service_role");
  const firstEvent = payload();
  const first = await recordApplication({ rpc }, userId, firstEvent);
  equal(first.created, true);
  equal((await recordApplication({ rpc }, userId, firstEvent)).application.id, first.application.id);
  equal(await scalar("select count(*)::int as result from public.applications where user_id=$1", [userId]), 1);
  const distinct = await recordApplication({ rpc }, userId, payload({ url: "https://boards.greenhouse.io/acme/jobs/456", postingId: "456" }));
  equal(distinct.created, true);
  assert.notEqual(first.application.id, distinct.application.id); assertions++;
  const equivalent = await recordApplication({ rpc }, userId, payload({ url: "https://boards.greenhouse.io/embed/job_app?for=acme&token=123" }));
  equal(equivalent.application.id, first.application.id);
  await pg.query("update public.applications set status='Offered' where id=$1", [first.application.id]);
  equal((await recordApplication({ rpc }, userId, firstEvent)).application.status, "Offered");
  await assert.rejects(recordApplication({ rpc }, userId, { ...firstEvent, role: "Changed payload" }), error => error.status === 409); assertions++;

  // A separate account and same event UUID cannot retrieve the first account's result.
  const other = await recordApplication({ rpc }, otherId, firstEvent);
  assert.notEqual(other.application.id, first.application.id); assertions++;
  await pg.query("delete from public.applications where id=$1", [first.application.id]);
  await assert.rejects(recordApplication({ rpc }, userId, firstEvent), error => error.status === 409); assertions++;

  // Two legacy candidates force a durable, recoverable extension review item.
  const candidates = [randomUUID(), randomUUID()];
  for (const id of candidates) await pg.query("insert into public.applications(id,user_id,company,role,status,applied_date) values($1,$2,'QA Legacy','Engineer','Applied',current_date)", [id, userId]);
  const ambiguousEvent = payload({ company: "QA Legacy", role: "Engineer", url: "", postingId: undefined });
  equal((await recordApplication({ rpc }, userId, ambiguousEvent)).status, "needs_matching");
  await role("authenticated", otherId);
  equal(await scalar("select public.list_unresolved_extension_events() as result"), []);
  equal((await rpc("resolve_extension_application_event", { p_event_id: ambiguousEvent.eventId, p_target_application_id: candidates[0], p_create_new: false })).error?.code, "P0002");
  await role("authenticated", userId);
  const pending = await scalar("select public.list_unresolved_extension_events() as result");
  equal(pending.length, 1);
  equal(pending[0].candidates.length, 2);
  equal((await rpc("resolve_extension_application_event", { p_event_id: ambiguousEvent.eventId, p_target_application_id: candidates[0], p_create_new: false })).data.application.id, candidates[0]);
  await assert.rejects(pg.query("select * from public.application_ingest_events"), error => error.code === "42501"); assertions++;
  equal((await rpc("record_extension_application", { p_user_id: userId, p_event_id: randomUUID(), p_payload: {} })).error?.code, "42501");
  await role("service_role");
  equal((await recordApplication({ rpc }, userId, ambiguousEvent)).application.id, candidates[0]);
  equal(await scalar("select pending_payload as result from public.application_ingest_events where user_id=$1 and event_id=$2", [userId, ambiguousEvent.eventId]), null);

  const suggestionId = randomUUID();
  await pg.query("insert into public.application_suggestions(id,user_id,message_id,kind,company,role,status,category,email_date,match_reason,match_candidate_ids) values($1,$2,'ambiguous-mail','new','QA Legacy','Engineer','Interviewed','interview',now(),'multiple_candidates',$3::uuid[])", [suggestionId, userId, candidates]);
  await role("authenticated", userId);
  equal((await rpc("approve_application_suggestion", { p_suggestion_id: suggestionId, p_company: "QA Legacy", p_role: "Engineer", p_status: "Interviewed" })).error?.code, "55000");
  equal((await rpc("resolve_application_suggestion", { p_suggestion_id: suggestionId, p_target_application_id: candidates[1], p_create_new: false, p_company: "QA Legacy", p_role: "Engineer", p_status: "Interviewed" })).data, candidates[1]);
  await role("service_role");
  equal(await scalar("select status as result from public.applications where id=$1", [candidates[0]]), "Applied");
  equal(await scalar("select status as result from public.applications where id=$1", [candidates[1]]), "Interviewed");
  // Approval must re-check the candidate set after scanning.
  await role("service_role");
  const raceA = randomUUID(), raceB = randomUUID(), raceS = randomUUID();
  for (const id of [raceA, raceB]) await pg.query("insert into public.applications(id,user_id,company,role,status,applied_date) values($1,$2,'QA Race','Engineer','Applied',current_date)", [id,userId]);
  await pg.query("insert into public.application_suggestions(id,user_id,message_id,kind,application_id,company,role,status,category,email_date) values($1,$2,'race-mail','update',$3,'QA Race','Engineer','Interviewed','interview',now())", [raceS,userId,raceA]);
  await role("authenticated",userId);
  const raceResult = await rpc("approve_application_suggestion",{p_suggestion_id:raceS,p_company:"QA Race",p_role:"Engineer",p_status:"Interviewed",p_identity_version:1});
  equal(raceResult.error, null);
  equal(raceResult.data, null); // Null means persisted matching review, never approval.
  equal(await scalar("select match_reason as result from public.application_suggestions where id=$1",[raceS]), "multiple_candidates");
  equal(await scalar("select count(*)::int as result from public.applications where id=any($1::uuid[]) and status='Applied'",[[raceA,raceB]]),2);
  await role("service_role");
  await pg.query("update public.applications set role='Accountant', applied_date=current_date+10 where id=$1",[raceA]);
  await role("authenticated",userId);
  equal((await rpc("resolve_application_suggestion",{p_suggestion_id:raceS,p_target_application_id:raceA,p_create_new:false,p_company:"QA Race",p_role:"Engineer",p_status:"Interviewed"})).error?.code, "55000");
  equal((await rpc("resolve_application_suggestion",{p_suggestion_id:raceS,p_target_application_id:raceB,p_create_new:false,p_company:"QA Race",p_role:"Engineer",p_status:"Interviewed"})).data,raceB);

  // Missing incoming identity may explicitly resolve to a known posting.
  await role("service_role");
  const known = await recordApplication({rpc},userId,payload({company:"QA Known",role:"Engineer",url:"https://boards.greenhouse.io/known/jobs/111",postingId:"111"}));
  await recordApplication({rpc},userId,payload({company:"QA Known",role:"Engineer",url:"https://boards.greenhouse.io/known/jobs/222",postingId:"222"}));
  const weak = payload({company:"QA Known",role:"Engineer",url:"",postingId:undefined});
  equal((await recordApplication({rpc},userId,weak)).status,"needs_matching");
  await role("authenticated",userId);
  equal((await rpc("resolve_extension_application_event",{p_event_id:weak.eventId,p_target_application_id:known.application.id,p_create_new:false})).data?.application.id,known.application.id);
  console.log(JSON.stringify({ assertions, migrations: "001–012", engine: "PostgreSQL via PGlite", liveDatabaseChanged: false, concurrencyClaim: "Single-connection transaction behavior only; live concurrent RPC verification remains required." }));
} finally { await pg.close(); }
