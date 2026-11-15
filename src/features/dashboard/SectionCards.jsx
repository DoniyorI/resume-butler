import { Briefcase, CalendarDays, Clock, Target, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RESPONSE_WINDOW_DAYS } from "@/features/dashboard/data";
import { MIN_GROUP_SIZE } from "@/features/dashboard/report";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function SectionCard({ icon: Icon, label, value, badge, footer }) {
  return (
    <Card className="bg-gradient-to-t from-brand/5 to-card shadow-sm">
      <CardHeader className="space-y-1 p-4">
        <CardDescription className="flex items-center gap-1.5">
          <Icon className="h-4 w-4" /> {label}
        </CardDescription>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className={`font-semibold tabular-nums ${String(value).length > 10 ? "text-base" : "text-2xl"}`}>{value}</CardTitle>
          {badge && (
            <Badge variant="outline" className="font-normal text-muted-foreground">
              {badge}
            </Badge>
          )}
        </div>
        {footer && <p className="text-xs text-muted-foreground">{footer}</p>}
      </CardHeader>
    </Card>
  );
}

// Headline numbers, in the style of shadcn's dashboard section cards
export default function SectionCards({ stats }) {
  const hasResponseTime = stats.medianResponseDays !== null;
  const hasWindow = stats.responseEligible > 0;
  // Under MIN_GROUP_SIZE the card shows the counts only, as the Search report does
  const showRate = stats.responseEligible >= MIN_GROUP_SIZE;
  const windowText = `of ${stats.responseEligible} applied ${RESPONSE_WINDOW_DAYS}+ days ago`;
  const rateValue = (count, rate) =>
    !hasWindow ? "Not enough history yet" : showRate ? `${rate}%` : `${count} of ${stats.responseEligible}`;
  const rateFooter = (count, verb) =>
    !hasWindow
      ? `Counts applications applied ${RESPONSE_WINDOW_DAYS}+ days ago`
      : showRate
        ? `${count} ${windowText} ${verb}`
        : `Applied ${RESPONSE_WINDOW_DAYS}+ days ago; too few for a rate yet`;
  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
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
        value={rateValue(stats.responses, stats.responseRate)}
        footer={rateFooter(stats.responses, "heard back")}
      />
      <SectionCard
        icon={Target}
        label="Offer rate"
        value={rateValue(stats.offers, stats.offerRate)}
        footer={rateFooter(stats.offers, "reached an offer")}
      />
      <SectionCard
        icon={Clock}
        label="Median days to first response"
        value={hasResponseTime ? `${stats.medianResponseDays} days` : "—"}
        footer={
          hasResponseTime
            ? `From ${stats.responseTimeSamples} ${stats.responseTimeSamples === 1 ? "response" : "responses"}, Applied to first reply`
            : "No responses with a recorded date yet"
        }
      />
    </div>
  );
}
