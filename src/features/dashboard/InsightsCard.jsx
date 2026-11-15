import Link from "next/link";
import { Activity, BarChart3, ChevronRight, GitBranch, Lightbulb } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { activitySummary, plural } from "@/features/dashboard/summaries";

// Doorway to /insights: where the charts and the report went. Each row opens its tab.
export default function InsightsCard({ series, total, today, className }) {
  const rows = [
    { tab: "activity", icon: Activity, label: "Activity", summary: activitySummary(series, today) },
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
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Lightbulb className="h-4 w-4 text-brand" /> Insights
        </CardTitle>
        <CardDescription>Charts and a report of your own records</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="-mx-2 divide-y">
          {rows.map(({ tab, icon: Icon, label, summary }) => (
            <li key={tab}>
              <Link
                href={`/insights?tab=${tab}`}
                className="flex items-center justify-between gap-3 rounded-md px-2 py-2.5 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
