import { parseDate } from "@/lib/dates";

// Shape of resumes.content (JSONB), shared by the editor, its Server Actions,
// data.js and the server AI code:
// { header, education, experience, projects, skills, order, target }.
// `order` lists the sections in display order as { id, title, hidden }; older
// rows also stored each section's items in it, which is ignored on load.
// `target` is the job the resume is tailored for: { jobDescription,
// applicationId, company, role }.

export const SECTION_IDS = ["education", "experience", "projects", "skills", "certifications"];
export const CUSTOM_SECTION_TYPES = ["entries", "text", "list"];
export const CUSTOM_SECTION_ID = /^custom:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const DEFAULT_SECTION_ORDER = [
  { id: "education", title: "Education" },
  { id: "experience", title: "Experience" },
  { id: "projects", title: "Projects" },
  { id: "skills", title: "Skills" },
  { id: "certifications", title: "Certifications" },
];

export const HEADER_FIELDS = ["name", "email", "phone", "linkedin", "github"];

export function blankItem(sectionId) {
  switch (sectionId) {
    case "education":
      return { degreeType: "", endDate: "", location: "", gpa: "", major: "", school: "", startDate: "" };
    case "experience":
      return {
        companyName: "",
        position: "",
        startDate: "",
        endDate: "",
        location: "",
        description: "",
        currentlyWorking: false,
      };
    case "projects":
      return { projectName: "", description: "", startDate: "", endDate: "", currentlyWorking: false };
    case "skills":
      return { header: "", skills: [] };
    case "certifications":
      return { id: crypto.randomUUID(), title: "", subtitle: "", date: "", url: "", description: [] };
    default:
      return { id: crypto.randomUUID(), title: "", subtitle: "", date: "", location: "", url: "", text: "", description: [] };
  }
}

// Sections whose items are kept newest first
export const DATED_SECTIONS = new Set(["education", "experience", "projects"]);

// Current items first, then by start date descending; undated items last
export function sortByDateDesc(items) {
  return [...items].sort((a, b) => {
    const aCurrent = a.currentlyWorking || a.currently_working;
    const bCurrent = b.currentlyWorking || b.currently_working;
    if (aCurrent && !bCurrent) return -1;
    if (!aCurrent && bCurrent) return 1;

    const dateA = parseDate(a.startDate || a.start_date);
    const dateB = parseDate(b.startDate || b.start_date);
    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;
    return dateB - dateA;
  });
}

// Every known section exactly once, in the saved order, missing ones appended
function normalizeOrder(order, customSections = []) {
  const saved = Array.isArray(order) ? order : [];
  const available = [...DEFAULT_SECTION_ORDER, ...customSections.map(s => ({ id: s.id, title: s.title, type: s.type }))];
  const result = [];
  for (const section of saved) {
    const known = available.find(s => s.id === section?.id);
    if (known && !result.some(s => s.id === known.id)) {
      result.push({ ...known, title: section.title || known.title, ...(section.hidden === true ? { hidden: true } : {}) });
    }
  }
  for (const section of available) {
    if (!result.some(s => s.id === section.id)) result.push({ ...section });
  }
  return result;
}

export const EMPTY_TARGET = { jobDescription: "", applicationId: null, company: "", role: "" };

function normalizeTarget(target) {
  if (!target || typeof target !== "object") return EMPTY_TARGET;
  const text = (value) => (typeof value === "string" ? value : "");
  return {
    jobDescription: text(target.jobDescription),
    applicationId: typeof target.applicationId === "string" ? target.applicationId : null,
    company: text(target.company),
    role: text(target.role),
  };
}

