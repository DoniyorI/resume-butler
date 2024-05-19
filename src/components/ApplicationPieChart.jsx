"use client";

import { useEffect, useState } from "react";
import { PieChart } from "@mui/x-charts/PieChart";
import { LineChart } from "@mui/x-charts/LineChart";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "@/lib/firebase/config";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { collection, getDocs } from "firebase/firestore";

const fetchApplicationData = async (userId) => {
  const applicationsCollection = collection(db, `users/${userId}/applications`);
  const applicationsSnapshot = await getDocs(applicationsCollection);
  const applicationsList = applicationsSnapshot.docs.map((doc) => doc.data());
  return applicationsList;
};

const getStatusCounts = (applications) => {
  const statusCounts = {
    Applied: 0,
    Interviewed: 0,
    Pending: 0,
    Rejected: 0,
    Offered: 0,
    Withdrew: 0,
  };

  applications.forEach((app) => {
    if (statusCounts[app.status] !== undefined) {
      statusCounts[app.status]++;
    }
  });

  return Object.keys(statusCounts).map((status) => ({
    label: status,
    value: statusCounts[status],
    color: statusColors[status.toLowerCase()],
  }));
};

const getDateCounts = (applications) => {
  const dateCounts = {};

  applications.forEach((app) => {
    const date = app.date;
    if (date) {
      const timestamp = new Date(date).setHours(0, 0, 0, 0); // Set to start of day
      if (!dateCounts[timestamp]) {
        dateCounts[timestamp] = 0;
      }
      dateCounts[timestamp]++;
    }
  });

  const sortedTimestamps = Object.keys(dateCounts).sort((a, b) => a - b);
  const startDate = new Date(parseInt(sortedTimestamps[0], 10));
  const endDate = new Date(parseInt(sortedTimestamps[sortedTimestamps.length - 1], 10));

  // Generate the complete range of dates
  const dateRange = [];
  for (let dt = startDate; dt <= endDate; dt.setDate(dt.getDate() + 1)) {
    const timestamp = dt.getTime();
    dateRange.push({
      date: timestamp,
      count: dateCounts[timestamp] || 0,
    });
  }

  return dateRange;
};

const statusColors = {
  applied: "#B5DCF2",
  interviewed: "#F3F5A3",
  pending: "#FFFACD",
  rejected: "#F2B5B5",
  offered: "#D8F1AE",
  withdrew: "#D0B5F2",
};

const ApplicationPieChart = () => {
  const [user, loading, error] = useAuthState(auth);
  const [statusData, setStatusData] = useState([]);
  const [dateData, setDateData] = useState([]);
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (error) console.error("Auth error:", error); // Handle possible auth errors
    if (!user) {
      router.push("/login");
      return;
    }

    const fetchData = async () => {
      const applications = await fetchApplicationData(user.uid);
      const statusCounts = getStatusCounts(applications);
      const dateCounts = getDateCounts(applications);
      setStatusData(statusCounts);
      setDateData(dateCounts);
    };

    fetchData();
  }, [user, loading, error, router]);

  // Ensure dateData and statusData are valid
  const validDateData = dateData.filter(item => item.date && !isNaN(item.date));
  const validStatusData = statusData.filter(item => item.value && !isNaN(item.value));

  return (
    <div className="flex flex-col lg:flex-row w-full pt-24 pb-10 px-5 space-x-5">
      <Card className="lg:w-1/2 mb-10 lg:mb-0">
        <CardHeader>
          <CardTitle>Applications Status</CardTitle>
          <CardDescription>A pie chart showing your application status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center items-center px-8">
            <PieChart
              series={[
                {
                  data: validStatusData.map((item) => ({ ...item, value: item.value })),
                  innerRadius: 30,
                  outerRadius: 100,
                  paddingAngle: 5,
                  cornerRadius: 5,
                  startAngle: -90,
                  endAngle: 270,
                  cx: 100,
                  cy: 150,
                },
              ]}
              height={300}
            />
          </div>
        </CardContent>
      </Card>
      <Card className="lg:w-1/2">
        <CardHeader>
          <CardTitle>Applications Over Time</CardTitle>
          <CardDescription>A line chart showing the number of applications over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center items-center">
            <LineChart
              xAxis={[
                {
                  data: validDateData.map((item) => item.date),
                  label: "Date",
                  tickCount: validDateData.length,
                  valueFormatter: (value) => new Date(value).toLocaleDateString(),
                },
              ]}
              yAxis={[
                {
                  tickCount: Math.max(...validDateData.map((item) => item.count)) + 1,
                  tickFormatter: (value) => Math.round(value), // Ensure whole numbers
                  tickInterval: () => 1, // Function returning tick interval of 1
                },
              ]}
              series={[
                {
                  data: validDateData.map((item) => item.count),
                },
              ]}
              width={500}
              height={300}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ApplicationPieChart;
