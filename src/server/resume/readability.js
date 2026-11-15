import { formatMonthYear } from "@/lib/dates";
import { safeHttpUrl } from "@/lib/safeUrl";
import { normalizeResumeContent } from "@/features/resumes/resumeDocument";

// Pure and deterministic: compares the lines `generateLatex` prints with the text a PDF
// text extractor read back from the compiled PDF. It describes what was found; it says
// nothing about how any particular applicant tracking system reads the file.

const NO_TEXT_MIN_CHARS = 20;
const LONG_BULLET_WORDS = 12;
const MIN_SEGMENT_WORDS = 3;

function text(value) {
  return value === null || value === undefined ? "" : String(value);
}

function bulletsOf(item) {
  const description = item?.description;
  if (!description) return [];
  const list = Array.isArray(description) ? description : String(description).split("\n");
  return list.map(text).filter((bullet) => bullet.trim());
}

function dateRange(item, { allowCurrent = true } = {}) {
  const start = formatMonthYear(item.startDate || item.start_date);
  if (!start) return "";
  const current = allowCurrent && (item.currentlyWorking || item.currently_working);
  return `${start} - ${current ? "Present" : formatMonthYear(item.endDate || item.end_date)}`;
}

function displayLink(value) {
  return text(value).replace(/^https?:\/\/(www\.)?/, "");
}

/**
 * The lines generateLatex prints for this resume content, in print order:
 * [{ section, kind: "name" | "contact" | "heading" | "line" | "bullet", label?, text }].
 * Hidden sections and sections with nothing to print are left out, as they are in the PDF.
 */
export function expectedLines(content) {
  const doc = normalizeResumeContent(content);
  const lines = [];
  const add = (section, kind, value, label) => {
    const trimmed = text(value).trim();
    if (trimmed) lines.push({ section, kind, text: trimmed, ...(label ? { label } : {}) });
  };

  const header = doc.header;
  add("Name", "name", header.name);
  add("Contact", "contact", header.email, "Email");
  add("Contact", "contact", header.phone, "Phone");
  add("Contact", "contact", displayLink(header.linkedin), "LinkedIn");
  add("Contact", "contact", displayLink(header.github), "GitHub");

  const sections = {
    experience: (title) => {
      doc.experience.forEach((exp) => {
        add(title, "line", exp.companyName || exp.company);
        add(title, "line", exp.location);
        add(title, "line", exp.position);
        add(title, "line", dateRange(exp));
        bulletsOf(exp).forEach((bullet) => add(title, "bullet", bullet));
      });
      return doc.experience.length > 0;
    },
    education: (title) => {
      doc.education.forEach((edu) => {
        add(title, "line", edu.school);
        add(title, "line", edu.location);
        const degree = [edu.degreeType || edu.degree_type, edu.major].filter(Boolean).join(" in ");
        add(title, "line", `${degree}${edu.gpa ? `, GPA: ${edu.gpa}` : ""}`.replace(/^,\s*/, ""));
        add(title, "line", formatMonthYear(edu.endDate || edu.end_date));
      });
      return doc.education.length > 0;
    },
    projects: (title) => {
      doc.projects.forEach((proj) => {
        add(title, "line", proj.projectName || proj.name);
        add(title, "line", dateRange(proj));
        bulletsOf(proj).forEach((bullet) => add(title, "bullet", bullet));
      });
      return doc.projects.length > 0;
    },
    skills: (title) => {
      const groups = doc.skills.filter((group) => group?.header && group.skills);
      groups.forEach((group) => {
        const skills = typeof group.skills === "string" ? group.skills : group.skills.join(", ");
        add(title, "line", `${group.header}: ${skills}`);
      });
      return groups.length > 0;
    },
  };
  const entries = (items) => (title) => {
    items.forEach((item) => {
      add(title, "line", item.title);
      add(title, "line", item.date);
      add(title, "line", item.subtitle);
      add(title, "line", item.location);
      if (safeHttpUrl(item.url)) add(title, "line", item.url);
      bulletsOf(item).forEach((bullet) => add(title, "bullet", bullet));
    });
    return items.length > 0;
  };
  sections.certifications = entries(doc.certifications);
  for (const section of doc.customSections) {
    if (!section.items.length) continue;
    if (section.type === "entries") sections[section.id] = entries(section.items);
    else {
      sections[section.id] = (title) => {
        section.items.forEach((item) => {
          const parts = section.type === "text" ? text(item.text).split("\n") : [item.text];
          parts.forEach((part) => add(title, "line", part));
        });
        return true;
      };
    }
  }

  for (const { id, title, hidden } of doc.order) {
    if (hidden || !sections[id]) continue;
    const before = lines.length;
    sections[id](title);
    // The heading prints only when the section printed something
    if (lines.length > before) lines.splice(before, 0, { section: title, kind: "heading", text: text(title).trim() });
  }
  return lines;
}

