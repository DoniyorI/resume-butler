import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { chatJSON } from "@/server/openai";

let requests;
let reply;
beforeEach((t) => {
  requests = [];
  reply = () => Response.json({ choices: [{ finish_reason: "stop", message: { content: '{"ready":true}' } }] });
  process.env.OPENAI_API_KEY = "synthetic-unit-test-key";
  process.env.OPENAI_MODEL = "gpt-4o-mini";
  for (const key of ["OPENAI_EMAIL_MODEL", "OPENAI_WRITING_MODEL", "OPENAI_SELECTION_MODEL", "OPENAI_IMPORT_MODEL"]) delete process.env[key];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    requests.push({ url, body: JSON.parse(options.body) });
    return reply();
  });
});
const request = (extra = {}) => chatJSON({ system: "Return JSON.", user: "Synthetic fixture", ...extra });

test("the existing default still returns a JSON object", async () => {
  assert.deepEqual(await request(), { ready: true });
  assert.equal(requests[0].body.model, "gpt-4o-mini");
});

test("an unconfigured deployment defaults every AI task to GPT-6 Luna", async () => {
  delete process.env.OPENAI_MODEL;
  for (const task of ["email", "writing", "selection", "import"]) {
    await request({ task, maxTokens: 200 });
  }
  assert.ok(requests.every(({ body }) => body.model === "gpt-6-luna" && body.reasoning_effort === "none"));
});

test("email model overrides leave writing requests on their own configured model", async () => {
  process.env.OPENAI_EMAIL_MODEL = "gpt-6-luna";
  process.env.OPENAI_WRITING_MODEL = "gpt-6.1-sol";
  await request({ task: "email", maxTokens: 200, temperature: 0 });
  await request({ task: "writing", maxTokens: 1000 });
  assert.equal(requests[0].body.model, "gpt-6-luna");
  assert.equal(requests[0].body.reasoning_effort, "none");
  assert.equal(requests[0].body.max_completion_tokens, 200);
  assert.equal(requests[0].body.max_tokens, undefined);
  assert.equal(requests[1].body.model, "gpt-6.1-sol");
  assert.equal(requests[1].body.reasoning_effort, "low");
});

test("classification can require a strict provider JSON schema", async () => {
  const schema = { type: "object", properties: { ready: { type: "boolean" } }, required: ["ready"], additionalProperties: false };
  await request({ schema, schemaName: "test_result" });
  assert.deepEqual(requests[0].body.response_format, { type: "json_schema", json_schema: { name: "test_result", strict: true, schema } });
});

test("versioned Luna model IDs retain the no-reasoning request mode", async () => {
  process.env.OPENAI_EMAIL_MODEL = "gpt-6.1-luna";
  await request({ task: "email" });
  assert.equal(requests[0].body.reasoning_effort, "none");
});

test("truncated JSON is rejected even when the partial content parses", async () => {
  reply = () => Response.json({ choices: [{ finish_reason: "length", message: { content: '{"ready":true}' } }] });
  await assert.rejects(request(), /incomplete|truncated/i);
});

test("refusal does not become a parsed application response", async () => {
  reply = () => Response.json({ choices: [{ finish_reason: "stop", message: { refusal: "Synthetic refusal", content: null } }] });
  await assert.rejects(request(), /refus|unavailable/i);
});

test("transient provider failure is retried within a bounded attempt count", async () => {
  reply = () => requests.length === 1
    ? new Response("temporary provider outage", { status: 503 })
    : Response.json({ choices: [{ finish_reason: "stop", message: { content: '{"ready":true}' } }] });
  assert.deepEqual(await request(), { ready: true });
  assert.equal(requests.length, 2);
});

test("provider failures do not echo private request content into errors", async () => {
  reply = () => new Response("PRIVATE_EMAIL_BODY secret@example.test", { status: 400 });
  await assert.rejects(request(), (error) => {
    assert.match(error.message, /400/);
    assert.equal(error.message.includes("PRIVATE_EMAIL_BODY"), false);
    return true;
  });
});

test("non-object JSON is rejected at the shared AI boundary", async () => {
  reply = () => Response.json({ choices: [{ finish_reason: "stop", message: { content: "null" } }] });
  await assert.rejects(request(), /object|invalid/i);
});
