import { requirePageUser } from "@/server/auth";
import { getCvData } from "@/features/cv/data";
import { getProfile } from "@/features/profile/data";
import CareerProfile from "@/features/profile/CareerProfile";

export const metadata = { title: "Profile & CV" };

// Profile and master CV on one page (/cv redirects here)
export default async function ProfilePage() {
  const { supabase, user } = await requirePageUser();
  const [profile, cv] = await Promise.all([getProfile(supabase, user), getCvData(supabase, user.id)]);

  return (
    <div className="mx-auto w-full max-w-6xl px-5 pb-16 pt-24 md:px-8">
      <p className="mb-8 text-sm text-muted-foreground">
        Everything here feeds the resumes and cover letters you generate.
      </p>
      <CareerProfile profile={profile} cv={cv} />
    </div>
  );
}
