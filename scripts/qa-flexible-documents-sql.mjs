import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const pg = new PGlite();
let assertions = 0;
const equal = (a, b) => { assert.deepEqual(a, b); assertions++; };
const scalar = async (sql, args = []) => (await pg.query(sql, args)).rows[0]?.result;
const user = randomUUID(), other = randomUUID(), resume = randomUUID();
async function role(name, id = "") {
  await pg.exec(`reset role; set role ${name}`);
  await pg.query("select set_config('request.jwt.claim.role',$1,false),set_config('request.jwt.claim.sub',$2,false)", [name, id]);
}
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
  await pg.query("insert into auth.users(id,email) values($1,'flex-qa@example.test'),($2,'other-flex@example.test')", [user, other]);
  await role("service_role");
  await pg.query("insert into public.resumes(id,user_id,title,content) values($1,$2,'Flexible QA','{}')", [resume, user]);
  await role("authenticated", user);
  const customId = "custom:" + randomUUID();
  const custom = { id: customId, title: "Research & service", type: "entries", items: [{ id: randomUUID(), title: "Compiler research", description: ["Preserved fact"] }] };
  const content = { schemaVersion: 2, revision: 0, customSections: [custom], order: [{ id: customId, title: custom.title }] };
  const save = (revision, body = content) => scalar("select public.save_resume_document($1,$2::jsonb,$3) as result", [resume, JSON.stringify({ ...body, revision }), revision]);
  equal(await save(0), { revision: 1 });
  await assert.rejects(save(0), e => e.code === "55000"); assertions++;
  await assert.rejects(pg.query("update public.resumes set content='{}' where id=$1", [resume]), e => e.code === "55000"); assertions++;
  await assert.rejects(pg.query("update public.resumes set content=$1::jsonb where id=$2", [JSON.stringify({ revision: 2, customSections: [] }), resume]), e => e.code === "55000"); assertions++;
  equal(await scalar("select content->'customSections'->0->'items'->0->>'title' as result from public.resumes where id=$1", [resume]), "Compiler research");
  await role("authenticated", other);
  await assert.rejects(save(1), e => e.code === "P0002"); assertions++;
  await role("authenticated", user);
  equal(await save(1), { revision: 2 });
  equal(await scalar("select content->'revision' as result from public.resumes where id=$1", [resume]), 2);
  await assert.rejects(save(2, { ...content, schemaVersion: 99 }), e => e.code === "22023"); assertions++;
  const settings = { revision: 0, titles: { projects: "Selected work" }, customSections: [] };
  equal(await scalar("select public.save_cv_sections($1::jsonb,$2) as result", [JSON.stringify(settings), 0]), { revision: 1 });
  await assert.rejects(scalar("select public.save_cv_sections($1::jsonb,0) as result", [JSON.stringify(settings)]), e => e.code === "55000"); assertions++;
  await role("authenticated", other);
  equal(await scalar("select count(*)::int as result from public.profiles where id=$1", [user]), 0);
  equal(await scalar("select cv_sections->'revision' as result from public.profiles where id=$1", [other]), 0);
  await role("anon");
  await assert.rejects(save(2), e => e.code === "42501"); assertions++;
  console.log(`Flexible document SQL: ${assertions} assertions passed`);
} finally { await pg.close(); }
