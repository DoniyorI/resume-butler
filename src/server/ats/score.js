import { visibleResumeContent } from "@/features/resumes/resumeDocument";
import "server-only";
import { analyzeBullets } from "@/server/ats/bullets";
import { extractKeywords, extractYearsRequirement, findInResume } from "@/server/ats/keywords";
import { resumeToText } from "@/server/ats/resumeText";
import { checkSections } from "@/server/ats/sections";
import { matchSkills } from "@/server/ats/skills";

const WEIGHTS = { keywordScore: 0.5, sectionScore: 0.2, qualityScore: 0.3 };

// Share of checks that pass, or null when there is nothing to check
function percentPresent(checks) {
  if (checks.length === 0) return null;
  return Math.round((checks.filter((c) => c.present).length / checks.length) * 100);
}

// Weighted mean of the components that were rated, renormalised over them
function weightedMean(scores) {
  let total = 0;
  let weight = 0;
  for (const [key, w] of Object.entries(WEIGHTS)) {
    if (typeof scores[key] !== "number") continue;
    total += scores[key] * w;
    weight += w;
  }
  return weight > 0 ? Math.round(total / weight) : null;
}

function educationToText(education) {
  return (education || [])
    .map((edu) => [edu.degreeType || edu.degree_type, edu.major, edu.school].filter(Boolean).join(" "))
    .join("\n");
}

/**
 * Heuristic ATS score (no AI) for a resume's content against a job description.
 * status: "empty" (no visible body content; the header is not content),
 * "no-keywords" (the posting names no recognised skill), or "ok". A score is
 * null when it was not rated, never a stand-in 0 or 100.
 */
export function scoreResume(jobDescription, value) {
  const resumeContent = visibleResumeContent(value);
  const keywords = extractKeywords(jobDescription);
  const resumeText = resumeToText(resumeContent);
  const bodyText = resumeToText({ ...resumeContent, header: {} }).trim();

  const options = { educationText: educationToText(resumeContent.education), skills: matchSkills(resumeText, { technical: true }) };
  const matched = [];
  const missing = [];
  for (const keyword of keywords) {
    (findInResume(keyword, resumeText, options) ? matched : missing).push(keyword);
  }

  const totalKeywords = keywords.length;
  const keywordScore = totalKeywords > 0 ? Math.round((matched.length / totalKeywords) * 100) : null;

  const sectionChecks = checkSections(resumeContent);
  const sectionScore = percentPresent(sectionChecks.filter((c) => c.category === "sections"));
  const qualityScore = percentPresent(sectionChecks.filter((c) => c.category === "quality"));

  const status = !bodyText ? "empty" : totalKeywords === 0 ? "no-keywords" : "ok";
  const overallScore = status === "ok" ? weightedMean({ keywordScore, sectionScore, qualityScore }) : null;

  return {
    status,
    overallScore,
    keywordScore,
    sectionScore,
    qualityScore,
    totalKeywords,
    matched,
    missing,
    yearsRequired: extractYearsRequirement(jobDescription),
    sectionChecks,
    bulletFeedback: analyzeBullets(resumeContent),
  };
}
