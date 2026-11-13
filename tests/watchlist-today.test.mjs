import assert from "node:assert/strict";
import { test } from "node:test";
import { database } from "./helpers/database.mjs";

const { suggestNextSteps } = await import("@/server/activities/suggest");
const { watchedWithBands } = await import("@/server/watchlist/fit");

const today = "2026-11-13";
const user = "11111111-1111-4111-8111-111111111111";
const other = "99999999-9999-4999-8999-999999999999";
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const watchedAt = (id, band, day = "2026-11-12") => ({ id, firstSeenAt: `${day}T08:00:00.000Z`, band });
const rule = (watched, extra = {}) => suggestNextSteps({ today, watched, ...extra }).filter((s) => s.kind === "watchlist_fit");

test("new strong or good postings at watched companies make one suggestion", () => {
  assert.deepEqual(rule([watchedAt("a", "strong"), watchedAt("b", "strong"), watchedAt("c", "good")]), [
    {
      id: "watchlist-fit",
      kind: "watchlist_fit",
      title: "Review new postings at companies you watch",
      reason: "2 new postings at companies you watch look like a strong fit.",
      href: "/watchlist",
    },
  ]);
  assert.equal(rule([watchedAt("a", "strong")])[0].reason, "1 new posting at a company you watch looks like a strong fit.");
  assert.equal(rule([watchedAt("a", "good"), watchedAt("b", "good"), watchedAt("c", "low")])[0].reason, "2 new postings at companies you watch look like a good fit.");
  assert.equal(rule([watchedAt("a", "good")])[0].reason, "1 new posting at a company you watch looks like a good fit.");
});

test("older, weak, unknown or missing postings make nothing", () => {
  assert.deepEqual(rule([]), []);
  assert.deepEqual(rule(undefined), []);
  assert.deepEqual(rule([watchedAt("a", "stretch"), watchedAt("b", "low"), watchedAt("c", null), watchedAt("d", "unknown")]), []);
  assert.deepEqual(rule([watchedAt("a", "strong", "2026-11-05")]), []); // first seen 8 days ago
  assert.equal(rule([watchedAt("a", "strong", "2026-11-06")]).length, 1); // exactly 7 days ago still counts
  assert.deepEqual(rule([{ id: "a", firstSeenAt: null, band: "strong" }]), []);
});

test("the rule comes after saved-job fits and before decide-on-a-saved-job", () => {
  const savedJobs = [
    { id: "fit", company: "Acme", role: "Dev", createdAt: "2026-11-12T00:00:00Z", applicationId: null, band: "strong" },
    { id: "old", company: "Old", role: "Dev", createdAt: "2026-10-01T00:00:00Z", applicationId: null },
  ];
  const kinds = suggestNextSteps({ today, savedJobs, watched: [watchedAt("a", "good")], pendingEmailCount: 2 }).map((s) => s.kind);
  assert.deepEqual(kinds, ["inbox", "saved_job_fit", "watchlist_fit", "saved_job"]);
  // Without the watched input nothing changes
  assert.equal(suggestNextSteps({ today, savedJobs }).some((s) => s.kind === "watchlist_fit"), false);
});

const cv = {
  education: [], projects: [], certifications: [], customSections: [],
  experience: [{
    id: "e1", company: "Harbor Analytics", position: "Software Engineer", startDate: "2019-01-01", endDate: "", currentlyWorking: true,
    bullets: ["Python", "SQL", "Docker", "AWS"].map((skill) => `Built reporting tools with ${skill} for the finance team`),
  }],
  skills: [],
};
const strongText = "Requirements:\n- Python\n- SQL\n- Docker\n- AWS";
const weakText = "Requirements:\n- Rust\n- Kubernetes\n- Kafka\n- Terraform\n- GraphQL";

