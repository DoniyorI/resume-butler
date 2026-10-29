import assert from "node:assert/strict";
import { test } from "node:test";
import { archiveError } from "../src/server/applications/submissions.js";
test("stale answer capture uses an explicit HTTP conflict instead of a serialization failure", () => {
  assert.throws(() => archiveError({ code: "PT409", message: "Answer changed or unapproved" }), error => error.status === 409 && /answer/i.test(error.message));
});
