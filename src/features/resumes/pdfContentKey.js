import { HEADER_FIELDS, normalizeResumeContent } from "@/features/resumes/resumeDocument";

// Postgres jsonb may reorder object keys. Normalize and sort before identifying
// the exact document used for compilation; targeting metadata is not printed.
export function printableResumeKey(value) {
  const { target: _target, ...content } = normalizeResumeContent(value);
  content.header = Object.fromEntries(HEADER_FIELDS.map(field => [field, content.header[field] || ""]));
  content.order = content.order.filter(section => !section.hidden);
  const visible = new Set(content.order.map(section => section.id));
  for (const id of ["education", "experience", "projects", "skills"]) {
    if (!visible.has(id)) content[id] = [];
  }
  const sort = item => Array.isArray(item) ? item.map(sort)
    : item && typeof item === "object" ? Object.fromEntries(Object.keys(item).sort()
      .filter(key => item[key] !== undefined).map(key => [key, sort(item[key])])) : item;
  return JSON.stringify(sort(content));
}

export async function hashPdfContentKey(key) {
  const bytes = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}
