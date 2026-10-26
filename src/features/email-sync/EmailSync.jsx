"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { postJson } from "@/lib/postJson";
import ConnectionCard from "@/features/email-sync/ConnectionCard";
import ScanResults from "@/features/email-sync/ScanResults";
import { DEFAULT_SCAN_OPTIONS, scanOptionsError, scanRequestBody } from "@/features/email-sync/ScanOptions";

// `guide`, `history` and `review` are server-rendered and passed in as slots
export default function EmailSync({ connection, guide, history, review }) {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [scanOptions, setScanOptions] = useState(DEFAULT_SCAN_OPTIONS);
  const [scanResults, setScanResults] = useState(null);

  // A Route Handler rather than a Server Action: the scan is long-running and
  // the applications table calls the same endpoint
  const handleScan = async () => {
    const problem = scanOptionsError(scanOptions);
    if (problem) {
      toast.error(problem);
      return;
    }
    setScanning(true);
    setScanResults(null);
    try {
      const data = await postJson("/api/scan-emails", scanRequestBody(scanOptions), "Scan failed");
      setScanResults(data);
      router.refresh();
      toast(
        data.suggestions > 0 ? `Found ${data.suggestions} to review` : "Scan complete - nothing new to review"
      );
    } catch (err) {
      toast.error(err.message);
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="space-y-6">
      {review}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <ConnectionCard
            connection={connection}
            scanning={scanning}
            onScan={handleScan}
            scanOptions={scanOptions}
            onScanOptionsChange={setScanOptions}
          />
          {guide}
        </div>
        <div className="space-y-4">
          {scanResults && <ScanResults results={scanResults} />}
          {history}
        </div>
      </div>
    </div>
  );
}
