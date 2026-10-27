import "server-only";
import { NextResponse } from "next/server";

// An error whose message is safe to show to the client
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function jsonError(message, status) {
  return NextResponse.json({ error: message }, { status });
}

// Log the real error server-side and return only a safe message to the client
export function errorResponse(error, context) {
  if (error instanceof HttpError) {
    return jsonError(error.message, error.status);
  }
  console.error(`${context}:`, error);
  return jsonError("Something went wrong. Please try again.", 500);
}

// Read a JSON body with a size cap and validate it against a zod schema
export async function parseJson(request, schema, { maxBytes = 100_000 } = {}) {
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > maxBytes) throw new HttpError(413, "Request is too large");

  const text = await request.text();
  if (text.length > maxBytes) throw new HttpError(413, "Request is too large");

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue.path.join(".");
    throw new HttpError(400, field ? `${field}: ${issue.message}` : issue.message);
  }
  return result.data;
}

// Content-Disposition for a download named after a document title, which
// can't break out of the header (only word characters, spaces, dots, dashes)
export function attachmentHeader(title, extension, fallback = "resume") {
  const base =
    (title || fallback)
      .replace(/[^\w .-]/g, "")
      .trim()
      .slice(0, 100) || fallback;
  const filename = `${base}.${extension}`;
  return `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
