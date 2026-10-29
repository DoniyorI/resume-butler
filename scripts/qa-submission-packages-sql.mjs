import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { recordResumeExport, captureSubmission, submissionInput } from "../src/server/applications/submissions.js";
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const pg = new PGlite();
let assertions = 0;
const equal = (a, b) => { assert.deepEqual(a, b); assertions++; };
const scalar = async (sql, args = []) => (await pg.query(sql, args)).rows[0]?.result;
const user = randomUUID(), other = randomUUID(), resume = randomUUID(), application = randomUUID(), otherApplication = randomUUID();
async function role(name, id = "") {
  await pg.exec(`reset role; set role ${name}`);
  await pg.query("select set_config('request.jwt.claim.role',$1,false),set_config('request.jwt.claim.sub',$2,false)", [name, id]);
}
const rpc = async (name, args) => {
  try {
    const keys = Object.keys(args);
    return { data: await scalar(`select public.${name}(${keys.map((key, i) => key + ' => $' + (i + 1)).join(',')}) as result`, keys.map(key => key === "p_pdf" && args[key] ? new Uint8Array(Buffer.from(args[key].slice(2), "hex")) : args[key] && typeof args[key] === "object" ? JSON.stringify(args[key]) : args[key])), error: null };
  } catch (error) { return { data: null, error: { code: error.code, message: error.message } }; }
};
const pdf = Buffer.from("%PDF-1.4\nFictional QA bytes\n%%EOF\n");
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
  await pg.query("insert into auth.users(id,email) values($1,'package-qa@example.test'),($2,'other-package@example.test')", [user, other]);
  await role("service_role");
  await pg.query("insert into public.resumes(id,user_id,title,content) values($1,$2,'Original resume',$3::jsonb)", [resume, user, JSON.stringify({ header: { name: "Original fact" } })]);
  for (const [id, owner] of [[application, user], [otherApplication, other]]) await pg.query("insert into public.applications(id,user_id,company,role,job_description,portal_link) values($1,$2,'QA Company','Engineer','Original job requirements','https://example.test/job/123')", [id, owner]);
  const artifact = await recordResumeExport({ rpc }, user, { resumeId: resume, title: "Original resume", content: { header: { name: "Original fact" } }, pdf });
  equal(await scalar("select encode(pdf_bytes,'hex') as result from public.resume_artifacts where id=$1", [artifact.id]), pdf.toString("hex"));
  const input = submissionInput.parse({ eventId: randomUUID(), applicationId: application, kind: "export", artifactId: artifact.id, submittedOn: "2026-10-29", answers: [{ question: "Availability", answer: "Two weeks" }] });
  const first = await captureSubmission({ rpc }, user, input);
  equal((await captureSubmission({ rpc }, user, input)).id, first.id);
  equal(await scalar("select count(*)::int as result from public.application_submissions where user_id=$1", [user]), 1);
  await assert.rejects(captureSubmission({ rpc }, user, { ...input, notes: "Changed intent" }), e => e.status === 409); assertions++;
  await pg.query("update public.applications set job_description='Later job text' where id=$1", [application]);
  await pg.query("delete from public.resumes where id=$1", [resume]);
  equal(await scalar("select job_description as result from public.application_submissions where id=$1", [first.id]), "Original job requirements");
  equal(await scalar("select content->'header'->>'name' as result from public.resume_artifacts where id=$1", [artifact.id]), "Original fact");
  equal(await scalar("select source_resume_id as result from public.resume_artifacts where id=$1", [artifact.id]), resume);
  await assert.rejects(captureSubmission({ rpc }, other, { ...input, eventId: randomUUID(), applicationId: otherApplication }), e => e.status === 404); assertions++;
  const upload = await captureSubmission({ rpc }, user, { ...input, eventId: randomUUID(), kind: "upload", artifactId: null }, { bytes: pdf, fileName: "actual.pdf" });
  equal(await scalar("select provenance as result from public.resume_artifacts where id=(select artifact_id from public.application_submissions where id=$1)", [upload.id]), "upload");
  const selectedResume = randomUUID();
  await pg.query("insert into public.resumes(id,user_id,title,content) values($1,$2,'Selected working version',$3::jsonb)", [selectedResume, user, JSON.stringify({ header: { name: "Selected fact" } })]);
  const selected = await captureSubmission({ rpc }, user, { ...input, eventId: randomUUID(), kind: "selected", artifactId: null, resumeId: selectedResume, supersedesId: upload.id });
  await pg.query("delete from public.resumes where id=$1", [selectedResume]);
  equal(await scalar("select resume_snapshot->'header'->>'name' as result from public.application_submissions where id=$1", [selected.id]), "Selected fact");
  equal(await scalar("select artifact_id as result from public.application_submissions where id=$1", [selected.id]), null);
  equal(await scalar("select supersedes_id as result from public.application_submissions where id=$1", [selected.id]), upload.id);
  const blankResume = randomUUID();
  await pg.query("insert into public.resumes(id,user_id,title,content) values($1,$2,\'Legacy empty resume\',null)", [blankResume,user]);
  const blank = await captureSubmission({ rpc }, user, { ...input, eventId: randomUUID(), kind: "selected", artifactId: null, resumeId: blankResume });
  equal(await scalar("select jsonb_typeof(resume_snapshot) as result from public.application_submissions where id=$1",[blank.id]), "null");
  const beforeFailure = await scalar("select count(*)::int as result from public.resume_artifacts where user_id=$1",[user]);
  const failedUpload = await rpc("capture_application_submission",{p_user_id:user,p_event_id:randomUUID(),p_input:{...input,kind:"upload",artifactId:null,submittedOn:null,filename:"failed.pdf",pdfSha256:artifact.sha256,requestHash:"1".repeat(64)},p_pdf:"\\x"+pdf.toString("hex")});
  equal(failedUpload.error?.code,"23502");
  equal(await scalar("select count(*)::int as result from public.resume_artifacts where user_id=$1",[user]),beforeFailure);
  await role("authenticated", user);
  equal(await scalar("select count(*)::int as result from public.application_submissions"), 4);
  equal(await scalar("select count(*)::int as result from public.resume_artifacts"), 2);
  await assert.rejects(pg.query("delete from public.resume_artifacts where id=$1", [artifact.id]), e => e.code === "42501"); assertions++;
  await assert.rejects(pg.query("update public.application_submissions set notes=\'tampered\' where id=$1", [first.id]), e => e.code === "42501"); assertions++;
  await role("authenticated", other);
  equal(await scalar("select count(*)::int as result from public.resume_artifacts"), 0);
  equal(await scalar("select count(*)::int as result from public.application_submissions"), 0);
  await assert.rejects(pg.query("update public.application_submissions set notes='tampered' where id=$1", [first.id]), e => e.code === "42501"); assertions++;
  await assert.rejects(recordResumeExport({ rpc }, other, { resumeId: null, title: "Spoofed export", content: {}, pdf }), e => /42501/.test(e.message)); assertions++;
  const quota = (await pg.query("select public.consume_rate_limit(\'submission-capture\') as allowed from generate_series(1,61)")).rows;
  equal(quota.every((row,index) => row.allowed === (index < 60)), true);
  await role("service_role");
  await pg.query("delete from public.applications where id=$1", [application]);
  equal(await scalar("select application_id as result from public.application_submissions where id=$1", [first.id]), null);
  equal(await scalar("select application_snapshot->>'company' as result from public.application_submissions where id=$1", [first.id]), "QA Company");
  equal((await captureSubmission({ rpc }, user, input)).id, first.id);
  await pg.exec("reset role");
  await pg.query("delete from auth.users where id=$1", [user]);
  equal(await scalar("select count(*)::int as result from public.resume_artifacts where user_id=$1", [user]), 0);
  equal(await scalar("select count(*)::int as result from public.application_submissions where user_id=$1", [user]), 0);
  console.log(`Submission package SQL: ${assertions} assertions passed`);
} finally { await pg.close(); }
