"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import ConnectionCard from "@/features/email-sync/ConnectionCard";
import ScanResults from "@/features/email-sync/ScanResults";

// `guide` and `history` are server-rendered and passed in as slots
export default function EmailSync({ connection, guide, history }) {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [scanResults, setScanResults] = useState(null);

  // A Route Handler rather than a Server Action: the scan is long-running and
  // the applications table calls the same endpoint
  const handleScan = async () => {
    setScanning(true);
    setScanResults(null);
    try {
      const res = await fetch("/api/scan-emails", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setScanResults(data);
      router.refresh();
      if (data.new_applications > 0 || data.status_updates > 0) {
        toast(`Found ${data.new_applications} new applications and ${data.status_updates} status updates`);
      } else {
        toast("Scan complete - no new updates found");
      }
    } catch (err) {
      toast(err.message || "Scan failed");
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        <ConnectionCard connection={connection} scanning={scanning} onScan={handleScan} />
        {guide}
      </div>
      <div className="space-y-4">
        {scanResults && <ScanResults results={scanResults} />}
        {history}
      </div>
    </div>
  );
}
