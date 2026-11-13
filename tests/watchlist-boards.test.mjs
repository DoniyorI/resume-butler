import assert from "node:assert/strict";
import { test } from "node:test";

const { parseBoardLink, fetchBoard, MAX_BODY_BYTES, MAX_POSTINGS } = await import("@/server/watchlist/boards");
const { normalizePostingIdentity } = await import("@/lib/postingIdentity");
const { HttpError } = await import("@/server/http");

const NOW = Date.parse("2026-11-13T12:00:00Z");
const LEVER_ID = "0a1b2c3d-1111-4222-8333-444455556666";
const ASHBY_ID = "AAAAAAAA-1111-4222-8333-444455556666";

test("parseBoardLink accepts the documented forms", () => {
  const ok = [
    ["https://boards.greenhouse.io/acme", "greenhouse", "acme"],
    ["https://boards.greenhouse.io/acme/jobs/123?gh_src=x#top", "greenhouse", "acme"],
    ["https://job-boards.greenhouse.io/acme_co-2/jobs/9", "greenhouse", "acme_co-2"],
    ["http://JOBS.LEVER.CO/acme/", "lever", "acme"],
    ["https://jobs.lever.co/acme/" + LEVER_ID, "lever", "acme"],
    ["  https://jobs.ashbyhq.com/Acme  ", "ashby", "Acme"],
    ["https://jobs.ashbyhq.com/acme/" + ASHBY_ID + "/application", "ashby", "acme"],
    ["greenhouse:acme", "greenhouse", "acme"],
    ["Lever:acme", "lever", "acme"],
    ["ashby:acme-2", "ashby", "acme-2"],
  ];
  for (const [input, platform, token] of ok) assert.deepEqual(parseBoardLink(input), { platform, token }, input);
});

test("parseBoardLink refuses everything else with a 400 that lists the accepted forms", () => {
  const bad = [
    "https://www.boards.greenhouse.io/acme",
    "https://www.jobs.lever.co/acme",
    "https://evil.test/https://jobs.lever.co/acme",
    "https://jobs.lever.co.evil.test/acme",
    "https://jobs.lever.co@evil.test/acme",
    "https://user:pw@jobs.lever.co/acme",
    "https://jobs.lever.co:8443/acme",
    "https://jobs.lever.co/",
    "https://jobs.lever.co",
    "https://jobs.lever.co/../acme",
    "https://jobs.lever.co/acme/../other",
    "https://jobs.lever.co/./acme",
    "https://jobs.lever.co/%2e%2e/acme",
    "https://jobs.lever.co/ac%2Fme",
    "https://jobs.lever.co/ac.me",
    "https://jobs.lever.co/ac\\me",
    "https://boards.greenhouse.io/embed/job_board?for=acme",
    "https://jobs.lever.co/" + "a".repeat(101),
    "ftp://jobs.lever.co/acme",
    "javascript:alert(1)",
    "file:///etc/passwd",
    "data:text/html,<script>",
    "//jobs.lever.co/acme",
    "jobs.lever.co/acme",
    "workday:acme",
    "greenhouse:ac/me",
    "greenhouse:ac.me",
    "lever:",
    "ashby:../x",
    "",
    "   ",
    null,
    { toString: () => "greenhouse:acme" },
  ];
  for (const input of bad) {
    assert.throws(() => parseBoardLink(input), (e) => e instanceof HttpError && e.status === 400 && /greenhouse:company/.test(e.message), String(input));
  }
});

// ---------- fetchBoard ----------

const json = (body, init = {}) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" }, ...init });
const stub = (response) => {
  const calls = [];
  const fetch = async (url, options) => {
    calls.push({ url, options });
    if (response instanceof Error) throw response;
    return typeof response === "function" ? response() : response;
  };
  return { fetch, calls };
};
const quiet = (t) => t.mock.method(console, "error", () => {});

