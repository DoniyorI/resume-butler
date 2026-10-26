import Link from "next/link";
import { cn } from "@/lib/utils";

const VIEWS = [
  { href: "/dash", label: "Classic" },
  { href: "/dash/new", label: "New (shadcn)" },
];

// Temporary switch for comparing the two dashboards; remove once one is chosen
export default function DashboardSwitch({ current }) {
  return (
    <div className="inline-flex items-center rounded-lg bg-muted p-1 text-sm">
      {VIEWS.map((view) => (
        <Link
          key={view.href}
          href={view.href}
          className={cn(
            "rounded-md px-3 py-1 font-medium text-muted-foreground transition-colors hover:text-foreground",
            current === view.href && "bg-background text-foreground shadow-sm"
          )}
        >
          {view.label}
        </Link>
      ))}
    </div>
  );
}
