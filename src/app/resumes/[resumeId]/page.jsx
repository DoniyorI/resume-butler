export default function Page({ params }) {
  //Call Firebase for resume data
  return (
    <div>
      <div className="flex flex-col w-full min-h-screen py-10 px-10">
        <h1 className="text-3xl font-medium text-[#559F87]">Resume: {params.resumeId}</h1>
      </div>
    </div>
  );
}
