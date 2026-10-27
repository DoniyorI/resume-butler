import { NextResponse } from "next/server";
import { errorResponse } from "@/server/http";
import { authenticateExtension } from "@/server/extension/tokens";

// Reads the Authorization header on every request; never prerender it
export const dynamic = "force-dynamic";

// The extension checks its token and shows who it's connected as
export async function GET(request) {
  try {
    const { admin, userId } = await authenticateExtension(request);
    const { data, error } = await admin
      .from("profiles")
      .select("first_name, last_name, email")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json({
      name: [data?.first_name, data?.last_name].filter(Boolean).join(" "),
      email: data?.email || "",
    });
  } catch (error) {
    return errorResponse(error, "Extension auth error");
  }
}
