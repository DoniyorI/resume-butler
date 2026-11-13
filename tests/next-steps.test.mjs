import assert from "node:assert/strict";
import { test } from "node:test";
import { database } from "./helpers/database.mjs";

const service = await import("@/server/activities/service");
const { suggestNextSteps, SUGGESTION_LIMIT } = await import("@/server/activities/suggest");
const { FOLLOW_UP_AFTER_DAYS, groupHistoryByApplication } = await import("@/features/dashboard/data");
const { addDays, activityTimeFields, stepTimeFields } = await import("@/features/activities/kinds");

const user = "11111111-1111-4111-8111-111111111111";
const other = "99999999-9999-4999-8999-999999999999";
const appId = "22222222-2222-4222-8222-222222222222";
const otherApp = "33333333-3333-4333-8333-333333333333";
const missing = "44444444-4444-4444-8444-444444444444";
const today = "2026-11-12";
const setupMessage = "Install migration 020 to use next steps.";

const app = (id, status, patch = {}) => ({ id, company: `Co ${id.slice(0, 4)}`, role: "Engineer", status, applied_date: today, ...patch });
const uuid = (n) => `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;
const activity = (patch = {}) => ({ id: uuid(900), applicationId: appId, kind: "task", status: "open", dueOn: null, completedAt: null, ...patch });

function seeded(extra = {}) {
  return database({
    applications: [
      { id: appId, user_id: user, company: "Acme", role: "Engineer", status: "Applied" },
      { id: otherApp, user_id: other, company: "Theirs", role: "Dev", status: "Applied" },
    ],
    application_activities: [],
    ...extra,
  });
}
const input = (patch = {}) => ({ applicationId: appId, kind: "assessment", title: "Take-home", dueOn: "2026-11-13", ...patch });
const rejectsWith = (promise, status, message) =>
  assert.rejects(promise, (e) => e.status === status && (!message || e.message === message));

// ---------- suggestNextSteps ----------

test("rule 1: an offer without an open offer deadline asks for the deadline", () => {
  const offered = app(appId, "Offered", { company: "Acme" });
  const [first] = suggestNextSteps({ applications: [offered], today });
  assert.equal(first.kind, "offer_deadline");
  assert.equal(first.reason, "Record the decision deadline for your offer from Acme.");
  assert.equal(first.applicationId, appId);
  assert.match(first.href, new RegExp(`^/applications/${appId}`));
  const open = [activity({ kind: "offer_deadline" })];
  assert.deepEqual(suggestNextSteps({ applications: [offered], activities: open, today }), []);
  // A different open kind, or a done deadline, does not count
  assert.equal(suggestNextSteps({ applications: [offered], activities: [activity({ kind: "task" })], today }).length, 1);
  assert.equal(
    suggestNextSteps({ applications: [offered], activities: [activity({ kind: "offer_deadline", status: "done", completedAt: `${today}T10:00:00Z` })], today }).length,
    1
  );
});

test("rule 2: interviewed with nothing recent or planned asks for the next round", () => {
  const interviewed = app(appId, "Interviewed", { company: "Acme" });
  const [first] = suggestNextSteps({ applications: [interviewed], today });
  assert.equal(first.reason, "Add your next round or a thank-you follow-up for Acme.");
  // Suppressed by any open step, or one done in the last 14 days
  assert.deepEqual(suggestNextSteps({ applications: [interviewed], activities: [activity({ kind: "interview", dueOn: addDays(today, 3) })], today }), []);
  assert.deepEqual(
    suggestNextSteps({ applications: [interviewed], activities: [activity({ status: "done", dueOn: addDays(today, -5), completedAt: `${addDays(today, -5)}T12:00:00Z` })], today }),
    []
  );
  // A step done a month ago, or a cancelled one, does not
  const old = activity({ status: "done", dueOn: addDays(today, -30), completedAt: `${addDays(today, -30)}T12:00:00Z` });
  assert.equal(suggestNextSteps({ applications: [interviewed], activities: [old], today }).length, 1);
  assert.equal(suggestNextSteps({ applications: [interviewed], activities: [activity({ status: "cancelled", dueOn: today })], today }).length, 1);
});

test("rule 3: a recruiter reaching out asks for a reply until a step is open", () => {
  const reached = app(appId, "Reached Out", { company: "Acme" });
  assert.equal(suggestNextSteps({ applications: [reached], today })[0].reason, "Reply to the recruiter at Acme.");
  assert.deepEqual(suggestNextSteps({ applications: [reached], activities: [activity({ kind: "recruiter_screen" })], today }), []);
});

test("rule 4: no reply after the follow-up window, reusing the dashboard rule", () => {
  const waiting = app(appId, "Applied", { company: "Acme", applied_date: addDays(today, -20) });
  const fresh = app(otherApp, "Applied", { applied_date: addDays(today, -(FOLLOW_UP_AFTER_DAYS - 1)) });
  const result = suggestNextSteps({ applications: [waiting, fresh], today });
  assert.equal(result.length, 1);
  assert.equal(result[0].reason, `No reply from Acme since you applied on Oct 23, 2026. Send a follow-up or set a date to check again.`);
  // A status change in the history means it heard back
  const moved = groupHistoryByApplication([{ application_id: appId, status: "Applied" }, { application_id: appId, status: "Rejected" }]);
  assert.deepEqual(suggestNextSteps({ applications: [waiting], historyByApp: moved, today }), []);
  // An open follow-up suppresses it; an open task does not
  assert.deepEqual(suggestNextSteps({ applications: [waiting], activities: [activity({ kind: "follow_up", dueOn: addDays(today, 2) })], today }), []);
  assert.equal(suggestNextSteps({ applications: [waiting], activities: [activity({ kind: "task" })], today }).length, 1);
});

test("rule 5: pending inbox suggestions link to the review queue", () => {
  assert.deepEqual(suggestNextSteps({ pendingEmailCount: 0, today }), []);
  const [many] = suggestNextSteps({ pendingEmailCount: 3, today });
  assert.equal(many.reason, "Review 3 inbox updates.");
  assert.equal(many.href, "/email-sync");
  assert.equal(suggestNextSteps({ pendingEmailCount: 1, today })[0].reason, "Review 1 inbox update.");
});

test("rule 6: saved jobs older than a week and not applied to ask for a decision", () => {
  const savedJobs = [
    { id: uuid(1), company: "Old", role: "", createdAt: `${addDays(today, -10)}T09:00:00Z`, applicationId: null },
    { id: uuid(2), company: "Older", role: "SRE", createdAt: `${addDays(today, -30)}T09:00:00Z`, applicationId: null },
    { id: uuid(3), company: "New", role: "", createdAt: `${addDays(today, -3)}T09:00:00Z`, applicationId: null },
    { id: uuid(4), company: "Applied", role: "", createdAt: `${addDays(today, -30)}T09:00:00Z`, applicationId: appId },
  ];
  const result = suggestNextSteps({ savedJobs, today });
  assert.deepEqual(result.map((s) => s.reason), ["Decide on Older (SRE): apply or remove it.", "Decide on Old: apply or remove it."]);
  assert.ok(result.every((s) => s.href === "/saved-jobs"));
});

test("suggestions run most urgent first and stop at the cap", () => {
  const applications = [
    app(uuid(10), "Applied", { applied_date: addDays(today, -30) }),
    app(uuid(11), "Reached Out"),
    app(uuid(12), "Interviewed"),
    app(uuid(13), "Offered"),
    app(uuid(14), "Rejected"),
  ];
  const savedJobs = [{ id: uuid(20), company: "Saved", role: "", createdAt: `${addDays(today, -9)}T00:00:00Z`, applicationId: null }];
  const kinds = suggestNextSteps({ applications, savedJobs, pendingEmailCount: 2, today }).map((s) => s.kind);
  assert.deepEqual(kinds, ["offer_deadline", "interview", "recruiter_screen", "follow_up", "inbox", "saved_job"]);

  const many = Array.from({ length: 12 }, (_, i) => app(uuid(100 + i), "Applied", { applied_date: addDays(today, -(15 + i)) }));
  const capped = suggestNextSteps({ applications: [...many, app(uuid(50), "Offered")], pendingEmailCount: 1, today });
  assert.equal(capped.length, SUGGESTION_LIMIT);
  assert.equal(capped[0].kind, "offer_deadline");
  // Longest wait first within the rule
  assert.equal(capped[1].applicationId, uuid(111));
  assert.ok(!capped.some((s) => s.kind === "inbox"));
});

test("suggestions work with no activities at all (before migration 020)", () => {
  const result = suggestNextSteps({ applications: [app(appId, "Offered")], activities: [], today });
  assert.equal(result.length, 1);
  assert.deepEqual(suggestNextSteps({ today }), []);
});

// ---------- server functions ----------

test("createActivity stores an owned, validated step and refuses another user's application", async () => {
  const db = seeded();
  const created = await service.createActivity(db, user, input({ link: "example.test/take-home", notes: "Use Python" }));
  assert.equal(created.applicationId, appId);
  assert.equal(created.status, "open");
  assert.equal(created.completedAt, null);
  assert.equal(created.link, "https://example.test/take-home");
  assert.equal(db.tables.application_activities[0].user_id, user);

  await rejectsWith(service.createActivity(db, user, input({ applicationId: otherApp })), 404);
  await rejectsWith(service.createActivity(db, user, input({ applicationId: missing })), 404);
  await rejectsWith(service.createActivity(db, other, input()), 404);
  assert.equal(db.tables.application_activities.length, 1);
});

test("a timed step keeps its zone; an untimed one drops it", async () => {
  const db = seeded();
  const timed = await service.createActivity(db, user, input({ kind: "interview", title: "Onsite", startsAt: "2026-11-13T15:00:00.000Z", timeZone: "America/New_York" }));
  assert.equal(timed.startsAt, "2026-11-13T15:00:00.000Z");
  assert.equal(timed.timeZone, "America/New_York");
  const untimed = await service.createActivity(db, user, input({ timeZone: "America/New_York" }));
  assert.equal(untimed.timeZone, null);
});

test("input validation: title, link scheme, kind, a time without a date, time zone", async () => {
  const db = seeded();
  await rejectsWith(service.createActivity(db, user, input({ title: "   " })), 400, "Add a title");
  await rejectsWith(service.createActivity(db, user, input({ title: "x".repeat(201) })), 400, "Keep the title under 200 characters");
  await rejectsWith(service.createActivity(db, user, input({ link: "javascript:alert(1)" })), 400, "Use an http or https link");
  await rejectsWith(service.createActivity(db, user, input({ link: "ftp://example.test/file" })), 400, "Use an http or https link");
  await rejectsWith(service.createActivity(db, user, input({ kind: "coffee" })), 400, "Choose what kind of step this is");
  await rejectsWith(
    service.createActivity(db, user, input({ dueOn: null, startsAt: "2026-11-13T15:00:00Z" })),
    400,
    "Pick a date before adding a time"
  );
  await rejectsWith(service.createActivity(db, user, input({ dueOn: "13/11/2026" })), 400, "That date doesn't exist. Pick a real calendar date.");
  await rejectsWith(service.createActivity(db, user, input({ contactChannel: "pigeon" })), 400, "Unknown contact channel");
  await rejectsWith(
    service.createActivity(db, user, input({ startsAt: "2026-11-13T15:00:00Z", timeZone: "Mars/Olympus" })),
    400,
    "Unknown time zone"
  );
  await rejectsWith(service.createActivity(db, user, input({ notes: "n".repeat(4001) })), 400);
  await rejectsWith(service.createActivity(db, user, input({ applicationId: "not-a-uuid" })), 400);
  assert.equal(db.tables.application_activities.length, 0);
});

test("the database's per-user cap (54000) maps to the 429 message", async () => {
  const db = seeded();
  db.fail("application_activities", "insert", { code: "54000", message: "limit of 2000 next steps" });
  await rejectsWith(
    service.createActivity(db, user, input()),
    429,
    "You have 2,000 next steps. Delete finished ones before adding more."
  );
  assert.equal(db.tables.application_activities.length, 0);
  // The app no longer counts rows itself: with the trigger quiet, the insert goes through
  await service.createActivity(db, user, input());
  assert.equal(db.tables.application_activities.length, 1);
});

test("an impossible calendar date is refused; a real leap day is kept", async () => {
  const db = seeded();
  await rejectsWith(service.createActivity(db, user, input({ dueOn: "2026-02-30" })), 400, "That date doesn't exist. Pick a real calendar date.");
  await rejectsWith(service.createActivity(db, user, input({ dueOn: "2026-02-29" })), 400, "That date doesn't exist. Pick a real calendar date.");
  const leap = await service.createActivity(db, user, input({ dueOn: "2028-02-29" }));
  assert.equal(leap.dueOn, "2028-02-29");
  assert.equal(db.tables.application_activities.length, 1);
});

test("an unknown time zone is refused; a time must fall on the due date in that zone", async () => {
  const db = seeded();
  await rejectsWith(service.createActivity(db, user, input({ time: "10:00", timeZone: "Mars/Olympus" })), 400, "Unknown time zone");
  await rejectsWith(service.createActivity(db, user, input({ time: "10:00" })), 400, "A time needs its time zone");
  // 03:00Z on Nov 13 is 22:00 on Nov 12 in New York, so it is not on due_on 2026-11-13 there
  await rejectsWith(
    service.createActivity(db, user, input({ startsAt: "2026-11-13T03:00:00Z", timeZone: "America/New_York" })),
    400,
    "That time falls on a different day than the date in America/New_York."
  );
  const ok = await service.createActivity(db, user, input({ startsAt: "2026-11-13T03:00:00Z", timeZone: "Asia/Tokyo" }));
  assert.equal(ok.startsAt, "2026-11-13T03:00:00.000Z");
  assert.equal(db.tables.application_activities.length, 1);
});

test("a time that skips the spring-forward gap is rejected, not shifted", async () => {
  const db = seeded();
  await rejectsWith(
    service.createActivity(db, user, input({ dueOn: "2026-03-08", time: "02:30", timeZone: "America/New_York" })),
    400,
    "02:30 doesn't exist on that date in America/New_York (the clocks change). Pick another time."
  );
  assert.equal(db.tables.application_activities.length, 0);
  const after = await service.createActivity(db, user, input({ dueOn: "2026-03-08", time: "03:30", timeZone: "America/New_York" }));
  assert.equal(after.startsAt, "2026-03-08T07:30:00.000Z");
});

test("editing only the title from another zone keeps the instant and the entered zone", async () => {
  const db = seeded();
  const created = await service.createActivity(db, user, input({ kind: "interview", title: "Onsite", time: "10:00", timeZone: "America/New_York" }));
  assert.equal(created.startsAt, "2026-11-13T15:00:00.000Z");
  assert.equal(created.timeZone, "America/New_York");

  // What the edit form does for a viewer in Tokyo: show the step in its own zone and send that back
  const form = activityTimeFields(created, "Asia/Tokyo");
  assert.deepEqual(form, { dueOn: "2026-11-13", time: "10:00", timeZone: "America/New_York" });
  const sent = stepTimeFields({ dueOn: form.dueOn, time: form.time }, created, "Asia/Tokyo");
  assert.equal(sent.timeZone, "America/New_York");
  const edited = await service.updateActivity(db, user, created.id, { ...input({ kind: "interview", title: "Final onsite" }), ...sent });
  assert.equal(edited.title, "Final onsite");
  assert.equal(edited.startsAt, created.startsAt);
  assert.equal(edited.timeZone, "America/New_York");
});

test("marking a done step done again keeps completed_at; reopening clears it", async () => {
  const db = seeded();
  const { id } = await service.createActivity(db, user, input());
  const first = await service.setActivityStatus(db, user, id, "done");
  assert.ok(Date.parse(first.completedAt));
  await new Promise((resolve) => setTimeout(resolve, 15));
  const again = await service.setActivityStatus(db, user, id, "done");
  assert.equal(again.status, "done");
  assert.equal(again.completedAt, first.completedAt);
  assert.equal(db.tables.application_activities[0].completed_at, first.completedAt);
  const reopened = await service.setActivityStatus(db, user, id, "open");
  assert.equal(reopened.completedAt, null);
  assert.equal(db.tables.application_activities[0].completed_at, null);
});

test("listUpcoming returns 20 overdue steps and counts the older ones, still showing today and upcoming", async () => {
  const now = service.todayKey();
  const rows = Array.from({ length: 30 }, (_, i) => ({
    id: `od-${String(i).padStart(2, "0")}`, user_id: user, application_id: appId, kind: "task", title: `Late ${i}`, status: "open", due_on: addDays(now, -(i + 1)),
  }));
  rows.push(
    { id: "today", user_id: user, application_id: appId, kind: "task", title: "Today", status: "open", due_on: now },
    { id: "next", user_id: user, application_id: appId, kind: "task", title: "Next", status: "open", due_on: addDays(now, 3) }
  );
  const db = seeded({ application_activities: rows });
  const result = await service.listUpcoming(db, user, { withinDays: 7 });
  assert.equal(result.setupPending, false);
  assert.equal(result.olderOverdue, 10);
  const overdue = result.items.filter((a) => a.dueOn < now);
  assert.equal(overdue.length, 20);
  // The 20 most recently due, oldest of them first
  assert.equal(overdue[0].id, "od-19");
  assert.equal(overdue[19].id, "od-00");
  assert.deepEqual(result.items.slice(20).map((a) => a.id), ["today", "next"]);
});

test("status transitions set and clear completed_at", async () => {
  const db = seeded();
  const { id } = await service.createActivity(db, user, input());
  const done = await service.setActivityStatus(db, user, id, "done");
  assert.equal(done.status, "done");
  assert.ok(Date.parse(done.completedAt));
  const reopened = await service.setActivityStatus(db, user, id, "open");
  assert.equal(reopened.status, "open");
  assert.equal(reopened.completedAt, null);
  const cancelled = await service.setActivityStatus(db, user, id, "cancelled");
  assert.equal(cancelled.completedAt, null);
  await rejectsWith(service.setActivityStatus(db, user, id, "archived"), 400, "Unknown step status");
});

test("update, status and delete only touch the user's own steps", async () => {
  const db = seeded();
  const { id } = await service.createActivity(db, user, input());
  await rejectsWith(service.updateActivity(db, other, id, input({ title: "Hijack" })), 404);
  await rejectsWith(service.setActivityStatus(db, other, id, "done"), 404);
  await rejectsWith(service.deleteActivity(db, other, id), 404);
  assert.equal(db.tables.application_activities[0].title, "Take-home");
  assert.equal(db.tables.application_activities[0].status, "open");

  const moved = await service.updateActivity(db, user, id, input({ title: "Take-home v2", dueOn: "2026-11-20" }));
  assert.equal(moved.title, "Take-home v2");
  assert.equal(moved.dueOn, "2026-11-20");
  assert.equal(moved.applicationId, appId);
  await rejectsWith(service.updateActivity(db, user, id, input({ dueOn: "", startsAt: "2026-11-20T15:00:00Z" })), 400);

  assert.deepEqual(await service.deleteActivity(db, user, id), { id, applicationId: appId });
  assert.equal(db.tables.application_activities.length, 0);
  await rejectsWith(service.deleteActivity(db, user, id), 404);
  await rejectsWith(service.deleteActivity(db, user, "nope"), 400);
});

test("listActivities and listUpcoming read only the user's rows", async () => {
  const soon = addDays(service.todayKey(), 1);
  const late = addDays(service.todayKey(), 30);
  const overdue = addDays(service.todayKey(), -40);
  const db = seeded({
    application_activities: [
      { id: "a1", user_id: user, application_id: appId, kind: "assessment", title: "Soon", status: "open", due_on: soon },
      { id: "a2", user_id: user, application_id: appId, kind: "task", title: "Late", status: "open", due_on: late },
      { id: "a3", user_id: user, application_id: appId, kind: "task", title: "Overdue", status: "open", due_on: overdue },
      { id: "a4", user_id: user, application_id: appId, kind: "task", title: "Done", status: "done", due_on: soon, completed_at: "2026-11-01T00:00:00Z" },
      { id: "a5", user_id: user, application_id: appId, kind: "task", title: "Undated", status: "open", due_on: null },
      { id: "b1", user_id: other, application_id: otherApp, kind: "task", title: "Theirs", status: "open", due_on: soon },
    ],
  });
  const own = await service.listActivities(db, user, { applicationId: appId });
  assert.equal(own.setupPending, false);
  assert.deepEqual(own.items.map((a) => a.id).sort(), ["a1", "a2", "a3", "a4", "a5"]);
  assert.deepEqual((await service.listActivities(db, user, { applicationId: otherApp })).items, []);

  const upcoming = await service.listUpcoming(db, user, { withinDays: 7 });
  assert.deepEqual(upcoming.items.map((a) => a.id), ["a3", "a1"]);
  assert.equal(upcoming.items[1].company, "Acme");
  assert.equal(upcoming.items[1].role, "Engineer");

  const forSuggestions = await service.listForSuggestions(db, user);
  assert.ok(forSuggestions.items.every((a) => a.applicationId === appId));
  assert.equal(forSuggestions.items.length, 5);
});

test("before migration 020: reads are setupPending, writes say how to fix it", async () => {
  for (const code of ["42P01", "PGRST205", "PGRST200", "PGRST204"]) {
    const db = seeded();
    // listActivities runs 1 select, listUpcoming 3 and listForSuggestions 3
    db.fail("application_activities", "select", { code, message: "missing" }, 7);
    assert.deepEqual(await service.listActivities(db, user, { applicationId: appId }), { items: [], setupPending: true });
    assert.deepEqual(await service.listUpcoming(db, user), { items: [], olderOverdue: 0, setupPending: true });
    assert.deepEqual(await service.listForSuggestions(db, user), { items: [], setupPending: true });
  }
  const db = seeded();
  // createActivity no longer counts rows first: the insert itself reports the missing table
  db.fail("application_activities", "insert", { code: "PGRST205", message: "missing" });
  await rejectsWith(service.createActivity(db, user, input()), 503, setupMessage);
  db.fail("application_activities", "update", { code: "42P01", message: "missing" }, 2);
  await rejectsWith(service.setActivityStatus(db, user, uuid(1), "done"), 503, setupMessage);
  await rejectsWith(service.updateActivity(db, user, uuid(1), input()), 503, setupMessage);
  db.fail("application_activities", "delete", { code: "PGRST205", message: "missing" });
  await rejectsWith(service.deleteActivity(db, user, uuid(1)), 503, setupMessage);
  // Other database errors are not mistaken for a missing migration
  db.fail("application_activities", "select", { code: "57014", message: "timeout" });
  await assert.rejects(service.listActivities(db, user, { applicationId: appId }), (e) => e.code === "57014");
});
