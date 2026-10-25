import ProfileForm from "@/features/profile/ProfileForm";

export default function ProfilePage() {
  return (
    <div className="flex flex-col w-full min-h-screen py-16 my-10 px-32">
      <h1 className="text-2xl font-semibold text-brand">Profile</h1>
      <div className="px-10">
        <ProfileForm />
      </div>
    </div>
  );
}
