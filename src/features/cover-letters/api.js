import { postJson } from "@/lib/postJson";

// Client calls to the cover letter Route Handlers; errors are thrown for the caller to toast

// { paragraphs, highlights, unsupported }
export function draftCoverLetter({ jobDescription, companyName, role, tone, length }) {
  return postJson(
    "/api/generate-cover-letter",
    { jobDescription, companyName, role, tone, length },
    "Failed to draft the cover letter"
  );
}

export async function rewriteParagraph({ text, jobDescription }) {
  const data = await postJson("/api/rewrite-paragraph", { text, jobDescription });
  return data.variants || [];
}

export async function countLetterPages({ coverLetterId }) {
  const data = await postJson("/api/cover-letter-pages", { coverLetterId });
  return data.pages;
}
