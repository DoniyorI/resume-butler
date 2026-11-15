import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TABS = [
  { value: "overview", label: "Overview", href: "/" },
  { value: "insights", label: "Insights", href: "/insights" },
];

// Shared by / and /insights: the title, the Overview | Insights switch and the way to the full table.
// The switch is two links (each page is its own route); it is styled like shadcn's TabsList.
export default function DashboardHeader({ active }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="space-y-3">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Where your job search stands today</p>
        </div>
        <nav aria-label="Dashboard views" className="inline-flex h-10 items-center rounded-md bg-muted p-1 text-muted-foreground">
          {TABS.map((tab) => (
            <Link
              key={tab.value}
              href={tab.href}
              aria-current={tab.value === active ? "page" : undefined}
              className={cn(
                "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                tab.value === active ? "bg-background text-foreground shadow-sm" : "hover:text-foreground"
              )}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>
      <Button asChild variant="outline" size="sm">
        <Link href="/applications">
          All applications <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Link>
      </Button>
    </div>
  );
}
