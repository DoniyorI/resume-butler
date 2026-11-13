import "server-only";
import { SATISFIED_BY, SKILL_ALIASES, matchSkills } from "@/server/ats/skills";
import { findInResume } from "@/server/ats/keywords";
import { clipAround, locate } from "@/server/fit/quote";
import { parseCvDate } from "@/server/fit/experienceYears";

// The degree labels extractKeywords uses, lowest first
export const DEGREE_TERMS = ["bachelor's degree", "master's degree", "PhD"];
export const isDegree = (term) => DEGREE_TERMS.includes(term);

const QUOTE_CAP = 160;
const MAX_EVIDENCE = 2;
const DEMONSTRATING = new Set(["experience", "project", "custom"]);

// The profile form stores the degree as one of these words; spelled out so the
// shared degree rules recognise it ("Master" alone is not a degree to them,
// since "Scrum master" isn't). Free text from imported resumes passes through.
const DEGREE_WORDS = {
  bachelor: "Bachelor's degree",
  master: "Master's degree",
  phd: "PhD",
  associate: "Associate degree",
};

function educationText(edu) {
  const type = String(edu?.degreeType || edu?.degree_type || "").trim();
  return [DEGREE_WORDS[type.toLowerCase()] || type, edu?.major ? `in ${edu.major}` : ""]
    .filter(Boolean)
    .join(" ");
}

const lines = (value) =>
  (Array.isArray(value) ? value : String(value || "").split("\n"))
    .map((line) => String(line || ""))
    .filter((line) => line.trim());

// The Master CV row a line came from; id is null when the loaded shape has none
const sourceOf = (type, id) => ({ type, id: id ?? null });

function unit(kind, key, label, text, source) {
  return { kind, key, label, text, source, skills: matchSkills(text, { technical: true }) };
}

/** Every searchable line of the Master CV, each tied to the entry it belongs to */
export function indexCv(cv, today = new Date()) {
  const units = [];
  (cv.experience || []).forEach((exp, i) => {
    const label =
      [exp.position, exp.company]
        .map((part) => String(part || "").trim())
        .filter(Boolean)
        .join(", ") || "Experience";
    for (const text of [...lines(exp.position), ...lines(exp.bullets)])
      units.push(unit("experience", `experience:${i}`, label, text, sourceOf("experience", exp.id)));
  });
  (cv.projects || []).forEach((project, i) => {
    const label = String(project.name || "").trim() || "Project";
    for (const text of [...lines(project.name), ...lines(project.description), ...lines(project.bullets)]) {
      units.push(unit("project", `project:${i}`, label, text, sourceOf("project", project.id)));
    }
  });
  (cv.customSections || []).forEach((section, s) => {
    (section.items || []).forEach((item, i) => {
      const key = `custom:${s}:${i}`;
      if (section.type === "entries") {
        const label = String(item.title || "").trim() || section.title || "Custom section";
        for (const text of [
          ...lines(item.title),
          ...lines(item.subtitle),
          ...lines(item.text),
          ...lines(item.description),
        ]) {
          units.push(unit("custom", key, label, text, sourceOf("custom", item.id)));
        }
      } else {
        for (const text of lines(item.text))
          units.push(unit("custom", key, section.title || "Custom section", text, sourceOf("custom", item.id)));
      }
    });
  });

  // Skills: one line per category, so "python, go" keeps its list context
  const categories = new Map();
  for (const skill of cv.skills || []) {
    const name = String(skill?.name || "").trim();
    if (!name) continue;
    const category = String(skill.category || "").trim();
    categories.set(category, [...(categories.get(category) || []), { name, id: skill.id }]);
  }
  [...categories].forEach(([category, entries]) => {
    const names = entries.map((entry) => entry.name);
    const line = unit(
      "skills",
      `skills:${category}`,
      category ? `Skills: ${category}` : "Skills",
      names.join(", "),
      sourceOf("skill", null)
    );
    line.names = names;
    line.ids = entries.map((entry) => entry.id);
    units.push(line);
  });

  (cv.certifications || []).forEach((cert, i) => {
    const label = String(cert.name || cert.issuer || "").trim() || "Certification";
    for (const text of [...lines(cert.name), ...lines(cert.issuer)])
      units.push(unit("certification", `certification:${i}`, label, text, sourceOf("certification", cert.id)));
  });
  (cv.education || []).forEach((edu, i) => {
    const label = String(edu.school || "").trim() || "Education";
    for (const text of lines(edu.major))
      units.push(unit("education", `education:${i}`, label, text, sourceOf("education", edu.id)));
  });

  return { units, education: cv.education || [], today };
}

