"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ACTIVITY_KIND_LABELS,
  ACTIVITY_KINDS,
  CONTACT_CHANNEL_LABELS,
  CONTACT_CHANNELS,
  DEFAULT_TITLES,
  TIMED_KINDS,
  activityTimeFields,
  currentTimeZone,
  stepTimeFields,
} from "@/features/activities/kinds";

function initialState(initial, initialKind) {
  const kind = initial?.kind || initialKind || "follow_up";
  // A timed step shows its time in the zone it was entered in
  const { dueOn, time } = activityTimeFields(initial);
  return {
    kind,
    title: initial?.title ?? DEFAULT_TITLES[kind],
    dueOn,
    time,
    contactName: initial?.contactName || "",
    contactChannel: initial?.contactChannel || "",
    link: initial?.link || "",
    notes: initial?.notes || "",
  };
}

// Add or edit one next step. onSubmit gets the fields the server functions
// take and returns the action's { ok, error } result.
export default function ActivityForm({ initial, initialKind, submitLabel = "Add step", onSubmit, onCancel }) {
  const [form, setForm] = useState(() => initialState(initial, initialKind));
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const set = (field) => (value) => setForm((current) => ({ ...current, [field]: value }));
  const timed = TIMED_KINDS.includes(form.kind);
  const fieldId = (name) => `activity-${initial?.id || "new"}-${name}`;
  // Shown beside the time when the step's zone isn't the browser's
  const storedZone = initial?.startsAt ? activityTimeFields(initial).timeZone : null;
  const otherZone = storedZone && storedZone !== currentTimeZone() ? storedZone : null;

  // Changing the kind replaces the title only while it is still the default
  const changeKind = (kind) =>
    setForm((current) => ({
      ...current,
      kind,
      title: current.title.trim() === "" || current.title === DEFAULT_TITLES[current.kind] ? DEFAULT_TITLES[kind] : current.title,
    }));

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    const time = timed ? form.time : "";
    if (time && !form.dueOn) return setError("Pick a date before adding a time.");
    setPending(true);
    const result = await onSubmit({
      kind: form.kind,
      title: form.title,
      // The server turns the wall-clock time in this zone into the instant
      ...stepTimeFields({ dueOn: form.dueOn, time }, initial),
      contactName: form.contactName,
      contactChannel: form.contactChannel,
      link: form.link,
      notes: form.notes,
    }).finally(() => setPending(false));
    if (result && !result.ok) setError(result.error || "Could not save this step.");
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-md border bg-muted/30 p-3" aria-label={submitLabel}>
      <div className="space-y-1.5">
        <Label htmlFor={fieldId("kind")} className="text-xs">
          Kind
        </Label>
        <Select value={form.kind} onValueChange={changeKind}>
          <SelectTrigger id={fieldId("kind")} aria-label="Kind">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACTIVITY_KINDS.map((kind) => (
              <SelectItem key={kind} value={kind}>
                {ACTIVITY_KIND_LABELS[kind]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={fieldId("title")} className="text-xs">
          Title
        </Label>
        <Input
          id={fieldId("title")}
          value={form.title}
          onChange={(e) => set("title")(e.target.value)}
          maxLength={200}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor={fieldId("date")} className="text-xs">
            Date
          </Label>
          <Input id={fieldId("date")} type="date" value={form.dueOn} onChange={(e) => set("dueOn")(e.target.value)} />
        </div>
        {timed && (
          <div className="space-y-1.5">
            <Label htmlFor={fieldId("time")} className="text-xs">
              Time (optional)
            </Label>
            {otherZone && <p className="text-[11px] text-muted-foreground">In {otherZone}</p>}
            <Input id={fieldId("time")} type="time" value={form.time} onChange={(e) => set("time")(e.target.value)} />
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor={fieldId("contact")} className="text-xs">
            Contact
          </Label>
          <Input
            id={fieldId("contact")}
            value={form.contactName}
            onChange={(e) => set("contactName")(e.target.value)}
            maxLength={200}
            placeholder="Name"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={fieldId("channel")} className="text-xs">
            Channel
          </Label>
          <Select
            value={form.contactChannel || "none"}
            onValueChange={(v) => set("contactChannel")(v === "none" ? "" : v)}
          >
            <SelectTrigger id={fieldId("channel")} aria-label="Channel">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {CONTACT_CHANNELS.map((channel) => (
                <SelectItem key={channel} value={channel}>
                  {CONTACT_CHANNEL_LABELS[channel]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={fieldId("link")} className="text-xs">
          Link
        </Label>
        <Input
          id={fieldId("link")}
          value={form.link}
          onChange={(e) => set("link")(e.target.value)}
          maxLength={2000}
          placeholder="https://… (meeting or assessment link)"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={fieldId("notes")} className="text-xs">
          Notes
        </Label>
        <Textarea
          id={fieldId("notes")}
          value={form.notes}
          onChange={(e) => set("notes")(e.target.value)}
          maxLength={4000}
          className="min-h-[60px] text-sm"
        />
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