// Both sides are compared in this form: ligatures split (NFKC), typographic quotes and
// dashes unified, whitespace collapsed, case ignored.
export function normalizeForComparison(value) {
  return text(value)
    .normalize("NFKC")
    .replace(/[​-‍⁠﻿­]/g, "")
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// The extraction as lines, and as running text in two forms: a line ending in a hyphen
// joined to the next line keeping the hyphen ("event-" + "driven") or dropping it
// ("effi-" + "cient").
function readerViews(extractedText) {
  const lines = text(extractedText).split(/\r?\n/).map(normalizeForComparison).filter(Boolean);
  const join = (keepHyphen) => {
    let out = "";
    for (const line of lines) {
      if (out.endsWith("-") && /^[a-z0-9]/.test(line)) out = (keepHyphen ? out : out.slice(0, -1)) + line;
      else out = out ? `${out} ${line}` : line;
    }
    return out;
  };
  return { lines, running: [join(true), join(false)] };
}

// A long bullet may be printed over several lines with other text between them: accept it
// when it is covered, in order, by runs of its own words that each appear in the extraction.
function coveredInPieces(item, running) {
  const words = item.split(" ");
  let at = 0;
  while (at < words.length) {
    const remaining = words.length - at;
    const needed = Math.min(MIN_SEGMENT_WORDS, remaining);
    let length = remaining;
    while (length >= needed && !running.some((view) => view.includes(words.slice(at, at + length).join(" ")))) length -= 1;
    if (length < needed) return false;
    at += length;
  }
  return true;
}

function isFound(item, running) {
  if (running.some((view) => view.includes(item))) return true;
  return item.split(" ").length > LONG_BULLET_WORDS && coveredInPieces(item, running);
}

/**
 * Which of the lines the PDF should print were read back from `extractedText`.
 * `pages` is the number of pages the extractor read, when known.
 * Returns { status: "ok" | "no-text" | "empty-resume", expected, found, missing: [{ section, text }],
 *   headingsInOrder, headingOrder, contact: [{ label, found }], extractedText, pages }.
 */
export function checkReadability(content, extractedText, { pages = null } = {}) {
  const extracted = text(extractedText);
  const result = { status: "ok", expected: 0, found: 0, missing: [], headingsInOrder: true, headingOrder: [], contact: [], extractedText: extracted, pages };

  const lines = expectedLines(content);
  if (!lines.some((line) => line.kind !== "heading")) return { ...result, status: "empty-resume" };
  result.expected = lines.length;

  if (extracted.replace(/\s/g, "").length < NO_TEXT_MIN_CHARS) {
    return { ...result, status: "no-text", missing: lines.map(({ section, text: line }) => ({ section, text: line })),
      headingsInOrder: false, contact: lines.filter((l) => l.kind === "contact").map((l) => ({ label: l.label, found: false })) };
  }

  const { lines: readLines, running } = readerViews(extracted);
  const headingsRead = [];
  for (const line of lines) {
    const needle = normalizeForComparison(line.text);
    let found = Boolean(needle) && isFound(needle, running);
    if (line.kind === "heading") {
      // A heading counts when it is a line of its own; its order is the order of those lines
      const at = readLines.indexOf(needle);
      found = at !== -1;
      if (found) headingsRead.push({ title: line.text, at });
    }
    if (line.kind === "contact") result.contact.push({ label: line.label, found });
    if (found) result.found += 1;
    else result.missing.push({ section: line.section, text: line.text });
  }

  result.headingOrder = [...headingsRead].sort((a, b) => a.at - b.at).map((h) => h.title);
  result.headingsInOrder = headingsRead.every((heading, index) => index === 0 || heading.at > headingsRead[index - 1].at);
  return result;
}
