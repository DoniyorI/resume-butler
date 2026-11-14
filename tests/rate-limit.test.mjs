import assert from "node:assert/strict";
import { test } from "node:test";
import { enforceRateLimit } from "../src/server/rateLimit.js";

test("AI quota errors and invalid results cannot remove paid-operation caps", async () => {
  for (const key of ["generate-resume", "generate-cover-letter", "suggest-bullets", "rewrite-bullet", "parse-resume", "scan-emails"]) {
    for (const rpc of [async () => ({ error: { code: "PGRST202", message: "missing" } }), async () => ({ error: { code: "42501", message: "denied" } }), async () => ({ data: null, error: null }), async () => { throw new Error("offline"); }]) {
      await assert.rejects(enforceRateLimit({ rpc }, key), error => error.status === 503);
    }
  }
});

test("rate limit allows an explicit grant, rejects denial, and retains PDF availability policy", async () => {
  await enforceRateLimit({ rpc: async () => ({ data: true, error: null }) }, "generate-resume");
  await assert.rejects(enforceRateLimit({ rpc: async () => ({ data: false, error: null }) }, "generate-resume"), error => error.status === 429);
  await enforceRateLimit({ rpc: async () => ({ error: { code: "PGRST202", message: "not installed" } }) }, "download-resume");
});

test("an unknown key says the migration is missing; other failures stay generic", async () => {
  const unknown = { rpc: async () => ({ data: null, error: { code: "P0001", message: "Unknown rate limit key: export-data" } }) };
  await assert.rejects(
    enforceRateLimit(unknown, "export-data"),
    (error) => error.status === 503 && error.message === "This feature needs the latest database migration. See supabase/migrations."
  );
  await assert.rejects(
    enforceRateLimit({ rpc: async () => ({ data: null, error: { code: "42501", message: "denied" } }) }, "export-data"),
    (error) => error.status === 503 && error.message === "Usage checks are temporarily unavailable. Please try again shortly."
  );
  await enforceRateLimit(unknown, "download-resume");
});
