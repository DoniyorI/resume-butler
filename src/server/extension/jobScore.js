import "server-only";
import { z } from "zod";
import { HttpError } from "@/server/http";
import { scoreResume } from "@/server/ats/score";
import { resumeToText } from "@/server/ats/resumeText";
import { assessFit } from "@/server/fit/assessFit";
import { fitSummary } from "@/server/fit/fitSummary";
import { loadMasterCv } from "@/server/resume/loadCv";
import { cvToResumeItem, readResumeForEditing, skillLines, visibleResumeContent } from "@/features/resumes/resumeDocument";

export const jobScoreInput = z.object({
  jobDescription: z.string().trim().min(40, "Open or paste the full job description before comparing.").max(50000),
  resumeId: z.string().uuid().nullable().default(null),
}).strict();

// How the posting compares with the Master CV (and the selected resume), trimmed
// for the extension. Null if it can't be computed; the keyword score still returns.
async function fitFor(admin, userId, jobDescription, { cv, resumeContent, assess }) {
  try {
    return fitSummary(assess({ jobDescription, cv: cv || (await loadMasterCv(admin, userId)), resumeContent }));
  } catch (error) {
    console.error("Assessing fit for the extension:", error);
    return null;
  }
}

// `assess` is injectable so a failing engine can be tested
export async function getJobScore(admin, userId, input, { assess = assessFit } = {}) {
  let content, source, cv = null;
  if (input.resumeId) {
    const { data, error } = await admin.from("resumes").select("id,title,content")
      .eq("user_id", userId).eq("id", input.resumeId).maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, "This resume is no longer available. Choose another resume.");
    const document = readResumeForEditing(data.content);
    if (document.readOnly) throw new HttpError(409, "Update the app to compare this resume's document format.");
    content = document.content;
    source = { type: "resume", id: data.id, title: String(data.title || "Untitled resume").slice(0, 200) };
  } else {
    cv = await loadMasterCv(admin, userId);
    content = {
      education: cv.education.map(cvToResumeItem.education),
      experience: cv.experience.map(cvToResumeItem.experience),
      projects: cv.projects.map(cvToResumeItem.projects),
      skills: skillLines(cv.skills), certifications: cv.certifications.map(cvToResumeItem.certifications),
      customSections: cv.customSections,
    };
    source = { type: "master-cv", id: null, title: "Master CV" };
  }
  const visible = visibleResumeContent(content);
  if (!resumeToText({ ...visible, header: {} }).trim()) {
    throw new HttpError(422, "Add experience, skills or other resume content before comparing this source.");
  }
  const { keywordScore, totalKeywords, matched, missing } = scoreResume(input.jobDescription, visible);
  const fit = await fitFor(admin, userId, input.jobDescription, {
    cv,
    resumeContent: source.type === "resume" ? content : null,
    assess,
  });
  return { method: "keyword-coverage-v1", score: totalKeywords ? keywordScore : null, totalKeywords, matched, missing, source, fit };
}
