import { NextResponse } from "next/server";
import PDFParser from "pdf2json";
import { requireUser } from "@/server/auth";
import { HttpError, errorResponse } from "@/server/http";
import { chatJSON } from "@/server/openai";
import { enforceRateLimit } from "@/server/rateLimit";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
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
  return list(value, LIMITS.bullets).map((b) => text(b, 1000)).filter(Boolean);
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

export async function POST(request) {
  try {
    const { supabase, user } = await requireUser();

    if (Number(request.headers.get("content-length") || 0) > MAX_FILE_BYTES + 10_000) {
      throw new HttpError(413, "File is too large (max 5 MB)");
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file.arrayBuffer !== "function") {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new HttpError(413, "File is too large (max 5 MB)");
    }

    await enforceRateLimit(supabase, "parse-resume");

    // Detect PDFs by their magic bytes; the client-supplied MIME type can't be trusted
    const buffer = Buffer.from(await file.arrayBuffer());
    const isPdf = buffer.subarray(0, 5).toString("latin1") === "%PDF-";
    const isText = !isPdf && file.name?.toLowerCase().endsWith(".txt");

    if (!isPdf && !isText) {
      throw new HttpError(400, "Upload a PDF or .txt file");
    }

    const resumeText = (isPdf ? await extractPdfText(buffer) : buffer.toString("utf-8")).slice(0, MAX_TEXT_CHARS);

    if (!resumeText || resumeText.trim().length === 0) {
      return NextResponse.json(
        { error: "Could not extract text from file" },
        { status: 400 }
      );
    }

    const raw = await chatJSON({ system: PARSE_PROMPT, user: resumeText });
    const parsed = {
      education: records(raw.education, LIMITS.education),
      experience: records(raw.experience, LIMITS.experience),
      projects: records(raw.projects, LIMITS.projects),
      skills: list(raw.skills, LIMITS.skills),
    };

    // Save to database
    const results = { education: 0, experience: 0, projects: 0, skills: 0 };

    if (parsed.education?.length > 0) {
      const rows = parsed.education.map((edu, i) => ({
        user_id: user.id,
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
      if (!error) results.education = rows.length;
    }

    if (parsed.experience?.length > 0) {
      for (let i = 0; i < parsed.experience.length; i++) {
        const exp = parsed.experience[i];
        const { data: inserted, error } = await supabase
          .from("cv_experience")
          .insert({
            user_id: user.id,
            company: text(exp.company),
            position: text(exp.position),
            location: text(exp.location),
            type: text(exp.type, 50) || "Full-time",
            start_date: text(exp.start_date, 10) || null,
            end_date: text(exp.end_date, 10) || null,
            currently_working: exp.currently_working === true,
            sort_order: i,
          })
          .select()
          .single();

        const bullets = bulletList(exp.bullets);
        if (!error && inserted && bullets.length > 0) {
          await supabase.from("cv_experience_bullets").insert(
            bullets.map((b, bi) => ({
              experience_id: inserted.id,
              content: b,
              sort_order: bi,
            }))
          );
        }
        if (!error) results.experience++;
      }
    }

    if (parsed.projects?.length > 0) {
      for (let i = 0; i < parsed.projects.length; i++) {
        const proj = parsed.projects[i];
        const { data: inserted, error } = await supabase
          .from("cv_projects")
          .insert({
            user_id: user.id,
            name: text(proj.name),
            description: text(proj.description, 2000),
            start_date: text(proj.start_date, 10) || null,
            end_date: text(proj.end_date, 10) || null,
            currently_working: false,
            sort_order: i,
          })
          .select()
          .single();

        const bullets = bulletList(proj.bullets);
        if (!error && inserted && bullets.length > 0) {
          await supabase.from("cv_project_bullets").insert(
            bullets.map((b, bi) => ({
              project_id: inserted.id,
              content: b,
              sort_order: bi,
            }))
          );
        }
        if (!error) results.projects++;
      }
    }

    if (parsed.skills?.length > 0) {
      const skillNames = parsed.skills
        .map((s) => text(typeof s === "string" ? s : s?.name, 100))
        .filter(Boolean);
      const rows = skillNames.map((name, i) => ({
        user_id: user.id,
        name,
        sort_order: i,
      }));
      const { error } = await supabase.from("cv_skills").insert(rows);
      if (!error) results.skills = rows.length;
    }

    return NextResponse.json({
      message: "Resume parsed and saved successfully",
      results,
      parsed,
    });
  } catch (error) {
    return errorResponse(error, "Error parsing resume");
  }
}
