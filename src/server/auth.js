import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HttpError } from "@/server/http";

// For Server Components: returns the Supabase client and user, or sends the
// visitor to /login. (app)/layout.js already guards these pages; this keeps
// each page self-contained.
export async function requirePageUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  return { supabase, user };
}

// For Route Handlers and Server Actions: returns the Supabase client and verified user,
// or throws a 401 HttpError.
// getUser() validates the session with Supabase, unlike getSession().
export async function requireUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new HttpError(401, "Unauthorized");
  return { supabase, user };
}
