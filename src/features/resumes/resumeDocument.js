import { parseDate } from "@/lib/dates";

// Shape of resumes.content (JSONB), shared by the editor, its Server Actions
// and data.js: { header, education, experience, projects, skills, order }.
// `order` lists the sections in display order as { id, title }; older rows
// also stored each section's items in it, which is ignored on load.

export const SECTION_IDS = ["education", "experience", "projects", "skills"];

export const DEFAULT_SECTION_ORDER = [
  { id: "education", title: "Education" },
  { id: "experience", title: "Experience" },
  { id: "projects", title: "Projects" },
  { id: "skills", title: "Skills" },
];

export const HEADER_FIELDS = ["name", "email", "phone", "linkedin", "github"];

export function blankItem(sectionId) {
  switch (sectionId) {
    case "education":
      return { degreeType: "", endDate: "", location: "", gpa: "", major: "", school: "", startDate: "" };
    case "experience":
      return { companyName: "", position: "", startDate: "", endDate: "", location: "", description: "", currentlyWorking: false };
    case "projects":
      return { projectName: "", description: "", startDate: "", endDate: "", currentlyWorking: false };
    case "skills":
      return { header: "", skills: [] };
    default:
      return {};
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
function normalizeOrder(order) {
  const saved = Array.isArray(order) ? order : [];
  const result = [];
  for (const section of saved) {
    const known = DEFAULT_SECTION_ORDER.find((s) => s.id === section?.id);
    if (known && !result.some((s) => s.id === known.id)) {
      result.push({ id: known.id, title: section.title || known.title });
    }
  }
  for (const section of DEFAULT_SECTION_ORDER) {
    if (!result.some((s) => s.id === section.id)) result.push(section);
  }
  return result;
}

// Turn a stored content value into the editor's document shape
export function normalizeResumeContent(content) {
  const source = content && typeof content === "object" ? content : {};
  const list = (value) => (Array.isArray(value) ? value : []);
  return {
    header: source.header && typeof source.header === "object" ? source.header : {},
    education: list(source.education),
    experience: list(source.experience),
    projects: list(source.projects),
    skills: list(source.skills),
    order: normalizeOrder(source.order),
  };
}
