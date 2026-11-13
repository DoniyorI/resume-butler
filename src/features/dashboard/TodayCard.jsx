"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CalendarClock, Check, ChevronRight, Lightbulb } from "lucide-react";
import LocalDateTime from "@/components/shared/LocalDateTime";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { setActivityStatusAction } from "@/features/activities/actions";
import useLocalToday from "@/features/activities/hooks/useLocalToday";
import { ACTIVITY_KIND_LABELS, addDays } from "@/features/activities/kinds";
import { formatShortDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

const UPCOMING_DAYS = 7;

// Overdue, today and the next 7 days, by the viewer's own calendar day
function groupByDay(items, today) {
  const last = addDays(today, UPCOMING_DAYS);
  return [
    { key: "overdue", label: "Overdue", items: items.filter((a) => a.dueOn < today) },
    { key: "today", label: "Today", items: items.filter((a) => a.dueOn === today) },
    { key: "upcoming", label: "Next 7 days", items: items.filter((a) => a.dueOn > today && a.dueOn <= last) },
  ].filter((group) => group.items.length);
}

function DueRow({ activity, overdue, onDone, busy }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2" data-activity-id={activity.id}>
      <Link
        href={`/applications/${activity.applicationId}#next-steps`}
        className="min-w-0 flex-1 rounded-md px-2 py-1 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <p className="truncate text-sm font-medium">{activity.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {activity.company}
          {activity.role && ` · ${activity.role}`} · {ACTIVITY_KIND_LABELS[activity.kind]} ·{" "}
          {activity.startsAt ? (
            <LocalDateTime value={activity.startsAt} format="long" />
          ) : (
            formatShortDate(activity.dueOn)
          )}
          {overdue && <span className="ml-1.5 rounded bg-red-100 px-1.5 font-medium text-red-700">Overdue</span>}
        </p>
      </Link>
      <Button
        size="sm"
        variant="outline"
        className="h-7 shrink-0 px-2"
        disabled={busy}
        onClick={() => onDone(activity.id)}
      >
        <Check className="mr-1 h-3.5 w-3.5" /> Done
      </Button>
    </li>
  );
}

/**
 * The dashboard's first card: dated next steps grouped by the viewer's day,
 * then rule-based suggestions. Grouping waits for the browser's date because
 * the server doesn't know the viewer's time zone.
 */
export default function TodayCard({ upcoming, olderOverdue = 0, suggestions, setupPending, className }) {
  const today = useLocalToday();
  const [hidden, setHidden] = useState(() => new Set());
  // Steps whose "Done" is on its way, so a double-click sends it once
  const [busy, setBusy] = useState(() => new Set());

  const markDone = async (id) => {
    if (busy.has(id)) return;
    setBusy((current) => new Set(current).add(id));
    setHidden((current) => new Set(current).add(id));
    const result = await setActivityStatusAction(id, "done");
    if (result.ok) toast.success("Marked done");
    else {
      setHidden((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      toast.error(result.error);
    }
    setBusy((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  };

  const visible = upcoming.filter((a) => !hidden.has(a.id));
  const groups = today ? groupByDay(visible, today) : [];
  const nothing = today && groups.length === 0 && suggestions.length === 0;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <CalendarClock className="h-4 w-4 text-brand" /> Today
        </CardTitle>
        <CardDescription>What is due, and what to do next.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {setupPending && <p className="text-xs text-muted-foreground">Dated next steps need migration 020.</p>}

        {!today && visible.length > 0 && <p className="text-sm text-muted-foreground">Loading your day…</p>}

        {groups.map((group) => (
          <section key={group.key} aria-label={group.label}>
            <h3
              className={cn(
                "text-xs font-semibold uppercase tracking-wide",
                group.key === "overdue" ? "text-red-700" : "text-muted-foreground"
              )}
            >
              {group.label} <span className="font-normal">({group.items.length})</span>
            </h3>
            <ul className="-mx-2 divide-y">
              {group.items.map((activity) => (
                <DueRow
                  key={activity.id}
                  activity={activity}
                  overdue={group.key === "overdue"}
                  busy={busy.has(activity.id)}
                  onDone={markDone}
                />
              ))}
            </ul>
            {group.key === "overdue" && olderOverdue > 0 && (
              <p className="px-0 pt-1 text-xs text-muted-foreground">
                and {olderOverdue} older overdue {olderOverdue === 1 ? "step" : "steps"}
              </p>
            )}
          </section>
        ))}

        {today && groups.length === 0 && suggestions.length > 0 && !setupPending && (
          <p className="text-sm text-muted-foreground">Nothing is due in the next {UPCOMING_DAYS} days.</p>
        )}

        {nothing && (
          <p className="py-2 text-sm text-muted-foreground">
            Nothing is due. Open an application and use Next steps to add a follow-up, an assessment or an interview.
          </p>
        )}

        {suggestions.length > 0 && (
          <section aria-label="Suggested next steps">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Lightbulb className="h-3.5 w-3.5" /> Suggested next steps
            </h3>
            <ul className="-mx-2 divide-y">
              {suggestions.map((suggestion) => (
                <li key={suggestion.id}>
                  <Link
                    href={suggestion.href}
                    className="flex items-center justify-between gap-3 rounded-md px-2 py-2.5 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{suggestion.title}</p>
                      <p className="text-xs text-muted-foreground">{suggestion.reason}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
            {setupPending && (
              <p className="pt-2 text-xs text-muted-foreground">
                Recording these steps on an application needs migration 020; until then the suggestions are a reminder.
              </p>
            )}
          </section>
        )}
      </CardContent>
    </Card>
  );
}
