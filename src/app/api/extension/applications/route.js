import { NextResponse } from "next/server";
import { errorResponse, parseJson } from "@/server/http";
import { recordApplication, recordApplicationInput } from "@/server/extension/applications";
import { authenticateExtension } from "@/server/extension/tokens";

// The extension saw the user submit an application: add it to the tracker
// (or fill in the one already tracked). Body: recordApplicationInput.
export async function POST(request) {
  try {
    const { admin, userId } = await authenticateExtension(request);
    const input = await parseJson(request, recordApplicationInput, { maxBytes: 120_000 });
    const result = await recordApplication(admin, userId, input);
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    return errorResponse(error, "Extension application error");
  }
}
