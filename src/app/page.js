import Greeting from "@/components/Greeting";

export default function Home() {
  return (
    <div className='flex flex-col w-full min-h-screen py-16 px-10'>
      <Greeting className="text-4xl font-bold text-[#559F87]"/>
        <p className=" mt-2 mb-6">View your recent job applications here.</p>
    </div>
  );
}
