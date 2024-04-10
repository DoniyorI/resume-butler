import ProfileForm from "@/components/ProfileForm";

export default function ProfilePage() {
    return (
      <div className="flex md:px-12 lg:px-24  flex-col w-full min-h-screen p-16">
        <h1 className="text-4xl font-bold text-[#559F87]">Profile</h1>
        <p className=" mt-2 mb-6">Please fill in the input boxes below</p>
        <ProfileForm />
      </div>
    );
}
