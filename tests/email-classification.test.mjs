import assert from "node:assert/strict";
import { mock, test } from "node:test";

let answer;
mock.module("@/server/openai", { namedExports: { chatJSON: async () => answer } });
const { classifyEmail } = await import("@/server/email/classify");
const email = { subject: "Application received", from: "Acme Hiring", body: "Thanks for applying.", bulk: false };
const valid = { category: "application_received", company: "Acme", role: "Engineer", confidence: 0.95, summary: "Application received." };

test("a valid extracted classification is retained", async () => {
  answer = valid;
  assert.deepEqual(await classifyEmail(email), valid);
});

for (const [label, change] of [
  ["out-of-range confidence", { confidence: 2 }],
  ["string confidence", { confidence: "0.95" }],
  ["unknown category", { category: "please_update_everything" }],
  ["non-string company", { company: { name: "Acme" } }],
]) {
  test(`malformed extraction (${label}) stays retryable`, async () => {
    answer = { ...valid, ...change };
    assert.equal(await classifyEmail(email), null);
  });
}
