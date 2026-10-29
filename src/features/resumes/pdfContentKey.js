import { HEADER_FIELDS, visibleResumeContent } from "@/features/resumes/resumeDocument";

// Postgres jsonb may reorder object keys. Normalize and sort before identifying
// the exact document used for compilation; targeting metadata is not printed.
export function printableResumeKey(value) {
  const { target: _target, revision: _revision, schemaVersion: _schemaVersion, ...content } = visibleResumeContent(value);
  content.header = Object.fromEntries(HEADER_FIELDS.map(field => [field, content.header[field] || ""]));
  const sort = item => Array.isArray(item) ? item.map(sort)
    : item && typeof item === "object" ? Object.fromEntries(Object.keys(item).sort()
      .filter(key => item[key] !== undefined && key !== "id").map(key => [key, sort(item[key])])) : item;
  // Section IDs determine the order, so retain them even though item IDs do not print.
  const order = content.order.map(s => ({ id: s.id, title: s.title, type: s.type }));
  return JSON.stringify({ order, content: sort(content) });
}

export async function hashPdfContentKey(key) {
  const bytes = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}
