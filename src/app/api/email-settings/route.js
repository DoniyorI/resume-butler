import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { connectionInputSchema, deleteConnection, getConnection, saveConnection } from "@/server/email/connection";
import { errorResponse, parseJson } from "@/server/http";

// GET - the user's email connection (never includes the password)
export async function GET() {
  try {
    const { supabase, user } = await requireUser();
    return NextResponse.json({ connection: await getConnection(supabase, user.id) });
  } catch (error) {
    return errorResponse(error, "Error fetching email settings");
  }
}

// POST - create or update the connection; the password is encrypted with a server-only key
export async function POST(request) {
  try {
    const { supabase, user } = await requireUser();
    const input = await parseJson(request, connectionInputSchema);
    return NextResponse.json({ connection: await saveConnection(supabase, user.id, input) });
  } catch (error) {
    return errorResponse(error, "Error saving email settings");
  }
}

export async function DELETE() {
  try {
    const { supabase, user } = await requireUser();
    await deleteConnection(supabase, user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "Error deleting email settings");
  }
}
