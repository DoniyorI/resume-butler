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

// { content, picks }, or { content: null } when the master CV is empty
export function tailorFromCv({ jobDescription }) {
  return postJson("/api/tailor-resume", { jobDescription });
}

// Page count plus the fingerprint of the saved content actually compiled.
export function checkResumePages({ resumeId }) {
  return postJson("/api/resume-pages", { resumeId });
}

export async function countResumePages({ resumeId }) {
  return (await checkResumePages({ resumeId })).pages;
}
