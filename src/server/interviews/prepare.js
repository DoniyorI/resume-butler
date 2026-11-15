import "server-only";
import { CHECK_KINDS, degreeLine, yearsLine } from "@/features/opportunities/fitLines";
import { localDateKey } from "@/features/activities/kinds";
import { clipAround } from "@/server/fit/quote";

// Interview preparation, arranged from what the user sent and what the posting
// asked for. Pure: no database, no AI. Every statement about the user is a
// verbatim quote of their own text (Master CV, the resume they sent, the
// answers they recorded); every statement about the job quotes the posting.
// Apart from those quotes and requirement labels the output holds only the
// fixed strings below (and yearsLine / degreeLine, which the fit card uses too).

export const MIN_DESCRIPTION = 40;
export const MAX_QUOTES = 2;
export const MAX_STORIES = 6;
export const MAX_ANSWERS = 20;
export const POSTING_QUOTE_CAP = 200;
const INTERVIEW_KINDS = ["interview", "recruiter_screen"];
const STORY_KINDS = new Set(["experience", "project"]);

export const PREP_TEXT = {
  noSubmission: "No submitted version recorded. This uses the job description and resume saved on the application now.",
  upload: "You recorded an uploaded PDF; Resume Butler can't tell which lines it held.",
  unknown: "You didn't record which resume you sent; Resume Butler can't tell which lines it held.",
  unreadable: "The resume you recorded is in a format this version can't read, so Resume Butler can't tell which lines it held.",
  noResume: "No resume is linked to this application, so Resume Butler can't tell which lines they read.",
  goDeeper: "On the resume they read — expect follow-up questions",
  bringUp: "In your Master CV but not on what you sent — you can bring it up",
  shown: "Shown in your Master CV — expect questions",
  needExample: "Listed but without an example — think of one",
  gaps: "Not in your Master CV — prepare an honest answer",
  alsoAccepted: "Also accepted:",
  stories: "Stories to have ready",
  covers: "Covers:",
  checks: "Only you can judge",
  answers: "What you told them in the application",
  addDescription: "Save the job description on the application first; without it there is nothing to prepare from.",
  addCv: "Add your experience to your Master CV to see where you have an example.",
  fitUnavailable: "The comparison could not be loaded. Reload to try again.",
  footer:
    "Everything here is quoted from the posting, your Master CV, or what you recorded when you applied. Nothing is generated.",
};

export const FIXED_STRINGS = Object.freeze(Object.values(PREP_TEXT));

const text = (value) => (typeof value === "string" ? value : "");
const trimmed = (value) => text(value).trim();

// The latest record (by submitted_on, then created_at) that no other record
// supersedes, or null
export function chooseSubmission(records) {
  const list = Array.isArray(records) ? records : [];
  const superseded = new Set(list.map((record) => record.supersedes_id).filter(Boolean));
  const open = list.filter((record) => !superseded.has(record.id));
  open.sort(
    (a, b) =>
      text(b.submitted_on).localeCompare(text(a.submitted_on)) || text(b.created_at).localeCompare(text(a.created_at))
  );
  return open[0] || null;
}

// The job description to prepare from: the submitted one wins, the application's
// current one is the fallback
export function chooseDescription(application, submission) {
  return trimmed(submission?.job_description) || trimmed(application?.jobDescription);
}

// The resume content the employer read, or null when it was not recorded
export function submissionResumeContent(submission) {
  if (!submission) return null;
  if (submission.kind === "export") return submission.artifact?.content || null;
  if (submission.kind === "selected") return submission.resume_snapshot || null;
  return null;
}

function nextStep(activities, now) {
  const today = localDateKey(now);
  const open = (activities || []).filter(
    (activity) => activity?.status === "open" && INTERVIEW_KINDS.includes(activity.kind)
  );
  const upcoming = open.filter((activity) =>
    activity.startsAt ? new Date(activity.startsAt).getTime() >= now.getTime() : Boolean(activity.dueOn) && activity.dueOn >= today
  );
  upcoming.sort((a, b) => {
    const when = (activity) => activity.startsAt || `${activity.dueOn}T23:59:59Z`;
    return new Date(when(a)) - new Date(when(b));
  });
  const step = upcoming[0];
  if (!step) return null;
  return {
    id: step.id,
    title: text(step.title),
    kind: step.kind,
    startsAt: step.startsAt || null,
    timeZone: step.timeZone || null,
    dueOn: step.dueOn || null,
    contactName: text(step.contactName),
    contactChannel: text(step.contactChannel),
    link: text(step.link),
    notes: text(step.notes),
  };
}

