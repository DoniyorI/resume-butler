import ProfileForm from "@/components/ProfileForm";

export default function ProfilePage() {
  return (
    <div className="flex flex-col w-full min-h-screen py-16 px-10 my-10">
      <h1 className="text-2xl font-semibold text-[#559F87]">Profile</h1>
      <div className="mx-4">
      <ProfileForm/>
      </div>
    </div>
  );
}
