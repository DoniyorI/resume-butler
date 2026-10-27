"use client";

import { useState } from "react";
import { format, startOfYear, subDays } from "date-fns";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { parseDate } from "@/lib/dates";
import { dateRangeLabel } from "@/features/applications/listParams";

const toIso = (date) => (date ? format(date, "yyyy-MM-dd") : "");

const PRESETS = [
  { label: "Last 7 days", from: () => subDays(new Date(), 6) },
  { label: "Last 30 days", from: () => subDays(new Date(), 29) },
  { label: "Last 90 days", from: () => subDays(new Date(), 89) },
  { label: "This year", from: () => startOfYear(new Date()) },
];

// Applied-date range. from/to are "YYYY-MM-DD" strings from the URL; each
// pick in the calendar applies right away.
export default function DateRangeFilter({ from, to, onChange }) {
  // The calendar works from a local copy so quick clicks don't depend on the
  // URL having caught up yet; it resets from the URL each time it opens
  const [range, setRange] = useState(undefined);

  const handleOpenChange = (open) => {
    if (open) setRange({ from: parseDate(from) || undefined, to: parseDate(to) || undefined });
  };

  const handleSelect = (next) => {
    setRange(next);
    onChange({ from: toIso(next?.from), to: toIso(next?.to) });
  };

  const applyPreset = (preset) => {
    const next = { from: preset.from(), to: new Date() };
    setRange(next);
    onChange({ from: toIso(next.from), to: toIso(next.to) });
  };

  const active = Boolean(from || to);

  return (
    <Popover onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 border-dashed px-2.5 text-xs">
          <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
          Applied
          {active && (
            <>
              <span className="mx-2 h-4 w-px bg-border" />
              <span className="rounded bg-muted px-1.5 py-0.5 font-normal">{dateRangeLabel(from, to)}</span>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-auto flex-col p-0 sm:flex-row">
        <div className="flex flex-wrap gap-1 border-b p-2 sm:w-32 sm:flex-col sm:flex-nowrap sm:border-b-0 sm:border-r">
          {PRESETS.map((preset) => (
            <Button
              key={preset.label}
              variant="ghost"
              size="sm"
              className="h-7 justify-start px-2 text-xs"
              onClick={() => applyPreset(preset)}
            >
              {preset.label}
            </Button>
          ))}
          {active && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 justify-start px-2 text-xs text-muted-foreground"
              onClick={() => handleSelect(undefined)}
            >
              Any date
            </Button>
          )}
        </div>
        <Calendar
          mode="range"
          numberOfMonths={2}
          defaultMonth={range?.from || subDays(new Date(), 31)}
          selected={range}
          onSelect={handleSelect}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
