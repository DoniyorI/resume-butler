import nextEnv from "@next/env";
import { writeFile } from "node:fs/promises";
import { emailCases, syntheticEmails } from "../tests/fixtures/emails.mjs";
import { classifyEmail, isCandidateEmail } from "@/server/email/classify";
import { normalizeCompany, normalizeRole } from "@/server/email/matching";

nextEnv.loadEnvConfig(process.cwd());
const models = (process.argv[3] || "gpt-4o-mini,gpt-6-luna").split(",");
const path = process.argv[2] || "/tmp/resume-butler-email-model-evaluation.json";
const realFetch = globalThis.fetch;
let usage;
globalThis.fetch = async (...args) => {
  const response = await realFetch(...args);
  if (String(args[0]).startsWith("https://api.openai.com/")) {
    const body = await response.clone().json();
    usage.input += body.usage?.prompt_tokens || 0;
    usage.output += body.usage?.completion_tokens || 0;
    usage.requests++;
  }
  return response;
};
const report = { synthetic: true, generatedAt: new Date().toISOString(), models: [] };
try {
  for (const model of models) {
    process.env.OPENAI_EMAIL_MODEL = model;
    usage = { input: 0, output: 0, requests: 0 };
    const cases = [];
    const emails = syntheticEmails("evaluation");
    for (const [index, fixture] of emailCases.entries()) {
      const candidate = isCandidateEmail(emails[index]);
      if (fixture.filtered) {
        cases.push({ id: fixture.id, prefiltered: !candidate, correct: !candidate });
        continue;
      }
      const started = Date.now();
      const answer = candidate ? await classifyEmail(emails[index]) : null;
      cases.push({
        id: fixture.id, latencyMs: Date.now() - started, answer,
        correct: Boolean(answer && answer.category === fixture.category &&
          normalizeCompany(answer.company) === fixture.companyKey && normalizeRole(answer.role) === fixture.roleKey),
      });
    }
    const timings = cases.filter((row) => row.latencyMs != null).map((row) => row.latencyMs).sort((a, b) => a - b);
    const result = {
      model, passed: cases.filter((row) => row.correct).length, total: cases.length,
      meanLatencyMs: Math.round(timings.reduce((sum, value) => sum + value, 0) / timings.length),
      maxLatencyMs: timings.at(-1), usage: { ...usage }, cases,
    };
    report.models.push(result);
    await writeFile(path, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ model, passed: result.passed, total: result.total, meanLatencyMs: result.meanLatencyMs, maxLatencyMs: result.maxLatencyMs, usage: result.usage }));
  }
} finally { globalThis.fetch = realFetch; }
console.log(JSON.stringify({ reportPath: path, caveat: "Small synthetic corpus; not a production accuracy estimate." }));
