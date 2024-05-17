"use client";

import { useEffect, useState } from "react";
import { PieChart } from "@mui/x-charts/PieChart";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "@/lib/firebase/config";
import { useRouter } from "next/navigation";
import { useMediaQuery, useTheme } from "@mui/material";
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
  const [data, setData] = useState([]);
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
      const transformedData = getStatusCounts(applications);
      setData(transformedData);
    };

    fetchData();
  }, [user]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Applications Status</CardTitle>
        <CardDescription>A pie chart showing your application status</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center items-center">
          <PieChart
            series={[
              {
                data: data.map((item) => ({ ...item, value: item.value })),
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
  );
};

export default ApplicationPieChart;
