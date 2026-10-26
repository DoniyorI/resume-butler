"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCoverLetter } from "@/features/cover-letters/actions";
import { createResume } from "@/features/resumes/actions";
import { TYPE_LABELS } from "@/features/documents/documentTypes";

// Name-a-document dialog shared by "New" and "Rename". `onSubmit(name)`
// returns { ok, error } (or never resolves when it redirects to the new document).
function NameDialog({ open, onOpenChange, title, description, submitLabel, initialName, onSubmit }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && (
          <NameForm
            title={title}
            description={description}
            submitLabel={submitLabel}
            initialName={initialName}
            onSubmit={onSubmit}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function NameForm({ title, description, submitLabel, initialName, onSubmit, onCancel }) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState(null);
  const [pending, startTransition] = useTransition();

  const submit = (event) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Give it a name");
      return;
    }
    startTransition(async () => {
      const result = await onSubmit(trimmed);
      if (result && !result.ok) setError(result.error);
    });
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>
      <div className="space-y-1.5">
        <Label htmlFor="document-name" className="text-xs font-medium text-muted-foreground">
          Name
        </Label>
        <Input
          id="document-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Stripe — Backend Engineer"
          maxLength={200}
          autoFocus
          className="h-9"
        />
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending} className="bg-brand hover:bg-brand/90">
          {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}

const CREATE = { resume: createResume, coverLetter: createCoverLetter };

// Creating opens the new document's editor (the action redirects)
export function NewDocumentDialog({ type, onOpenChange }) {
  const label = type ? TYPE_LABELS[type].toLowerCase() : "";
  return (
    <NameDialog
      open={Boolean(type)}
      onOpenChange={onOpenChange}
      title={`New ${label}`}
      description="Name it after the job it's for, so you can find it later."
      submitLabel={`Create ${label}`}
      initialName=""
      onSubmit={(name) => CREATE[type]({ title: name })}
    />
  );
}

export function RenameDialog({ document, onOpenChange, onRename }) {
  return (
    <NameDialog
      open={Boolean(document)}
      onOpenChange={onOpenChange}
      title="Rename"
      submitLabel="Save name"
      initialName={document?.title || ""}
      onSubmit={onRename}
    />
  );
}

export function DeleteDialog({ document, onOpenChange, onDelete }) {
  const [pending, startTransition] = useTransition();
  const uses = document?.applications.length || 0;

  return (
    <Dialog open={Boolean(document)} onOpenChange={(open) => !pending && onOpenChange(open)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete “{document?.title}”?</DialogTitle>
          <DialogDescription>
            This can&apos;t be undone.
            {uses > 0 &&
              ` ${uses === 1 ? "One application uses" : `${uses} applications use`} it; they'll keep everything else.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={pending} onClick={() => startTransition(() => onDelete())}>
            {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
