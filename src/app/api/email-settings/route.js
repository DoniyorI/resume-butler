import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { ALLOWED_IMAP_HOSTS, IMAP_PORT, isAllowedImapHost, normalizeImapHost } from "@/lib/imapHosts";

// GET - Retrieve the user's email connection (masks password)
export async function GET() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("email_connections")
      .select("id, imap_host, imap_port, email_address, is_active, last_scan_at, created_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ connection: data });
  } catch (error) {
    console.error("Error fetching email settings:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Create or update email connection
export async function POST(request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { email_address, app_password, imap_host, imap_port } = body;

    if (!email_address || !app_password) {
      return NextResponse.json(
        { error: "email_address and app_password are required" },
        { status: 400 }
      );
    }

    const host = normalizeImapHost(imap_host || "imap.gmail.com");
    if (!isAllowedImapHost(host)) {
      return NextResponse.json(
        { error: `Unsupported IMAP server. Supported: ${ALLOWED_IMAP_HOSTS.join(", ")}` },
        { status: 400 }
      );
    }

    if (imap_port && Number(imap_port) !== IMAP_PORT) {
      return NextResponse.json(
        { error: `Only port ${IMAP_PORT} (IMAP over TLS) is supported` },
        { status: 400 }
      );
    }

    // Upsert: create or update
    const { data, error } = await supabase
      .from("email_connections")
      .upsert(
        {
          user_id: user.id,
          email_address,
          app_password,
          imap_host: host,
          imap_port: IMAP_PORT,
          is_active: true,
        },
        { onConflict: "user_id" }
      )
      .select("id, imap_host, imap_port, email_address, is_active, created_at")
      .single();

    if (error) throw error;

    return NextResponse.json({ connection: data });
  } catch (error) {
    console.error("Error saving email settings:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Remove email connection
export async function DELETE() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await supabase
      .from("email_connections")
      .delete()
      .eq("user_id", user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting email settings:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
