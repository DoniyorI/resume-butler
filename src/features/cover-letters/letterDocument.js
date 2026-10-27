// Shape of cover_letters.content (JSONB), shared by the editors, their Server
// Actions, data.js and the PDF renderer:
// { header, date, recipient, greeting, body, signOff, target }
// - body is stored as Draft.js raw content ({ blocks: [{ text }] }), the format
//   letters were first saved in; the editor reads and writes it as paragraphs.
// - target is the job the letter is for, as on resumes.

export const HEADER_FIELDS = ["name", "contactEmail", "contactPhone", "linkedin", "portfolio"];

export const DEFAULT_GREETING = "Dear Hiring Manager,";
export const DEFAULT_SIGN_OFF = "Sincerely,";

export const EMPTY_TARGET = { jobDescription: "", applicationId: null, company: "", role: "" };

const text = (value) => (typeof value === "string" ? value : "");

// Very old rows stored content as a JSON string
export function parseStoredContent(content) {
  if (typeof content !== "string") return content && typeof content === "object" ? content : {};
  try {
    return JSON.parse(content) || {};
  } catch {
    return {};
  }
}

// Draft.js blocks -> paragraphs. Blank blocks only separate paragraphs.
export function paragraphsFromDraft(raw) {
  const blocks = Array.isArray(raw?.blocks) ? raw.blocks : [];
  return blocks.map((block) => text(block?.text).trim()).filter(Boolean);
}

// Paragraphs -> Draft.js raw content, one block per paragraph
export function paragraphsToDraft(paragraphs) {
  return { blocks: paragraphs.map((paragraph, index) => draftBlock(`p${index}`, paragraph)), entityMap: {} };
}

function draftBlock(key, value) {
  return { key, text: value, type: "unstyled", depth: 0, inlineStyleRanges: [], entityRanges: [], data: {} };
}

function normalizeTarget(target) {
  if (!target || typeof target !== "object") return EMPTY_TARGET;
  return {
    jobDescription: text(target.jobDescription),
    applicationId: typeof target.applicationId === "string" ? target.applicationId : null,
    company: text(target.company),
    role: text(target.role),
  };
}

/**
 * Stored content -> the letter editor's document. `fallbackHeader` fills
 * empty header fields (from the profile).
 */
export function normalizeLetter(content, fallbackHeader = {}) {
  const source = parseStoredContent(content);
  const saved = source.header && typeof source.header === "object" ? source.header : {};
  const header = {};
  for (const field of HEADER_FIELDS) header[field] = text(saved[field]) || text(fallbackHeader[field]);

  return {
    header,
    date: typeof source.date === "string" ? source.date : null,
    recipient: {
      name: text(source.recipient?.name),
      company: text(source.recipient?.company),
    },
    greeting: text(source.greeting) || DEFAULT_GREETING,
    paragraphs: paragraphsFromDraft(source.body),
    signOff: text(source.signOff) || DEFAULT_SIGN_OFF,
    target: normalizeTarget(source.target),
  };
}

// The letter editor's document -> stored content
export function letterToContent(letter) {
  return {
    header: letter.header,
    date: letter.date,
    recipient: letter.recipient,
    greeting: letter.greeting,
    body: paragraphsToDraft(letter.paragraphs.filter((p) => p.trim())),
    signOff: letter.signOff,
    target: letter.target,
  };
}
