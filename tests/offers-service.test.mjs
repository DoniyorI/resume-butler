import assert from "node:assert/strict";
import { test } from "node:test";
import { database } from "./helpers/database.mjs";

const service = await import("@/server/offers/service");

const user = "11111111-1111-4111-8111-111111111111";
const other = "99999999-9999-4999-8999-999999999999";
const appId = "22222222-2222-4222-8222-222222222222";
const otherApp = "33333333-3333-4333-8333-333333333333";
const setupMessage = "Offers need database migration 022.";

const terms = (patch = {}) => ({
  baseAmount: 150000,
  basePeriod: "year",
  currency: "USD",
  bonus: "10%",
  equity: "",
  benefits: "",
  startDate: null,
  receivedOn: "2026-11-10",
  decideBy: null,
  notes: "",
  ...patch,
});
const deadline = (patch = {}) => ({
  id: "55555555-5555-4555-8555-555555555555",
  user_id: user,
  application_id: appId,
  kind: "offer_deadline",
  title: "Decide on the offer",
  due_on: "2026-11-20",
  starts_at: null,
  time_zone: null,
  status: "open",
  completed_at: null,
  notes: "keep me",
  contact_name: "",
  contact_channel: "",
  link: "",
  ...patch,
});
const seeded = (extra = {}) =>
  database({
    applications: [
      { id: appId, user_id: user, company: "Acme", role: "Engineer", status: "Offered" },
      { id: otherApp, user_id: other, company: "Theirs", role: "Dev", status: "Offered" },
    ],
    application_offers: [],
    application_activities: [],
    ...extra,
  });
const rejectsWith = (promise, status, message) =>
  assert.rejects(promise, (e) => e.status === status && (!message || e.message === message));
const missing = { code: "42P01", message: "missing" };

test("a missing table reads as setupPending and never throws", async () => {
  const db = seeded();
  db.fail("application_offers", "select", missing, 3);
  assert.deepEqual(await service.getOffer(db, user, appId), {
    offer: null,
    decideBy: null,
    deadlineAvailable: false,
    setupPending: true,
  });
  assert.equal((await service.listOfferDecisions(db, user, [appId])).size, 0);
  assert.deepEqual(await service.listOffersForSuggestions(db, user), []);
  // Writes say what to install
  db.fail("application_offers", "upsert", missing);
  await rejectsWith(service.saveOffer(db, user, appId, terms()), 503, setupMessage);
  db.fail("application_offers", "upsert", { code: "PGRST205", message: "missing" });
  await rejectsWith(service.decideOffer(db, user, appId, { decision: "pending" }), 503, setupMessage);
  // No ids: nothing to ask
  assert.equal((await service.listOfferDecisions(seeded(), user, [])).size, 0);
});

test("getOffer reads the offer and the earliest open decide-by step; no offer is null", async () => {
  const db = seeded({
    application_activities: [
      deadline(),
      deadline({ id: "66666666-6666-4666-8666-666666666666", due_on: "2026-11-15" }),
      deadline({ id: "77777777-7777-4777-8777-777777777777", due_on: "2026-11-01", status: "done", completed_at: "2026-11-02T00:00:00Z" }),
    ],
  });
  const empty = await service.getOffer(db, user, appId);
  assert.equal(empty.offer, null);
  assert.equal(empty.decideBy, "2026-11-15");
  assert.equal(empty.deadlineAvailable, true);
  await service.saveOffer(db, user, appId, terms());
  const read = await service.getOffer(db, user, appId);
  assert.equal(read.offer.baseAmount, 150000);
  assert.equal(read.offer.decision, "pending");
  // Another user sees nothing
  assert.equal((await service.getOffer(db, other, appId)).offer, null);

  const noActivities = seeded();
  noActivities.fail("application_activities", "select", missing);
  assert.equal((await service.getOffer(noActivities, user, appId)).deadlineAvailable, false);
});

test("saveOffer is scoped by user, refuses another user's application and keeps the decision", async () => {
  const db = seeded();
  await rejectsWith(service.saveOffer(db, user, otherApp, terms()), 404);
  assert.equal(db.tables.application_offers.length, 0);

  const { offer } = await service.saveOffer(db, user, appId, terms());
  assert.equal(offer.applicationId, appId);
  assert.equal(db.tables.application_offers[0].user_id, user);
  // Nothing the user did not enter is invented
  assert.equal(db.tables.application_offers[0].decided_on, undefined);
  assert.equal(db.tables.application_offers[0].start_date, null);

  await service.decideOffer(db, user, appId, { decision: "accepted", decidedOn: "2026-11-12" });
  await service.saveOffer(db, user, appId, terms({ baseAmount: 160000 }));
  const [row] = db.tables.application_offers;
  assert.equal(db.tables.application_offers.length, 1);
  assert.equal(row.base_amount, 160000);
  assert.equal(row.decision, "accepted");
  assert.equal(row.decided_on, "2026-11-12");
});

