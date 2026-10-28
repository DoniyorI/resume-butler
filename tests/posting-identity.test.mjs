import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizePostingIdentity } from "@/lib/postingIdentity";

const examples = [
  ["LinkedIn posting", "https://www.linkedin.com/jobs/view/backend-engineer-123/?trk=feed", "linkedin", "global", "123", "https://www.linkedin.com/jobs/view/123/"],
  ["LinkedIn search selection", "https://www.linkedin.com/jobs/search/?currentJobId=123&keywords=engineer", "linkedin", "global", "123", "https://www.linkedin.com/jobs/view/123/"],
  ["Greenhouse board", "https://job-boards.greenhouse.io/acme/jobs/123?gh_src=test", "greenhouse", "acme", "123", "https://job-boards.greenhouse.io/acme/jobs/123"],
  ["Greenhouse embedded form", "https://boards.greenhouse.io/embed/job_app?for=acme&token=123&utm_source=x", "greenhouse", "acme", "123", "https://job-boards.greenhouse.io/acme/jobs/123"],
  ["another Greenhouse board", "https://boards.greenhouse.io/other/jobs/123", "greenhouse", "other", "123", "https://job-boards.greenhouse.io/other/jobs/123"],
  ["Lever apply", "https://jobs.lever.co/acme/12345678-1234-1234-1234-123456789abc/apply?lever-source=x", "lever", "acme", "12345678-1234-1234-1234-123456789abc", "https://jobs.lever.co/acme/12345678-1234-1234-1234-123456789abc"],
  ["Ashby form", "https://jobs.ashbyhq.com/acme/12345678-1234-1234-1234-123456789abc/application#form", "ashby", "acme", "12345678-1234-1234-1234-123456789abc", "https://jobs.ashbyhq.com/acme/12345678-1234-1234-1234-123456789abc"],
];
for (const [name, url, platform, namespace, postingId, urlKey] of examples) {
  test(`${name} retains employer and posting identity`, () => {
    assert.deepEqual(normalizePostingIdentity({ url }), { platform, namespace, postingId, urlKey });
  });
}
test("unknown sites retain case-sensitive paths and identity-bearing query parameters", () => {
  assert.deepEqual(normalizePostingIdentity({ url: "https://example.test/Jobs/Engineer?req=ABC&view=apply&utm_source=feed#form" }), {
    platform: null, namespace: null, postingId: null,
    urlKey: "https://example.test/Jobs/Engineer?req=ABC&view=apply",
  });
});
test("no URL is an explicitly weak identity", () => {
  assert.deepEqual(normalizePostingIdentity({ url: "" }), { platform: null, namespace: null, postingId: null, urlKey: "" });
});
for (const url of ["javascript:alert(1)", "not a URL", "https://user:pass@example.test/job", `https://example.test/${"a".repeat(2000)}`]) {
  test(`unsafe or invalid URL is rejected (${url.slice(0, 30)})`, () => assert.throws(() => normalizePostingIdentity({ url })));
}
test("page-supplied IDs cannot override the posting URL", () => {
  assert.throws(() => normalizePostingIdentity({ url: examples[0][1], platform: "linkedin", postingId: "456" }));
  assert.throws(() => normalizePostingIdentity({ url: examples[0][1], platform: "greenhouse", postingId: "123" }));
});
test("a lookalike domain cannot claim a supported platform identity", () => {
  assert.throws(() => normalizePostingIdentity({ url: "https://linkedin.com.example.test/jobs/view/123", platform: "linkedin", postingId: "123" }));
});
