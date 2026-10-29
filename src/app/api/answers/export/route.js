import { requireUser } from "@/server/auth";
import { answerError } from "@/server/answers/service";
import { attachmentHeader, errorResponse } from "@/server/http";

export async function GET() {
  try {
    const { supabase } = await requireUser();
    // One SQL statement captures current answers and history in the same snapshot.
    // The scalar JSON result is not subject to a table-list row limit.
    const { data, error } = await supabase.rpc("export_reusable_answers");
    answerError(error);
    if (!data || data.schemaVersion !== 1 || !Array.isArray(data.answers) || !Array.isArray(data.versions)) throw new Error("Invalid answer export result");
    const json = JSON.stringify(data, null, 2), encoder = new TextEncoder();
    let offset = 0;
    const body = new ReadableStream({ pull(controller) {
      if (offset >= json.length) { controller.close(); return; }
      // Avoid splitting a UTF-16 surrogate pair across encoded chunks.
      let end = Math.min(offset + 32768, json.length);
      if (end < json.length && json.charCodeAt(end - 1) >= 0xd800 && json.charCodeAt(end - 1) <= 0xdbff) end--;
      controller.enqueue(encoder.encode(json.slice(offset, end))); offset = end;
    } });
    return new Response(body, { headers: { "Content-Type": "application/json", "Content-Disposition": attachmentHeader("answer-library", "json"), "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error, "exportAnswerLibrary"); }
}
