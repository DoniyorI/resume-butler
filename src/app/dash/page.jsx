import ApplicationPieChart from '@/components/ApplicationPieChart';

const DashboardPage = () => {
  return (
    <div className="flex flex-col w-full min-h-screen pt-32 px-5 md:pt-24 md:pb-10 md:px-10">
      <h1 className="text-2xl font-semibold text-[#559F87]">Dashboard</h1>
        <ApplicationPieChart/>    
    </div>
  );
};

export default DashboardPage;