const greenhouseBoard = {
  jobs: [
    {
      id: 4012345,
      title: "  Senior   Backend Engineer ",
      location: { name: "Remote - US" },
      absolute_url: "https://evil.example/jobs?gh_jid=4012345",
      content: "&lt;h2&gt;Requirements&lt;/h2&gt;&lt;ul&gt;&lt;li&gt;Python &amp;amp; SQL&lt;/li&gt;&lt;li&gt;AWS&lt;/li&gt;&lt;/ul&gt;&lt;script&gt;alert(1)&lt;/script&gt;",
      updated_at: "2026-11-10T10:00:00-05:00",
      first_published: "2026-11-01T09:00:00-04:00",
      departments: [{ name: "Eng" }],
      offices: [],
    },
    { id: "not-a-number", title: "Bad id", content: "" },
    { id: 7, title: "No content" },
    { id: 7, title: "Duplicate" },
    "junk",
    null,
  ],
  meta: { total: 6 },
};

const leverBoard = [
  {
    id: LEVER_ID,
    text: "Staff Engineer",
    categories: { location: "San Francisco", commitment: "Full-time", team: "Platform", department: "Eng" },
    hostedUrl: "https://evil.example/hosted",
    applyUrl: "https://evil.example/apply",
    workplaceType: "hybrid",
    descriptionPlain: "Build things.\nWith care.",
    lists: [
      { text: "What you will do", content: "<li>Design APIs</li><li>Review code</li>" },
      { text: "Requirements", content: "<li>Go &amp; Rust</li>" },
    ],
    additionalPlain: "We are an equal opportunity employer.",
    createdAt: Date.parse("2026-10-15T00:00:00Z"),
  },
  { id: "short", text: "Bad id", createdAt: 1 },
  { id: "1b1b1b1b-1111-4222-8333-444455556666", text: "Old", createdAt: 5 },
];

const ashbyBoard = {
  jobs: [
    {
      id: ASHBY_ID,
      title: "Data Engineer",
      location: "New York",
      department: "Data",
      team: "Infra",
      employmentType: "FullTime",
      isRemote: false,
      workplaceType: "OnSite",
      publishedAt: "2026-11-05T15:30:00.000+00:00",
      jobUrl: "https://evil.example/job",
      applyUrl: "https://evil.example/apply",
      descriptionHtml: "<p>HTML only</p>",
      descriptionPlain: "Plain description of the role.",
    },
    { id: "2c2c2c2c-1111-4222-8333-444455556666", title: "Hidden", isListed: false, descriptionPlain: "x" },
    { id: "3d3d3d3d-1111-4222-8333-444455556666", title: "Remote one", isRemote: true, employmentType: "Contract", descriptionHtml: "<ul><li>Item</li></ul>", publishedAt: "1970-01-01T00:00:00Z" },
  ],
};

test("greenhouse: mapping, escaped content, canonical urls, request shape", async () => {
  const { fetch, calls } = stub(json(greenhouseBoard));
  const board = await fetchBoard({ platform: "greenhouse", token: "acme" }, { fetch, now: NOW });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://boards-api.greenhouse.io/v1/boards/acme/jobs?content=true");
  assert.equal(calls[0].options.redirect, "error");
  assert.deepEqual(calls[0].options.headers, { accept: "application/json", "user-agent": "ResumeButler/1.0" });
  assert.ok(calls[0].options.signal instanceof AbortSignal);

  assert.equal(board.total, 6);
  assert.deepEqual(board.postings.map((p) => p.postingId), ["4012345", "7"]);
  const [job] = board.postings;
  assert.equal(job.title, "Senior Backend Engineer");
  assert.equal(job.location, "Remote - US");
  assert.equal(job.description, "Requirements\n- Python & SQL\n- AWS");
  assert.equal(job.postedAt, "2026-11-01T13:00:00.000Z");
  assert.equal(job.url, "https://job-boards.greenhouse.io/acme/jobs/4012345");
  assert.deepEqual(normalizePostingIdentity({ url: job.url }), { platform: "greenhouse", namespace: "acme", postingId: "4012345", urlKey: job.url });
  assert.equal(board.postings[1].description, "");
  assert.equal(board.postings[1].postedAt, null);
});

