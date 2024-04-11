import Greeting from "@/components/Greeting";

export default function Home() {
  return (
    <div className='flex flex-col w-full min-h-screen py-10 px-10'>
      <Greeting className="text-2xl font-semibold text-[#559F87]"/>
        <p className=" mt-2 mb-6">Let's tailor your resume and cover letter so you can get that interview </p>

      
    </div>
  );
}
