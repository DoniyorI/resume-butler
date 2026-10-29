import assert from "node:assert/strict";
import { test } from "node:test";
import { autofillSelectionInput, getAutofillContext, resolveAutofillSources } from "@/server/extension/autofill";

const owner = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const answerId = "00000000-0000-4000-8000-000000000010";
const secondId = "00000000-0000-4000-8000-000000000011";
const profile = () => ({ id: owner, first_name: "Ada", last_name: "Lovelace", email: "ada@example.test", phone: "+1 202 555 0140", linkedin: "https://linkedin.com/in/ada", github: "https://github.com/ada", portfolio: "https://ada.example.test", location: "London", updated_at: "2026-10-29" });
const answer = () => ({ id: answerId, user_id: owner, label: "A project", question: "Describe a project.", answer: "I built a parser.", revision: 3, approved_at: "2026-10-29", archived_at: null, updated_at: "2026-10-29" });

// Exercise the service's actual filters/projections against mixed owned rows;
// the network/database transport is the only substitute here.
function database(tables) {
  return { from(table) {
    let rows = [...(tables[table] || [])], columns;
    const result = () => ({ data: rows.map(row => Object.fromEntries(columns.split(",").map(key => [key, row[key]]))), error: null });
    const query = {
      select(value) { columns = value; return query; },
      eq(key, value) { rows = rows.filter(row => row[key] === value); return query; },
      is(key, value) { rows = rows.filter(row => row[key] === value); return query; },
      not(key, operator, value) { assert.equal(operator, "is"); rows = rows.filter(row => row[key] !== value); return query; },
      in(key, values) { rows = rows.filter(row => values.includes(row[key])); return query; },
      order(key, { ascending }) { rows.sort((a, b) => (a[key] > b[key] ? 1 : a[key] < b[key] ? -1 : 0) * (ascending ? 1 : -1)); return query; },
      limit(count) { rows = rows.slice(0, count); return query; },
      maybeSingle: async () => ({ data: result().data[0] || null, error: null }),
      then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject); },
    };
    return query;
  } };
}
const db = (profiles = [profile()], answers = [answer()]) => database({ profiles, reusable_answers: answers });

test("autofill returns only the owner's contact facts and currently approved metadata", async () => {
  const own = profile(), foreign = { ...profile(), id: other, email: "other@example.test" };
  const result = await getAutofillContext(db([foreign, own], [
    answer(), { ...answer(), id: secondId, user_id: other, answer: "PRIVATE" },
    { ...answer(), id: "draft", approved_at: null }, { ...answer(), id: "archived", archived_at: "2026-10-29" },
  ]), owner);
  assert.deepEqual(result.facts, { name: "Ada Lovelace", email: "ada@example.test", phone: "+1 202 555 0140", linkedin: "https://linkedin.com/in/ada", github: "https://github.com/ada", portfolio: "https://ada.example.test/" });
  assert.deepEqual(result.choices, [{ id: answerId, label: "A project", question: "Describe a project.", revision: 3 }]);
  assert.match(result.profileFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(result).includes("PRIVATE"), false);
  assert.equal(JSON.stringify(result).includes("I built a parser."), false, "initial choices must not include answer bodies");
});

test("another account's profile cannot stand in for a missing owned profile", async () => {
  await assert.rejects(getAutofillContext(db([{ ...profile(), id: other }]), owner), error => error.status === 404);
});

test("contact changes invalidate review while unrelated CV edits leave it valid", async () => {
  const p = profile(), client = db([p]);
  const initial = await getAutofillContext(client, owner);
  p.location = "Different location"; p.updated_at = "2026-10-30";
  const selection = { profileFingerprint: initial.profileFingerprint, answerSelections: [{ id: answerId, revision: 3 }] };
  assert.equal((await resolveAutofillSources(client, owner, selection)).answers[0].answer, "I built a parser.");
  p.phone = "+1 202 555 0199";
  await assert.rejects(resolveAutofillSources(client, owner, selection), error => error.status === 409);
});

test("reuse checks current ownership, revision, approval and archive status", async () => {
  const current = answer(), client = db([profile()], [current]);
  const { profileFingerprint } = await getAutofillContext(client, owner);
  const input = { profileFingerprint, answerSelections: [{ id: answerId, revision: 3 }] };
  for (const change of [{ revision: 4 }, { approved_at: null }, { archived_at: "2026-10-30" }]) {
    Object.assign(current, answer(), change);
    await assert.rejects(resolveAutofillSources(client, owner, input), error => error.status === 409);
  }
  Object.assign(current, answer(), { user_id: other });
  await assert.rejects(resolveAutofillSources(client, owner, input), error => error.status === 404);
});

test("unsafe or incomplete legacy facts are omitted rather than guessed or truncated", async () => {
  const result = await getAutofillContext(db([{ ...profile(), last_name: "", phone: "x".repeat(51), email: "invalid", linkedin: "javascript:alert(1)", github: "https://password:secret@example.test", portfolio: "file:///etc/passwd" }]), owner);
  assert.deepEqual(result.facts, { name: "", email: "", phone: "", linkedin: "", github: "", portfolio: "" });
});

test("source selections reject duplicate, excessive or malformed answer references", () => {
  const base = { profileFingerprint: "a".repeat(64), answerSelections: [{ id: answerId, revision: 3 }] };
  assert.equal(autofillSelectionInput.safeParse(base).success, true);
  for (const input of [
    { ...base, userId: other }, { ...base, profileFingerprint: "old" },
    { ...base, answerSelections: [base.answerSelections[0], base.answerSelections[0]] },
    { ...base, answerSelections: Array.from({ length: 51 }, (_, index) => ({ id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`, revision: 1 })) },
    { ...base, answerSelections: [{ id: answerId, revision: 0 }] },
    { ...base, answerSelections: [{ id: answerId, revision: 3, answer: "Unreviewed text" }] },
  ]) assert.equal(autofillSelectionInput.safeParse(input).success, false);
});
