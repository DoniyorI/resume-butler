import { Briefcase, CalendarDays, Clock, Target, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function SectionCard({ icon: Icon, label, value, badge, footer }) {
  return (
    <Card className="bg-gradient-to-t from-brand/5 to-card shadow-sm">
      <CardHeader className="space-y-1 pb-4">
        <CardDescription className="flex items-center gap-1.5">
          <Icon className="h-4 w-4" /> {label}
        </CardDescription>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-2xl font-semibold tabular-nums sm:text-3xl">{value}</CardTitle>
          {badge && (
            <Badge variant="outline" className="font-normal text-muted-foreground">
              {badge}
            </Badge>
          )}
        </div>
        {footer && <p className="pt-1 text-sm text-muted-foreground">{footer}</p>}
      </CardHeader>
    </Card>
  );
}

// Headline numbers, in the style of shadcn's dashboard section cards
export default function SectionCards({ stats }) {
  const hasResponseTime = stats.avgResponseDays !== null;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <SectionCard
        icon={Briefcase}
        label="Total applications"
        value={stats.total}
        badge={
          <span className="flex items-center gap-1">
            <CalendarDays className="h-3 w-3" /> +{stats.thisWeek} this week
          </span>
        }
        footer="Every application you're tracking"
      />
      <SectionCard
        icon={TrendingUp}
        label="Response rate"
        value={`${stats.responseRate}%`}
        footer={`${stats.responses} interviews or offers`}
      />
      <SectionCard
        icon={Target}
        label="Offer rate"
        value={`${stats.offerRate}%`}
        footer={`${stats.statusCounts.Offered} ${stats.statusCounts.Offered === 1 ? "offer" : "offers"}`}
      />
      <SectionCard
        icon={Clock}
        label="Avg. response time"
        value={hasResponseTime ? `${stats.avgResponseDays} days` : "—"}
        footer={
          hasResponseTime
            ? `From ${stats.responseTimeSamples} ${stats.responseTimeSamples === 1 ? "reply" : "replies"}`
            : "No replies tracked yet"
        }
      />
    </div>
  );
}
