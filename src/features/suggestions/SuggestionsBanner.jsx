import Link from "next/link";
import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";

// Shown above the applications table when email scans found something to review
export default function SuggestionsBanner({ count }) {
  if (!count) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand/30 bg-brand/5 px-4 py-3">
      <p className="flex items-center gap-2 text-sm">
        <Inbox className="h-4 w-4 text-brand" />
        {count === 1 ? "1 application update" : `${count} application updates`} found in your email
      </p>
      <Button asChild size="sm" variant="outline">
        <Link href="/email-sync#review">Review</Link>
      </Button>
    </div>
  );
}
