// Disposable real-Postgres checks; no production access.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const pg = new PGlite();
let assertions = 0;
const equal = (a, b) => { assert.deepEqual(a, b); assertions++; };
const scalar = async (sql, args = []) => (await pg.query(sql, args)).rows[0]?.result;
async function role(name, id = "") {
  await pg.exec(`reset role; set role ${name}`);
  await pg.query("select set_config('request.jwt.claim.role',$1,false),set_config('request.jwt.claim.sub',$2,false)", [name, id]);
}
const user = randomUUID(), other = randomUUID(), resume = randomUUID();
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
  for (const file of (await readdir(directory)).filter(f => /^\d{3}_.*\.sql$/.test(f)).sort()) {
    await pg.exec((await readFile(new URL(file, directory), "utf8")).replace('create extension if not exists "uuid-ossp";', ""));
    if (file.startsWith("012_")) await pg.exec("grant all on all tables in schema public to authenticated,service_role");
  }
  await pg.query("insert into auth.users(id,email) values($1,'saved-qa@example.test'),($2,'other-qa@example.test')", [user, other]);
  await role("service_role");
  await pg.query("insert into public.resumes(id,user_id,title) values($1,$2,'Working resume')", [resume, user]);
  const payload = { company: "QA Company", role: "Engineer", location: "Remote", portal_link: "https://job-boards.greenhouse.io/acme/jobs/123", job_description: "Original job description", salary_min: 100000, salary_max: 150000, salary_currency: "USD", salary_period: "year", workplace_type: "remote", employment_type: "full_time", source_site: "greenhouse" };
  const save = (who, p = payload, r = resume) => scalar("select public.save_job_opportunity($1,$2::jsonb,$3) as result", [who, JSON.stringify(p), r]);
  const first = await save(user);
  equal(await scalar("select count(*)::int as result from public.applications"), 0);
  equal((await save(user)).id, first.id);
  equal((await save(user, { ...payload, portal_link: "https://boards.greenhouse.io/embed/job_app?for=acme&token=123" })).id, first.id);
  equal(await scalar("select count(*)::int as result from public.job_opportunities where user_id=$1", [user]), 1);
  const second = await save(user, { ...payload, portal_link: "https://job-boards.greenhouse.io/acme/jobs/456" });
  assert.notEqual(second.id, first.id); assertions++;
  await assert.rejects(save(other), e => e.code === "P0002"); assertions++;
  await role("authenticated", other);
  equal(await scalar("select count(*)::int as result from public.job_opportunities"), 0);
  await assert.rejects(save(user), e => e.code === "42501"); assertions++;
  await assert.rejects(pg.query("insert into public.job_opportunities(user_id,identity_key,payload) values($1,'bad','{}')", [other]), e => e.code === "42501"); assertions++;
  const own = await save(other, payload, null);
  assert.notEqual(own.id, first.id); assertions++;
  await role("service_role");
  const application = randomUUID();
  await pg.query("insert into public.applications(id,user_id,company,role,portal_link,applied_date) values($1,$2,'QA Company','Engineer',$3,current_date)", [application, user, payload.portal_link]);
  equal(await scalar("select application_id as result from public.job_opportunities where id=$1", [first.id]), application);
  equal(await scalar("select application_id as result from public.job_opportunities where id=$1", [second.id]), null);
  equal(await scalar("select application_id as result from public.job_opportunities where id=$1", [own.id]), null);
  // Same-name jobs with a different identity cannot link; ambiguous identical postings unlink.
  const duplicate = randomUUID();
  await pg.query("insert into public.applications(id,user_id,company,role,portal_link,applied_date) values($1,$2,'QA Company','Engineer',$3,current_date)", [duplicate, user, payload.portal_link]);
  equal(await scalar("select application_id as result from public.job_opportunities where id=$1", [first.id]), null);
  await pg.query("delete from public.applications where id=$1", [duplicate]);
  equal((await save(user)).application_id, application);
  // Manual URL edits must not override a contradictory stored requisition identity.
  await pg.query("update public.applications set posting_platform='greenhouse',posting_namespace='acme',posting_id='456' where id=$1", [application]);
  equal((await save(user)).application_id, null);
  await pg.query("update public.applications set posting_id='123' where id=$1", [application]);
  equal(await scalar("select application_id as result from public.job_opportunities where id=$1", [first.id]), application);
  await pg.query("update public.applications set portal_link='https://job-boards.greenhouse.io/acme/jobs/999' where id=$1", [application]);
  equal(await scalar("select application_id as result from public.job_opportunities where id=$1", [first.id]), null);
  await pg.query("update public.applications set portal_link=$1 where id=$2", [payload.portal_link, application]);
  await pg.query("delete from public.resumes where id=$1", [resume]);
  equal(await scalar("select resume_id as result from public.job_opportunities where id=$1", [first.id]), null);
  await assert.rejects(save(user), e => e.code === "P0002"); assertions++;
  await role("authenticated", user);
  await pg.query("delete from public.job_opportunities where id=$1", [own.id]);
  equal(await scalar("select count(*)::int as result from public.job_opportunities"), 2);
  await role("anon");
  await assert.rejects(save(user, payload, null), e => e.code === "42501"); assertions++;
  console.log(`Saved opportunity SQL: ${assertions} assertions passed`);
} finally { await pg.close(); }
