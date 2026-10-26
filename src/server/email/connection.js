import "server-only";
import { z } from "zod";
import { decryptSecret, encryptSecret, isEncrypted } from "@/server/crypto";
import { ALLOWED_IMAP_HOSTS, IMAP_PORT, isAllowedImapHost, normalizeImapHost } from "@/server/email/imapHosts";
import { HttpError } from "@/server/http";

// Everything except app_password. Never select "*" for anything sent to the browser.
export const PUBLIC_CONNECTION_COLUMNS = "id, imap_host, imap_port, email_address, is_active, last_scan_at, created_at";

export const connectionInputSchema = z.object({
  email_address: z.string().trim().email().max(254),
  app_password: z.string().min(1).max(200),
  imap_host: z.string().max(253).optional(),
  imap_port: z.coerce.number().int().optional(),
});

// Validate input that didn't come through parseJson (e.g. a Server Action);
// throws a 400 HttpError with the same message format
export function parseConnectionInput(input) {
  const result = connectionInputSchema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue.path.join(".");
    throw new HttpError(400, field ? `${field}: ${issue.message}` : issue.message);
  }
  return result.data;
}

export async function getConnection(supabase, userId) {
  const { data, error } = await supabase
    .from("email_connections")
    .select(PUBLIC_CONNECTION_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Create or replace the user's IMAP connection. `input` must already match
// connectionInputSchema. Returns the public columns.
export async function saveConnection(supabase, userId, { email_address, app_password, imap_host, imap_port }) {
  const host = normalizeImapHost(imap_host || "imap.gmail.com");
  if (!isAllowedImapHost(host)) {
    throw new HttpError(400, `Unsupported IMAP server. Supported: ${ALLOWED_IMAP_HOSTS.join(", ")}`);
  }
  if (imap_port && imap_port !== IMAP_PORT) {
    throw new HttpError(400, `Only port ${IMAP_PORT} (IMAP over TLS) is supported`);
  }

  const { data, error } = await supabase
    .from("email_connections")
    .upsert(
      {
        user_id: userId,
        email_address,
        app_password: encryptSecret(app_password),
        imap_host: host,
        imap_port: IMAP_PORT,
        is_active: true,
      },
      { onConflict: "user_id" }
    )
    .select(PUBLIC_CONNECTION_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

export async function deleteConnection(supabase, userId) {
  const { error } = await supabase.from("email_connections").delete().eq("user_id", userId);
  if (error) throw error;
}

// The active connection with its password decrypted, for the sync job only.
// Returns null when the user has no active connection.
export async function getConnectionCredentials(supabase, userId) {
  const { data, error } = await supabase
    .from("email_connections")
    .select("imap_host, email_address, app_password")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return {
    host: data.imap_host,
    user: data.email_address,
    password: decryptSecret(data.app_password),
    // Rows saved before encryption was added still hold plaintext
    needsEncryption: !isEncrypted(data.app_password),
  };
}

export async function encryptStoredPassword(supabase, userId, password) {
  const { error } = await supabase
    .from("email_connections")
    .update({ app_password: encryptSecret(password) })
    .eq("user_id", userId);
  if (error) console.error("Could not encrypt legacy email password:", error);
}

export async function markScanned(supabase, userId) {
  await supabase
    .from("email_connections")
    .update({ last_scan_at: new Date().toISOString() })
    .eq("user_id", userId);
}
