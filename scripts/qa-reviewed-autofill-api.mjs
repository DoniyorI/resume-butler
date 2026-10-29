// Uses only the two previously created fictional QA accounts. Credentials and
// generated extension tokens stay in memory; created tokens are revoked.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/server/supabaseAdmin";
import { createExtensionToken } from "@/server/extension/tokens";
import { answerCommandInput, saveAnswer } from "@/server/answers/service";

nextEnv.loadEnvConfig(process.cwd());
if (!process.env.QA_SESSION_FILE) throw new Error("Set QA_SESSION_FILE to the private synthetic account fixture.");
if (new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname !== "tlmabncoijnuxymxohgu.supabase.co") throw new Error("This check is restricted to the named QA project.");
const session = JSON.parse(await readFile(process.env.QA_SESSION_FILE, "utf8"));
const primary = session.accounts.find(account => account.id === "25da4fa1-9512-4e32-b22b-bd90548f50dd");
const other = session.accounts.find(account => account.id === "acf746a7-3fc0-4e45-864b-02bf23b7d2c2");
assert.ok(primary && other && [primary, other].every(account => account.email.endsWith("@example.test")), "Only the known fictional accounts may be used.");
const admin = createAdminClient();
const ownerClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const tokens = [], id = randomUUID(), run = randomUUID().slice(0, 8);
const content = { label: `A6 API QA ${run}`, question: "Describe a project.", answer: "I built a test-only API fixture.", category: "project", tags: ["qa"], sourceNote: "Fictional verification data", sourceUrl: "" };
let revision = 0, checks = 0;
const command = (action, value = content) => answerCommandInput.parse({ id, eventId: randomUUID(), expectedRevision: revision, action, ...(["approve", "draft"].includes(action) && { content: value }) });
async function call(token, body, expected, label) {
  const response = await fetch("http://localhost:3000/api/extension/autofill", { method: body ? "POST" : "GET", headers: { ...(token && { Authorization: `Bearer ${token}` }), ...(body && { "Content-Type": "application/json" }) }, ...(body && { body: JSON.stringify(body) }) });
  assert.equal(response.status, expected, label); checks++;
  if (response.ok) { assert.equal(response.headers.get("cache-control"), "no-store"); checks++; }
  return response.json();
}
try {
  const { data: auth, error } = await ownerClient.auth.signInWithPassword({ email: primary.email, password: primary.password });
  if (error || auth.user?.id !== primary.id) throw new Error("Synthetic owner sign-in failed.");
  for (const account of [primary, other]) tokens.push({ ...(await createExtensionToken(admin, account.id)), userId: account.id });
  await call(null, null, 401, "a cookie-less request requires its extension token");
  const own = await call(tokens[0].token, null, 200, "owned contact context");
  const foreign = await call(tokens[1].token, null, 200, "second account context");
  assert.equal(own.facts.email, primary.email); checks++;
  assert.equal(foreign.facts.email, other.email); checks++;
  assert.ok(own.choices.every(choice => !Object.hasOwn(choice, "answer"))); checks++;
  revision = (await saveAnswer(ownerClient, command("approve"))).revision;
  const input = { profileFingerprint: own.profileFingerprint, answerSelections: [{ id, revision }] };
  const selected = await call(tokens[0].token, input, 200, "owned approved answer");
  assert.equal(selected.answers[0].answer, content.answer); checks++;
  await call(tokens[1].token, { ...input, profileFingerprint: foreign.profileFingerprint }, 404, "another account cannot reuse this answer");
  await call(tokens[0].token, { ...input, profileFingerprint: "0".repeat(64) }, 409, "stale contact fingerprint");
  await call(tokens[0].token, { ...input, answerSelections: [input.answerSelections[0], input.answerSelections[0]] }, 400, "duplicate answer references");
  await call(tokens[0].token, { ...input, userId: other.id }, 400, "request cannot override the authenticated owner");
  revision = (await saveAnswer(ownerClient, command("draft", { ...content, answer: "Edited, not approved." }))).revision;
  await call(tokens[0].token, input, 409, "an old approved revision cannot be reused");
  await call(tokens[0].token, { ...input, answerSelections: [{ id, revision }] }, 409, "the current draft is also unavailable");
  revision = (await saveAnswer(ownerClient, command("approve"))).revision;
  await call(tokens[0].token, { ...input, answerSelections: [{ id, revision }] }, 200, "explicit approval makes the current version reusable");
  revision = (await saveAnswer(ownerClient, command("archive"))).revision;
  const latest = await call(tokens[0].token, null, 200, "archived answer metadata");
  assert.equal(latest.choices.some(choice => choice.id === id), false); checks++;
  await call(tokens[0].token, { ...input, answerSelections: [{ id, revision }] }, 409, "archived sources cannot be reused");
  const { error: revokeError } = await admin.from("extension_tokens").update({ revoked_at: new Date().toISOString() }).eq("id", tokens[0].id).eq("user_id", primary.id);
  if (revokeError) throw new Error("Could not revoke the synthetic extension connection.");
  await call(tokens[0].token, null, 401, "disconnected token");
  console.log(JSON.stringify({ run, checks, accounts: [primary.id, other.id], archivedAnswer: id, revision, result: "pass" }));
} finally {
  for (const token of tokens) {
    const { error } = await admin.from("extension_tokens").update({ revoked_at: new Date().toISOString() }).eq("id", token.id).eq("user_id", token.userId);
    if (error) console.error("A synthetic token still needs revocation.");
  }
  if (revision) {
    try { await saveAnswer(ownerClient, command("archive")); } catch { console.error("The fictional QA answer may still be visible in the synthetic account."); }
  }
  await ownerClient.auth.signOut({ scope: "local" });
}
