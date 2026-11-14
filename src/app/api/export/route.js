import { requireUser } from "@/server/auth";
import { errorResponse } from "@/server/http";
import { enforceRateLimit } from "@/server/rateLimit";
import { applicationsCsv, exportJsonChunks } from "@/server/export/exportData";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// GET /api/export          every row the account holds, as streamed JSON
// GET /api/export?format=csv   the applications as CSV
export async function GET(request) {
  try {
    const { supabase, user } = await requireUser();
    await enforceRateLimit(supabase, "export-data");
    const now = new Date();
    const date = now.toISOString().slice(0, 10);

    if (new URL(request.url).searchParams.get("format") === "csv") {
      const csv = await applicationsCsv(supabase, user.id);
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="resume-butler-applications-${date}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const chunks = exportJsonChunks(supabase, user.id, { now });
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      async pull(controller) {
        try {
          const { value, done } = await chunks.next();
          if (done) controller.close();
          else controller.enqueue(encoder.encode(value));
        } catch (error) {
          console.error("Error streaming data export:", error?.code || "unknown");
          controller.error(error);
        }
      },
      async cancel() {
        await chunks.return();
      },
    });
    return new Response(body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="resume-butler-export-${date}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return errorResponse(error, "Error exporting data");
  }
}