test("lever: description joins plain text, lists and the closing text", async () => {
  const { fetch, calls } = stub(json(leverBoard));
  const board = await fetchBoard({ platform: "lever", token: "acme" }, { fetch, now: NOW });
  assert.equal(calls[0].url, "https://api.lever.co/v0/postings/acme?mode=json");
  assert.equal(board.total, 3);
  assert.deepEqual(board.postings.map((p) => p.postingId), [LEVER_ID, "1b1b1b1b-1111-4222-8333-444455556666"]);
  const [job] = board.postings;
  assert.equal(
    job.description,
    "Build things.\nWith care.\n\nWhat you will do\n- Design APIs\n- Review code\n\nRequirements\n- Go & Rust\n\nWe are an equal opportunity employer."
  );
  assert.deepEqual([job.title, job.location, job.workplaceType, job.employmentType], ["Staff Engineer", "San Francisco", "hybrid", "Full-time"]);
  assert.equal(job.postedAt, "2026-10-15T00:00:00.000Z");
  assert.equal(job.url, `https://jobs.lever.co/acme/${LEVER_ID}`);
  assert.deepEqual(normalizePostingIdentity({ url: job.url }), { platform: "lever", namespace: "acme", postingId: LEVER_ID, urlKey: job.url });
  assert.equal(board.postings[1].postedAt, null); // epoch 5 ms is not a plausible date
});

test("ashby: mapping, unlisted postings skipped, dates checked", async () => {
  const { fetch, calls } = stub(json(ashbyBoard));
  const board = await fetchBoard({ platform: "ashby", token: "acme" }, { fetch, now: NOW });
  assert.equal(calls[0].url, "https://api.ashbyhq.com/posting-api/job-board/acme");
  assert.equal(board.total, 3);
  assert.equal(board.postings.length, 2);
  const [job, remote] = board.postings;
  assert.deepEqual([job.title, job.location, job.workplaceType, job.employmentType, job.description], ["Data Engineer", "New York", "onsite", "Full-time", "Plain description of the role."]);
  assert.equal(job.postedAt, "2026-11-05T15:30:00.000Z");
  assert.equal(job.postingId, ASHBY_ID.toLowerCase());
  assert.equal(job.url, `https://jobs.ashbyhq.com/acme/${ASHBY_ID.toLowerCase()}`);
  assert.deepEqual(normalizePostingIdentity({ url: job.url }), { platform: "ashby", namespace: "acme", postingId: ASHBY_ID.toLowerCase(), urlKey: job.url });
  assert.deepEqual([remote.workplaceType, remote.employmentType, remote.description, remote.postedAt], ["remote", "Contract", "- Item", null]);
});

