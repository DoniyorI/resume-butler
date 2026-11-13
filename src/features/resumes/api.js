import { postJson } from "@/lib/postJson";

// Client calls to the resume AI Route Handlers; errors are thrown for the caller to toast

// focus "match" tailors bullets to the job; "concise" shortens them (only: the bullets to look at)
export async function reviewBullets({ focus = "match", jobDescription, resumeContent, only }) {
  const data = await postJson("/api/suggest-bullets", { focus, jobDescription, resumeContent, only });
  return data.suggestions || [];
}

export async function rewriteBullet({ text, context, jobDescription }) {
  const data = await postJson("/api/rewrite-bullet", { text, context, jobDescription });
  return data.variants || [];
}

// How the job fits the Master CV, the entries that back it, and what the page could still show.
// { fit, plan, gaps }. Computed locally on the server: no AI.
export function fetchResumeFit({ jobDescription, resumeContent }) {
  return postJson("/api/resume-fit", { jobDescription, resumeContent });
}

// Page count plus the fingerprint of the saved content actually compiled.
export function checkResumePages({ resumeId }) {
  return postJson("/api/resume-pages", { resumeId });
}

export async function countResumePages({ resumeId }) {
  return (await checkResumePages({ resumeId })).pages;
}
