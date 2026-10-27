import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, errorResponse } from "@/server/http";
import { undoApplication } from "@/server/extension/applications";
import { authenticateExtension } from "@/server/extension/tokens";

// Undo from the extension's "Added to Resume Butler" notice
export async function DELETE(request, { params }) {
  try {
    const { admin, userId } = await authenticateExtension(request);
    const id = z.string().uuid().safeParse(params.id);
    if (!id.success) throw new HttpError(400, "Invalid application");
    return NextResponse.json(await undoApplication(admin, userId, id.data));
  } catch (error) {
    return errorResponse(error, "Extension undo error");
  }
}