const escapePattern = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// The posting's sentences, in order, as plain substrings of the description
function postingSentences(description) {
  const sentences = [];
  for (const line of description.split(/\r?\n+/)) {
    for (const part of line.split(/(?<=[.!?])\s+/)) {
      const sentence = part.replace(/^\s*[-*•·‣▪●–—]\s+/, "").trim();
      if (sentence) sentences.push(sentence);
    }
  }
  return sentences;
}

function quoteFromPosting(sentences, requirement) {
  const spellings = [...new Set([requirement.label, requirement.term].map(trimmed).filter(Boolean))];
  for (const sentence of sentences) {
    for (const spelling of spellings) {
      const match = new RegExp(`(?<![A-Za-z0-9])${escapePattern(spelling)}(?![A-Za-z0-9+#])`, "i").exec(sentence);
      if (match) return clipAround(sentence, match.index, match.index + match[0].length, POSTING_QUOTE_CAP);
    }
  }
  return null;
}

// Every experience and project bullet of the Master CV, as written
function cvBullets(cv) {
  const bullets = new Set();
  const add = (value) => {
    for (const line of Array.isArray(value) ? value : text(value).split("\n")) {
      if (trimmed(line)) bullets.add(trimmed(line));
    }
  };
  for (const exp of cv?.experience || []) add(exp.bullets);
  for (const project of cv?.projects || []) {
    add(project.bullets);
    add(project.description);
  }
  return bullets;
}

function isEmptyCv(cv) {
  const has = (list) => Array.isArray(list) && list.length > 0;
  return !has(cv?.experience) && !has(cv?.projects) && !has(cv?.skills);
}

function describeSource({ submission, resumeKnown, application }) {
  if (!submission) {
    return {
      kind: "current",
      submittedOn: null,
      resumeTitle: null,
      submissionId: null,
      resumeKnown,
      notes: [PREP_TEXT.noSubmission, ...(!resumeKnown && !application?.resumeId ? [PREP_TEXT.noResume] : [])],
    };
  }
  let notes = [];
  if (!resumeKnown) {
    if (submission.kind === "upload") notes = [PREP_TEXT.upload];
    else if (submission.kind === "unknown") notes = [PREP_TEXT.unknown];
    else notes = [PREP_TEXT.unreadable];
  }
  return {
    kind: "submitted",
    submittedOn: submission.submitted_on || null,
    resumeTitle: trimmed(submission.resume_title) || null,
    submissionId: submission.id,
    resumeKnown,
    notes,
  };
}

function itemFor(requirement, sentences, onResume) {
  const quotes = (requirement.evidence || [])
    .filter((item) => trimmed(item?.quote))
    .slice(0, MAX_QUOTES)
    .map((item) => ({ text: item.quote, from: text(item.label) }));
  const item = {
    term: requirement.term,
    label: requirement.label || requirement.term,
    importance: requirement.importance,
    strength: requirement.strength,
    quotes,
    onResume,
    postingQuote: quoteFromPosting(sentences, requirement),
  };
  if (Array.isArray(requirement.alternativeLabels) && requirement.alternativeLabels.length) {
    item.alternativeLabels = requirement.alternativeLabels.filter(Boolean);
  }
  return item;
}

function buildStories(requirements, bullets) {
  const found = new Map();
  requirements.forEach((requirement) => {
    for (const evidence of requirement.evidence || []) {
      const bullet = trimmed(evidence?.text);
      if (!STORY_KINDS.has(evidence?.kind) || !bullets.has(bullet)) continue;
      const story =
        found.get(bullet) ||
        found.set(bullet, { text: bullet, from: text(evidence.label), covers: [], required: 0, preferred: 0, order: found.size }).get(bullet);
      const label = requirement.label || requirement.term;
      if (story.covers.includes(label)) continue;
      story.covers.push(label);
      story[requirement.importance === "required" ? "required" : "preferred"] += 1;
    }
  });
  return [...found.values()]
    .sort((a, b) => b.required - a.required || b.preferred - a.preferred || a.order - b.order)
    .slice(0, MAX_STORIES)
    .map(({ text: story, from, covers }) => ({ text: story, from, covers }));
}

