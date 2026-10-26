import { requirePageUser } from "@/server/auth";
import { getProfile } from "@/features/profile/data";
import ProfileForm from "@/features/profile/ProfileForm";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const { supabase, user } = await requirePageUser();
  const profile = await getProfile(supabase, user);

  return (
    <div className="flex flex-col w-full min-h-screen py-16 my-10 px-32">
      <h1 className="text-2xl font-semibold text-brand">Profile</h1>
      <div className="px-10">
        <ProfileForm initialProfile={profile} />
      </div>
    </div>
  );
}
