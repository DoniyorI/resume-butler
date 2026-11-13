import "server-only";
import {
  cvToResumeItem,
  findResumeItem,
  itemBullets,
  normalizeResumeContent,
  skillLines,
} from "@/features/resumes/resumeDocument";
import { findInResume } from "@/server/ats/keywords";
import { matchSkills, skillLabel } from "@/server/ats/skills";
import { indexCv, isDegree, sourcesFor } from "@/server/fit/cvEvidence";
import { MAX_EXPERIENCE, MAX_PROJECTS, mostRecent } from "@/server/resume/tailorResume";

const MIN_EXPERIENCE = 2;
const MIN_PROJECTS = 1;
const MAX_NAMED_TERMS = 4;
const POINTS = { required: 2, preferred: 1 };
const NO_MATCH_NOTE = "None of your entries name what this posting asks for, so the most recent ones are shown.";

const key = (type, id) => `${type}:${id}`;
const norm = (value) => String(value || "").trim().toLowerCase();

// Which requirement terms each experience / project entry backs, from every
// matching line of the CV (not the capped evidence list, which names at most
// two entries per term).
function termsByEntry(requirements, cv) {
  const index = indexCv(cv);
  const byEntry = new Map();
  for (const req of requirements) {
    for (const { type, id } of sourcesFor(req.term, index)) {
      if ((type !== "experience" && type !== "project") || id == null) continue;
      const entry = byEntry.get(key(type, id)) || new Map();
      entry.set(req.term, req.importance);
      byEntry.set(key(type, id), entry);
    }
  }
  return byEntry;
}

const score = (terms) =>
  terms ? [...terms.values()].reduce((sum, importance) => sum + POINTS[importance], 0) : 0;

function reasonFor(terms) {
  if (!terms || !terms.size) return "";
  const names = [...terms.keys()].map(skillLabel);
  const shown = names.slice(0, MAX_NAMED_TERMS);
  const more = names.length - shown.length;
  const list =
    more > 0
      ? `${shown.join(", ")} and ${more} more`
      : shown.length > 1
        ? `${shown.slice(0, -1).join(", ")} and ${shown.at(-1)}`
        : shown[0];
  return `Backs ${list}`;
}

// Entries ranked by score, then recency, then CV order. With `keepNewest`
// the most recent entry is always picked; zero-scoring entries otherwise join
// only to reach `min`, newest first.
function choose(entries, type, termsMap, { max, min, noMatchReason, keepNewest = false }) {
  const rank = new Map(mostRecent(entries).map((entry, i) => [entry, i]));
  const scored = entries
    .map((entry, i) => ({ entry, i, terms: termsMap.get(key(type, entry.id)) }))
    .map((row) => ({ ...row, score: score(row.terms) }));
  const byRank = (a, b) => b.score - a.score || rank.get(a.entry) - rank.get(b.entry) || a.i - b.i;
  const newest = keepNewest ? scored.find((row) => rank.get(row.entry) === 0) : null;
  const picked = [
    ...(newest ? [newest] : []),
    ...scored
      .filter((row) => row !== newest && row.score > 0)
      .sort(byRank)
      .slice(0, max - (newest ? 1 : 0)),
  ];
  const fillers = scored
    .filter((row) => !picked.includes(row))
    .sort(byRank)
    .slice(0, Math.max(0, Math.min(min, entries.length) - picked.length));
  return [...picked, ...fillers].sort(byRank).map((row) => ({
    entry: row.entry,
    score: row.score,
    reason: row.score > 0 ? reasonFor(row.terms) : row === newest ? "Your most recent role" : noMatchReason,
  }));
}

// Whether a CV skill answers any requirement, by the rules the fit engine uses
// (so "Postgres" answers "postgresql"). Degrees are not skills.
function skillMatcher(requirements) {
  const terms = requirements.map((req) => req.term).filter((term) => !isDegree(term));
  return (skill) => {
    const name = String(skill.name || "");
    const skills = matchSkills(name, { technical: true });
    return terms.some((term) => findInResume(term, name, { skills }));
  };
}

// Every CV skill, each category kept in place and its matching skills first
function orderedSkills(skills, matches) {
  const categories = new Map();
  for (const skill of skills) {
    const category = skill.category || "Skills";
    categories.set(category, [...(categories.get(category) || []), skill]);
  }
  return [...categories.values()].flatMap((list) => [
    ...list.filter(matches),
    ...list.filter((skill) => !matches(skill)),
  ]);
}

/**
 * Tailor a resume from the Master CV using only what the fit assessment found:
 * the entries whose own text backs the posting's requirements. Nothing is
 * written or rewritten, so nothing can be invented. Same shape tailorResume
 * returns: { content, picks }, plus `note` when nothing in the CV matched.
 */
