"use client";
import { AlertTriangle, Check, Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import FitGauge from "@/features/resumes/studio/FitGauge";
import JobTarget from "@/features/resumes/studio/assistant/JobTarget";

const TONES = [
  { value: "professional", label: "Professional" },
  { value: "warm", label: "Warm" },
  { value: "direct", label: "Direct" },
];

const LENGTHS = [
  { value: "short", label: "Short" },
  { value: "standard", label: "Standard" },
];

function Segmented({ label, options, value, onChange }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div
        role="radiogroup"
        aria-label={label}
        className="grid rounded-md bg-muted p-1 text-sm"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded px-2 py-1 font-medium text-muted-foreground",
              value === option.value && "bg-background text-foreground shadow-sm"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// The AI's draft, shown before it replaces the letter's paragraphs
function DraftPreview({ draft, onApply, onDiscard }) {
  return (
    <section
      className="space-y-3 rounded-lg border border-brand/40 bg-brand/5 p-3"
      aria-labelledby="draft-heading"
    >
      <div className="flex items-center justify-between">
        <h3 id="draft-heading" className="text-sm font-semibold">
          Draft
        </h3>
        <button
          type="button"
          onClick={onDiscard}
          className="rounded p-1 text-muted-foreground hover:bg-background"
          aria-label="Discard the draft"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {draft.unsupported.length > 0 && (
        <p className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Mentions {draft.unsupported.join(", ")}, which{" "}
            {draft.unsupported.length === 1 ? "isn't" : "aren't"} in your Master CV. Remove{" "}
            {draft.unsupported.length === 1 ? "it" : "them"} unless it&apos;s true.
          </span>
        </p>
      )}

      <div className="max-h-80 space-y-2 overflow-y-auto rounded-md bg-background p-3 text-sm leading-relaxed">
        {draft.paragraphs.map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </div>

      {draft.highlights.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground">From your Master CV</p>
          <ul className="mt-1 space-y-0.5">
            {draft.highlights.map((highlight, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs">
                <Check className="mt-0.5 h-3 w-3 shrink-0 text-brand" /> {highlight}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Button size="sm" className="w-full" onClick={onApply}>
        Use this draft
      </Button>
      <p className="text-center text-[11px] text-muted-foreground">
        Replaces the paragraphs on the page. You can undo it.
      </p>
    </section>
  );
}

/**
 * Right-hand panel of the letter editor: page fit, the job the letter is for,
 * and an AI draft (tone and length, previewed before it's applied).
 */
export default function LetterAssistant({ fit, pdfCheck, onCheckPdf, job, draft, onClose }) {
  const hasJob = Boolean(job.target.jobDescription.trim());

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Assistant</h2>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 xl:hidden"
            onClick={onClose}
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        <section aria-label="Page fit">
          <FitGauge fit={fit} pdfCheck={pdfCheck} onCheckPdf={onCheckPdf} />
        </section>

        <div className="border-t pt-4">
          <JobTarget
            target={job.target}
            jobOptions={job.options}
            onChange={job.onChange}
            documentLabel="cover letter"
          />
        </div>

        {hasJob && (
          <section className="space-y-3 border-t pt-4" aria-labelledby="draft-tools-heading">
            <div>
              <h3 id="draft-tools-heading" className="text-sm font-semibold">
                Draft with AI
              </h3>
              <p className="text-xs text-muted-foreground">
                Written from your Master CV for this job. Nothing is invented; check it before you send.
              </p>
            </div>
            <Segmented label="Tone" options={TONES} value={draft.tone} onChange={draft.setTone} />
            <Segmented label="Length" options={LENGTHS} value={draft.length} onChange={draft.setLength} />
            <Button className="w-full" onClick={draft.onDraft} disabled={draft.drafting}>
              {draft.drafting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {draft.drafting ? "Drafting" : draft.result ? "Draft again" : "Draft the letter"}
            </Button>
            {draft.result && (
              <DraftPreview draft={draft.result} onApply={draft.onApply} onDiscard={draft.onDiscard} />
            )}
          </section>
        )}
      </div>
    </div>
  );
}
