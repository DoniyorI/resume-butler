"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BellOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteApplications } from "@/features/applications/actions";

const STORAGE_KEY = "alert-rows-kept";

function readKept() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(stored) ? stored.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function saveKept(ids) {
  try {
    // The newest 500 are plenty: a kept row that is deleted later never comes back
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids.slice(-500)));
  } catch {
    // Private mode or storage disabled: the banner just returns next visit
  }
}

// Shown above the applications table when an email scan added rows that look
// like job alerts or notifications (alertRows.js). The user removes the ones
// they pick, or keeps them all; nothing is removed without that choice.
export default function AlertRowsReview({ rows }) {
  const router = useRouter();
  // null until mounted, so rows the user kept never flash on load
  const [kept, setKept] = useState(null);
  const [open, setOpen] = useState(false);
  const [unchecked, setUnchecked] = useState(() => new Set());
  const [isPending, startTransition] = useTransition();

  useEffect(() => setKept(readKept()), []);

  const waiting = useMemo(
    () => (kept ? rows.filter((row) => !kept.includes(row.id)) : []),
    [rows, kept]
  );
  if (!waiting.length) return null;

  const selected = waiting.filter((row) => !unchecked.has(row.id));
  const toggle = (id) =>
    setUnchecked((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const keepAll = () => {
    const next = [...kept, ...waiting.map((row) => row.id)];
    saveKept(next);
    setKept(next);
    setOpen(false);
  };

  const remove = () =>
    startTransition(async () => {
      const result = await deleteApplications(selected.map((row) => row.id));
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast(`Removed ${result.data.count} ${result.data.count === 1 ? "row" : "rows"}`);
      setOpen(false);
      setUnchecked(new Set());
      router.refresh();
    });

  const count = waiting.length;
  return (
    <>
      <div
        role="status"
        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/60 py-2 pl-4 pr-2"
      >
        <p className="flex items-center gap-2 text-sm">
          <BellOff className="h-4 w-4 shrink-0 text-amber-700" />
          {count === 1
            ? "1 row looks like a job alert, not an application"
            : `${count} rows look like job alerts, not applications`}
        </p>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" className="h-8" onClick={() => setOpen(true)}>
            Review
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={keepAll}
            aria-label="Keep these rows and hide this notice"
            title="Keep these rows and hide this notice"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Rows that look like job alerts</DialogTitle>
            <DialogDescription>
              An email scan added these, and they never moved past their first status. Removing them deletes the
              rows for good and takes them out of your counts. Untick any you want to keep.
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
            {waiting.map((row) => (
              <li key={row.id} className="flex items-start gap-3 rounded-lg border p-3">
                <Checkbox
                  id={`alert-row-${row.id}`}
                  checked={!unchecked.has(row.id)}
                  onCheckedChange={() => toggle(row.id)}
                  className="mt-0.5"
                />
                <label htmlFor={`alert-row-${row.id}`} className="min-w-0 flex-1 cursor-pointer text-sm">
                  <span className="block font-medium">
                    {row.company || "Unknown company"}
                    {row.role ? ` · ${row.role}` : ""}
                    <span className="ml-2 font-normal text-muted-foreground">{row.status}</span>
                  </span>
                  <span className="mt-0.5 block text-xs text-amber-800">{row.reason}</span>
                  {row.comment ? (
                    <span className="mt-1 block break-words text-xs text-muted-foreground">{row.comment}</span>
                  ) : null}
                </label>
              </li>
            ))}
          </ul>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="ghost" onClick={keepAll} disabled={isPending}>
              Keep all
            </Button>
            <Button variant="destructive" onClick={remove} disabled={isPending || !selected.length}>
              {isPending
                ? "Removing..."
                : `Remove ${selected.length} ${selected.length === 1 ? "row" : "rows"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
