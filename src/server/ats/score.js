import { visibleResumeContent } from "@/features/resumes/resumeDocument";
import "server-only";
import { analyzeBullets } from "@/server/ats/bullets";
import { extractKeywords, findInResume } from "@/server/ats/keywords";
import { resumeToText } from "@/server/ats/resumeText";
import { checkSections } from "@/server/ats/sections";

function percentPresent(checks, whenEmpty) {
  if (checks.length === 0) return whenEmpty;
  return Math.round((checks.filter((c) => c.present).length / checks.length) * 100);
}

// Heuristic ATS score (no AI) for a resume's content against a job description
export function scoreResume(jobDescription, value) {
  const resumeContent = visibleResumeContent(value);
  const keywords = extractKeywords(jobDescription);
  const resumeText = resumeToText(resumeContent);

  const matched = [];
  const missing = [];
  for (const keyword of keywords) {
    (findInResume(keyword, resumeText) ? matched : missing).push(keyword);
  }

  const totalKeywords = keywords.length;
  const keywordScore = totalKeywords > 0 ? Math.round((matched.length / totalKeywords) * 100) : 0;

  const sectionChecks = checkSections(resumeContent);
  const sectionScore = percentPresent(
    sectionChecks.filter((c) => c.category === "sections"),
    0
  );
  const qualityScore = percentPresent(
    sectionChecks.filter((c) => c.category === "quality"),
    100
  );

  const overallScore = Math.round(keywordScore * 0.5 + sectionScore * 0.2 + qualityScore * 0.3);

  return {
    overallScore,
    keywordScore,
    sectionScore,
    qualityScore,
    totalKeywords,
    matched,
    missing,
    sectionChecks,
    bulletFeedback: analyzeBullets(resumeContent),
  };
}
