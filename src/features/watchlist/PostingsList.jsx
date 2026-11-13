"use client";
import { useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, ExternalLink, MapPin } from "lucide-react";
import LocalDateTime from "@/components/shared/LocalDateTime";
import { safeHttpUrl } from "@/lib/safeUrl";
import { BANDS, CHECK_KINDS } from "@/features/opportunities/JobFit";
import { dismissWatchedPosting, saveWatchedPosting } from "./actions";

const WORKPLACE = { remote: "Remote", hybrid: "Hybrid", onsite: "On-site" };
const button = "rounded-md border px-3 py-2 hover:bg-muted disabled:opacity-60";

function PostingCard({ posting, onGone }) {
  const router = useRouter();
  const checksId = useId();
  const [busy, setBusy] = useState(""), [error, setError] = useState(""), [showChecks, setShowChecks] = useState(false);
  const { fit } = posting;
  const band = fit ? BANDS[fit.band] || BANDS.unknown : null;
  const href = safeHttpUrl(posting.url);
  const checks = (fit?.checks || []).filter((check) => check?.quote);
  const place = [posting.location, WORKPLACE[posting.workplaceType] || posting.workplaceType].filter(Boolean).join(" · ");

  async function run(name, action, done) {
    setBusy(name); setError("");
    try {
      const result = await action();
      if (!result.ok) { setError(result.error); return; }
      done();
      onGone(posting.id);
      router.refresh();
    } finally {
      setBusy("");
    }
  }
  const save = () => run("save", () => saveWatchedPosting(posting.id), () =>
    toast.success("Saved to Saved jobs", { description: <Link href="/saved-jobs" className="underline">Open Saved jobs</Link> }));
  const dismiss = () => run("dismiss", () => dismissWatchedPosting(posting.id), () => {});

  return (
    <article className="flex flex-col rounded-xl border bg-white p-5 shadow-sm">
      {band ? (
        <div className="mb-3">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${band.tone}`}><band.Icon size={13} aria-hidden="true" />{band.label}</span>
          {fit.reason ? <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{fit.reason}</p> : null}
        </div>
      ) : <p className="mb-3 text-xs text-muted-foreground">Fit unavailable</p>}
      <h3 className="break-words text-lg font-semibold leading-snug">{posting.title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{posting.companyName}</p>
      {place ? <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin size={13} />{place}</p> : null}
      <p className="mt-2 text-xs text-muted-foreground">First seen <LocalDateTime value={posting.firstSeenAt} format="date" /></p>
      {fit?.missing?.length ? <p className="mt-3 break-words text-xs text-muted-foreground">Not in your Master CV: {fit.missing.join(", ")}</p> : null}
      {checks.length ? (
        <div className="mt-3">
          <button type="button" aria-expanded={showChecks} aria-controls={checksId} onClick={() => setShowChecks(!showChecks)} className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
            Only you can judge <ChevronDown size={13} className={showChecks ? "rotate-180" : ""} aria-hidden="true" />
          </button>
          <div id={checksId}>{showChecks ? (
            <ul className="mt-2 space-y-1.5 text-xs">
              {checks.map((check) => <li key={check.kind} className="break-words leading-relaxed"><span className="font-medium">{CHECK_KINDS[check.kind] || "Check"}:</span> <span className="text-muted-foreground">“{check.quote}”</span></li>)}
            </ul>
          ) : null}</div>
        </div>
      ) : null}
      <div className="mt-auto flex flex-wrap items-center gap-3 pt-4 text-xs font-medium">
        <button type="button" disabled={Boolean(busy)} onClick={save} className="rounded-md bg-brand px-3 py-2 text-white hover:bg-brand/90 disabled:opacity-60">{busy === "save" ? "Saving…" : "Save job"}</button>
        <button type="button" disabled={Boolean(busy)} onClick={dismiss} className={button}>{busy === "dismiss" ? "Dismissing…" : "Dismiss"}</button>
        {href ? <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand hover:underline">Open posting <ExternalLink size={12} /></a> : null}
      </div>
      {error ? <p role="alert" className="mt-3 text-xs text-red-700">{error}</p> : null}
    </article>
  );
}

export default function PostingsList({ postings }) {
  // Cards leave at once; the refresh that follows removes them from the server list
  const [gone, setGone] = useState(() => new Set());
  const remaining = postings.filter((posting) => !gone.has(posting.id));
  if (!remaining.length) return null;
  return <div className="grid items-start gap-4 md:grid-cols-2">{remaining.map((posting) => <PostingCard key={posting.id} posting={posting} onGone={(id) => setGone((set) => new Set(set).add(id))} />)}</div>;
}
