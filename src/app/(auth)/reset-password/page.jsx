import { redirect } from "next/navigation";
import ResetPasswordForm from "@/features/auth/ResetPasswordForm";
import { hasRecentRecovery, requirePageUser } from "@/server/auth";

export const metadata = { title: "Choose a new password" };

// The emailed reset link signs the user in (via /auth/callback) and lands
// here. Only a session from that link, in the last few minutes, may set a new
// password; otherwise (an expired link, or just signed in) it goes to /login.
export default async function ResetPasswordPage() {
  const { supabase, user } = await requirePageUser();
  // Signed in some other way, or the link is too old: start over from the email
  if (!(await hasRecentRecovery(supabase))) redirect("/login?error=auth");
  return <ResetPasswordForm email={user.email} />;
}
