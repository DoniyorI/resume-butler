import "server-only";
import PDFParser from "pdf2json";
import { HttpError } from "@/server/http";
import { chatJSON } from "@/server/openai";

export const MAX_RESUME_FILE_BYTES = 5 * 1024 * 1024;
const MAX_TEXT_CHARS = 30_000;

// LLM output is untrusted: cap how many rows and how much text it can write
const LIMITS = { education: 10, experience: 30, projects: 30, bullets: 20, skills: 200 };

function text(value, max = 500) {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function number(value) {
  const n = typeof value === "string" || typeof value === "number" ? Number(value) : NaN;
  return value !== "" && Number.isFinite(n) ? n : null;
}

function list(value, max) {
  return Array.isArray(value) ? value.slice(0, max) : [];
}

function records(value, max) {
  return list(value, max).filter((item) => item && typeof item === "object");
}

function bulletList(value) {
  return list(value, LIMITS.bullets)
    .map((b) => text(b, 1000))
    .filter(Boolean);
}

function extractPdfText(buffer) {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser(null, true);
    pdfParser.on("pdfParser_dataReady", () => resolve(pdfParser.getRawTextContent()));
    pdfParser.on("pdfParser_dataError", (errData) => reject(new Error(errData.parserError)));
    pdfParser.parseBuffer(buffer);
  });
}

const PARSE_PROMPT = `You are a resume parser. Extract structured data from the resume text below.

Return a JSON object with this exact structure:
{
  "education": [
    {
      "school": "University Name",
      "location": "City, State",
      "degree_type": "Bachelor" | "Master" | "PhD" | "Associate",
      "major": "Field of Study",
      "gpa": null or number,
      "start_date": "YYYY-MM-DD" or null,
      "end_date": "YYYY-MM-DD" or null
    }
  ],
  "experience": [
    {
      "company": "Company Name",
      "position": "Job Title",
      "location": "City, State",
      "type": "Full-time" | "Part-time" | "Internship" | "Contract",
      "start_date": "YYYY-MM-DD" or null,
      "end_date": "YYYY-MM-DD" or null,
      "currently_working": false,
      "bullets": ["bullet point 1", "bullet point 2"]
    }
  ],
  "projects": [
    {
      "name": "Project Name",
      "description": "Brief description",
      "start_date": "YYYY-MM-DD" or null,
      "end_date": "YYYY-MM-DD" or null,
      "bullets": ["bullet point 1", "bullet point 2"]
    }
  ],
  "skills": ["skill1", "skill2", "skill3"]
}

Rules:
- Extract EXACTLY what is written. Do NOT add, embellish, or rephrase anything.
- For dates, use the first of the month if only month/year is given (e.g. "Jan 2023" -> "2023-01-01")
- If a date says "Present" or "Current", set end_date to null and currently_working to true
- Include ALL bullet points exactly as written
- If a section doesn't exist in the resume, return an empty array for it
- Skills should be a flat list of individual skill names`;

// Detect PDFs by their magic bytes; the client-supplied MIME type can't be trusted
async function extractResumeText(buffer, fileName) {
  const isPdf = buffer.subarray(0, 5).toString("latin1") === "%PDF-";
  const isText = !isPdf && fileName?.toLowerCase().endsWith(".txt");
  if (!isPdf && !isText) throw new HttpError(400, "Upload a PDF or .txt file");

  const resumeText = (isPdf ? await extractPdfText(buffer) : buffer.toString("utf-8")).slice(
    0,
    MAX_TEXT_CHARS
  );
  if (!resumeText.trim()) throw new HttpError(400, "Could not extract text from file");
  return resumeText;
}

async function saveEducation(supabase, userId, education) {
  if (education.length === 0) return 0;
  const rows = education.map((edu, i) => ({
    user_id: userId,
    school: text(edu.school),
    location: text(edu.location),
    degree_type: text(edu.degree_type, 50),
    major: text(edu.major),
    gpa: number(edu.gpa),
    start_date: text(edu.start_date, 10) || null,
    end_date: text(edu.end_date, 10) || null,
    sort_order: i,
  }));
  const { error } = await supabase.from("cv_education").insert(rows);
  return error ? 0 : rows.length;
}

// Insert parent rows one at a time so each one's bullets can reference its ID.
// Returns how many parent rows were saved.
async function saveWithBullets(supabase, { table, bulletTable, foreignKey, entries, toRow }) {
  let saved = 0;
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const { data: inserted, error } = await supabase
      .from(table)
      .insert(toRow(entry, i))
      .select("id")
      .single();
    if (error) continue;
    saved++;

    const bullets = bulletList(entry.bullets);
    if (bullets.length > 0) {
      await supabase
        .from(bulletTable)
        .insert(bullets.map((content, bi) => ({ [foreignKey]: inserted.id, content, sort_order: bi })));
    }
  }
  return saved;
}

async function saveSkills(supabase, userId, skills) {
  const rows = skills
    .map((s) => text(typeof s === "string" ? s : s?.name, 100))
    .filter(Boolean)
    .map((name, i) => ({ user_id: userId, name, sort_order: i }));
  if (rows.length === 0) return 0;
  const { error } = await supabase.from("cv_skills").insert(rows);
  return error ? 0 : rows.length;
}

/**
 * Parse an uploaded resume (PDF or .txt) with the LLM and append it to the
 * user's master CV. Returns the route's response body.
 */
export async function parseResume(supabase, userId, { buffer, fileName }) {
  const resumeText = await extractResumeText(buffer, fileName);

  const raw = await chatJSON({ system: PARSE_PROMPT, user: resumeText });
  const parsed = {
    education: records(raw.education, LIMITS.education),
    experience: records(raw.experience, LIMITS.experience),
    projects: records(raw.projects, LIMITS.projects),
    skills: list(raw.skills, LIMITS.skills),
  };

  const results = {
    education: await saveEducation(supabase, userId, parsed.education),
    experience: await saveWithBullets(supabase, {
      table: "cv_experience",
      bulletTable: "cv_experience_bullets",
      foreignKey: "experience_id",
      entries: parsed.experience,
      toRow: (exp, i) => ({
        user_id: userId,
        company: text(exp.company),
        position: text(exp.position),
        location: text(exp.location),
        type: text(exp.type, 50) || "Full-time",
        start_date: text(exp.start_date, 10) || null,
        end_date: text(exp.end_date, 10) || null,
        currently_working: exp.currently_working === true,
        sort_order: i,
      }),
    }),
    projects: await saveWithBullets(supabase, {
      table: "cv_projects",
      bulletTable: "cv_project_bullets",
      foreignKey: "project_id",
      entries: parsed.projects,
      toRow: (proj, i) => ({
        user_id: userId,
        name: text(proj.name),
        description: text(proj.description, 2000),
        start_date: text(proj.start_date, 10) || null,
        end_date: text(proj.end_date, 10) || null,
        currently_working: false,
        sort_order: i,
      }),
    }),
    skills: await saveSkills(supabase, userId, parsed.skills),
  };

  return { message: "Resume parsed and saved successfully", results, parsed };
}