export function planTailoring({ fit, cv }) {
  const requirements = fit?.requirements || [];
  const experience = cv?.experience || [];
  const projects = cv?.projects || [];
  const byEntry = termsByEntry(requirements, cv || {});

  const pickedExperience = choose(experience, "experience", byEntry, {
    max: MAX_EXPERIENCE,
    min: MIN_EXPERIENCE,
    noMatchReason: "Recent experience, no direct match",
    keepNewest: true,
  });
  const pickedProjects = choose(projects, "project", byEntry, {
    max: MAX_PROJECTS,
    min: MIN_PROJECTS,
    noMatchReason: "Recent project, no direct match",
  });
  const anyMatch = [...pickedExperience, ...pickedProjects].some((row) => row.score > 0);

  return {
    content: {
      education: (cv?.education || []).map(cvToResumeItem.education),
      experience: pickedExperience.map(({ entry }) => cvToResumeItem.experience(entry)),
      projects: pickedProjects.map(({ entry }) => cvToResumeItem.projects(entry)),
      skills: skillLines(orderedSkills(cv?.skills || [], skillMatcher(requirements))),
    },
    picks: {
      experience: pickedExperience.map(({ entry, reason }) => ({
        title: [entry.position, entry.company].filter(Boolean).join(" at "),
        reason,
      })),
      projects: pickedProjects.map(({ entry, reason }) => ({ title: entry.name, reason })),
    },
    note: !anyMatch && experience.length + projects.length > 0 ? NO_MATCH_NOTE : null,
  };
}

const BY_IMPORTANCE = (a, b) => (a.importance === "required" ? 0 : 1) - (b.importance === "required" ? 0 : 1);

// The first evidence from an experience or project entry, else from a skill
function addableEvidence(req) {
  const evidence = req.evidence || [];
  return (
    evidence.find((item) => item.source?.type === "experience" || item.source?.type === "project") ||
    evidence.find((item) => item.source?.type === "skill") ||
    null
  );
}

function entryAddable(req, evidence, cv, resume) {
  const isProject = evidence.source.type === "project";
  const entry = (isProject ? cv.projects : cv.experience)?.find((row) => row.id === evidence.source.id);
  if (!entry || evidence.source.id == null) return null;

  const sectionId = isProject ? "projects" : "experience";
  const base = {
    term: req.term,
    label: req.label || skillLabel(req.term),
    importance: req.importance,
    sectionId,
    title: isProject ? entry.name : [entry.position, entry.company].filter(Boolean).join(", "),
    quote: evidence.quote,
  };
  const onPage = findResumeItem[sectionId](entry, resume[sectionId] || []);
  if (!onPage) {
    return { ...base, kind: "entry", item: cvToResumeItem[sectionId](entry) };
  }
  const bullet = evidence.text;
  if (itemBullets(onPage).some((line) => norm(line) === norm(bullet))) return null;
  const match = isProject
    ? { projectName: onPage.projectName, startDate: entry.startDate || "" }
    : { companyName: onPage.companyName, position: onPage.position, startDate: entry.startDate || "" };
  return { ...base, kind: "bullet", match, bullet };
}

/**
 * What the resume leaves out that the Master CV backs (`addable`, each tied to
 * the user's own words), and what the CV lacks (`missing`, to ask about).
 */
export function resumeGaps({ fit, cv, resumeContent }) {
  const requirements = fit?.requirements || [];
  const resume = normalizeResumeContent(resumeContent);
  const backed = requirements.filter((req) => req.strength !== "missing");
  const notShown = new Set(fit?.resume ? fit.resume.notShown : backed.map((req) => req.term));

  const addable = [];
  for (const req of [...requirements].sort(BY_IMPORTANCE)) {
    if (!notShown.has(req.term) || isDegree(req.term)) continue;
    const evidence = addableEvidence(req);
    if (!evidence) continue;
    if (evidence.source.type === "skill") {
      // Exactly the one Master CV skill the evidence points at, never a whole category line
      const row = (cv?.skills || []).find((skill) => skill.id != null && skill.id === evidence.source.id);
      const name = String(row?.name || "").trim();
      if (!name) continue;
      addable.push({
        term: req.term,
        label: req.label || skillLabel(req.term),
        importance: req.importance,
        kind: "skill",
        sectionId: "skills",
        title: "Skills",
        quote: evidence.quote,
        skill: name,
      });
      continue;
    }
    const found = entryAddable(req, evidence, cv || {}, resume);
    if (found) addable.push(found);
  }

  const missing = requirements
    .filter((req) => req.strength === "missing" && !isDegree(req.term))
    .sort(BY_IMPORTANCE)
    .map((req) => {
      const row = { term: req.term, label: req.label || skillLabel(req.term), importance: req.importance };
      return req.alternatives
        ? {
            ...row,
            alternatives: req.alternatives,
            alternativeLabels: req.alternativeLabels || req.alternatives.map(skillLabel),
          }
        : row;
    });

  return {
    backed: backed.length,
    shown: fit?.resume ? fit.resume.shown.length : 0,
    addable,
    missing,
  };
}
