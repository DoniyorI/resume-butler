"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GitCompareArrows, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import MatchTargetPicker from "@/features/suggestions/MatchTargetPicker";
import { resolveExtensionEvent } from "@/features/applications/ingestionActions";

export default function ExtensionMatchReview({ events }) {
  const router = useRouter();
  const [resolved, setResolved] = useState([]);
  const waiting = events.filter(event => !resolved.includes(event.eventId));
  if (!waiting.length) return null;
  return (
    <Card id="matching" className="scroll-mt-24 border-brand/25 shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><GitCompareArrows className="h-4 w-4 text-brand" /> Submissions to match <Badge variant="secondary">{waiting.length}</Badge></CardTitle>
        <CardDescription>These submissions are saved safely. Choose an existing application or keep one as a separate opening.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {waiting.map((event, index) => (
          <details key={event.eventId} open={index === 0} className="group rounded-lg border bg-background">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
              <span className="min-w-0"><span className="block text-sm font-medium">{event.company} · {event.role || "Untitled role"}</span><span className="mt-0.5 block text-xs text-muted-foreground">Browser extension · {event.appliedDate || "Date unknown"}</span></span>
              <span className="flex shrink-0 items-center gap-2"><Badge variant="outline" className="font-normal">Needs matching</Badge><ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" /></span>
            </summary>
            <div className="space-y-3 border-t px-4 py-4">
              <p className="text-sm text-muted-foreground">More than one record could match. We&apos;ve kept them separate so the right history stays with each job.</p>
              <MatchTargetPicker candidates={event.candidates} onResolve={async choice => {
                const result = await resolveExtensionEvent(event.eventId, choice);
                if (result.ok) { setResolved(previous => [...previous, event.eventId]); router.refresh(); }
                return result;
              }} />
            </div>
          </details>
        ))}
      </CardContent>
    </Card>
  );
}
