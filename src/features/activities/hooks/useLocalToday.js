"use client";

import { useEffect, useState } from "react";
import { localDateKey } from "@/features/activities/kinds";

// The viewer's calendar day as "YYYY-MM-DD", or null until mounted: the
// server doesn't know the viewer's time zone, so anything that depends on
// "today" (overdue, due today) renders after hydration.
export default function useLocalToday() {
  const [today, setToday] = useState(null);
  useEffect(() => {
    setToday(localDateKey());
  }, []);
  return today;
}
