import "server-only";
import PDFParser from "pdf2json";
import { HttpError } from "@/server/http";
import { chatJSON } from "@/server/openai";
import { normalizeCvDate } from "@/lib/cvDates";

export const MAX_RESUME_FILE_BYTES = 5 * 1024 * 1024;
const MAX_TEXT_CHARS = 30_000;

// LLM output is untrusted: cap how many rows and how much text it can write
const LIMITS = { education: 10, experience: 30, projects: 30, bullets: 20, skills: 200 };

function text(value, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function number(value) {
  const n = typeof value === "string" || typeof value === "number" ? Number(value) : NaN;
  return !(typeof value === "string" && !value.trim()) && Number.isFinite(n) ? n : null;
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
- If only a year is given, or a date is absent/unknown, return null. Never invent a month.
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

function normalizeImport(raw) {
  let datesNeedingReview = 0;
  const date = value => {
    const normalized = normalizeCvDate(value);
    if (value && !normalized && !/^(present|current)$/i.test(String(value).trim())) datesNeedingReview++;
    return normalized;
  };
  const unique = values => {
    const seen = new Set();
    return values.filter(value => {
      const key = value.toLowerCase().replace(/\s+/g, " ");
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
  };
  const dates = entry => ({ start_date: date(entry.start_date), end_date: date(entry.end_date) });
  const input = {
    education: records(raw?.education, LIMITS.education).map(entry => ({
      school: text(entry.school, 200), location: text(entry.location, 200), degree_type: text(entry.degree_type, 50),
      major: text(entry.major, 200), gpa: number(entry.gpa) != null && number(entry.gpa) >= 0 && number(entry.gpa) <= 10 ? number(entry.gpa) : null, ...dates(entry),
    })),
    experience: records(raw?.experience, LIMITS.experience).map(entry => ({
      company: text(entry.company, 200), position: text(entry.position, 200), location: text(entry.location, 200),
      type: text(entry.type, 50), ...dates(entry), currently_working: entry.currently_working === true,
      bullets: unique(bulletList(entry.bullets)),
    })),
    projects: records(raw?.projects, LIMITS.projects).map(entry => ({
      name: text(entry.name, 200), description: text(entry.description, 2000), ...dates(entry), bullets: unique(bulletList(entry.bullets)),
    })),
    skills: unique(list(raw?.skills, LIMITS.skills).map(entry => text(typeof entry === "string" ? entry : entry?.name, 100)).filter(Boolean)),
  };
  return { input, datesNeedingReview };
}

/**
 * Parse an uploaded resume (PDF or .txt) with the LLM and safely merge it into the
 * user's master CV. Returns the route's response body.
 */
export async function parseResume(supabase, userId, { buffer, fileName }) {
  const resumeText = await extractResumeText(buffer, fileName);
  const raw = await chatJSON({ task: "import", system: PARSE_PROMPT, user: resumeText });
  const { input, datesNeedingReview } = normalizeImport(raw);
  const { data, error } = await supabase.rpc("merge_resume_import", { p_input: input });
  if (["PGRST202", "42883", "42703", "PGRST204"].includes(error?.code)) {
    throw new HttpError(503, "Resume import is being updated (migration 019). Your existing CV is unchanged. Try again after setup.");
  }
  if (error) throw error;
  const counters = [...Object.values(data?.added || {}), ...Object.values(data?.merged || {}), ...Object.values(data?.needsReview || {}), data?.bulletsAdded];
  if (!data?.added || !data?.merged || !data?.needsReview || counters.length !== 12 || !counters.every(value => Number.isInteger(value) && value >= 0)) {
    throw new Error("Invalid resume import result");
  }
  return { message: "Resume imported", results: data.added, merged: data.merged, bulletsAdded: data.bulletsAdded, needsReview: data.needsReview, datesNeedingReview };
}
