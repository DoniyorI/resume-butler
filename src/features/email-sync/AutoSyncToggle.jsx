"use client";

import { useState, useTransition } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { setEmailAutoSync } from "@/features/email-sync/actions";

const MINUTE_MS = 60 * 1000;

// "5 min ago", "3 hours ago", "2 days ago"
export function timeAgo(value) {
  if (!value) return null;
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / MINUTE_MS);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

// The daily auto-sync switch (see /api/cron/email-sync), on the dashboard and
// on Email Sync. `connection` comes from features/email-sync/data.js.
export default function AutoSyncToggle({ connection, id = "auto-sync" }) {
  const [enabled, setEnabled] = useState(Boolean(connection.autoSync));
  const [saving, startTransition] = useTransition();

  const toggle = (next) => {
    setEnabled(next);
    startTransition(async () => {
      const result = await setEmailAutoSync(next);
      if (!result.ok) {
        setEnabled(!next);
        toast.error(result.error);
        return;
      }
      toast(next ? "Daily sync is on" : "Daily sync is off");
    });
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <label htmlFor={id} className="text-sm font-medium">
            Sync every day
          </label>
          <p className="text-xs text-muted-foreground">
            {enabled && connection.lastAutoSyncAt
              ? `Last daily sync ${timeAgo(connection.lastAutoSyncAt)}. Updates wait for your review.`
              : "Scans each morning and queues updates for your review."}
          </p>
        </div>
        <Switch id={id} checked={enabled} onCheckedChange={toggle} disabled={saving} />
      </div>
      {enabled && connection.lastAutoSyncError && (
        <p className="flex items-start gap-1.5 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {connection.lastAutoSyncError}
        </p>
      )}
    </div>
  );
}
