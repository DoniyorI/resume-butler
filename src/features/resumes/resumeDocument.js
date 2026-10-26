import { parseDate } from "@/lib/dates";

// Shape of resumes.content (JSONB), shared by the editor, its Server Actions,
// data.js and the server AI code:
// { header, education, experience, projects, skills, order, target }.
// `order` lists the sections in display order as { id, title, hidden }; older
// rows also stored each section's items in it, which is ignored on load.
// `target` is the job the resume is tailored for: { jobDescription,
// applicationId, company, role }.

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
      const entry = { id: known.id, title: section.title || known.title };
      if (section.hidden === true) entry.hidden = true;
      result.push(entry);
    }
  }
  for (const section of DEFAULT_SECTION_ORDER) {
    if (!result.some((s) => s.id === section.id)) result.push(section);
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
  const list = (value) => (Array.isArray(value) ? value : []);
  return {
    header: source.header && typeof source.header === "object" ? source.header : {},
    education: list(source.education),
    experience: list(source.experience),
    projects: list(source.projects),
    skills: list(source.skills),
    order: normalizeOrder(source.order),
    target: normalizeTarget(source.target),
  };
}

// Bullets of an experience or project item. Stored as an array; older items
// may hold one newline-separated string.
export function itemBullets(item) {
  if (Array.isArray(item?.description)) return item.description;
  return item?.description ? String(item.description).split("\n") : [];
}

// Master CV entries (camelCase, from loadMasterCv) as resume items
export const cvToResumeItem = {
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
