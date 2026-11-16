import assert from "node:assert/strict";
import { test } from "node:test";
import { findAlertRows, ALERT_REASONS } from "@/features/applications/alertRows";

const row = (id, extra = {}) => ({
  id,
  company: "Northwind",
  role: "Software Engineer",
  status: "Reached Out",
  source: "email",
  resume_id: null,
  comments: "Auto-detected from email: Job alert notification for a Software Engineer role that matches the recipient's profile.",
  ...extra,
});
const history = (entries) =>
  new Map(Object.entries(entries).map(([id, statuses]) => [id, statuses.map((status) => ({ application_id: id, status }))]));
const ids = (rows, byApp = new Map()) => findAlertRows(rows, byApp).map((r) => r.id);

test("an email-created row that never moved and reads like a job alert is listed with its reason", () => {
  const [found] = findAlertRows([row("a")], history({ a: ["Reached Out"] }));
  assert.deepEqual(found, {
    id: "a",
    company: "Northwind",
    role: "Software Engineer",
    status: "Reached Out",
    comment: "Auto-detected from email: Job alert notification for a Software Engineer role that matches the recipient's profile.",
    reason: ALERT_REASONS.alert,
  });
});

test("the alert wordings the email summaries use are recognised", () => {
  for (const summary of [
    "A reminder that a saved job for a Software Engineer position at Alignerr is still available.",
    "The email informs the recipient about new job opportunities that match their profile, including a role for a Flutter developer.",
    "Job alert informing that ElevenLabs is hiring for a Full-Stack Engineer position.",
    "User is notified about a new job match for the Angular Full Stack Developer position.",
    "The email informs about a hiring opportunity for the Pro Customer Service/Sales team.",
    "Job alert for an Associate Software Engineer role at Optum with a match percentage of 88%.",
  ]) {
    assert.deepEqual(ids([row("a", { comments: `Auto-detected from email: ${summary}` })]), ["a"], summary);
  }
});

test("a job site as the company, or no role at all, is a reason too", () => {
  const plain = "From email: The email encourages the recipient to share their status.";
  const board = findAlertRows([row("a", { company: "LinkedIn", comments: plain })], new Map());
  assert.equal(board[0].reason, ALERT_REASONS.jobSite);
  const noRole = findAlertRows(
    [row("b", { company: "Vercel", role: "Unknown", status: "Pending", comments: "Auto-detected from email: A deployment failed." })],
    new Map()
  );
  assert.equal(noRole[0].reason, ALERT_REASONS.noRole);
  assert.equal(findAlertRows([row("c", { role: "", comments: plain })], new Map())[0].reason, ALERT_REASONS.noRole);
});

test("a real recruiter message is left alone", () => {
  const recruiter = row("a", {
    company: "Various startups (unnamed)",
    role: "Product Engineer; Founding Engineer",
    comments: "From email: A recruiter personally reached out about engineering openings at several startups and asked to connect.",
  });
  assert.deepEqual(ids([recruiter]), []);
});

test("rows the user added, applied to, moved on or attached a resume to are never listed", () => {
  const byApp = history({ moved: ["Reached Out", "Interviewed", "Reached Out"], applied: ["Applied", "Reached Out"] });
  const rows = [
    row("manual", { source: "manual", comments: "Job alert I want to follow up on" }),
    row("extension", { source: "extension", comments: "Added from LinkedIn" }),
    row("applied"),
    row("moved"),
    row("now-applied", { status: "Applied" }),
    row("rejected", { status: "Rejected" }),
    row("has-resume", { resume_id: "r1" }),
  ];
  assert.deepEqual(ids(rows, byApp), []);
});

test("a row with no source column still counts when its note says it came from email", () => {
  assert.deepEqual(ids([row("a", { source: undefined })]), ["a"]);
  assert.deepEqual(ids([row("b", { source: null, comments: "A job alert I typed myself" })]), []);
});

test("at most 100 rows are listed and odd input is ignored", () => {
  const many = Array.from({ length: 130 }, (_, i) => row(`r${i}`));
  assert.equal(findAlertRows(many, new Map()).length, 100);
  assert.deepEqual(findAlertRows([null, {}, row("a", { comments: null, role: null })], new Map()).map((r) => r.id), ["a"]);
  assert.deepEqual(findAlertRows(undefined, undefined), []);
});
