"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { refreshStaleBoards } from "./actions";

// Reads the boards last checked over 12 hours ago, once per page load
export default function StaleRefresher({ staleCount }) {
  const router = useRouter();
  const started = useRef(false);
  const [running, setRunning] = useState(0);

  useEffect(() => {
    if (started.current || staleCount < 1) return;
    started.current = true;
    setRunning(staleCount);
    refreshStaleBoards()
      .catch(() => {})
      .finally(() => { setRunning(0); router.refresh(); });
    // staleCount is read once, on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return running ? <p role="status" className="text-xs text-muted-foreground">Checking {running} {running === 1 ? "board" : "boards"}…</p> : null;
}