test("deciding accepted sets decided_on and completes the open decide-by steps", async () => {
  const db = seeded({ application_activities: [deadline()] });
  // No offer row yet: one is created with just the decision
  const result = await service.decideOffer(db, user, appId, { decision: "accepted", decidedOn: "2026-11-12" });
  assert.equal(result.offer.decision, "accepted");
  assert.equal(result.offer.decidedOn, "2026-11-12");
  assert.equal(result.deadlineError, undefined);
  assert.equal(db.tables.application_offers[0].base_amount, undefined);
  assert.equal(db.tables.application_activities[0].status, "done");
  assert.ok(db.tables.application_activities[0].completed_at);
  assert.equal(db.tables.applications[0].status, "Offered");

  await rejectsWith(service.decideOffer(db, user, appId, { decision: "declined", decidedOn: null }), 400);
  await rejectsWith(service.decideOffer(db, user, appId, { decision: "declined", decidedOn: "2026-02-30" }), 400);
  await rejectsWith(service.decideOffer(db, user, otherApp, { decision: "accepted", decidedOn: "2026-11-12" }), 404);
});

test("declining with withdraw moves the application to Withdrew; without it the status stays", async () => {
  const db = seeded();
  await service.decideOffer(db, user, appId, { decision: "declined", decidedOn: "2026-11-12", withdraw: false });
  assert.equal(db.tables.applications[0].status, "Offered");
  await service.decideOffer(db, user, appId, { decision: "declined", decidedOn: "2026-11-12", withdraw: true });
  assert.equal(db.tables.applications[0].status, "Withdrew");
  // Another user's application is untouched
  assert.equal(db.tables.applications[1].status, "Offered");
  // Withdraw applies to a decline only
  const accepted = seeded();
  await service.decideOffer(accepted, user, appId, { decision: "accepted", decidedOn: "2026-11-12", withdraw: true });
  assert.equal(accepted.tables.applications[0].status, "Offered");
});

test("back to pending clears decided_on", async () => {
  const db = seeded();
  await service.decideOffer(db, user, appId, { decision: "accepted", decidedOn: "2026-11-12" });
  const { offer } = await service.decideOffer(db, user, appId, { decision: "pending", decidedOn: "2026-11-12" });
  assert.equal(offer.decision, "pending");
  assert.equal(offer.decidedOn, null);
  assert.equal(db.tables.application_offers[0].decided_on, null);
});

test("decideBy creates an all-day step, then reschedules it; null leaves it alone", async () => {
  const db = seeded();
  const created = await service.saveOffer(db, user, appId, terms({ decideBy: "2026-11-20" }));
  assert.equal(created.deadlineError, undefined);
  assert.equal(db.tables.application_activities.length, 1);
  const [step] = db.tables.application_activities;
  assert.deepEqual([step.kind, step.due_on, step.starts_at, step.status], ["offer_deadline", "2026-11-20", null, "open"]);

  await service.saveOffer(db, user, appId, terms({ decideBy: "2026-11-25" }));
  assert.equal(db.tables.application_activities.length, 1);
  assert.equal(db.tables.application_activities[0].due_on, "2026-11-25");

  // The same date again changes nothing; null or undefined leaves the step alone
  await service.saveOffer(db, user, appId, terms({ decideBy: "2026-11-25" }));
  await service.saveOffer(db, user, appId, terms({ decideBy: null }));
  await service.saveOffer(db, user, appId, terms({ decideBy: undefined }));
  assert.equal(db.tables.application_activities[0].status, "open");
  assert.equal(db.tables.application_activities.length, 1);
  assert.equal(db.tables.application_activities[0].due_on, "2026-11-25");

  // An existing step keeps its title and notes when rescheduled
  const withStep = seeded({ application_activities: [deadline()] });
  await service.saveOffer(withStep, user, appId, terms({ decideBy: "2026-12-01" }));
  assert.deepEqual(
    [withStep.tables.application_activities[0].due_on, withStep.tables.application_activities[0].notes, withStep.tables.application_activities[0].title],
    ["2026-12-01", "keep me", "Decide on the offer"]
  );

  // Without the activities table the date is ignored and the offer still saves
  const noActivities = seeded();
  noActivities.fail("application_activities", "select", missing);
  const result = await service.saveOffer(noActivities, user, appId, terms({ decideBy: "2026-11-20" }));
  assert.equal(result.deadlineError, undefined);
  assert.equal(noActivities.tables.application_offers.length, 1);
});

