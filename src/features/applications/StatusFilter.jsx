"use client";

import { useState } from "react";
import { CirclePlus } from "lucide-react";
import { APPLICATION_STATUSES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import StatusDot from "@/features/applications/StatusDot";

// Multi-select status filter. counts[status] already reflects the other
// filters (search, dates) but not this one, so every option shows what
// picking it would add.
export default function StatusFilter({ selected, counts, onChange }) {
  // Ticks show right away; quick clicks build on each other instead of on a
  // URL that hasn't caught up yet. The URL wins whenever it changes.
  const [picked, setPicked] = useState(selected);
  const [synced, setSynced] = useState(selected.join(","));
  if (selected.join(",") !== synced) {
    setSynced(selected.join(","));
    setPicked(selected);
  }

  const update = (statuses) => {
    setPicked(statuses);
    onChange(statuses);
  };

  const toggle = (status, checked) => {
    const next = new Set(picked);
    if (checked) next.add(status);
    else next.delete(status);
    update(APPLICATION_STATUSES.filter((option) => next.has(option)));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 border-dashed px-2.5 text-xs">
          <CirclePlus className="mr-1.5 h-3.5 w-3.5" />
          Status
          {picked.length > 0 && (
            <>
              <span className="mx-2 h-4 w-px bg-border" />
              {picked.length > 2 ? (
                <span className="rounded bg-muted px-1.5 py-0.5 font-normal">{picked.length} selected</span>
              ) : (
                picked.map((status) => (
                  <span
                    key={status}
                    className="ml-1 flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-normal first:ml-0"
                  >
                    <StatusDot status={status} />
                    {status}
                  </span>
                ))
              )}
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1">
        <div role="group" aria-label="Filter by status">
          {APPLICATION_STATUSES.map((status) => {
            const id = `status-filter-${status.replace(/\s+/g, "-").toLowerCase()}`;
            const checked = picked.includes(status);
            return (
              <label
                key={status}
                htmlFor={id}
                className="flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              >
                <Checkbox id={id} checked={checked} onCheckedChange={(value) => toggle(status, !!value)} />
                <StatusDot status={status} />
                <span className="flex-1">{status}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{counts[status] ?? 0}</span>
              </label>
            );
          })}
        </div>
        {picked.length > 0 && (
          <>
            <div className="-mx-1 my-1 h-px bg-border" />
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-full justify-center text-xs"
              onClick={() => update([])}
            >
              Clear status filter
            </Button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
