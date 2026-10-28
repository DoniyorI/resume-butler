import assert from "node:assert/strict";
import { test } from "node:test";
import { createIngestionQueue } from "../extension/ingestionQueue.js";

function setup(initial = []) {
  let rows = structuredClone(initial), next = 0;
  const storage = { get: async () => ({ queue: structuredClone(rows) }), set: async ({ queue }) => { rows = structuredClone(queue); } };
  const create = () => createIngestionQueue({ storage, uuid: () => `event-${++next}`, today: () => "2026-10-28" });
  return { create, snapshot: () => structuredClone(rows) };
}
const account = { userId: "owner", origin: "https://app.example.test" };
const job = { site: "greenhouse", jobId: "123", company: "Acme", role: "Engineer", url: "https://boards.greenhouse.io/acme/jobs/123" };
test("a submission is durable before transport and repeated notifications reuse its captured payload", async () => {
  const env = setup(), queue = env.create();
  const first = await queue.captureSubmission({ ...account, job });
  const repeated = await queue.captureSubmission({ ...account, job: { ...job, role: "Page changed" } });
  assert.equal(first.eventId, repeated.eventId);
  assert.equal(repeated.job.role, "Engineer");
  assert.equal(repeated.appliedDate, "2026-10-28");
  assert.equal(env.snapshot().length, 1);
});
test("service-worker restart preserves event UUID, date and payload", async () => {
  const env = setup();
  const first = await env.create().captureSubmission({ ...account, job });
  assert.deepEqual(await env.create().pendingFor(account), [first]);
});
test("concurrent enqueue operations cannot lose different submissions", async () => {
  const env = setup(), queue = env.create();
  await Promise.all([queue.captureSubmission({ ...account, job }), queue.captureSubmission({ ...account, job: { ...job, jobId: "456", url: "https://boards.greenhouse.io/acme/jobs/456" } })]);
  assert.equal(env.snapshot().length, 2);
  assert.notEqual(env.snapshot()[0].eventId, env.snapshot()[1].eventId);
});
test("switching accounts or app origins never selects another account's queued work", async () => {
  const queue = setup().create();
  await queue.captureSubmission({ ...account, job });
  assert.deepEqual(await queue.pendingFor({ ...account, userId: "other" }), []);
  assert.deepEqual(await queue.pendingFor({ ...account, origin: "http://localhost:3000" }), []);
});
test("an unresolved event survives until the exact event is acknowledged", async () => {
  const env = setup(), queue = env.create();
  const first = await queue.captureSubmission({ ...account, job });
  await queue.pause(first, "needs_matching");
  assert.equal((await queue.pendingFor(account))[0].state, "needs_matching");
  await queue.acknowledge({ ...first, userId: "other" });
  assert.equal(env.snapshot().length, 1);
  await queue.acknowledge(first);
  assert.deepEqual(env.snapshot(), []);
});
test("a later actual submission gets a new event after acknowledgment", async () => {
  const queue = setup().create();
  const first = await queue.captureSubmission({ ...account, job });
  await queue.acknowledge(first);
  assert.notEqual((await queue.captureSubmission({ ...account, job })).eventId, first.eventId);
});
test("legacy entries stay paused until the user explicitly assigns them", async () => {
  const env = setup([{ ...job, appliedDate: "2026-10-20" }]), queue = env.create();
  assert.deepEqual(await queue.pendingFor(account), []);
  assert.equal((await queue.summary(account)).legacy, 1);
  await queue.adoptLegacy(account);
  const pending = await queue.pendingFor(account);
  assert.equal(pending[0].userId, account.userId);
  assert.equal(pending[0].appliedDate, "2026-10-20");
  assert.equal((await queue.summary(account)).legacy, 0);
});
test("identical board-local IDs at different employers remain separate", async () => {
  const env = setup(), queue = env.create();
  const first = await queue.captureSubmission({ ...account, job });
  const second = await queue.captureSubmission({ ...account, job: { ...job, company: "Other", url: "https://boards.greenhouse.io/other/jobs/123" } });
  assert.notEqual(first.eventId, second.eventId);
  assert.equal(env.snapshot().length, 2);
});
test("legacy adoption never reassigns entries with another known owner", async () => {
  const initial = { version: 1, userId: "other", job };
  const env = setup([initial]), queue = env.create();
  await queue.adoptLegacy(account);
  assert.deepEqual(env.snapshot(), [initial]);
});
test("queue acknowledgment cannot remove an unrelated pending submission", async () => {
  const env = setup(), queue = env.create();
  const first = await queue.captureSubmission({ ...account, job });
  const second = await queue.captureSubmission({ ...account, job: { ...job, jobId: "456" } });
  await queue.acknowledge(first);
  assert.equal(env.snapshot()[0].eventId, second.eventId);
});
