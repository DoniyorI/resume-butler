import "server-only";

// The user's connected browsers (extension tokens), newest first. Revoked
// ones are left out; the hash never leaves the server.
export async function listExtensionTokens(supabase, userId) {
  const { data, error } = await supabase
    .from("extension_tokens")
    .select("id, name, created_at, last_used_at")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  if (error) {
    // The table comes from migration 008
    console.warn("Could not load extension tokens:", error.message);
    return [];
  }
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
  }));
}
