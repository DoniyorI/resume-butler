import assert from "node:assert/strict";
import { test } from "node:test";
const load = () => import("../src/server/email/connectionErrors.js");
test("TLS and network failures cannot be mislabeled as rejected email credentials", async () => {
  const { emailConnectionError } = await load();
  for (const code of ["UNABLE_TO_VERIFY_LEAF_SIGNATURE", "SELF_SIGNED_CERT_IN_CHAIN", "CERT_HAS_EXPIRED"]) {
    const error = emailConnectionError({ code });
    assert.equal(error.status,502);assert.match(error.message,/certificate/i);assert.doesNotMatch(error.message,/password/i);
  }
  const timeout=emailConnectionError({code:"ETIMEDOUT"});assert.equal(timeout.status,503);assert.match(timeout.message,/reach|timed out/i);
  const auth=emailConnectionError({source:"authentication"});assert.equal(auth.status,400);assert.match(auth.message,/sign-in|password/i);
});
