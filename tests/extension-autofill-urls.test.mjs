import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { test } from "node:test";
import { autofillPlatform, supportedAutofillUrl } from "../extension/autofillUrls.js";
import { createAutofillReview } from "../extension/autofillReview.js";

const lever = "https://jobs.lever.co/qa/00000000-0000-4000-8000-000000000001/apply";
const gh = "https://job-boards.greenhouse.io/examplelabs/jobs/4000001";
// [url, platform or null]
const table = [
  [lever, "lever"], [lever + "/", "lever"],
  [gh, "greenhouse"], [gh + "/", "greenhouse"], [gh + "?gh_src=abc#app", "greenhouse"],
  ["https://job-boards.greenhouse.io/embed/job_app?for=examplelabs&token=4000001", "greenhouse"],
  ["https://job-boards.greenhouse.io/embed/job_app?token=4000001&for=examplelabs", "greenhouse"],
  // look-alike hosts, scheme, credentials, ports
  ["https://jobs.lever.co.evil.example/qa/00000000-0000-4000-8000-000000000001/apply", null],
  ["https://job-boards.greenhouse.io.evil.example/examplelabs/jobs/4000001", null],
  ["https://evil-job-boards.greenhouse.io/examplelabs/jobs/4000001", null],
  ["http://job-boards.greenhouse.io/examplelabs/jobs/4000001", null],
  ["http://jobs.lever.co/qa/00000000-0000-4000-8000-000000000001/apply", null],
  ["https://user:pw@job-boards.greenhouse.io/examplelabs/jobs/4000001", null],
  ["https://user@jobs.lever.co/qa/00000000-0000-4000-8000-000000000001/apply", null],
  ["https://job-boards.greenhouse.io:8443/examplelabs/jobs/4000001", null],
  // other paths
  ["https://job-boards.greenhouse.io/examplelabs/jobs/abc", null],
  ["https://job-boards.greenhouse.io/examplelabs/jobs/4000001/apply", null],
  ["https://job-boards.greenhouse.io/examplelabs", null],
  ["https://job-boards.greenhouse.io/", null],
  ["https://jobs.lever.co/qa/00000000-0000-4000-8000-000000000001", null],
  ["https://jobs.lever.co/qa/not-a-uuid/apply", null],
  // embed rules: both parameters, once each, well formed
  ["https://job-boards.greenhouse.io/embed/job_app", null],
  ["https://job-boards.greenhouse.io/embed/job_app?for=examplelabs", null],
  ["https://job-boards.greenhouse.io/embed/job_app?for=a%20b&token=1", null],
  ["https://job-boards.greenhouse.io/embed/job_app?for=a&token=x", null],
  ["https://job-boards.greenhouse.io/embed/job_app?for=a&token=1&token=2", null],
  ["https://job-boards.greenhouse.io/embed/job_app/extra?for=a&token=1", null],
  // the old host redirects to job-boards; an iframe-only embed host is never a form page
  ["https://boards.greenhouse.io/examplelabs/jobs/4000001", null],
  ["https://boards.greenhouse.io/embed/job_app?for=examplelabs&token=4000001", null],
  ["https://example-company.com/careers?gh_jid=4000001", null],
  ["not a url", null], ["", null], [undefined, null],
];

async function popupPlatform() {
  const context = { URL, document: { getElementById: () => ({}) }, chrome: {}, globalThis: null };
  context.globalThis = context;
  vm.runInNewContext(await readFile(new URL("../extension/popup/autofill.js", import.meta.url), "utf8"), context);
  return context.RB_autofillUi.platformFor;
}

test("the worker accepts only Lever and Greenhouse application form URLs", () => {
  for (const [url, platform] of table) {
    assert.equal(autofillPlatform(url), platform, String(url));
    assert.equal(supportedAutofillUrl(url), platform !== null, String(url));
  }
});

test("the popup's copy of the URL rules agrees with the worker on every case", async () => {
  const platformFor = await popupPlatform();
  for (const [url, platform] of table) {
    assert.equal(platformFor(url), platform && platform[0].toUpperCase() + platform.slice(1), String(url));
  }
});

test("a Greenhouse tab is reviewable: first and last name are proposed and an old server's missing keys are empty", async () => {
  let tab = { id: 7, url: gh };
  const facts = { name: "Ada Lovelace", firstName: "Ada", lastName: "Lovelace", email: "ada@example.test", phone: "", linkedin: "", github: "", portfolio: "" };
  let served = facts;
  const sent = [];
  const review = createAutofillReview({
    connectedAccount: async () => ({ userId: "owner", origin: "https://resume-butler.vercel.app", token: "t" }),
    activeTab: async () => structuredClone(tab),
    api: async (_path, options = {}) => options.method === "POST" ? { facts: served, profileFingerprint: "a".repeat(64), answers: [] }
      : { facts: served, profileFingerprint: "a".repeat(64), choices: [] },
    sendToTab: async (_id, message) => {
      sent.push(message);
      return message.type === "autofill:scan" ? { ok: true, inventoryId: "inv", url: tab.url, title: "Staff Quality Engineer", manual: [], fields: [
        { id: "f", label: "First Name", kind: "profile", sourceKey: "firstName", empty: true, maxLength: 255, multiline: false },
        { id: "l", label: "Last Name", kind: "profile", sourceKey: "lastName", empty: true, maxLength: -1, multiline: false },
      ] } : { ok: true, outcomes: message.values.map(item => ({ fieldId: item.fieldId, status: "filled" })) };
    },
    now: () => 0, randomId: () => "review-1",
  });
  const base = () => ({ account: { userId: "owner", origin: "https://resume-butler.vercel.app" }, tab: structuredClone(tab) });
  const { review: plan } = await review.prepare(base());
  assert.deepEqual(plan.fields.map(field => [field.id, field.value, field.selected]), [["f", "Ada", true], ["l", "Lovelace", true]]);
  await review.fill({ ...base(), reviewId: plan.id, fieldIds: ["f", "l"] });
  assert.deepEqual(sent.at(-1).values, [{ fieldId: "f", value: "Ada" }, { fieldId: "l", value: "Lovelace" }]);

  // A name that changed after review is refused before any write.
  const second = (await review.prepare(base())).review;
  served = { ...facts, firstName: "Grace" };
  const before = sent.length;
  await assert.rejects(review.fill({ ...base(), reviewId: second.id, fieldIds: ["f"] }));
  assert.equal(sent.length, before);

  // A server that predates the two keys yields empty values, not a failed review.
  const { firstName, lastName, ...older } = facts; served = older;
  const empty = (await review.prepare(base())).review;
  assert.deepEqual(empty.fields.map(field => [field.value, field.selected]), [["", false], ["", false]]);

  // An unsupported tab is refused before any request.
  tab = { id: 7, url: "https://boards.greenhouse.io/examplelabs/jobs/4000001" };
  await assert.rejects(review.prepare(base()));
});