function buildChecks(fit) {
  const checks = (fit.checks || [])
    .filter((check) => trimmed(check?.quote))
    .map((check) => ({ kind: check.kind, label: CHECK_KINDS[check.kind] || "Check", text: check.quote }));
  const years = yearsLine(fit.years);
  if (years) checks.push({ kind: "years", label: "Experience", text: years });
  const degree = degreeLine(fit.degree);
  if (degree) checks.push({ kind: "degree", label: "Education", text: degree });
  return checks;
}

function buildGroups(requirements, { resumeKnown, resume, sentences }) {
  const shown = new Set(resume?.shown || []);
  const notShown = new Set(resume?.notShown || []);
  const buckets = { goDeeper: [], bringUp: [], shown: [], needExample: [], gaps: [] };
  for (const requirement of requirements) {
    if (requirement.strength === "demonstrated") {
      if (!resumeKnown) {
        buckets.shown.push(itemFor(requirement, sentences, null));
      } else if (notShown.has(requirement.term)) {
        buckets.bringUp.push(itemFor(requirement, sentences, false));
      } else if (shown.has(requirement.term)) {
        buckets.goDeeper.push(itemFor(requirement, sentences, true));
      } else {
        // Backed, but the resume comparison did not rate it: not claimed either way
        buckets.shown.push(itemFor(requirement, sentences, null));
      }
    } else if (requirement.strength === "listed") {
      buckets.needExample.push(itemFor(requirement, sentences, resumeKnown ? shown.has(requirement.term) || false : null));
    } else if (requirement.strength === "missing") {
      buckets.gaps.push(itemFor(requirement, sentences, null));
    }
  }
  return ["goDeeper", "bringUp", "shown", "needExample", "gaps"]
    .map((key) => ({ key, title: PREP_TEXT[key], items: buckets[key] }))
    .filter((group) => group.items.length);
}

/**
 * The interview preparation page's data.
 *   application: { id, company, role, status, jobDescription, resumeId }
 *   submission:  the chosen record from getSubmission (or null)
 *   fit:         assessFit's result for the chosen description and resume (or null)
 *   cv:          the Master CV (loadMasterCv)
 *   activities:  the application's steps (toActivity shape), or null when unavailable
 */
export function buildInterviewPrep({ application, submission = null, fit = null, cv = null, activities = null, now = new Date() }) {
  const description = chooseDescription(application, submission);
  const hasDescription = description.length >= MIN_DESCRIPTION;
  const usable = hasDescription && fit && Array.isArray(fit.requirements) ? fit : null;
  const resumeKnown = Boolean(usable?.resume) && (submission ? Boolean(submissionResumeContent(submission)) : true);

  const sentences = hasDescription ? postingSentences(description) : [];
  // Required first, then preferred, each in the engine's order
  const requirements = usable
    ? [...usable.requirements.filter((r) => r.importance === "required"), ...usable.requirements.filter((r) => r.importance !== "required")]
    : [];
  const answers = (Array.isArray(submission?.answers) ? submission.answers : [])
    .filter((item) => item && typeof item.question === "string" && typeof item.answer === "string")
    .slice(0, MAX_ANSWERS)
    .map((item) => ({ question: item.question, answer: item.answer }));

  return {
    source: describeSource({ submission, resumeKnown, application }),
    posting: {
      company: text(application?.company),
      role: text(application?.role),
      hasDescription,
      fitAvailable: Boolean(usable),
      cvEmpty: cv ? isEmptyCv(cv) : false,
    },
    upcoming: nextStep(activities, now),
    past: (activities || []).filter((activity) => activity?.kind === "interview" && activity.status === "done").length,
    groups: usable ? buildGroups(requirements, { resumeKnown, resume: usable.resume, sentences }) : [],
    stories: usable ? buildStories(requirements, cvBullets(cv)) : [],
    checks: usable ? buildChecks(usable) : [],
    answers,
  };
}
