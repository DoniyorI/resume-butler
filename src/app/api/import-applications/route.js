import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth";
import { HttpError, errorResponse } from "@/server/http";
import { parseInput } from "@/server/actionResult";
import { enforceRateLimit } from "@/server/rateLimit";
import { planImport } from "@/server/applications/importPlan";
import { commitImport, loadExistingForImport } from "@/server/applications/importApplications";

export const maxDuration = 60;

const MAX_BYTES = 1024 * 1024;
const TOO_LARGE = "File is too large (max 1 MB)";
const NOT_CSV = "This does not look like a CSV file. Export your sheet as CSV and try again.";
const DAY_MS = 24 * 60 * 60 * 1000;

const column = z.number().int().min(0).max(39).nullable();
const optionsSchema = z.object({
  mapping: z
    .object({
      company: column, role: column, status: column, appliedDate: column, location: column,
      link: column, pay: column, workplace: column, employmentType: column, notes: column,
    })
    .partial()
    .optional(),
  dateOrder: z.enum(["mdy", "dmy"]).optional(),
  undated: z.enum(["skip", "today"]).optional(),
  includeDuplicates: z.boolean().optional(),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// The viewer's local date, if it is within a day of the server's UTC date
function resolveToday(claimed) {
  const server = new Date().toISOString().slice(0, 10);
  const time = claimed ? Date.parse(`${claimed}T00:00:00Z`) : NaN;
  return Number.isFinite(time) && Math.abs(time - Date.parse(`${server}T00:00:00Z`)) <= DAY_MS ? claimed : server;
}

export async function POST(request) {
  try {
    const { supabase, user } = await requireUser();

    // Reject oversized uploads before buffering the multipart body
    if (Number(request.headers.get("content-length") || 0) > MAX_BYTES + 10_000) throw new HttpError(413, TOO_LARGE);
    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file.text !== "function") throw new HttpError(400, "No file provided");
    if (file.size > MAX_BYTES) throw new HttpError(413, TOO_LARGE);

    const mode = form.get("mode");
    if (mode !== "preview" && mode !== "commit") throw new HttpError(400, "Unknown mode");
    let raw = {};
    try {
      raw = JSON.parse(String(form.get("options") || "{}"));
    } catch {
      throw new HttpError(400, "Invalid options");
    }
    const options = parseInput(optionsSchema, raw, { withField: true });

    const text = await file.text();
    if (text.includes("\u0000")) throw new HttpError(400, NOT_CSV);

    if (mode === "commit") await enforceRateLimit(supabase, "import-applications");

    const existing = await loadExistingForImport(supabase, user.id);
    const plan = planImport({ text, options, existing, today: resolveToday(options.today) });

    if (mode === "preview") {
      const problems = plan.rows
        .filter((row) => row.outcome === "error" || row.outcome === "undated")
        .slice(0, 50)
        .map((row) => ({ line: row.line, reason: row.reason }));
      return NextResponse.json({ ...plan, rows: plan.rows.slice(0, 50), problems });
    }

    if (plan.needsMapping) throw new HttpError(400, "Choose which column holds the company name.");
    const result = await commitImport(supabase, user.id, plan);
    revalidatePath("/applications");
    revalidatePath("/");
    return NextResponse.json({
      imported: result.imported,
      failed: result.failed,
      notAttempted: result.notAttempted,
      skipped: { duplicates: plan.totals.duplicates + result.duplicates, undated: plan.totals.undated, errors: plan.totals.errors },
      truncated: plan.totals.truncated,
      ids: result.ids,
    });
  } catch (error) {
    return errorResponse(error, "Error importing applications");
  }
}
