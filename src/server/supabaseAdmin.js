import "server-only";
import { createClient } from "@supabase/supabase-js";

// Supabase client with the service role key: it bypasses row-level security,
// so it's only for jobs with no signed-in user (the daily email sync). Every
// query made with it must filter by user_id itself.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY not configured");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
