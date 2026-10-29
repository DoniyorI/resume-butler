import { NextResponse } from "next/server";
import { authenticateExtension } from "@/server/extension/tokens";
import { autofillSelectionInput, getAutofillContext, resolveAutofillSources } from "@/server/extension/autofill";
import { errorResponse, parseJson } from "@/server/http";

const headers = { "Cache-Control": "no-store" };

export async function GET(request) {
  try {
    const { admin, userId } = await authenticateExtension(request);
    return NextResponse.json(await getAutofillContext(admin, userId), { headers });
  } catch (error) { return errorResponse(error, "Extension autofill choices"); }
}

export async function POST(request) {
  try {
    const { admin, userId } = await authenticateExtension(request);
    const input = await parseJson(request, autofillSelectionInput, { maxBytes: 8000 });
    return NextResponse.json(await resolveAutofillSources(admin, userId, input), { headers });
  } catch (error) { return errorResponse(error, "Extension autofill review"); }
}