// Spellings to find a term's place in a line, for the quote
function spellings(term) {
  const skills = [term, ...(SATISFIED_BY[term] || [])];
  return [...skills.flatMap((skill) => SKILL_ALIASES[skill] || [skill]), ...term.split(/\s+/)];
}

function evidenceItem(term, line) {
  // A skills line quotes the one skill that matched when it can
  const at = line.names ? line.names.findIndex((name) => findInResume(term, name)) : -1;
  const text = at >= 0 ? line.names[at] : line.text;
  const source = at >= 0 ? sourceOf("skill", line.ids[at]) : line.source;
  const [start, end] = locate(text, spellings(term));
  return { kind: line.kind, label: line.label, quote: clipAround(text, start, end, QUOTE_CAP), source, text };
}

function evidenceFrom(term, lines) {
  const evidence = [];
  const seen = new Set();
  for (const line of lines) {
    if (seen.has(line.key)) continue;
    seen.add(line.key);
    evidence.push(evidenceItem(term, line));
    if (evidence.length === MAX_EVIDENCE) break;
  }
  return evidence;
}

// Whether one education entry meets a degree level (or higher)
export const meetsDegree = (term, edu) => findInResume(term, "", { educationText: educationText(edu) });

// A degree whose end date is after `today` is in progress, not yet earned.
// No end date is taken as earned.
export function inProgress(edu, today) {
  const end = parseCvDate(edu?.endDate);
  const now = parseCvDate(today instanceof Date ? today : new Date(today));
  return typeof end === "number" && typeof now === "number" && end > now;
}

/** How strongly the Master CV backs one requirement, with the user's own words as evidence */
export function strengthOf(term, index) {
  if (isDegree(term)) {
    const meeting = index.education.filter((edu) => !inProgress(edu, index.today) && meetsDegree(term, edu));
    if (!meeting.length) return { strength: "missing", evidence: [] };
    return {
      strength: "demonstrated",
      evidence: meeting.slice(0, MAX_EVIDENCE).map((edu) => ({
        kind: "education",
        label: String(edu.school || "").trim() || "Education",
        quote: clipAround(String(edu.degreeType || edu.major || ""), 0, 0, QUOTE_CAP),
        source: sourceOf("education", edu.id),
        text: String(edu.degreeType || edu.major || ""),
      })),
    };
  }

  const matching = index.units.filter((line) => findInResume(term, line.text, { skills: line.skills }));
  const shown = matching.filter((line) => DEMONSTRATING.has(line.kind));
  if (shown.length) return { strength: "demonstrated", evidence: evidenceFrom(term, shown) };
  if (matching.length) return { strength: "listed", evidence: evidenceFrom(term, matching) };
  return { strength: "missing", evidence: [] };
}

/** Every Master CV line that backs a term, uncapped: [{ type, id, text }]. Same matching as strengthOf. */
export function sourcesFor(term, index) {
  if (isDegree(term)) return [];
  return index.units
    .filter((line) => findInResume(term, line.text, { skills: line.skills }))
    .map((line) => ({ type: line.source.type, id: line.source.id, text: line.text }));
}

/** Whether a resume shows a term, under the same rules */
export function resumeShows(term, resumeText, resumeEducation, resumeSkills) {
  if (isDegree(term))
    return resumeEducation.some((edu) => meetsDegree(term, edu)) || findInResume(term, resumeText);
  return findInResume(term, resumeText, { skills: resumeSkills });
}

export function cvIsEmpty(cv) {
  const filled = (list, fields) =>
    (list || []).some((entry) => fields.some((field) => lines(entry?.[field]).length));
  return (
    !filled(cv.experience, ["company", "position", "bullets"]) &&
    !filled(cv.projects, ["name", "description", "bullets"]) &&
    !filled(cv.skills, ["name"]) &&
    !filled(cv.education, ["school", "major", "degreeType"])
  );
}
