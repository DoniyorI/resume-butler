"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const keyFor = (id) => `rb-dashboard-${id}`;

// A dashboard section that starts closed (or open) and remembers the viewer's choice.
// Children render only while open, so charts load on demand.
export default function CollapsibleSection({ id, title, summary, defaultOpen = false, children }) {
  // The server render and the first client render use the default; the saved choice applies after mount
  const [open, setOpen] = useState(defaultOpen);
  const panelId = `${id}-panel`;

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(keyFor(id));
      if (saved === "open") setOpen(true);
      else if (saved === "closed") setOpen(false);
    } catch {
      // Storage can be blocked; the default stays
    }
  }, [id]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    try {
      window.localStorage.setItem(keyFor(id), next ? "open" : "closed");
    } catch {
      // Not remembered, still works
    }
  };

  return (
    <section
      id={id}
      aria-label={title}
      className="rounded-lg border bg-card text-card-foreground shadow-sm"
    >
      <h2 className="text-base">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={toggle}
          className="flex w-full items-center justify-between gap-3 rounded-lg px-4 py-3 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-6"
        >
          <span className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
            <span className="font-semibold">{title}</span>
            {summary && <span className="text-sm font-normal text-muted-foreground">{summary}</span>}
          </span>
          <ChevronDown
            className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
            aria-hidden="true"
          />
        </button>
      </h2>
      <div id={panelId} hidden={!open}>
        {open && <div className="border-t py-4">{children}</div>}
      </div>
    </section>
  );
}