test("watchedWithBands scores the newest open postings and fails soft", async (t) => {
  const c = uuid(1);
  // Lever posting ids are UUIDs: the link is rebuilt from them, and a posting without a valid one is left out
  const row = (n, patch) => ({
    id: uuid(10 + n), user_id: user, company_id: c, posting_id: uuid(700 + n), title: `Role ${n}`, location: "", url: `https://jobs.lever.co/acme/${n}`,
    description: "", workplace_type: "", employment_type: "", posted_at: null,
    first_seen_at: `2026-11-1${n}T08:00:00.000Z`, last_seen_at: "2026-11-13T00:00:00Z", closed_at: null, dismissed_at: null, saved_at: null, ...patch,
  });
  const db = database({
    watched_companies: [{ id: c, user_id: user, name: "Acme", platform: "lever", board_token: "acme", created_at: "2026-11-01T00:00:00.000Z" }],
    watched_postings: [
      row(1, { description: strongText }),
      row(2, { description: weakText }),
      row(3, { description: "short" }),
      row(4, { description: strongText, closed_at: "2026-11-13T00:00:00Z" }),
      row(5, { description: strongText, user_id: other }),
    ],
  });
  const result = await watchedWithBands(db, user, { cv, today });
  assert.deepEqual(result.map((r) => r.id), [uuid(13), uuid(12), uuid(11)]); // newest first; closed and other users' excluded
  assert.deepEqual(result.map((r) => Object.keys(r).sort()), result.map(() => ["band", "firstSeenAt", "id"]));
  assert.equal(result.find((r) => r.id === uuid(11)).band, "strong");
  assert.equal(result.find((r) => r.id === uuid(13)).band, null);
  assert.ok(["low", "stretch"].includes(result.find((r) => r.id === uuid(12)).band));
  assert.equal(result[0].firstSeenAt, "2026-11-13T08:00:00.000Z");

  // A posting first seen within an hour of the company being added is its backlog, not news
  const fresh = database({
    watched_companies: [{ id: c, user_id: user, name: "Acme", platform: "lever", board_token: "acme", created_at: "2026-11-13T07:30:00.000Z" }],
    watched_postings: [
      row(1, { description: strongText, first_seen_at: "2026-11-13T07:30:30.000Z" }), // backlog
      row(2, { description: strongText, first_seen_at: "2026-11-13T08:30:00.000Z" }), // exactly an hour: still backlog
      row(3, { description: strongText, first_seen_at: "2026-11-13T08:30:01.000Z" }), // news
    ],
  });
  assert.deepEqual((await watchedWithBands(fresh, user, { cv, today })).map((r) => r.id), [uuid(13)]);

  // Feeds the rule: 1 strong posting first seen within the week
  const today13 = result.map((r) => ({ ...r, firstSeenAt: "2026-11-12T08:00:00Z" }));
  assert.equal(suggestNextSteps({ today, watched: today13 }).find((s) => s.kind === "watchlist_fit").reason, "1 new posting at a company you watch looks like a strong fit.");

  // At most the 60 newest are scored
  const many = database({
    watched_companies: [{ ...db.tables.watched_companies[0], created_at: "2026-10-01T00:00:00.000Z" }],
    watched_postings: Array.from({ length: 80 }, (_, i) => row(1, { id: uuid(100 + i), posting_id: uuid(900 + i), description: strongText, first_seen_at: new Date(Date.UTC(2026, 10, 1, 0, i)).toISOString() })),
  });
  assert.equal((await watchedWithBands(many, user, { cv })).length, 60);

  // Failing soft
  t.mock.method(console, "error", () => {});
  const broken = database({});
  broken.fail("watched_postings", "select", { code: "XX000", message: "boom" });
  assert.deepEqual(await watchedWithBands(broken, user, { cv, today }), []);
  const pending = database({});
  pending.fail("watched_postings", "select", { code: "42P01", message: "missing" });
  assert.deepEqual(await watchedWithBands(pending, user, { cv, today }), []);
  assert.deepEqual(await watchedWithBands(database({ watched_postings: [] }), user, { cv }), []);
});
