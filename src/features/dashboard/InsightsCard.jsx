import Link from "next/link";
import { Activity, BarChart3, ChevronRight, GitBranch, Lightbulb } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { plural, timingSummary } from "@/features/dashboard/summaries";

// Links into /insights, one row per tab, with a one-line summary.
export default function InsightsCard({ total, medianResponseDays, className }) {
  const rows = [
    { tab: "activity", icon: Activity, label: "Pipeline and timing", summary: timingSummary(medianResponseDays) },
    {
      tab: "flow",
      icon: GitBranch,
      label: "Application flow",
      summary: total > 0 ? `How ${plural(total, "application")} moved` : "How your applications move",
    },
    { tab: "report", icon: BarChart3, label: "Search report", summary: "Outcomes by source, resume and more" },
  ];
  return (
    <Card className={className}>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="h-4 w-4 text-brand" /> More insights
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        <ul className="-mx-2 divide-y">
          {rows.map(({ tab, icon: Icon, label, summary }) => (
            <li key={tab}>
              <Link
                href={`/insights?tab=${tab}`}
                className="flex items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{label}</p>
                    <p className="truncate text-xs text-muted-foreground">{summary}</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
