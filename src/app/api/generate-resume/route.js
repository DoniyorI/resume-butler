import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/auth";
import { errorResponse, parseJson } from "@/server/http";
import { chatJSON } from "@/server/openai";
import { enforceRateLimit } from "@/server/rateLimit";

const RESUME_PROMPT = `Resume Aligner is a CV parser designed to analyze job descriptions and parse input dictionaries containing categories such as education, experience, projects, and skills. Its main function is to select and align entries from the input that best match the specified job requirements for a resume. It should NEVER use the same entry more than once. It strictly preserves the content and structure of the input dictionary, neither adding new items nor altering the existing text.

The output JSON object reflects the structure of the input dictionary, accurately categorizing entries under 'experience', 'projects', and 'skills' as they appear in the input, omitting entries unrelated to the job description so that each "experience" and "projects" category will ALWAYS have THREE entries.

The tool is optimized for API calls, ensuring high responsiveness and adaptability. It delivers responses containing only the output dictionary in a JSON format, structured as described. The output never contains additional commentary or new items and strictly maintains the structure and content of the input. The Response NEEDS to be a JSON object, NO COMMENTARY`;

const SKILLS_PROMPT = `The GPT takes a list of dictionaries containing skills and categorizes these skills into categories. It outputs the results in a JSON dictionary, mapping each category to a list of skill entries. The category should NOT be "skills"`;

function callGPT(prompt, jobDescription, cv) {
  return chatJSON({
    system: "Provide output in valid JSON",
    user: `${prompt}\n${jobDescription}\n${cv}`,
  });
}

const bodySchema = z.object({
  title: z.string().trim().min(1).max(200),
  jobDescription: z.string().min(1).max(20_000),
});

export async function POST(request) {
  try {
    const { supabase, user } = await requireUser();
    const { title, jobDescription } = await parseJson(request, bodySchema);
    await enforceRateLimit(supabase, "generate-resume");

    // Fetch user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    // Fetch CV data
    const [experienceRes, projectsRes, educationRes, skillsRes] =
      await Promise.all([
        supabase
          .from("cv_experience")
          .select("*, cv_experience_bullets(*)")
          .eq("user_id", user.id),
        supabase
          .from("cv_projects")
          .select("*, cv_project_bullets(*)")
          .eq("user_id", user.id),
        supabase.from("cv_education").select("*").eq("user_id", user.id),
        supabase.from("cv_skills").select("*").eq("user_id", user.id),
      ]);

    const cvData = {
      education: educationRes.data || [],
      experience: (experienceRes.data || []).map((exp) => ({
        ...exp,
        description: (exp.cv_experience_bullets || []).map((b) => b.content),
      })),
      projects: (projectsRes.data || []).map((proj) => ({
        ...proj,
        description: (proj.cv_project_bullets || []).map((b) => b.content),
      })),
      skills: (skillsRes.data || []).map((s) => ({ name: s.name, category: s.category })),
    };

    // Call GPT to align resume
    const alignedCV = await callGPT(
      RESUME_PROMPT,
      jobDescription,
      JSON.stringify(cvData)
    );

    // Categorize skills
    const skillNames = (alignedCV.skills || []).map((s) => s.name || s);
    const categorizedSkills = await callGPT(
      SKILLS_PROMPT,
      "",
      JSON.stringify(skillNames)
    );

    // Create resume
    const resumeContent = {
      education: alignedCV.education || [],
      experience: alignedCV.experience || [],
      projects: alignedCV.projects || [],
      skills: categorizedSkills,
      header: {
        name: `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim(),
        email: profile?.email || "",
        phone: profile?.phone || "",
        linkedin: profile?.linkedin || "",
        github: profile?.github || "",
      },
    };

    const { data: resume, error } = await supabase
      .from("resumes")
      .insert({
        user_id: user.id,
        title,
        content: resumeContent,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ resumeId: resume.id });
  } catch (error) {
    return errorResponse(error, "Error generating resume");
  }
}
