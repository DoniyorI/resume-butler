import "server-only";
import { createClient } from "@supabase/supabase-js";

// This client bypasses row-level security. Use only in trusted server jobs or
// scoped archive RPCs. Derive user_id from auth, never from client input, and
// enforce ownership independently in every query or service-only RPC.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY not configured");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
