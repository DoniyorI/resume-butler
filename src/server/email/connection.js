import "server-only";
import { z } from "zod";
import { decryptSecret, encryptSecret, isEncrypted } from "@/server/crypto";
import {
  ALLOWED_IMAP_HOSTS,
  IMAP_PORT,
  isAllowedImapHost,
  normalizeImapHost,
} from "@/server/email/imapHosts";
import { revokeGmailToken } from "@/server/email/gmailClient";
import { HttpError } from "@/server/http";

// Everything except app_password and oauth_refresh_token. Never select "*" for anything sent to the browser.
// `provider` (imap or gmail) arrives with migration 023; before it, every connection is IMAP.
const LEGACY_PUBLIC_COLUMNS =
  "id, imap_host, imap_port, email_address, is_active, last_scan_at, created_at, auto_sync, last_auto_sync_at, last_auto_sync_error";
const PUBLIC_CONNECTION_COLUMNS = `${LEGACY_PUBLIC_COLUMNS}, provider`;

export const GMAIL_SETUP_MESSAGE = "Connecting Gmail with Google needs migration 023. Use an app password until it is applied.";

// An unknown column (Postgres 42703 on a read, PostgREST PGRST204 on a write): migration 023 is not applied yet
const isMissingColumn = (error) =>
  ["42703", "PGRST204"].includes(error?.code) && /provider|oauth_refresh_token/.test(error?.message || "");

// Run a select with the 023 columns, and again without them before the migration
async function withProviderFallback(run, legacyColumns, newColumns) {
  const result = await run(`${legacyColumns}, ${newColumns}`);
  if (!result.error || !isMissingColumn(result.error)) return result;
  const legacy = await run(legacyColumns);
  if (legacy.data) legacy.data = { ...legacy.data, provider: "imap", oauth_refresh_token: null };
  return legacy;
}

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
  const { data, error } = await withProviderFallback(
    (columns) => supabase.from("email_connections").select(columns).eq("user_id", userId).maybeSingle(),
    LEGACY_PUBLIC_COLUMNS,
    "provider"
  );
  if (error) throw error;
  if (data) delete data.oauth_refresh_token;
  return data;
}

// Create or replace the user's IMAP connection. `input` must already match
// connectionInputSchema. Returns the public columns.
export async function saveConnection(
  supabase,
  userId,
  { email_address, app_password, imap_host, imap_port }
) {
  const host = normalizeImapHost(imap_host || "imap.gmail.com");
  if (!isAllowedImapHost(host)) {
    throw new HttpError(400, `Unsupported IMAP server. Supported: ${ALLOWED_IMAP_HOSTS.join(", ")}`);
  }
  if (imap_port && imap_port !== IMAP_PORT) {
    throw new HttpError(400, `Only port ${IMAP_PORT} (IMAP over TLS) is supported`);
  }

  const row = {
    user_id: userId,
    email_address,
    app_password: encryptSecret(app_password),
    imap_host: host,
    imap_port: IMAP_PORT,
    is_active: true,
  };
  // Replacing a Gmail connection: revoke its Google access, then store the IMAP row
  const previous = await getStoredRefreshToken(supabase, userId);
  let result = await supabase
    .from("email_connections")
    .upsert({ ...row, provider: "imap", oauth_refresh_token: null }, { onConflict: "user_id" })
    .select(PUBLIC_CONNECTION_COLUMNS)
    .single();
  if (result.error && isMissingColumn(result.error)) {
    result = await supabase.from("email_connections").upsert(row, { onConflict: "user_id" }).select(LEGACY_PUBLIC_COLUMNS).single();
    if (result.data) result.data = { ...result.data, provider: "imap" };
  }
  if (result.error) throw result.error;
  if (previous) await revokeGmailToken(previous);
  return result.data;
}

/**
 * Create or replace the user's connection as Gmail through Google, storing the refresh token encrypted.
 * Throws HttpError(503) with GMAIL_SETUP_MESSAGE before migration 023. Returns the public columns.
 */
export async function saveGmailConnection(supabase, userId, { emailAddress, refreshToken }) {
  const previous = await getStoredRefreshToken(supabase, userId);
  const { data, error } = await supabase
    .from("email_connections")
    .upsert(
      {
        user_id: userId,
        provider: "gmail",
        email_address: emailAddress,
        oauth_refresh_token: encryptSecret(refreshToken),
        app_password: null,
        imap_host: "imap.gmail.com",
        imap_port: IMAP_PORT,
        is_active: true,
        last_auto_sync_error: null,
      },
      { onConflict: "user_id" }
    )
    .select(PUBLIC_CONNECTION_COLUMNS)
    .single();
  if (error && isMissingColumn(error)) throw new HttpError(503, GMAIL_SETUP_MESSAGE);
  if (error) throw error;
  if (previous && previous !== refreshToken) await revokeGmailToken(previous);
  return data;
}

// The decrypted Google refresh token of a Gmail connection, or null (also before migration 023)
async function getStoredRefreshToken(supabase, userId) {
  const { data, error } = await supabase
    .from("email_connections")
    .select("provider, oauth_refresh_token")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || data?.provider !== "gmail" || !data.oauth_refresh_token) return null;
  try {
    return decryptSecret(data.oauth_refresh_token);
  } catch {
    return null;
  }
}

// Disconnecting a Gmail connection also revokes its Google access (best effort)
export async function deleteConnection(supabase, userId) {
  const token = await getStoredRefreshToken(supabase, userId);
  const { error } = await supabase.from("email_connections").delete().eq("user_id", userId);
  if (error) throw error;
  if (token) await revokeGmailToken(token);
}

// The active connection with its password decrypted, for the sync job only.
// Returns null when the user has no active connection.
export async function getConnectionCredentials(supabase, userId) {
  const { data, error } = await withProviderFallback(
    (columns) => supabase.from("email_connections").select(columns).eq("user_id", userId).eq("is_active", true).maybeSingle(),
    "imap_host, email_address, app_password",
    "provider, oauth_refresh_token"
  );
  if (error) throw error;
  if (!data) return null;

  if (data.provider === "gmail") {
    if (!data.oauth_refresh_token) return null;
    return { provider: "gmail", user: data.email_address, refreshToken: decryptSecret(data.oauth_refresh_token), needsEncryption: false };
  }
  return {
    provider: "imap",
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

// Turn the daily auto-sync on or off. Returns the public columns.
export async function setAutoSync(supabase, userId, enabled) {
  const { data, error } = await withProviderFallback(
    (columns) =>
      supabase
        .from("email_connections")
        .update({ auto_sync: enabled, ...(enabled ? { last_auto_sync_error: null } : {}) })
        .eq("user_id", userId)
        .select(columns)
        .maybeSingle(),
    LEGACY_PUBLIC_COLUMNS,
    "provider"
  );
  if (error) throw error;
  if (!data) throw new HttpError(400, "Connect your email first");
  delete data.oauth_refresh_token;
  return data;
}

export async function markScanned(supabase, userId) {
  await supabase
    .from("email_connections")
    .update({ last_scan_at: new Date().toISOString() })
    .eq("user_id", userId);
}
