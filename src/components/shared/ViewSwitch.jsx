import Link from "next/link";
import { cn } from "@/lib/utils";

// Segmented switch between alternative versions of a page, for side-by-side
// comparison while a redesign is reviewed. `views`: [{ href, label }]
export default function ViewSwitch({ views, current }) {
  return (
    <div className="inline-flex items-center rounded-lg bg-muted p-1 text-sm">
      {views.map((view) => (
        <Link
          key={view.href}
          href={view.href}
          aria-current={current === view.href ? "page" : undefined}
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
