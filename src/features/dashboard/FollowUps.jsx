import Link from "next/link";
import { ChevronRight, Hourglass } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FOLLOW_UP_AFTER_DAYS } from "@/features/dashboard/data";

// Applications with no reply after two weeks: a to-do list, not another count
export default function FollowUps({ followUps, className }) {
  const { total, items } = followUps;
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Hourglass className="h-4 w-4 text-brand" /> Waiting on a reply
          {total > 0 && <span className="text-sm font-normal text-muted-foreground">{total}</span>}
        </CardTitle>
        <CardDescription>
          Still at Applied after {FOLLOW_UP_AFTER_DAYS} days. A short follow-up email often gets a response.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nothing overdue. Applications with no reply after {FOLLOW_UP_AFTER_DAYS} days will show up here.
          </p>
        ) : (
          <ul className="-mx-2 divide-y">
            {items.map((app) => (
              <li key={app.id}>
                <Link
                  href={`/applications/${app.id}`}
                  className="flex items-center justify-between gap-3 rounded-md px-2 py-2.5 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{app.company}</p>
                    {app.role && <p className="truncate text-xs text-muted-foreground">{app.role}</p>}
                  </div>
                  <span className="flex shrink-0 items-center gap-1 text-sm tabular-nums text-muted-foreground">
                    {app.daysWaiting} days
                    <ChevronRight className="h-4 w-4" />
                  </span>
                </Link>
              </li>
            ))}
            {total > items.length && (
              <li className="px-2 pt-2.5 text-xs text-muted-foreground">
                and {total - items.length} more on the Applications page
              </li>
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
