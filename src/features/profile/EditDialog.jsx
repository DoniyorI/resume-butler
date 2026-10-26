"use client";

import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// The draft lives inside the dialog content, which Radix unmounts on close,
// so every open starts from `initial`
function EditForm({ title, description, initial, onSave, onDelete, onDone, setBusy, children }) {
  const [draft, setDraft] = useState(initial);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState(null);
  const [pending, startTransition] = useTransition();

  const update = (changes) => setDraft((current) => ({ ...current, ...changes }));

  const run = (action) => {
    setBusy(true);
    startTransition(async () => {
      const result = await action();
      setBusy(false);
      if (result.ok) onDone();
      else setError(result.error);
    });
  };

  const submit = (event) => {
    event.preventDefault();
    run(() => onSave(draft));
  };

  const remove = () => {
    if (confirmingDelete) run(onDelete);
    else setConfirmingDelete(true);
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>

      <div className="space-y-4">{children(draft, update)}</div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <DialogFooter className="gap-2 sm:justify-between">
        {onDelete ? (
          <Button
            type="button"
            variant="ghost"
            onClick={remove}
            disabled={pending}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            {confirmingDelete ? "Click again to delete" : "Delete"}
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending} className="bg-brand hover:bg-brand/90">
            {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </div>
      </DialogFooter>
    </form>
  );
}

/**
 * Edit (or add) one entry in a dialog. `onSave(draft)` and `onDelete()` return
 * a promise of { ok, error }; on failure the dialog stays open with the draft.
 * `children(draft, update)` renders the fields.
 */
export default function EditDialog({ open, onOpenChange, initial, ...formProps }) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        {initial && (
          <EditForm initial={initial} onDone={() => onOpenChange(false)} setBusy={setBusy} {...formProps} />
        )}
      </DialogContent>
    </Dialog>
  );
}
