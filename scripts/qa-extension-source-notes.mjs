// Real disposable Postgres; no production data or credentials.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
if (!process.env.PGLITE_MODULE) throw new Error("Set PGLITE_MODULE.");
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const pg = new PGlite();
let checks = 0;
const check = (a, b) => { assert.deepEqual(a, b); checks++; };
const scalar = async (sql, args = []) => (await pg.query(sql, args)).rows[0]?.result;
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
  for (const file of files.filter(f => !f.startsWith("018_"))) {
    await pg.exec((await readFile(new URL(file, directory), "utf8")).replace('create extension if not exists "uuid-ossp";', ""));
  }
  const user = randomUUID(), other = randomUUID();
  await pg.query("insert into auth.users(id,email) values($1,'source-qa@example.test'),($2,'other-qa@example.test')", [user, other]);
  const urls = {
    linkedin: "https://www.linkedin.com/jobs/view/4484740117/",
    greenhouse: "https://job-boards.greenhouse.io/fixture/jobs/123",
    lever: "https://jobs.lever.co/fixture/00000000-0000-4000-8000-000000000001",
    ashby: "https://jobs.ashbyhq.com/fixture/00000000-0000-4000-8000-000000000001",
  };
  for (const [source, url] of Object.entries(urls)) {
    await pg.query("insert into public.applications(user_id,company,role,portal_link,source,comments) values($1,'Fixture','Engineer',$2,'extension','Added by the browser extension')", [user, url]);
  }
  await pg.query("insert into public.applications(user_id,company,role,portal_link,source,comments) values($1,'Edited','Engineer',$2,'extension','Contact Pat on Friday'),($1,'Manual','Engineer',$2,'manual','Added by the browser extension')", [user, urls.linkedin]);
  const acl = await scalar("select proacl::text as result from pg_proc where oid='public.write_extension_application(uuid,jsonb,uuid)'::regprocedure");
  await pg.exec(await readFile(new URL("018_extension_source_notes.sql", directory), "utf8"));
  check(await scalar("select proacl::text as result from pg_proc where oid='public.write_extension_application(uuid,jsonb,uuid)'::regprocedure"), acl);
  check(await scalar("select count(*)::int as result from public.applications where comments like 'Added from %'"), 4);
  check(await scalar("select comments as result from public.applications where company='Edited'"), "Contact Pat on Friday");
  check(await scalar("select comments as result from public.applications where company='Manual'"), "Added by the browser extension");
  await pg.exec("set role service_role; select set_config('request.jwt.claim.role','service_role',false)");
  for (const [source, url] of Object.entries(urls)) {
    const event = randomUUID();
    const payload = { company: `New ${source}`, role: "Engineer", portal_link: url.replace(/123$/, "124").replace("4484740117", "4484740118").replace(/000000000001$/, "000000000002"), applied_date: "2026-10-29", source_site: "wrong-label" };
    await pg.exec("reset role");
    const identity = await scalar("select public.posting_identity_key($1) as result", [payload.portal_link]);
    await pg.exec("set role service_role");
    Object.assign(payload, { posting_platform: identity.platform, posting_namespace: identity.namespace, posting_id: identity.postingId, posting_url_key: identity.urlKey });
    const result = await scalar("select public.record_extension_application($1,$2,$3::jsonb) as result", [user, event, JSON.stringify(payload)]);
    check(await scalar("select comments as result from public.applications where id=$1", [result.application.id]), `Added from ${{ linkedin: "LinkedIn", greenhouse: "Greenhouse", lever: "Lever", ashby: "Ashby" }[source]}`);
    check((await scalar("select public.record_extension_application($1,$2,$3::jsonb) as result", [user, event, JSON.stringify(payload)])).application.id, result.application.id);
  }
  await pg.exec("reset role");
  check(await scalar("select has_function_privilege('authenticated','public.write_extension_application(uuid,jsonb,uuid)','EXECUTE') as result"), false);
  console.log(JSON.stringify({ checks, disposablePostgres: true }));
} finally { await pg.close(); }
