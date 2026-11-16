import assert from "node:assert/strict";
import { test } from "node:test";
import { CHECK_KINDS, languageLine } from "@/features/opportunities/fitLines";

test("the language line says whether the Master CV mentions each required language", () => {
  assert.equal(
    languageLine({ required: ["Korean"], missing: ["Korean"], status: "short" }),
    "Asks for Korean: not mentioned in your Master CV."
  );
  assert.equal(
    languageLine({ required: ["Korean", "Japanese"], missing: ["Korean"], status: "short" }),
    "Asks for Korean and Japanese: Korean is not mentioned in your Master CV."
  );
  assert.equal(
    languageLine({ required: ["Korean", "Japanese"], missing: [], status: "meets" }),
    "Asks for Korean and Japanese: mentioned in your Master CV."
  );
});

test("no language line when the posting requires none, or for an older result", () => {
  assert.equal(languageLine({ required: [], missing: [], status: "not-stated" }), null);
  assert.equal(languageLine(undefined), null);
});

test("location and language checks have labels", () => {
  assert.equal(CHECK_KINDS.location, "Location");
  assert.equal(CHECK_KINDS.language, "Language");
});
