import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

// Next 14's production minifier folds a constant template literal into a string
// and writes `\\b` as backslash + backspace, so a regex built that way matches
// nothing in production while passing here and in dev (the language names in
// posting.js, November 2026). Build such a regex as a literal or from plain strings.
function sources(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : sources(path);
    return /\.(?:js|jsx|mjs)$/.test(entry.name) ? [path] : [];
  });
}

test("no RegExp is built from a template literal containing \\\\b", () => {
  const offenders = [];
  for (const file of [...sources("src"), ...sources("extension")]) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (/RegExp\(\s*`[^`]*\\\\b/.test(line)) offenders.push(`${file}:${i + 1}`);
    });
  }
  assert.deepEqual(offenders, []);
});
