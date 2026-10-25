import "server-only";
import { createClient } from "@/lib/supabase/server";
import { HttpError } from "@/server/http";

// Returns the Supabase client and verified user for the current request.
// getUser() validates the session with Supabase, unlike getSession().
export async function requireUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new HttpError(401, "Unauthorized");
  return { supabase, user };
}
