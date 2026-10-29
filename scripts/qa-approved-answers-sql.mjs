import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { saveAnswer, answerCommandInput } from "../src/server/answers/service.js";
import { captureSubmission, submissionInput } from "../src/server/applications/submissions.js";
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const pg = new PGlite();
const user = randomUUID(), other = randomUUID(), id = randomUUID(), app = randomUUID();
let assertions = 0;
const equal = (a, b) => { assert.deepEqual(a, b); assertions++; };
const scalar = async (sql, args = []) => (await pg.query(sql, args)).rows[0]?.result;
async function role(name, owner = "") {
  await pg.exec(`reset role; set role ${name}`);
  await pg.query("select set_config('request.jwt.claim.role',$1,false),set_config('request.jwt.claim.sub',$2,false)", [name, owner]);
}
const rpc = async (name, args) => {
  try {
    const keys = Object.keys(args);
    return { data: await scalar(`select public.${name}(${keys.map((key,i) => key+' => $'+(i+1)).join(',')}) as result`, keys.map(key => args[key] && typeof args[key] === "object" ? JSON.stringify(args[key]) : args[key])), error: null };
  } catch (error) { return { data: null, error: { code: error.code } }; }
};
const content = { label: "Backend story", question: "Tell us about a project", answer: "I built a fictional service.", category: "project", tags: ["backend"], sourceNote: "My project notes", sourceUrl: "https://example.test/project" };
const command = (action, revision, values = content, eventId = randomUUID()) => answerCommandInput.parse({ id, eventId, expectedRevision: revision, action, ...(["draft","approve"].includes(action) ? { content: values } : {}) });
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
  await pg.query("insert into auth.users(id,email) values($1,'answer-qa@example.test'),($2,'other-answer-qa@example.test')",[user,other]);
  await role("authenticated",user);
  const create = command("draft",0);
  equal((await saveAnswer({rpc},create)).revision,1);
  equal(await scalar("select approved_at is null as result from public.reusable_answers where id=$1",[id]),true);
  equal((await saveAnswer({rpc},create)).revision,1);
  const approve = command("approve",1);
  equal((await saveAnswer({rpc},approve)).revision,2);
  equal(await scalar("select approved_at is not null as result from public.reusable_answers where id=$1",[id]),true);
  await assert.rejects(saveAnswer({rpc},command("draft",1)), e=>e.status===409); assertions++;
  equal((await saveAnswer({rpc},create)).revision,1); // Replay never overwrites revision2.
  equal(await scalar("select revision as result from public.reusable_answers where id=$1",[id]),2);
  await assert.rejects(saveAnswer({rpc},{...approve,content:{...content,answer:"Changed intent"}}), e=>e.status===409); assertions++;
  equal(await scalar("select count(*)::int as result from public.reusable_answer_versions where answer_id=$1",[id]),2);
  const exported = await scalar("select public.export_reusable_answers() as result");
  equal(exported.answers.length,1); equal(exported.versions.length,2);
  await role("authenticated",other);
  equal((await scalar("select public.export_reusable_answers() as result")).answers,[]);
  equal(await scalar("select count(*)::int as result from public.reusable_answers"),0);
  equal(await scalar("select count(*)::int as result from public.reusable_answer_versions"),0);
  await assert.rejects(saveAnswer({rpc},command("approve",2)), e=>e.status===404); assertions++;
  await role("service_role");
  await pg.query("insert into public.applications(id,user_id,company,role,job_description) values($1,$2,'QA Answers','Engineer','Original QA requirements')",[app,user]);
  const captureInput = submissionInput.parse({eventId:randomUUID(),applicationId:app,kind:"unknown",submittedOn:"2026-10-29",answerSelections:[{id,revision:2}]});
  const captured = await captureSubmission({rpc},user,captureInput);
  equal(await scalar("select answers->0->>'answer' as result from public.application_submissions where id=$1",[captured.id]),content.answer);
  equal(await scalar("select (answers->0->>'sourceRevision')::int as result from public.application_submissions where id=$1",[captured.id]),2);
  await role("authenticated",user);
  const edited = {...content,answer:"Updated story requiring fresh approval."};
  equal((await saveAnswer({rpc},command("draft",2,edited))).revision,3);
  equal(await scalar("select approved_at is null as result from public.reusable_answers where id=$1",[id]),true);
  await role("service_role");
  await assert.rejects(captureSubmission({rpc},user,{...captureInput,eventId:randomUUID(),answerSelections:[{id,revision:3}]}),e=>e.status===409); assertions++;
  equal((await captureSubmission({rpc},user,captureInput)).id,captured.id);
  await role("authenticated",user);
  equal((await saveAnswer({rpc},command("archive",3))).revision,4);
  equal(await scalar("select archived_at is not null as result from public.reusable_answers where id=$1",[id]),true);
  equal((await saveAnswer({rpc},command("restore",4))).revision,5);
  equal(await scalar("select approved_at is null and archived_at is null as result from public.reusable_answers where id=$1",[id]),true);
  equal((await saveAnswer({rpc},command("approve",5,edited))).revision,6);
  await assert.rejects(pg.query("update public.reusable_answers set answer='tampered' where id=$1",[id]),e=>e.code==='42501'); assertions++;
  const deletion = await rpc("delete_reusable_answer",{p_answer_id:id,p_expected_revision:6});
  equal(deletion.error,null);
  equal(await scalar("select count(*)::int as result from public.reusable_answer_versions where answer_id=$1",[id]),0);
  await assert.rejects(saveAnswer({rpc},create),e=>e.status===404); assertions++;
  await role("service_role");
  equal((await captureSubmission({rpc},user,captureInput)).id,captured.id);
  equal(await scalar("select answers->0->>'answer' as result from public.application_submissions where id=$1",[captured.id]),content.answer);
  await pg.exec("reset role");await pg.query("delete from auth.users where id=$1",[user]);
  equal(await scalar("select count(*)::int as result from public.reusable_answer_tombstones where user_id=$1",[user]),0);
  console.log(`Approved answer SQL: ${assertions} assertions passed`);
} finally { await pg.close(); }
