"use client";

import { useId, useState } from "react";
import { ArrowRight, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { safeHttpUrl } from "@/lib/safeUrl";

export default function MatchTargetPicker({ candidates = [], onResolve }) {
  const name = useId();
  const [choice, setChoice] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const selected = candidates.some(candidate => candidate.id === choice) || choice === "new";
  const resolve = async () => {
    if (!selected || pending) return;
    setPending(true); setError("");
    try {
      const result = await onResolve({ applicationId: choice === "new" ? null : choice, createNew: choice === "new" });
      if (!result?.ok) setError(result?.error || "Couldn't save this match. Try again.");
    } catch { setError("Couldn't save this match. Your item is still waiting safely."); }
    finally { setPending(false); }
  };
  return (
    <div className="space-y-3">
      <fieldset disabled={pending} className="space-y-2">
        <legend className="mb-2 text-xs font-medium text-muted-foreground">Choose where this belongs</legend>
        <div className="max-h-64 space-y-2 overflow-y-auto p-0.5">
          {candidates.map(candidate => (
            <label key={candidate.id} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors focus-within:ring-2 focus-within:ring-ring ${choice === candidate.id ? "border-brand bg-brand/5" : "bg-background hover:border-brand/40"}`}>
              <input type="radio" name={name} value={candidate.id} checked={choice === candidate.id} onChange={() => setChoice(candidate.id)} className="mt-1 accent-[#559F87]" />
              <span className="min-w-0 flex-1 space-y-1">
                <span className="block text-sm font-medium">{candidate.role || "Untitled role"}</span>
                <span className="block text-xs text-muted-foreground">{candidate.company} · Applied {candidate.appliedDate || "date unknown"}</span>
                {safeHttpUrl(candidate.url) && <span className="block break-all text-xs text-muted-foreground">{candidate.url}</span>}
              </span>
              <Badge variant={candidate.status?.toLowerCase()} className="shrink-0 font-normal">{candidate.status}</Badge>
            </label>
          ))}
          <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors focus-within:ring-2 focus-within:ring-ring ${choice === "new" ? "border-brand bg-brand/5" : "border-dashed bg-background hover:border-brand/40"}`}>
            <input type="radio" name={name} value="new" checked={choice === "new"} onChange={() => setChoice("new")} className="mt-1 accent-[#559F87]" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-sm font-medium"><Plus className="h-3.5 w-3.5" /> This is a separate application</span>
              <span className="mt-1 block text-xs text-muted-foreground">Create a new record and keep the others unchanged.</span>
            </span>
          </label>
        </div>
      </fieldset>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">Nothing changes until you confirm.</p>
        <Button size="sm" disabled={!selected || pending} onClick={resolve}>
          {pending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="mr-2 h-3.5 w-3.5" />}
          {pending ? "Saving match…" : choice === "new" ? "Create application" : "Confirm match"}
        </Button>
      </div>
    </div>
  );
}
