"use client";
import { useState, useTransition } from "react";
import { BriefcaseBusiness, Link2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { loadApplicationJob } from "@/features/resumes/actions";

function jobName({ role, company }) {
  if (role && company) return `${role} at ${company}`;
  return role || company || "Pasted job description";
}

function JobForm({ target, jobOptions, onSave, onCancel }) {
  const [text, setText] = useState(target.applicationId ? "" : target.jobDescription);
  const [error, setError] = useState(null);
  const [pending, startTransition] = useTransition();
  const { applications, linked } = jobOptions;

  const pickApplication = (applicationId) => {
    setError(null);
    startTransition(async () => {
      const result = await loadApplicationJob(applicationId);
      if (!result.ok) return setError(result.error);
      if (!result.data.jobDescription.trim()) return setError("That application has no job description yet");
      onSave(result.data);
    });
  };

  const savePasted = () => {
    if (!text.trim()) return setError("Paste the job description first");
    onSave({ jobDescription: text.trim(), applicationId: null, company: "", role: "" });
  };

  return (
    <div className="space-y-4">
      {linked?.jobDescription && linked.applicationId !== target.applicationId && (
        <button
          type="button"
          onClick={() => onSave(linked)}
          className="flex w-full items-start gap-3 rounded-lg border border-brand/40 bg-brand/5 p-3 text-left hover:bg-brand/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          <span>
            <span className="block text-sm font-medium">{jobName(linked)}</span>
            <span className="block text-xs text-muted-foreground">
              This resume is attached to it. Use its job description.
            </span>
          </span>
        </button>
      )}

      {applications.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">From your applications</Label>
          <Select onValueChange={pickApplication} disabled={pending}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Choose an application" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {applications.map((app) => (
                <SelectItem key={app.id} value={app.id}>
                  {jobName(app)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="job-description" className="text-xs font-medium text-muted-foreground">
          {applications.length > 0 ? "Or paste a job description" : "Paste the job description"}
        </Label>
        <Textarea
          id="job-description"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="About the role, responsibilities, requirements..."
          className="min-h-[140px] text-sm"
          maxLength={20_000}
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button size="sm" onClick={savePasted} disabled={pending} className="flex-1">
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Use this job description
        </Button>
        {onCancel && (
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * The job this resume is tailored for. Saved with the resume, so match scores
 * and AI suggestions use it without pasting it again.
 */
export default function JobTarget({ target, jobOptions, onChange }) {
  const hasJob = Boolean(target.jobDescription.trim());
  const [editing, setEditing] = useState(!hasJob);
  const [expanded, setExpanded] = useState(false);

  const save = (next) => {
    onChange(next);
    setEditing(false);
  };

  if (editing || !hasJob) {
    return (
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold">Which job is this resume for?</h3>
          <p className="text-xs text-muted-foreground">
            The match score and AI suggestions are tailored to it. It&apos;s saved with this resume.
          </p>
        </div>
        <JobForm
          target={target}
          jobOptions={jobOptions}
          onSave={save}
          onCancel={hasJob ? () => setEditing(false) : null}
        />
      </section>
    );
  }

  return (
    <section className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <BriefcaseBusiness className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Tailoring for</p>
            <p className="truncate text-sm font-semibold">{jobName(target)}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 px-2 text-xs"
          onClick={() => setEditing(true)}
        >
          Change
        </Button>
      </div>
      <p
        className={
          expanded
            ? "whitespace-pre-line text-xs text-muted-foreground"
            : "line-clamp-3 text-xs text-muted-foreground"
        }
      >
        {target.jobDescription}
      </p>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="text-xs font-medium text-brand hover:underline"
      >
        {expanded ? "Show less" : "Show the full description"}
      </button>
    </section>
  );
}
