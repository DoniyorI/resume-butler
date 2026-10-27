"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEmailScan } from "@/features/applications/hooks/useEmailScan";

export default function ScanEmailsButton() {
  const { scanning, scan } = useEmailScan();

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8 border-brand/30 text-brand hover:bg-brand/5 hover:text-brand"
      onClick={scan}
      disabled={scanning}
    >
      {scanning ? (
        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
      ) : (
        <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
      )}
      {scanning ? "Scanning..." : "Scan emails"}
    </Button>
  );
}