test("an empty decide-by cancels every open step; null leaves them", async () => {
  const db = seeded({
    application_activities: [
      deadline(),
      deadline({ id: "66666666-6666-4666-8666-666666666666", due_on: "2026-11-25" }),
      deadline({ id: "77777777-7777-4777-8777-777777777777", kind: "follow_up" }),
    ],
  });
  await service.saveOffer(db, user, appId, terms({ decideBy: null }));
  assert.deepEqual(db.tables.application_activities.map((r) => r.status), ["open", "open", "open"]);
  const result = await service.saveOffer(db, user, appId, terms({ decideBy: "" }));
  assert.equal(result.deadlineError, undefined);
  assert.deepEqual(db.tables.application_activities.map((r) => r.status), ["cancelled", "cancelled", "open"]);
  assert.equal((await service.getOffer(db, user, appId)).decideBy, null);
});

test("a decided offer ignores decideBy; pending again takes it", async () => {
  const db = seeded({ application_activities: [deadline()] });
  await service.saveOffer(db, user, appId, terms());
  await service.decideOffer(db, user, appId, { decision: "accepted", decidedOn: "2026-11-12" });
  assert.equal(db.tables.application_activities[0].status, "done");

  await service.saveOffer(db, user, appId, terms({ decideBy: "2026-11-20" }));
  assert.equal(db.tables.application_activities.length, 1);
  assert.equal(db.tables.application_activities[0].status, "done");
  await service.saveOffer(db, user, appId, terms({ decideBy: "" }));
  assert.equal(db.tables.application_activities[0].status, "done");

  await service.decideOffer(db, user, appId, { decision: "pending" });
  await service.saveOffer(db, user, appId, terms({ decideBy: "2026-11-30" }));
  assert.equal(db.tables.application_activities.length, 2);
  assert.deepEqual(db.tables.application_activities.map((r) => [r.status, r.due_on]), [["done", "2026-11-20"], ["open", "2026-11-30"]]);
});

test("a step failure keeps the offer and reports deadlineError", async () => {
  const db = seeded();
  db.fail("application_activities", "insert", { code: "XX000", message: "boom" });
  const quiet = console.error;
  console.error = () => {};
  try {
    const result = await service.saveOffer(db, user, appId, terms({ decideBy: "2026-11-20" }));
    assert.equal(result.deadlineError, true);
    assert.equal(db.tables.application_offers.length, 1);
    assert.equal(result.offer.baseAmount, 150000);

    const deciding = seeded({ application_activities: [deadline()] });
    deciding.fail("application_activities", "update", { code: "XX000", message: "boom" });
    const decided = await service.decideOffer(deciding, user, appId, { decision: "accepted", decidedOn: "2026-11-12" });
    assert.equal(decided.deadlineError, true);
    assert.equal(deciding.tables.application_offers[0].decision, "accepted");
  } finally {
    console.error = quiet;
  }
});

test("deleteOffer is scoped by user; the lists cover only the user's own offers", async () => {
  const db = seeded();
  await service.saveOffer(db, user, appId, terms());
  db.tables.application_offers.push({ id: "88888888-8888-4888-8888-888888888888", user_id: other, application_id: otherApp, decision: "accepted", decided_on: "2026-11-01" });
  await service.decideOffer(db, user, appId, { decision: "accepted", decidedOn: "2026-11-12" });

  const decisions = await service.listOfferDecisions(db, user, [appId, otherApp]);
  assert.deepEqual([...decisions], [[appId, "accepted"]]);
  assert.deepEqual(await service.listOffersForSuggestions(db, user), [{ applicationId: appId, decision: "accepted", decidedOn: "2026-11-12" }]);

  await service.deleteOffer(db, other, appId);
  assert.equal(db.tables.application_offers.length, 2);
  await service.deleteOffer(db, user, appId);
  assert.deepEqual(db.tables.application_offers.map((row) => row.user_id), [other]);
});
