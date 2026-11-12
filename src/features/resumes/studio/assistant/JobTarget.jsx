"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { Bookmark, BriefcaseBusiness, Link2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { loadApplicationJob, loadSavedJob } from "@/features/resumes/actions";

function jobName({ role, company }) {
  if (role && company) return `${role} at ${company}`;
  return role || company || "Pasted job description";
}

// Forget ?job= once it's been handled, so a reload doesn't ask again
function clearJobParam() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("job")) return;
  url.searchParams.delete("job");
  window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
}

/**
 * A saved job opened with ?job= (getDeepLinkedJob in features/resumes/data.js).
 * A document without a job adopts it; one aimed at another job gets a prompt
 * to switch, never a silent replacement. Returns { pending, onUse, onDismiss }.
 */
export function useLinkedJob(linkedJob, onChange) {
  const [pending, setPending] = useState(linkedJob && !linkedJob.adopt ? linkedJob.target : null);
  const adopted = useRef(false);
  useEffect(() => {
    if (!linkedJob?.adopt || adopted.current) return;
    adopted.current = true;
    onChange(linkedJob.target);
    clearJobParam();
  }, [linkedJob, onChange]);
  return {
    pending,
    onUse: () => { onChange(pending); setPending(null); clearJobParam(); },
    onDismiss: () => { setPending(null); clearJobParam(); },
  };
}

function SwitchPrompt({ linked, documentLabel }) {
  if (!linked?.pending) return null;
  return (
    <div role="status" className="flex items-start gap-3 rounded-lg border border-brand/40 bg-brand/5 p-3">
      <Bookmark className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-xs">
          This {documentLabel} is aimed at another job. Switch to the saved job{" "}
          <span className="font-medium">{jobName(linked.pending)}</span>?
        </p>
        <div className="flex gap-2">
          <Button size="sm" className="h-7 px-2 text-xs" onClick={linked.onUse}>
            Switch
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={linked.onDismiss}>
            Keep current
          </Button>
        </div>
      </div>
    </div>
  );
}

function JobForm({ target, jobOptions, onSave, onCancel, documentLabel }) {
  const [text, setText] = useState(target.applicationId || target.opportunityId ? "" : target.jobDescription);
  const [error, setError] = useState(null);
  const [pending, startTransition] = useTransition();
  const { applications, linked } = jobOptions;
  const savedJobs = jobOptions.savedJobs || [];
  const hasChoices = applications.length > 0 || savedJobs.length > 0;

  const pick = (load, emptyMessage) => (id) => {
    setError(null);
    startTransition(async () => {
      const result = await load(id);
      if (!result.ok) return setError(result.error);
      if (!result.data.jobDescription.trim()) return setError(emptyMessage);
      onSave(result.data);
    });
  };
  const pickApplication = pick(loadApplicationJob, "That application has no job description yet");
  const pickSavedJob = pick(loadSavedJob, "That saved job has no job description yet");

  const savePasted = () => {
    if (!text.trim()) return setError("Paste the job description first");
    onSave({ jobDescription: text.trim(), applicationId: null, opportunityId: null, company: "", role: "" });
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
              This {documentLabel} is attached to it. Use its job description.
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

      {savedJobs.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">From your saved jobs</Label>
          <Select onValueChange={pickSavedJob} disabled={pending}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Choose a saved job" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {savedJobs.map((job) => (
                <SelectItem key={job.id} value={job.id}>
                  {jobName(job)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="job-description" className="text-xs font-medium text-muted-foreground">
          {hasChoices ? "Or paste a job description" : "Paste the job description"}
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
 * The job the document (`documentLabel`: "resume" or "cover letter") is
 * tailored for. Saved with it, so match scores
 * and AI suggestions use it without pasting it again.
 */
export default function JobTarget({ target, jobOptions, onChange, linked, documentLabel = "resume" }) {
  const hasJob = Boolean(target.jobDescription.trim());
  const [editing, setEditing] = useState(!hasJob);
  const [expanded, setExpanded] = useState(false);

  // A job set from outside the form (an opened saved job) is shown, not edited
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (target.jobDescription.trim()) setEditing(false);
  }, [target]);

  const save = (next) => {
    onChange(next);
    setEditing(false);
  };

  if (editing || !hasJob) {
    return (
      <section className="space-y-3">
        <SwitchPrompt linked={linked} documentLabel={documentLabel} />
        <div>
          <h3 className="text-sm font-semibold">Which job is this {documentLabel} for?</h3>
          <p className="text-xs text-muted-foreground">
            The AI is tailored to it. It&apos;s saved with this {documentLabel}.
          </p>
        </div>
        <JobForm
          target={target}
          jobOptions={jobOptions}
          documentLabel={documentLabel}
          onSave={save}
          onCancel={hasJob ? () => setEditing(false) : null}
        />
      </section>
    );
  }

  return (
    <section className="space-y-2">
      <SwitchPrompt linked={linked} documentLabel={documentLabel} />
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
