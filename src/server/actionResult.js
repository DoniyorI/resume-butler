import "server-only";
import { HttpError } from "@/server/http";

/**
 * Run a Server Action body and return { ok: true, data } or a user-safe
 * { ok: false, error }. HttpError messages are shown as-is; anything else is
 * logged and replaced with a generic message.
 */
export async function runAction(context, body) {
  try {
    return { ok: true, data: await body() };
  } catch (error) {
    if (error instanceof HttpError) return { ok: false, error: error.message, status: error.status };
    console.error(`${context}:`, error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/**
 * Validate Server Action input with a zod schema, throwing a 400 HttpError on
 * failure. Pass { withField: true } when the schema uses zod's default
 * messages, so the error names the field ("company: String must contain...").
 */
export function parseInput(schema, input, { withField = false } = {}) {
  const result = schema.safeParse(input);
  if (result.success) return result.data;

  const issue = result.error.issues[0];
  const field = issue.path.filter((part) => typeof part === "string").join(".");
  throw new HttpError(400, withField && field ? `${field}: ${issue.message}` : issue.message);
}
