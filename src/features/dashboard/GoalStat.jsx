"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Flame, Loader2, Pencil, Target } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { saveGoal } from "@/features/dashboard/actions";

const MAX_STREAK_LOOKBACK = 366;

// Local calendar day as YYYY-MM-DD (applied dates are stored as plain dates)
function dayKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const addDays = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

// Weeks start on Monday
function startOfWeek(date) {
  return addDays(date, -((date.getDay() + 6) % 7));
}

function countBetween(perDay, start, end) {
  let total = 0;
  for (let day = start; day <= end; day = addDays(day, 1)) total += perDay.get(dayKey(day)) || 0;
  return total;
}

/**
 * Progress toward the goal for the current day or week, how many periods in a
 * row it was hit (the current one counts once it's hit), and what's left.
 */
function goalProgress(goal, perDay, today) {
  const weekly = goal.period === "week";
  const periodStart = weekly ? startOfWeek(today) : today;
  const done = countBetween(perDay, periodStart, today);

  let streak = done >= goal.target ? 1 : 0;
  let start = weekly ? addDays(periodStart, -7) : addDays(periodStart, -1);
  for (let i = 0; i < MAX_STREAK_LOOKBACK; i++) {
    const end = weekly ? addDays(start, 6) : start;
    if (countBetween(perDay, start, end) < goal.target) break;
    streak++;
    start = weekly ? addDays(start, -7) : addDays(start, -1);
  }

  const remaining = Math.max(0, goal.target - done);
  // Days left in the week, today included
  const daysLeft = weekly ? 7 - ((today.getDay() + 6) % 7) : 1;
  return { done, remaining, streak, daysLeft, weekly };
}

function GoalForm({ goal, onDone }) {
  const [period, setPeriod] = useState(goal?.period || "week");
  const [target, setTarget] = useState(String(goal?.target || (goal?.period === "day" ? 3 : 15)));
  const [error, setError] = useState(null);
  const [pending, startTransition] = useTransition();

  const submit = (next) =>
    startTransition(async () => {
      const result = await saveGoal(next);
      if (!result.ok) return setError(result.error);
      toast(next ? "Goal saved" : "Goal removed");
      onDone();
    });

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        submit({ period, target });
      }}
    >
      <p className="text-sm font-medium">Your application goal</p>
      <div
        className="grid grid-cols-2 rounded-md bg-muted p-1 text-sm"
        role="radiogroup"
        aria-label="Goal period"
      >
        {[
          ["day", "Daily"],
          ["week", "Weekly"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={period === value}
            onClick={() => setPeriod(value)}
            className={cn(
              "rounded px-2 py-1 font-medium text-muted-foreground",
              period === value && "bg-background text-foreground shadow-sm"
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="goal-target" className="text-xs text-muted-foreground">
          Applications per {period === "day" ? "day" : "week"}
        </Label>
        <Input
          id="goal-target"
          type="number"
          inputMode="numeric"
          min={1}
          max={200}
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="h-9"
        />
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" className="flex-1" disabled={pending}>
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save goal
        </Button>
        {goal && (
          <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => submit(null)}>
            Remove
          </Button>
        )}
      </div>
    </form>
  );
}

/**
 * The goal as the fourth stat card: "x of N" for this day or week, with what is left and the streak
 * beneath. `series` is [{ date: "YYYY-MM-DD", count }] of applied dates. The card is not a link: its
 * edit button opens the goal editor.
 */
export default function GoalStat({ goal, series }) {
  const [open, setOpen] = useState(false);
  // "Today" is the viewer's local day, known only in the browser
  const [today, setToday] = useState(null);
  useEffect(() => setToday(new Date()), []);

  const perDay = useMemo(() => new Map(series.map((s) => [s.date, s.count])), [series]);
  const progress = goal && today ? goalProgress(goal, perDay, today) : null;
  const hit = progress && progress.remaining === 0;

  const editor = (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {goal ? (
          <Button variant="ghost" size="icon" className="ml-auto h-6 w-6 text-muted-foreground" aria-label="Edit goal">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs">
            Set a goal
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <GoalForm goal={goal} onDone={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );

  const label = !goal ? "Goal" : goal.period === "day" ? "Today's goal" : "This week's goal";
  const footer = !goal
    ? "A daily or weekly target, with pace and streak"
    : !progress
      ? "\u00a0"
      : [
          hit
            ? "Goal hit. Nice work."
            : progress.weekly
              ? `${progress.remaining} to go by Sunday`
              : `${progress.remaining} more today`,
          progress.streak > 0
            ? `${progress.streak} ${progress.weekly ? "week" : "day"}${progress.streak === 1 ? "" : "s"} in a row`
            : "no streak yet",
        ].join(" \u00b7 ");

  return (
    <Card className="h-full bg-gradient-to-t from-brand/5 to-card shadow-sm">
      <CardHeader className="space-y-1 p-4">
        <CardDescription className="flex items-center gap-1.5">
          <Target className="h-4 w-4" /> {label}
          {goal && editor}
        </CardDescription>
        <div className="flex flex-wrap items-center gap-2">
          {goal ? (
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {progress ? progress.done : "\u2013"} of {goal.target}
            </CardTitle>
          ) : (
            <>
              <CardTitle className="text-base font-semibold">No goal set</CardTitle>
              {editor}
            </>
          )}
        </div>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          {goal && progress && progress.streak > 0 && <Flame className="h-3.5 w-3.5 shrink-0 text-orange-500" aria-hidden="true" />}
          <span>{footer}</span>
        </p>
      </CardHeader>
    </Card>
  );
}
