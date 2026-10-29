// Only the existing fictional accounts. Tokens are revoked; resumes remain
// clearly labeled QA fixtures in those test accounts, never the user's account.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import nextEnv from "@next/env";
import { createAdminClient } from "@/server/supabaseAdmin";
import { createExtensionToken } from "@/server/extension/tokens";
nextEnv.loadEnvConfig(process.cwd());
if (!process.env.QA_SESSION_FILE || new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname !== "tlmabncoijnuxymxohgu.supabase.co") throw new Error("Named QA project and private fixture required.");
const session = JSON.parse(await readFile(process.env.QA_SESSION_FILE, "utf8"));
const accounts = ["25da4fa1-9512-4e32-b22b-bd90548f50dd", "acf746a7-3fc0-4e45-864b-02bf23b7d2c2"].map(id => session.accounts.find(a => a.id === id));
assert.ok(accounts.every(a => a?.email.endsWith("@example.test")));
const admin = createAdminClient(), tokens = [], resumeId = randomUUID();
const run = randomUUID().slice(0, 8), description = "Build backend APIs using Python, Docker and PostgreSQL.";
let checks = 0;
async function call(token, body, status) {
  const response = await fetch("http://localhost:3000/api/extension/job-score", { method: "POST", headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) }, body: JSON.stringify(body) });
  assert.equal(response.status, status); checks++;
  if (response.ok) { assert.equal(response.headers.get("cache-control"), "no-store"); checks++; }
  return response.json();
}
try {
  const { error } = await admin.from("resumes").insert({ id: resumeId, user_id: accounts[0].id, title: `Job score QA ${run}`, content: { skills: [{ header: "Skills", skills: "Python" }], projects: [{ projectName: "Private test project", description: ["Docker"] }], order: [{ id: "skills", title: "Skills" }, { id: "projects", title: "Projects", hidden: true }] } });
  if (error) throw new Error("Could not create the fictional comparison fixture.");
  for (const a of accounts) tokens.push({ ...await createExtensionToken(admin, a.id), userId: a.id });
  const input = { jobDescription: description, resumeId };
  await call(null, input, 401);
  const own = await call(tokens[0].token, input, 200);
  assert.deepEqual(own.matched, ["python"]); checks++;
  assert.ok(own.missing.includes("docker")); checks++;
  assert.equal(JSON.stringify(own).includes("Private test project"), false); checks++;
  await call(tokens[1].token, input, 404);
  await call(tokens[0].token, { ...input, userId: accounts[1].id }, 400);
  await call(tokens[0].token, { ...input, jobDescription: "" }, 400);
  await call(tokens[0].token, { ...input, jobDescription: "x".repeat(50001) }, 400);
  const unknown = await call(tokens[0].token, { ...input, jobDescription: "We value thoughtful collaboration and curiosity every day." }, 200);
  assert.equal(unknown.score, null); checks++;
  const cvResponse = await fetch("http://localhost:3000/api/extension/job-score", { method: "POST", headers: { Authorization: `Bearer ${tokens[0].token}`, "Content-Type": "application/json" }, body: JSON.stringify({ jobDescription: description, resumeId: null }) });
  assert.equal(cvResponse.status, 200); checks++;
  assert.equal((await cvResponse.json()).source.type, "master-cv"); checks++;
  const { error: revokeError } = await admin.from("extension_tokens").update({ revoked_at: new Date().toISOString() }).eq("id", tokens[0].id).eq("user_id", accounts[0].id);
  if (revokeError) throw new Error("Could not revoke QA connection.");
  await call(tokens[0].token, input, 401);
  console.log(JSON.stringify({ checks, run, fixtureResume: resumeId, result: "pass" }));
} finally {
  for (const token of tokens) {
    const { error } = await admin.from("extension_tokens").update({ revoked_at: new Date().toISOString() }).eq("id", token.id).eq("user_id", token.userId);
    if (error) console.error("A fictional QA token still needs revocation.");
  }
}
