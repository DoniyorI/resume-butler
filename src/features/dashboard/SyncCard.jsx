"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Inbox, Loader2, Mail, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { postJson } from "@/lib/postJson";
import AutoSyncToggle, { timeAgo } from "@/features/email-sync/AutoSyncToggle";

/**
 * Email sync at a glance: what's waiting for review, a scan of the last two
 * weeks, and the daily auto-sync switch. `connection` comes from
 * features/email-sync/data.js (null when no inbox is connected).
 */
export default function SyncCard({ connection, pendingCount }) {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);

  // Same endpoint and defaults (last 14 days) as Email Sync; emails already seen are skipped
  const scan = async () => {
    setScanning(true);
    try {
      const data = await postJson("/api/scan-emails", {}, "Scan failed");
      toast(
        data.suggestions > 0 ? `Found ${data.suggestions} to review` : "Scan complete. Nothing new to review."
      );
      router.refresh();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setScanning(false);
    }
  };

  if (!connection) {
    return (
      <Card className="flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4 text-brand" /> Inbox
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-1 items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Connect your inbox to find confirmations, interviews and rejections automatically.
          </p>
          <Button asChild size="sm">
            <Link href="/email-sync">Connect</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const lastScan = timeAgo(connection.lastScanAt);

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="h-4 w-4 text-brand" /> Inbox
        </CardTitle>
        <Button size="sm" variant="outline" className="h-8" onClick={scan} disabled={scanning}>
          {scanning ? (
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
          )}
          {scanning ? "Scanning" : "Scan now"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="truncate text-xs text-muted-foreground" title={connection.emailAddress}>
          {connection.emailAddress}
          {lastScan ? `, last scanned ${lastScan}` : ", not scanned yet"}
        </p>

        {pendingCount > 0 ? (
          <Link
            href="/email-sync#review"
            className="flex items-center justify-between gap-2 rounded-md border border-brand/30 bg-brand/5 px-3 py-2 text-sm hover:bg-brand/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex items-center gap-2">
              <Inbox className="h-4 w-4 text-brand" />
              {pendingCount} {pendingCount === 1 ? "update" : "updates"} to review
            </span>
            <span className="text-xs font-medium text-brand">Review</span>
          </Link>
        ) : (
          <p className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
            <Inbox className="h-4 w-4" /> Nothing waiting for review
          </p>
        )}

        <AutoSyncToggle connection={connection} id="dashboard-auto-sync" />
      </CardContent>
    </Card>
  );
}
