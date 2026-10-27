"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Flame, Loader2, Pencil, Target } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

function Ring({ value, max }) {
  const size = 76;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = max ? Math.min(1, value / max) : 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="hsl(var(--muted))"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#559F87"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - fraction)}
        className="transition-[stroke-dashoffset] duration-500 motion-reduce:transition-none"
      />
    </svg>
  );
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
 * "Apply to N jobs a day/week": progress this period, the streak, and what's
 * left. `series` is [{ date: "YYYY-MM-DD", count }] of applied dates.
 */
export default function GoalCard({ goal, series }) {
  const [open, setOpen] = useState(false);
  // "Today" is the viewer's local day, known only in the browser
  const [today, setToday] = useState(null);
  useEffect(() => setToday(new Date()), []);

  const perDay = useMemo(() => new Map(series.map((s) => [s.date, s.count])), [series]);
  const progress = goal && today ? goalProgress(goal, perDay, today) : null;
  const hit = progress && progress.remaining === 0;

  const editButton = (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {goal ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            aria-label="Edit goal"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button size="sm">Set a goal</Button>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <GoalForm goal={goal} onDone={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-4 w-4 text-brand" />{" "}
          {goal?.period === "day" ? "Today's goal" : "This week's goal"}
        </CardTitle>
        {goal && editButton}
      </CardHeader>
      <CardContent className="flex flex-1 items-center">
        {!goal ? (
          <div className="flex w-full items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Set a daily or weekly target and track your pace and streak here.
            </p>
            {editButton}
          </div>
        ) : (
          <div className="flex w-full items-center gap-4">
            <div className="relative shrink-0">
              <Ring value={progress?.done ?? 0} max={goal.target} />
              <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                <span className="text-lg font-semibold tabular-nums">{progress?.done ?? "–"}</span>
                <span className="text-[11px] text-muted-foreground">of {goal.target}</span>
              </span>
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium">
                {!progress
                  ? " "
                  : hit
                    ? "Goal hit. Nice work."
                    : progress.weekly
                      ? `${progress.remaining} to go by Sunday`
                      : `${progress.remaining} more today`}
              </p>
              {progress && !hit && progress.weekly && (
                <p className="text-xs text-muted-foreground">
                  About {Math.ceil(progress.remaining / progress.daysLeft)} a day for the {progress.daysLeft}{" "}
                  {progress.daysLeft === 1 ? "day" : "days"} left
                </p>
              )}
              {progress && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Flame className={cn("h-3.5 w-3.5", progress.streak > 0 ? "text-orange-500" : "")} />
                  {progress.streak > 0
                    ? `${progress.streak} ${progress.weekly ? "week" : "day"}${progress.streak === 1 ? "" : "s"} in a row`
                    : `No streak yet. Hit it ${progress.weekly ? "this week" : "today"} to start one.`}
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
