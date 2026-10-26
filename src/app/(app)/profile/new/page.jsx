import ViewSwitch from "@/components/shared/ViewSwitch";
import { requirePageUser } from "@/server/auth";
import { getCvData } from "@/features/cv/data";
import { getProfile } from "@/features/profile/data";
import CareerProfile from "@/features/career-profile/CareerProfile";

export const metadata = { title: "Profile & CV" };

// Redesign under review: replaces /profile and /cv once approved
const VIEWS = [
  { href: "/profile", label: "Classic profile" },
  { href: "/cv", label: "Classic CV" },
  { href: "/profile/new", label: "New" },
];

export default async function CareerProfilePage() {
  const { supabase, user } = await requirePageUser();
  const [profile, cv] = await Promise.all([getProfile(supabase, user), getCvData(supabase, user.id)]);

  return (
    <div className="mx-auto w-full max-w-6xl px-5 pb-16 pt-24 md:px-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Everything here feeds the resumes and cover letters you generate.
        </p>
        <ViewSwitch views={VIEWS} current="/profile/new" />
      </div>
      <CareerProfile profile={profile} cv={cv} />
    </div>
  );
}