test("vendor-supplied urls are never used", async () => {
  for (const [platform, body] of [["greenhouse", greenhouseBoard], ["lever", leverBoard], ["ashby", ashbyBoard]]) {
    const { fetch } = stub(json(body));
    const board = await fetchBoard({ platform, token: "acme" }, { fetch, now: NOW });
    for (const posting of board.postings) assert.match(posting.url, /^https:\/\/(job-boards\.greenhouse\.io|jobs\.lever\.co|jobs\.ashbyhq\.com)\/acme\//, posting.url);
  }
});

test("strings are coerced and capped, postings limited to 2,000", async () => {
  const many = Array.from({ length: MAX_POSTINGS + 50 }, (_, i) => ({ id: i + 1, title: `Role ${i}` }));
  const big = { id: 99999, title: "t".repeat(500), location: { name: "l".repeat(500) }, content: "x".repeat(60000) };
  let { fetch } = stub(json({ jobs: [big, ...many] }));
  let board = await fetchBoard({ platform: "greenhouse", token: "acme" }, { fetch, now: NOW });
  assert.equal(board.total, MAX_POSTINGS + 51);
  assert.equal(board.postings.length, MAX_POSTINGS);
  assert.equal(board.postings[0].title.length, 300);
  assert.equal(board.postings[0].location.length, 300);
  assert.equal(board.postings[0].description.length, 20000);

  ({ fetch } = stub(json({ jobs: [{ id: 5, title: { evil: true }, location: 7, content: ["x"] }, { id: 6, title: "Fine\u0000 title", location: null, content: 12 }] })));
  board = await fetchBoard({ platform: "greenhouse", token: "acme" }, { fetch, now: NOW });
  assert.deepEqual(board.postings.map((p) => [p.postingId, p.title, p.location, p.description]), [["6", "Fine title", "", ""]]);
});

test("an unknown board is a 404, everything else a 502 without the vendor's words", async (t) => {
  const error = quiet(t);
  const secret = "VENDOR-SECRET-BODY";
  const cases = [
    [new Response(JSON.stringify({ error: secret }), { status: 404 }), 404, "That job board was not found. Check the link."],
    [new Response(secret, { status: 404 }), 404, "That job board was not found. Check the link."],
    [new Response(secret, { status: 500 }), 502],
    [new Response(secret, { status: 429 }), 502],
    [new Response(secret, { status: 302, headers: { location: "https://evil.test/" } }), 502],
    [new Response(secret, { status: 200 }), 502], // not JSON
    [new Response(JSON.stringify({ unexpected: secret }), { status: 200 }), 502], // wrong shape
    [new Response("[]", { status: 200 }), 502], // an array where Greenhouse sends an object
    [new TypeError("fetch failed: redirect"), 502],
    [Object.assign(new Error(secret), { name: "TimeoutError" }), 502],
  ];
  for (const [response, status, message = "Could not read that job board right now."] of cases) {
    const { fetch } = stub(response);
    await assert.rejects(
      fetchBoard({ platform: "greenhouse", token: "acme" }, { fetch }),
      (e) => e instanceof HttpError && e.status === status && e.message === message && !e.message.includes(secret)
    );
  }
  assert.ok(error.mock.calls.length > 0);
  assert.equal(JSON.stringify(error.mock.calls.map((c) => c.arguments)).includes(secret), false);
});

test("a redirect is an error: the request forbids following one", async (t) => {
  quiet(t);
  const { fetch, calls } = stub(new TypeError("fetch failed"));
  await assert.rejects(fetchBoard({ platform: "lever", token: "acme" }, { fetch }), (e) => e.status === 502);
  assert.equal(calls[0].options.redirect, "error");
});

test("a body over 15 MB fails, declared or streamed", async (t) => {
  quiet(t);
  const declared = new Response("[]", { status: 200, headers: { "content-length": String(MAX_BODY_BYTES + 1) } });
  await assert.rejects(fetchBoard({ platform: "lever", token: "acme" }, { fetch: stub(declared).fetch }), (e) => e.status === 502);

  let pulled = 0;
  const chunk = new Uint8Array(1024 * 1024).fill(32);
  const stream = new ReadableStream({
    pull(controller) {
      pulled++;
      if (pulled > 100) controller.close();
      else controller.enqueue(chunk);
    },
  });
  await assert.rejects(fetchBoard({ platform: "lever", token: "acme" }, { fetch: stub(new Response(stream, { status: 200 })).fetch }), (e) => e.status === 502);
  assert.ok(pulled <= 17, `read ${pulled} MB before stopping`);
});

test("the token is validated before any request", async () => {
  const { fetch, calls } = stub(json({ jobs: [] }));
  for (const token of ["a/b", "a.b", "../x", "", "a?b"]) {
    await assert.rejects(fetchBoard({ platform: "ashby", token }, { fetch }), (e) => e.status === 400);
  }
  await assert.rejects(fetchBoard({ platform: "workday", token: "acme" }, { fetch }), (e) => e.status === 400);
  assert.equal(calls.length, 0);
});

// ---------- stored strings are clean ----------

const EMOJI = "\u{1F600}";
const clean = (value) => {
  const text = JSON.stringify(value);
  assert.equal(text.includes("\u0000"), false);
  assert.equal(text.includes("\\u0000"), false);
  assert.deepEqual(JSON.parse(text), value);
  for (const field of Object.values(value)) if (typeof field === "string") assert.equal(field.isWellFormed(), true);
};

test("NUL characters in vendor text never reach a mapped posting (all three boards)", async () => {
  const greenhouse = { jobs: [{ id: 1, title: "Eng\u0000ineer", location: { name: "Re\u0000mote" }, content: "&lt;p&gt;Hello\u0000 World&lt;/p&gt;&lt;p&gt;Next&lt;/p&gt;" }] };
  const lever = [{ id: LEVER_ID, text: "Staff\u0000", descriptionPlain: "Plain\u0000 text", lists: [{ text: "Do\u0000", content: "<li>Ship\u0000 it</li>" }], additionalPlain: "End\u0000" }];
  const ashby = { jobs: [{ id: ASHBY_ID, title: "Data\u0000", location: "NY\u0000", descriptionHtml: "<p>Rows\u0000 and</p><ul><li>colu\u0000mns</li></ul>" }] };
  for (const [platform, body, description] of [
    ["greenhouse", greenhouse, "Hello World\n\nNext"],
    ["lever", lever, "Plain text\n\nDo\n- Ship it\n\nEnd"],
    ["ashby", ashby, "Rows and\n\n- columns"],
  ]) {
    const { fetch } = stub(json(body));
    const { postings } = await fetchBoard({ platform, token: "acme" }, { fetch, now: NOW });
    assert.equal(postings.length, 1, platform);
    clean(postings[0]);
    assert.equal(postings[0].description, description, platform);
    assert.equal(postings[0].title.includes("\u0000"), false, platform);
  }
});

test("lone surrogates are replaced and a cut never splits an emoji", async () => {
  // The emoji starts at the last character the title may keep (index 299), and at the last of the description's 20,000
  const title = "t".repeat(299) + EMOJI + "tail";
  const plain = "d".repeat(19_999) + EMOJI + "tail";
  const ashby = { jobs: [{ id: ASHBY_ID, title, location: "l".repeat(299) + EMOJI, descriptionPlain: plain }, { id: "4e4e4e4e-1111-4222-8333-444455556666", title: "Lone \ud800 half", descriptionPlain: "x\udc00y" }] };
  const { postings } = await fetchBoard({ platform: "ashby", token: "acme" }, { fetch: stub(json(ashby)).fetch, now: NOW });
  const [capped, lone] = postings;
  for (const posting of postings) clean(posting);
  assert.equal(capped.title, "t".repeat(299));
  assert.equal(capped.location, "l".repeat(299));
  assert.equal(capped.description, "d".repeat(19_999));
  assert.equal(lone.title.includes("\ud800"), false);
  assert.equal(lone.description.isWellFormed(), true);

  // The same in the HTML paths: description cap in greenhouse (escaped HTML) and lever (lists)
  const body = "p".repeat(19_999) + EMOJI + "tail";
  const greenhouse = { jobs: [{ id: 5, title: EMOJI.repeat(200), content: `&lt;p&gt;${body}&lt;/p&gt;` }] };
  const [gh] = (await fetchBoard({ platform: "greenhouse", token: "acme" }, { fetch: stub(json(greenhouse)).fetch, now: NOW })).postings;
  clean(gh);
  assert.equal(gh.title.length, 300); // 150 whole emoji
  assert.equal(gh.description, "p".repeat(19_999));
  const lever = [{ id: LEVER_ID, text: "x", lists: [{ text: "h", content: `<li>${body}</li>` }] }];
  const [lv] = (await fetchBoard({ platform: "lever", token: "acme" }, { fetch: stub(json(lever)).fetch, now: NOW })).postings;
  clean(lv);
  assert.equal(lv.description.isWellFormed(), true);
  assert.ok(lv.description.length <= 20_000);
});
