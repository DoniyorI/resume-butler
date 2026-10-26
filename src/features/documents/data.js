import "server-only";
import { normalizeResumeContent } from "@/features/resumes/resumeDocument";

// Thumbnails show a few real lines of each document; keep the payload small
const PREVIEW_LINES = 7;
const LINE_CHARS = 90;

const clip = (text) => String(text || "").slice(0, LINE_CHARS);

function entryLine(sectionId, item) {
  switch (sectionId) {
    case "experience":
      return [item.position, item.companyName].filter(Boolean).join(", ");
    case "education":
      return [item.school, item.major].filter(Boolean).join(", ");
    case "projects":
      return item.projectName;
    case "skills": {
      const skills = Array.isArray(item.skills) ? item.skills.join(", ") : item.skills;
      return [item.header, skills].filter(Boolean).join(": ");
    }
    default:
      return "";
  }
}

// Resume thumbnail: the name, then each section's heading and first few entries
function resumePreview(rawContent) {
  const content = normalizeResumeContent(rawContent);
  const sections = [];
  for (const { id, title } of content.order) {
    const items = content[id] || [];
    const lines = items
      .slice(0, 2)
      .map((item) => clip(entryLine(id, item)))
      .filter(Boolean);
    if (lines.length) sections.push({ title: clip(title), lines });
  }
  return { name: clip(content.header?.name), sections: sections.slice(0, 4) };
}

// Draft.js raw content stores paragraphs as blocks[].text
function coverLetterPreview(rawContent) {
  let content = rawContent;
  if (typeof content === "string") {
    try {
      content = JSON.parse(content);
    } catch {
      content = {};
    }
  }
  const blocks = Array.isArray(content?.body?.blocks) ? content.body.blocks : [];
  return {
    name: clip(content?.header?.name),
    lines: blocks
      .map((block) => clip(block?.text).trim())
      .filter(Boolean)
      .slice(0, PREVIEW_LINES),
  };
}

// Applications that use each document, by document id
async function linkedApplications(supabase, userId) {
  const { data, error } = await supabase
    .from("applications")
    .select("id, company, role, resume_id, cover_letter_id")
    .eq("user_id", userId)
    .or("resume_id.not.is.null,cover_letter_id.not.is.null");
  if (error) throw error;

  const byDocument = new Map();
  for (const app of data) {
    const link = { id: app.id, company: app.company || "", role: app.role || "" };
    for (const documentId of [app.resume_id, app.cover_letter_id]) {
      if (documentId) byDocument.set(documentId, [...(byDocument.get(documentId) || []), link]);
    }
  }
  return byDocument;
}

/**
 * Every resume and cover letter the user has, newest edit first:
 * [{ id, type: "resume" | "coverLetter", title, href, createdAt, updatedAt, preview, applications }]
 */
export async function listDocuments(supabase, userId) {
  const [resumes, coverLetters, links] = await Promise.all([
    supabase.from("resumes").select("id, title, content, created_at, updated_at").eq("user_id", userId),
    supabase.from("cover_letters").select("id, title, content, created_at, updated_at").eq("user_id", userId),
    linkedApplications(supabase, userId),
  ]);
  if (resumes.error) throw resumes.error;
  if (coverLetters.error) throw coverLetters.error;

  const toDocument = (type, hrefBase, preview) => (row) => ({
    id: row.id,
    type,
    title: row.title || "Untitled",
    href: `${hrefBase}/${row.id}`,
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
    preview: preview(row.content),
    applications: links.get(row.id) || [],
  });

  return [
    ...resumes.data.map(toDocument("resume", "/resumes", resumePreview)),
    ...coverLetters.data.map(toDocument("coverLetter", "/coverletters", coverLetterPreview)),
  ].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}
