import ApplicationTable from "@/components/table";
export default function Applications() {
  return(
    <div className='flex flex-col w-full min-h-screen py-16 px-10'>
      <h1 className="text-4xl font-bold text-[#559F87]">Your Applications</h1>
        <p className=" mt-2 mb-6">View your recent job applications here.</p>
      <ApplicationTable />
    </div>
  );
}