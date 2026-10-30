// Disposable PostgreSQL checks; fictional CV data only.
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
const owner = randomUUID(), other = randomUUID(), exp = randomUUID();
const empty = () => ({ education: [], experience: [], projects: [], skills: [] });
const experience = (overrides = {}) => ({ company: "Fixture Co", position: "Engineer", location: "Remote", type: "Full-time", start_date: "2024-01-01", end_date: null, currently_working: true, bullets: [], ...overrides });
const merge = input => scalar("select public.merge_resume_import($1::jsonb) as result", [JSON.stringify(input)]);
async function account(id) {
  await pg.exec("reset role; set role authenticated");
  await pg.query("select set_config('request.jwt.claim.role','authenticated',false),set_config('request.jwt.claim.sub',$1,false)", [id]);
}
try {
  await pg.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.role() returns text language sql stable as $$ select current_setting('request.jwt.claim.role',true) $$;
    create function public.uuid_generate_v4() returns uuid language sql as $$ select gen_random_uuid() $$;
    grant usage on schema public,auth to anon,authenticated,service_role;
    grant execute on all functions in schema auth to anon,authenticated,service_role;
    alter default privileges in schema public grant all on tables to authenticated,service_role;`);
  const dir = new URL("../supabase/migrations/", import.meta.url);
  for (const f of (await readdir(dir)).filter(f => /^\d{3}.*\.sql$/.test(f) && Number(f.slice(0, 3)) < 19).sort()) {
    await pg.exec((await readFile(new URL(f, dir), "utf8")).replace('create extension if not exists "uuid-ossp";', ""));
  }
  await pg.query("insert into auth.users(id,email) values($1,'import-qa@example.test'),($2,'other-qa@example.test')", [owner, other]);
  await pg.query("insert into public.cv_experience(id,user_id,company,position,location,start_date,currently_working,sort_order) values($1,$2,'Fixture Co','Engineer','User location','2024-01-15',true,7)", [exp, owner]);
  await pg.query("insert into public.cv_experience_bullets(experience_id,content,sort_order) values($1,'Built an API.',0)", [exp]);
  await pg.query("insert into public.cv_experience(user_id,company,position,start_date) values($1,'Fixture Co','Engineer','2024-01-01')", [other]);
  await pg.exec(await readFile(new URL("019_resume_import_merge.sql", dir), "utf8"));
  await account(owner);
  const input = { education: [{ school: "Fixture University", degree_type: "Bachelor", major: "CS", gpa: null, location: "", start_date: null, end_date: "2024-05-01" }],
    experience: [experience({ company: " fixture   co ", bullets: ["built an API", "Added tests."] })],
    projects: [{ name: "API project", description: "Original description", start_date: null, end_date: null, bullets: ["Built a parser."] }], skills: ["Python", " python ", "C++", "C#"] };
  const first = await merge(input);
  check(first.added, { education: 1, experience: 0, projects: 1, skills: 3 });
  check(first.merged.experience, 1); check(first.bulletsAdded, 2);
  check(await scalar("select location as result from public.cv_experience where id=$1", [exp]), "User location");
  check(await scalar("select start_date::text as result from public.cv_experience where id=$1", [exp]), "2024-01-15");
  check(await scalar("select jsonb_agg(content order by sort_order) as result from public.cv_experience_bullets where experience_id=$1", [exp]), ["Built an API.", "Added tests."]);
  const repeated = await merge(input);
  check(repeated.added, { education: 0, experience: 0, projects: 0, skills: 0 }); check(repeated.bulletsAdded, 0);
  check(repeated.merged, { education: 1, experience: 1, projects: 1 });
  const distinct = await merge({ ...empty(), experience: [experience({ position: "Staff Engineer" }), experience({ start_date: "2020-01-01", end_date: "2021-01-01", currently_working: false })] });
  check(distinct.added.experience, 2);
  check(await scalar("select min(sort_order) as result from public.cv_experience where user_id=$1 and id<>$2", [owner, exp]), 8);
  // An earlier resume must not end the user's currently active employment.
  await merge({ ...empty(), experience: [experience({ end_date: "2024-12-01", currently_working: false })] });
  check(await scalar("select end_date::text as result from public.cv_experience where id=$1", [exp]), null);
  const before = await scalar("select count(*)::int as result from public.cv_experience where user_id=$1", [owner]);
  await assert.rejects(merge({ ...empty(), experience: [experience({ company: "Should roll back" }), experience({ company: "Invalid", start_date: "2024-02-30" })] })); checks++;
  check(await scalar("select count(*)::int as result from public.cv_experience where user_id=$1", [owner]), before);
  await pg.exec("reset role");
  await pg.query("insert into public.cv_experience(user_id,company,position,start_date) values($1,'Ambiguous','Engineer','2024-01-01'),($1,'Ambiguous','Engineer','2024-01-01')", [owner]);
  await account(owner);
  const ambiguous = await merge({ ...empty(), experience: [experience({ company: "Ambiguous", bullets: ["Do not guess"] })] });
  check(ambiguous.needsReview.experience, 1); check(ambiguous.added.experience, 0);
  check(await scalar("select count(*)::int as result from public.cv_experience where company='Ambiguous'"), 2);
  // Parent ownership determines all bullet writes, even if supplied data has a user_id.
  await account(other);
  const foreign = await merge({ ...empty(), experience: [experience({ user_id: owner, bullets: ["Other account only"] })] });
  check(foreign.merged.experience, 1);
  await pg.exec("reset role");
  check(await scalar("select count(*)::int as result from public.cv_experience_bullets where experience_id=$1 and content='Other account only'", [exp]), 0);
  await pg.query("insert into public.cv_experience_bullets(experience_id,content,sort_order) select $1,'Existing bullet '||n,n from generate_series(2,49) n", [exp]);
  await account(owner);
  const capped = await merge({ ...empty(), experience: [experience({ bullets: ["Beyond capacity"] })] });
  check(capped.needsReview.bullets, 1); check(capped.bulletsAdded, 0);
  await pg.exec("reset role");
  check(await scalar("select has_function_privilege('anon','public.merge_resume_import(jsonb)','EXECUTE') as result"), false);
  await account("");
  await assert.rejects(merge(empty()), e => e.code === "42501"); checks++;
  console.log(JSON.stringify({ checks, disposablePostgres: true }));
} catch (error) { console.error(JSON.stringify({ error: error.message, code: error.code, where: error.where, actual: error.actual, expected: error.expected })); process.exitCode = 1; } finally { await pg.close(); }
