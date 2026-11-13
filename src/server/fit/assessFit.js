import "server-only";
import { extractYearsRequirement } from "@/server/ats/keywords";
import { matchSkills } from "@/server/ats/skills";
import { resumeToText } from "@/server/ats/resumeText";
import { visibleResumeContent } from "@/features/resumes/resumeDocument";
import { countedText, findChecks, readRequirements, readSentences } from "@/server/fit/posting";
import {
  DEGREE_TERMS,
  cvIsEmpty,
  inProgress,
  indexCv,
  isDegree,
  meetsDegree,
  resumeShows,
  strengthOf,
} from "@/server/fit/cvEvidence";
import { experienceYears } from "@/server/fit/experienceYears";

export const FIT_METHOD = "fit-evidence-v1";
const BANDS = ["low", "stretch", "good", "strong"];
const STRENGTH_ORDER = { missing: 0, listed: 1, demonstrated: 2 };
const MIN_REQUIRED_TERMS = 3;
const MAX_REQUIREMENTS = 60;

// "TypeScript or JavaScript": the posting asks for one of them. When the CV
// backs any alternative, the unbacked ones are dropped; when it backs none,
// only the first is kept (missing), naming the others in `alternatives`.
// A term the posting also asks for on its own is never dropped.
function resolveAlternatives(requirements, groups, standalone) {
  const byTerm = new Map(requirements.map((req) => [req.term, { ...req }]));
  const dropped = new Set();
  for (const group of groups) {
    const members = group.filter((term) => byTerm.has(term) && !dropped.has(term));
    if (members.length < 2) continue;
    const backed = members.some((term) => byTerm.get(term).strength !== "missing");
    const [first, ...rest] = members;
    const removable = (backed ? members : rest).filter(
      (term) => byTerm.get(term).strength === "missing" && !standalone.has(term)
    );
    removable.forEach((term) => dropped.add(term));
    if (!backed && removable.length) {
      const kept = byTerm.get(first);
      kept.alternatives = [...new Set([...(kept.alternatives || []), ...removable])];
    }
  }
  return [...byTerm.values()].filter((req) => !dropped.has(req.term));
}

// "Bachelor's or master's degree": the lowest level is the requirement, the
// higher one an alternative, so a degree is dropped when a lower one is asked
// for at the same importance. "Bachelor's required; master's preferred" keeps both.
function dropAlternativeDegrees(requirements) {
  return requirements.filter(
    (req) =>
      !isDegree(req.term) ||
      !requirements.some(
        (other) =>
          other !== req &&
          isDegree(other.term) &&
          other.importance === req.importance &&
          DEGREE_TERMS.indexOf(other.term) < DEGREE_TERMS.indexOf(req.term)
      )
  );
}

function tally(requirements, importance) {
  const list = requirements.filter((req) => req.importance === importance);
  const count = (strength) => list.filter((req) => req.strength === strength).length;
  return {
    total: list.length,
    demonstrated: count("demonstrated"),
    listed: count("listed"),
    missing: count("missing"),
  };
}

function yearsSummary(description, cv, today) {
  const required = extractYearsRequirement(description);
  const have = experienceYears(cv.experience, today);
  let status = "short";
  if (required === null) status = "not-stated";
  else if (have === null) status = "unknown";
  else if (have >= required) status = "meets";
  return { required, have, status };
}

function degreeSummary(requirements, education, today) {
  const required =
    requirements.find((req) => req.importance === "required" && isDegree(req.term))?.term || null;
  if (!required) return { required: null, status: "not-stated" };
  if (!education.some((edu) => edu && (edu.school || edu.major || edu.degreeType)))
    return { required, status: "unknown" };
  const meeting = education.filter((edu) => meetsDegree(required, edu));
  if (meeting.some((edu) => !inProgress(edu, today))) return { required, status: "meets" };
  // Not yet earned: short for the band, flagged so the UI can say "in progress"
  if (meeting.length) return { required, status: "short", inProgress: true };
  return { required, status: "short" };
}

const plural = (n, one, many) => (n === 1 ? one : many);
const article = (term) => (/^[aeiou]/i.test(term) ? "an" : "a");

