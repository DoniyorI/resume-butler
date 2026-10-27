import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { parseDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

// "Oct 26", or "Oct 26, 2025" for another year
function shortDate(value) {
  const date = parseDate(value);
  if (!date) return "—";
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

// The newest applications, a jump-off to the full table. `items` come from
// getDashboardStats().recent.
export default function RecentApplications({ items, total, className }) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">Recent applications</CardTitle>
        <Button asChild variant="ghost" size="sm" className="h-8 text-brand hover:text-brand">
          <Link href="/applications">
            View all {total > 0 && <span className="ml-1 tabular-nums">({total})</span>}
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="flex-1 px-0 pb-2">
        {items.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">
            No applications yet. Add one with New Application, or connect your email.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-8 pl-6 text-xs">Company</TableHead>
                <TableHead className="hidden h-8 text-xs sm:table-cell">Role</TableHead>
                <TableHead className="h-8 text-xs">Status</TableHead>
                <TableHead className="h-8 pr-6 text-right text-xs">Applied</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((app) => (
                <TableRow key={app.id} className="group relative">
                  <TableCell className="max-w-[10rem] truncate py-2 pl-6 font-medium">
                    {/* The link covers the row, so the whole row opens the application */}
                    <Link
                      href={`/applications/${app.id}`}
                      className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring"
                      title={app.company}
                    >
                      {app.company}
                    </Link>
                  </TableCell>
                  <TableCell
                    className="hidden max-w-[14rem] truncate py-2 text-muted-foreground sm:table-cell"
                    title={app.role}
                  >
                    {app.role || "—"}
                  </TableCell>
                  <TableCell className="py-2">
                    <Badge variant={app.status.toLowerCase()} className="whitespace-nowrap">
                      {app.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap py-2 pr-6 text-right tabular-nums text-muted-foreground">
                    {shortDate(app.appliedDate)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
