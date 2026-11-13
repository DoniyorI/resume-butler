"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, ExternalLink, ListTodo, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import LocalDateTime from "@/components/shared/LocalDateTime";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ActivityForm from "@/features/activities/ActivityForm";
import useLocalToday from "@/features/activities/hooks/useLocalToday";
import {
  createActivityAction,
  deleteActivityAction,
  setActivityStatusAction,
  updateActivityAction,
} from "@/features/activities/actions";
import { ACTIVITY_KIND_LABELS, CONTACT_CHANNEL_LABELS } from "@/features/activities/kinds";
import { formatShortDate } from "@/lib/dates";
import { safeHttpUrl } from "@/lib/safeUrl";
import { cn } from "@/lib/utils";

// Open steps by date (undated last), then the ones done or cancelled
function byDate(a, b) {
  if (a.dueOn !== b.dueOn) return !a.dueOn ? 1 : !b.dueOn ? -1 : a.dueOn.localeCompare(b.dueOn);
  return (a.startsAt || "").localeCompare(b.startsAt || "") || a.createdAt.localeCompare(b.createdAt);
}

function When({ activity }) {
  if (activity.startsAt) return <LocalDateTime value={activity.startsAt} format="long" />;
  if (activity.dueOn) return <span>{formatShortDate(activity.dueOn)}</span>;
  return <span>No date yet</span>;
}

function ActivityRow({ activity, today, onEdit, run: runAction }) {
  const [confirming, setConfirming] = useState(false);
  // One action at a time per row, so a double-click can't send it twice
  const [busy, setBusy] = useState(false);
  const run = async (action, message) => {
    if (busy) return;
    setBusy(true);
    try {
      await runAction(action, message);
    } finally {
      setBusy(false);
    }
  };
  const open = activity.status === "open";
  const overdue = open && today && activity.dueOn && activity.dueOn < today;
  const dueToday = open && today && activity.dueOn === today;
  const href = safeHttpUrl(activity.link);
  const contact = [activity.contactName, CONTACT_CHANNEL_LABELS[activity.contactChannel]].filter(Boolean).join(" · ");

  return (
    <li className="space-y-1.5 py-3" data-activity-id={activity.id}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={cn("text-sm font-medium", !open && "text-muted-foreground line-through")}>{activity.title}</p>
          <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
            <span>{ACTIVITY_KIND_LABELS[activity.kind]}</span>
            <span aria-hidden="true">·</span>
            <When activity={activity} />
            {overdue && <span className="rounded bg-red-100 px-1.5 font-medium text-red-700">Overdue</span>}
            {dueToday && <span className="rounded bg-brand/15 px-1.5 font-medium text-brand">Today</span>}
            {activity.status === "cancelled" && <span>Cancelled</span>}
          </p>
          {contact && <p className="text-xs text-muted-foreground">{contact}</p>}
          {href && (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
            >
              <ExternalLink className="h-3 w-3" /> Open link
            </a>
          )}
          {activity.notes && (
            <p className="line-clamp-3 whitespace-pre-line text-xs text-foreground/80">{activity.notes}</p>
          )}
        </div>
      </div>
      {confirming ? (
        <div className="flex items-center gap-2 text-xs">
          <span>Delete this step?</span>
          <Button size="sm" variant="destructive" className="h-7 px-2" disabled={busy} onClick={() => run(() => deleteActivityAction(activity.id), "Step deleted")}>
            Delete
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2" disabled={busy} onClick={() => setConfirming(false)}>
            Keep
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1">
          {open ? (
            <>
              <Button size="sm" variant="outline" className="h-7 px-2" disabled={busy} onClick={() => run(() => setActivityStatusAction(activity.id, "done"), "Marked done")}>
                <Check className="mr-1 h-3.5 w-3.5" /> Done
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2" disabled={busy} onClick={onEdit}>
                <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2" disabled={busy} onClick={() => run(() => setActivityStatusAction(activity.id, "cancelled"), "Step cancelled")}>
                <X className="mr-1 h-3.5 w-3.5" /> Cancel step
              </Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" className="h-7 px-2" disabled={busy} onClick={() => run(() => setActivityStatusAction(activity.id, "open"), "Step reopened")}>
              <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reopen
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
            disabled={busy}
            onClick={() => setConfirming(true)}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
          </Button>
        </div>
      )}
    </li>
  );
}

/**
 * The application's next steps: open ones by date, the add form, and the
 * done or cancelled ones collapsed. Before migration 020 it is one quiet line.
 */
export default function NextSteps({ applicationId, items, setupPending, unavailable, initialKind }) {
  const today = useLocalToday();
  const [addOpen, setAddOpen] = useState(false);
  // ?step=<kind> opens the form for that kind, also when it changes while the
  // page is open, until the user closes it
  const [closedStep, setClosedStep] = useState(null);
  const adding = addOpen || Boolean(initialKind && closedStep !== initialKind);
  const setAdding = (open) => {
    setAddOpen(open);
    if (!open) setClosedStep(initialKind || null);
  };
  const [editingId, setEditingId] = useState(null);

  if (setupPending) {
    return <p className="text-xs text-muted-foreground">Next steps need migration 020</p>;
  }
  if (unavailable) {
    return <p className="text-xs text-muted-foreground">Next steps are unavailable right now. Reload to try again.</p>;
  }

  const open = items.filter((a) => a.status === "open").sort(byDate);
  const closed = items.filter((a) => a.status !== "open").sort(byDate);

  // Row buttons: run the action, toast the result; the server re-renders the list
  const run = async (action, message) => {
    const result = await action();
    if (result.ok) toast.success(message);
    else toast.error(result.error);
  };

  const create = async (values) => {
    const result = await createActivityAction({ applicationId, ...values });
    if (result.ok) {
      setAdding(false);
      toast.success("Step added");
    }
    return result;
  };

  const update = (id) => async (values) => {
    const result = await updateActivityAction(id, values);
    if (result.ok) {
      setEditingId(null);
      toast.success("Step updated");
    }
    return result;
  };

  return (
    <Card id="next-steps" className="scroll-mt-24">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ListTodo className="h-4 w-4 text-brand" /> Next steps
        </CardTitle>
        {!adding && (
          <Button size="sm" variant="outline" className="h-8" onClick={() => setAdding(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {adding && (
          <ActivityForm
            key={initialKind || "add"}
            initialKind={initialKind}
            onSubmit={create}
            onCancel={() => setAdding(false)}
          />
        )}

        {open.length === 0 && !adding && (
          <p className="text-sm text-muted-foreground">
            Nothing planned. Add a follow-up, an assessment deadline or an interview so it shows on your dashboard.
          </p>
        )}

        {open.length > 0 && (
          <ul className="divide-y">
            {open.map((activity) =>
              editingId === activity.id ? (
                <li key={activity.id} className="py-3">
                  <ActivityForm
                    initial={activity}
                    submitLabel="Save step"
                    onSubmit={update(activity.id)}
                    onCancel={() => setEditingId(null)}
                  />
                </li>
              ) : (
                <ActivityRow
                  key={activity.id}
                  activity={activity}
                  today={today}
                  run={run}
                  onEdit={() => setEditingId(activity.id)}
                />
              )
            )}
          </ul>
        )}

        {closed.length > 0 && (
          <details className="group text-sm">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
              Done and cancelled ({closed.length})
            </summary>
            <ul className="divide-y">
              {closed.map((activity) => (
                <ActivityRow key={activity.id} activity={activity} today={today} run={run} onEdit={() => {}} />
              ))}
            </ul>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
