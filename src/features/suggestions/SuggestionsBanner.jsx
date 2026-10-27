"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Inbox, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "suggestions-banner-dismissed";

function readDismissed() {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function saveDismissed(value) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Private mode or storage disabled: it just hides for this visit
  }
}

// Shown above the applications table when email scans found something to
// review. Closing it hides it until a scan adds a newer suggestion.
export default function SuggestionsBanner({ count, latestAt }) {
  // null until mounted, so a dismissed banner never flashes on load
  const [visible, setVisible] = useState(null);

  useEffect(() => {
    setVisible(Boolean(count) && readDismissed() !== latestAt);
  }, [count, latestAt]);

  if (!visible) return null;

  const dismiss = () => {
    if (latestAt) saveDismissed(latestAt);
    setVisible(false);
  };

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand/30 bg-brand/5 py-2 pl-4 pr-2"
    >
      <p className="flex items-center gap-2 text-sm">
        <Inbox className="h-4 w-4 shrink-0 text-brand" />
        {count === 1 ? "1 application update" : `${count} application updates`} found in your email
      </p>
      <div className="flex items-center gap-1">
        <Button asChild size="sm" variant="outline" className="h-8">
          <Link href="/email-sync#review">Review</Link>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={dismiss}
          aria-label="Hide until new updates arrive"
          title="Hide until new updates arrive"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