function bandFor(counts, years, degree) {
  const { total, demonstrated, listed } = counts.required;
  const coverage = (demonstrated + 0.5 * listed) / total;
  let band = coverage >= 0.75 ? "strong" : coverage >= 0.5 ? "good" : coverage >= 0.25 ? "stretch" : "low";

  const sentences = [
    `${demonstrated} of ${total} required ${plural(total, "skill or qualification is", "skills and qualifications are")} backed by your experience or projects` +
      (listed ? ` and ${listed} more ${plural(listed, "is", "are")} listed without an example.` : "."),
  ];
  if (years.status === "short") {
    const lowered = BANDS[Math.max(0, BANDS.indexOf(band) - 1)];
    sentences.push(
      `The posting asks for ${years.required}+ years; your dated experience covers about ${years.have} ${plural(years.have, "year", "years")}` +
        (lowered !== band ? `, so this is rated one band lower.` : ".")
    );
    band = lowered;
  }
  if (degree.status === "short" && band === "strong") {
    band = "good";
    sentences.push(
      `The posting asks for ${article(degree.required)} ${degree.required} that your education doesn't show, so this is not rated strong.`
    );
  }
  return { band, reason: sentences.join(" ") };
}

function compareResume(requirements, resumeContent) {
  const content = visibleResumeContent(resumeContent);
  const text = resumeToText(resumeContent);
  const skills = matchSkills(text, { technical: true });
  const backed = requirements.filter((req) => req.strength !== "missing");
  const shows = (term) => resumeShows(term, text, content.education || [], skills);
  return {
    shown: backed.filter((req) => shows(req.term)).map((req) => req.term),
    notShown: backed.filter((req) => !shows(req.term)).map((req) => req.term),
  };
}

/**
 * How one job posting compares with the user's Master CV, with the user's own
 * words as evidence. Decision support, not a prediction: it says which stated
 * requirements the CV backs, not whether an interview will follow.
 *
 * Pure and deterministic: the same input (including `today`) gives the same result.
 */
export function assessFit({ jobDescription, cv, resumeContent = null, today = new Date() }) {
  const description = typeof jobDescription === "string" ? jobDescription : "";
  const masterCv = cv || {};
  const sentences = readSentences(description);
  const index = indexCv(masterCv, today);

  const posted = readRequirements(sentences, description);
  // At most MAX_REQUIREMENTS, the first by appearance in the posting: a longer
  // list isn't useful to read, and it bounds the work on very long postings
  const stated = dropAlternativeDegrees(posted.requirements)
    .slice(0, MAX_REQUIREMENTS)
    .map((req) => ({ ...req, ...strengthOf(req.term, index) }));
  const requirements = resolveAlternatives(stated, posted.alternatives, posted.standalone)
    .sort(
      (a, b) =>
        (a.importance === "required" ? 0 : 1) - (b.importance === "required" ? 0 : 1) ||
        STRENGTH_ORDER[a.strength] - STRENGTH_ORDER[b.strength] ||
        a.position - b.position
    )
    .map(({ term, importance, strength, evidence, alternatives }) =>
      alternatives
        ? { term, importance, strength, evidence, alternatives }
        : { term, importance, strength, evidence }
    );

  const counts = { required: tally(requirements, "required"), preferred: tally(requirements, "preferred") };
  const years = yearsSummary(countedText(sentences), masterCv, today);
  const degree = degreeSummary(requirements, masterCv.education || [], today);

  let band = "unknown";
  let reason;
  if (cvIsEmpty(masterCv)) {
    reason = "Your Master CV has no experience, projects or skills yet.";
  } else if (counts.required.total < MIN_REQUIRED_TERMS) {
    reason = "This posting names too few specific requirements to compare.";
  } else {
    ({ band, reason } = bandFor(counts, years, degree));
  }

  return {
    method: FIT_METHOD,
    band,
    reason,
    requirements,
    counts,
    years,
    degree,
    checks: findChecks(sentences),
    resume: resumeContent ? compareResume(requirements, resumeContent) : null,
  };
}
