import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import PDFParser from "pdf2json";

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
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Extract text from PDF
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    let resumeText;

    if (file.type === "application/pdf") {
      resumeText = await new Promise((resolve, reject) => {
        const pdfParser = new PDFParser(null, true);
        pdfParser.on("pdfParser_dataReady", (pdfData) => {
          const text = pdfParser.getRawTextContent();
          resolve(text);
        });
        pdfParser.on("pdfParser_dataError", (errData) => {
          reject(new Error(errData.parserError));
        });
        pdfParser.parseBuffer(buffer);
      });
    } else {
      resumeText = buffer.toString("utf-8");
    }

    if (!resumeText || resumeText.trim().length === 0) {
      return NextResponse.json(
        { error: "Could not extract text from file" },
        { status: 400 }
      );
    }

    // Call GPT to parse
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY not configured" },
        { status: 500 }
      );
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: PARSE_PROMPT },
          { role: "user", content: resumeText },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI API error: ${err}`);
    }

    const gptData = await response.json();
    const parsed = JSON.parse(gptData.choices[0].message.content);

    // Save to database
    const results = { education: 0, experience: 0, projects: 0, skills: 0 };

    if (parsed.education?.length > 0) {
      const rows = parsed.education.map((edu, i) => ({
        user_id: user.id,
        school: edu.school || "",
        location: edu.location || "",
        degree_type: edu.degree_type || "",
        major: edu.major || "",
        gpa: edu.gpa || null,
        start_date: edu.start_date || null,
        end_date: edu.end_date || null,
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
            company: exp.company || "",
            position: exp.position || "",
            location: exp.location || "",
            type: exp.type || "Full-time",
            start_date: exp.start_date || null,
            end_date: exp.end_date || null,
            currently_working: exp.currently_working || false,
            sort_order: i,
          })
          .select()
          .single();

        if (!error && inserted && exp.bullets?.length > 0) {
          await supabase.from("cv_experience_bullets").insert(
            exp.bullets.map((b, bi) => ({
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
            name: proj.name || "",
            description: proj.description || "",
            start_date: proj.start_date || null,
            end_date: proj.end_date || null,
            currently_working: false,
            sort_order: i,
          })
          .select()
          .single();

        if (!error && inserted && proj.bullets?.length > 0) {
          await supabase.from("cv_project_bullets").insert(
            proj.bullets.map((b, bi) => ({
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
      const skillNames = parsed.skills.map((s) =>
        typeof s === "string" ? s : s.name || ""
      );
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
    console.error("Error parsing resume:", error);
    return NextResponse.json(
      { error: error.message || "Failed to parse resume" },
      { status: 500 }
    );
  }
}
