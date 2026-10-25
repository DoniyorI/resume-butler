import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/auth";
import { encryptSecret } from "@/server/crypto";
import { ALLOWED_IMAP_HOSTS, IMAP_PORT, isAllowedImapHost, normalizeImapHost } from "@/server/email/imapHosts";
import { HttpError, errorResponse, parseJson } from "@/server/http";

const PUBLIC_COLUMNS = "id, imap_host, imap_port, email_address, is_active, last_scan_at, created_at";

const bodySchema = z.object({
  email_address: z.string().trim().email().max(254),
  app_password: z.string().min(1).max(200),
  imap_host: z.string().max(253).optional(),
  imap_port: z.coerce.number().int().optional(),
});

// GET - Retrieve the user's email connection (never returns the password)
export async function GET() {
  try {
    const { supabase, user } = await requireUser();

    const { data, error } = await supabase
      .from("email_connections")
      .select(PUBLIC_COLUMNS)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ connection: data });
  } catch (error) {
    return errorResponse(error, "Error fetching email settings");
  }
}

// POST - Create or update email connection
export async function POST(request) {
  try {
    const { supabase, user } = await requireUser();
    const { email_address, app_password, imap_host, imap_port } = await parseJson(request, bodySchema);

    const host = normalizeImapHost(imap_host || "imap.gmail.com");
    if (!isAllowedImapHost(host)) {
      throw new HttpError(400, `Unsupported IMAP server. Supported: ${ALLOWED_IMAP_HOSTS.join(", ")}`);
    }
    if (imap_port && imap_port !== IMAP_PORT) {
      throw new HttpError(400, `Only port ${IMAP_PORT} (IMAP over TLS) is supported`);
    }

    // Upsert: create or update. The password is encrypted with a server-only key.
    const { data, error } = await supabase
      .from("email_connections")
      .upsert(
        {
          user_id: user.id,
          email_address,
          app_password: encryptSecret(app_password),
          imap_host: host,
          imap_port: IMAP_PORT,
          is_active: true,
        },
        { onConflict: "user_id" }
      )
      .select(PUBLIC_COLUMNS)
      .single();

    if (error) throw error;

    return NextResponse.json({ connection: data });
  } catch (error) {
    return errorResponse(error, "Error saving email settings");
  }
}

// DELETE - Remove email connection
export async function DELETE() {
  try {
    const { supabase, user } = await requireUser();

    const { error } = await supabase
      .from("email_connections")
      .delete()
      .eq("user_id", user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "Error deleting email settings");
  }
}
