import { postJson } from "@/lib/postJson";

// Client calls to the ATS Route Handlers; errors are thrown for the caller to toast

export function scoreResume({ jobDescription, resumeContent }) {
  return postJson("/api/ats-score", { jobDescription, resumeContent });
}

export async function suggestBullets({ jobDescription, resumeContent }) {
  const data = await postJson("/api/suggest-bullets", { jobDescription, resumeContent });
  return data.suggestions || [];
}
