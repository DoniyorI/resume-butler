import ResetPasswordForm from "@/features/auth/ResetPasswordForm";
import { requirePageUser } from "@/server/auth";

export const metadata = { title: "Choose a new password" };

// The emailed reset link signs the user in (via /auth/callback) and lands
// here. Without that session (an expired or reused link) it goes to /login.
export default async function ResetPasswordPage() {
  const { user } = await requirePageUser();
  return <ResetPasswordForm email={user.email} />;
}