// Turn a stored content value into the editor's document shape
export function normalizeResumeContent(content) {
  const source = content && typeof content === "object" ? content : {};
  if (source.schemaVersion != null && ![1, 2].includes(source.schemaVersion)) throw new Error("Unsupported resume document version. Update the app before editing.");
  const list = value => Array.isArray(value) ? value : [];
  const customSections = list(source.customSections);
  const seen = new Set();
  for (const section of customSections) {
    if (!CUSTOM_SECTION_ID.test(section?.id || "") || seen.has(section.id) || !CUSTOM_SECTION_TYPES.includes(section.type) || !Array.isArray(section.items)) {
      throw new Error("Unsupported custom section. Your original document has been preserved.");
    }
    seen.add(section.id);
  }
  return {
    schemaVersion: 2, revision: Number.isInteger(source.revision) ? source.revision : 0,
    header: source.header && typeof source.header === "object" ? source.header : {},
    education: list(source.education), experience: list(source.experience),
    projects: list(source.projects), skills: list(source.skills),
    certifications: list(source.certifications), customSections,
    order: normalizeOrder(source.order, customSections), target: normalizeTarget(source.target),
  };
}

export function readResumeForEditing(value) {
  try { return { readOnly: false, content: normalizeResumeContent(value) }; }
  catch {
    return { readOnly: true, content: null, rawContent: value,
      reason: "This resume uses a newer or unsupported document format. This version can preserve and download the original data, but cannot edit it safely." };
  }
}

export function sectionItems(doc, sectionId) {
  return SECTION_IDS.includes(sectionId) ? doc[sectionId] || [] : doc.customSections?.find(s => s.id === sectionId)?.items || [];
}

export function withSectionItems(doc, sectionId, items) {
  if (SECTION_IDS.includes(sectionId)) return { ...doc, [sectionId]: items };
  return { ...doc, customSections: doc.customSections.map(s => s.id === sectionId ? { ...s, items } : s) };
}

function printedCustomItem(item, type) {
  if (type !== "entries") return { id: item.id, text: item.text || "" };
  return { id: item.id, title: item.title || "", subtitle: item.subtitle || "",
    date: item.date || "", location: item.location || "", url: item.url || "",
    description: itemBullets(item).filter(Boolean) };
}

export function visibleResumeContent(value) {
  const doc = normalizeResumeContent(value);
  const order = doc.order.filter(s => !s.hidden);
  const visible = new Set(order.map(s => s.id));
  return { ...doc, ...Object.fromEntries(SECTION_IDS.map(id => [id, visible.has(id) ? doc[id] : []])),
    certifications: visible.has("certifications") ? doc.certifications.map(item => printedCustomItem(item, "entries")) : [],
    customSections: doc.customSections.filter(s => visible.has(s.id)).map(s => ({
      ...s, title: order.find(o => o.id === s.id).title,
      items: s.items.map(item => printedCustomItem(item, s.type)),
    })), order };
}

// Bullets of an experience or project item. Stored as an array; older items
// may hold one newline-separated string.
export function itemBullets(item) {
  if (Array.isArray(item?.description)) return item.description;
  return item?.description ? String(item.description).split("\n") : [];
}

// Master CV entries (camelCase, from loadMasterCv) as resume items
export const cvToResumeItem = {
  certifications: cert => ({ id: cert.id, title: cert.name, subtitle: cert.issuer, date: cert.dateEarned, url: cert.url, description: [] }),
  education: (edu) => ({
    school: edu.school,
    location: edu.location,
    major: edu.major,
    degreeType: edu.degreeType,
    gpa: edu.gpa,
    startDate: edu.startDate,
    endDate: edu.endDate,
  }),
  experience: (exp) => ({
    companyName: exp.company,
    position: exp.position,
    location: exp.location,
    startDate: exp.startDate,
    endDate: exp.endDate,
    currentlyWorking: exp.currentlyWorking,
    description: exp.bullets.length > 0 ? [...exp.bullets] : [""],
  }),
  projects: (proj) => ({
    projectName: proj.name,
    description: proj.bullets.length > 0 ? [...proj.bullets] : [proj.description],
    startDate: proj.startDate,
    endDate: proj.endDate,
    currentlyWorking: proj.currentlyWorking,
  }),
};

// One resume skills line per CV skill category: [{ header, skills: "a, b" }]
export function skillLines(skills) {
  const grouped = new Map();
  for (const skill of skills) {
    const category = skill.category || "Skills";
    if (!grouped.has(category)) grouped.set(category, []);
    grouped.get(category).push(skill.name);
  }
  return [...grouped].map(([header, names]) => ({ header, skills: names.join(", ") }));
}
