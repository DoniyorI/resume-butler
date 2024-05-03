import ApplicationTable from "@/components/ApplicationTable";
export default function Applications() {
  return (
    <div className="flex flex-col w-full min-h-screen py-16 px-10 my-10">
      <h1 className="text-2xl font-semibold text-[#559F87]">
        Your Applications
      </h1>
      <ApplicationTable />
    </div>
  );
}
