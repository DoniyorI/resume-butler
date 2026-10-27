import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { HttpError } from "@/server/http";
import { createAdminClient } from "@/server/supabaseAdmin";

// Recognizable in logs and secret scanners; the rest is 32 random bytes
const TOKEN_PREFIX = "rbx_";
const MAX_ACTIVE_TOKENS = 5;
// Only write last_used_at this often, so busy extensions don't write on every request
const LAST_USED_RESOLUTION_MS = 60 * 60 * 1000;

export function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Create a token for the signed-in user. `supabase` is their own client (RLS
 * applies). Returns { id, token }; the token is shown once and only its hash
 * is stored.
 */
export async function createExtensionToken(supabase, userId) {
  const { count, error: countError } = await supabase
    .from("extension_tokens")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("revoked_at", null);
  if (countError) throw countError;
  if (count >= MAX_ACTIVE_TOKENS) {
    throw new HttpError(400, `You can have ${MAX_ACTIVE_TOKENS} connected browsers. Disconnect one first.`);
  }

  const token = TOKEN_PREFIX + randomBytes(32).toString("base64url");
  const { data, error } = await supabase
    .from("extension_tokens")
    .insert({ user_id: userId, token_hash: hashToken(token) })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id, token };
}

/**
 * Authenticate a request from the extension ("Authorization: Bearer rbx_...").
 * Returns { admin, userId, tokenId }. `admin` bypasses RLS, so every query the
 * caller makes with it must filter by userId. Throws a 401 HttpError otherwise.
 */
export async function authenticateExtension(request) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token.startsWith(TOKEN_PREFIX) || token.length > 100) {
    throw new HttpError(401, "Connect the extension to your Resume Butler account");
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("extension_tokens")
    .select("id, user_id, last_used_at, revoked_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (error) throw error;
  if (!data || data.revoked_at) {
    throw new HttpError(401, "This browser was disconnected. Connect the extension again.");
  }

  if (!data.last_used_at || Date.now() - new Date(data.last_used_at).getTime() > LAST_USED_RESOLUTION_MS) {
    await admin.from("extension_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  }
  return { admin, userId: data.user_id, tokenId: data.id };
}
