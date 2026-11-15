"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { checkResumeReadability } from "@/features/resumes/api";

function groupBySection(missing) {
  const groups = new Map();
  for (const { section, text } of missing) groups.set(section, [...(groups.get(section) || []), text]);
  return [...groups];
}

function Summary({ result }) {
  if (result.status === "empty-resume") {
    return <p className="text-sm">There is nothing on this resume to print yet.</p>;
  }
  if (result.status === "no-text") {
    return <p className="text-sm">No text could be read from the PDF. A text extractor would find nothing in it.</p>;
  }
  const groups = groupBySection(result.missing);
  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">
        Read back {result.found} of {result.expected} lines from your PDF
        {result.pages ? <span className="font-normal text-muted-foreground"> ({result.pages} {result.pages === 1 ? "page" : "pages"} read)</span> : null}
      </p>
      {groups.length > 0 ? (
        <section aria-label="Lines not found">
          <h3 className="mb-1 text-sm font-medium">Not found in the extracted text</h3>
          <div className="space-y-2">
            {groups.map(([section, texts]) => (
              <div key={section}>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{section}</p>
                <ul className="mt-1 space-y-1">
                  {texts.map((line, index) => (
                    <li key={index} className="break-words rounded border bg-muted/40 px-2 py-1 text-sm">“{line}”</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {result.missing.some(({ text }) => /[À-ɏ]/.test(text)) ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Some PDF readers split accented letters (such as é) into a letter and a separate mark, so lines with accents can
              show here even when they print correctly.
            </p>
          ) : null}
        </section>
      ) : null}
      {result.contact.length > 0 ? (
        <section aria-label="Contact details">
          <h3 className="mb-1 text-sm font-medium">Contact details</h3>
          <ul className="space-y-1 text-sm">
            {result.contact.map((row) => (
              <li key={row.label} className="flex items-center gap-2">
                {row.found ? <Check className="h-4 w-4 shrink-0 text-green-600" aria-hidden /> : <X className="h-4 w-4 shrink-0 text-destructive" aria-hidden />}
                {row.label}: {row.found ? "found" : "not found"}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <p className="text-sm">
        Section headings {result.headingsInOrder ? "appear in the order they are printed" : `were read in a different order: ${result.headingOrder.join(", ")}`}.
      </p>
    </div>
  );
}

/**
 * "Check PDF text": compiles the saved resume, then shows what a PDF text extractor read
 * from it and which of the user's own lines it did not find. `flush` saves pending edits
 * first, so the check is of what the editor shows.
 */
export default function ReadabilityDialog({ open, onOpenChange, resumeId, flush }) {
  const [state, setState] = useState({ status: "idle", result: null });
  const runId = useRef(0);
  // The check starts when the dialog opens, not when these callbacks change identity
  const callbacks = useRef({ flush, onOpenChange });
  callbacks.current = { flush, onOpenChange };

  const run = useCallback(async () => {
    const id = ++runId.current;
    setState({ status: "loading", result: null });
    try {
      if (!(await callbacks.current.flush())) {
        if (id === runId.current) { setState({ status: "idle", result: null }); callbacks.current.onOpenChange(false); }
        return;
      }
      const result = await checkResumeReadability({ resumeId });
      if (id === runId.current) setState({ status: "done", result });
    } catch (error) {
      if (id !== runId.current) return;
      toast.error(error.message);
      setState({ status: "error", result: null });
    }
  }, [resumeId]);

  useEffect(() => {
    if (open) void run();
    else runId.current += 1;
  }, [open, run]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Check PDF text</DialogTitle>
          <DialogDescription>Compiles your saved resume (your latest edits are saved first) and reads the text back out of the PDF.</DialogDescription>
        </DialogHeader>
        {state.status === "loading" ? (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Building the PDF and reading it back...
          </p>
        ) : null}
        {state.status === "error" ? (
          <div className="space-y-2">
            <p className="text-sm text-destructive">The check could not be completed.</p>
            <Button size="sm" variant="outline" onClick={() => void run()}>Try again</Button>
          </div>
        ) : null}
        {state.status === "done" ? (
          <div className="space-y-4">
            <Summary result={state.result} />
            {state.result.status !== "empty-resume" ? (
              <details className="rounded border">
                <summary className="cursor-pointer px-2 py-1.5 text-sm font-medium">Text extracted from the PDF</summary>
                <pre aria-label="Text extracted from the PDF" className="max-h-64 overflow-auto whitespace-pre-wrap break-words border-t p-2 text-xs">{state.result.extractedText || "(no text)"}</pre>
              </details>
            ) : null}
            <p className="text-xs text-muted-foreground">
              This is what a PDF text extractor reads. Applicant tracking systems use different readers, so this is a check, not a guarantee.
            </p>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
