"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import LocalDateTime from "@/components/shared/LocalDateTime";
import { checkCompanyNow, unwatchCompany, updateWatchKeywords } from "./actions";

const PLATFORMS = { greenhouse: "Greenhouse", lever: "Lever", ashby: "Ashby" };
const input = "min-w-0 flex-1 rounded-md border border-input bg-white px-2 py-1 text-xs outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 disabled:opacity-60";
const button = "rounded-md border px-3 py-1.5 hover:bg-muted disabled:opacity-60";

function CompanyRow({ company, kept }) {
  const router = useRouter();
  // "" | "check" | "keywords" | "remove": set before the await, cleared in finally
  const [busy, setBusy] = useState("");
  const [editing, setEditing] = useState(false), [draft, setDraft] = useState(company.keywords.join(", "));
  const [removing, setRemoving] = useState(false), [error, setError] = useState("");

  async function run(name, action, done) {
    setBusy(name); setError("");
    try {
      const result = await action();
      if (!result.ok) { setError(result.error); return; }
      done(result.data);
      router.refresh();
    } finally {
      setBusy("");
    }
  }

  const saveKeywords = (e) => {
    e.preventDefault();
    return run("keywords", () => updateWatchKeywords(company.id, draft), () => { setEditing(false); toast.success("Keywords saved. They apply the next time the board is checked."); });
  };
  const checkNow = () => run("check", () => checkCompanyNow(company.id), (data) => {
    if (data.skipped) setError("Checked a moment ago. Try again in a minute.");
    else if (data.error) setError(data.error);
    else toast.success(`Checked ${company.name}: ${data.added} new, ${data.closed} closed.`);
  });
  const remove = () => run("remove", () => unwatchCompany(company.id), () => toast(`Stopped watching ${company.name}. Jobs you saved stay in Saved jobs.`));

  return (
    <li className="space-y-3 rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="min-w-0 break-words font-semibold">{company.name} <span className="text-xs font-normal text-muted-foreground">{PLATFORMS[company.platform] || company.platform}</span></p>
        <p className="text-xs text-muted-foreground">
          {kept} of {company.openCount ?? "?"} open roles kept · Last checked{" "}
          {company.lastCheckedAt ? <LocalDateTime value={company.lastCheckedAt} /> : "never"}
        </p>
      </div>
      {company.lastError ? <p className="text-xs text-red-700">{company.lastError}</p> : null}
      {editing ? (
        <form onSubmit={saveKeywords} className="flex flex-wrap items-center gap-2">
          <input aria-label={`Job titles to keep at ${company.name}`} value={draft} onChange={(e) => setDraft(e.target.value)} disabled={busy === "keywords"} maxLength={2000} className={input} placeholder="engineer, data" />
          <button disabled={busy === "keywords"} className="text-xs font-medium text-brand">{busy === "keywords" ? "Saving…" : "Save"}</button>
          <button type="button" disabled={busy === "keywords"} onClick={() => { setEditing(false); setDraft(company.keywords.join(", ")); }} className="text-xs">Cancel</button>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {company.keywords.length ? company.keywords.map((word) => <span key={word} className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">{word}</span>) : <span className="text-muted-foreground">All titles (100 newest)</span>}
          <button type="button" onClick={() => setEditing(true)} className="font-medium text-brand hover:underline">Edit titles</button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3 text-xs font-medium">
        <button type="button" disabled={Boolean(busy)} onClick={checkNow} className={button}>{busy === "check" ? "Checking…" : "Check now"}</button>
        {removing ? (
          <span className="flex flex-wrap items-center gap-3 font-normal">
            Remove {company.name}? Its open roles leave this list; jobs you saved stay in Saved jobs.
            <button type="button" disabled={Boolean(busy)} onClick={remove} className="font-medium text-red-700">{busy === "remove" ? "Removing…" : "Remove"}</button>
            <button type="button" disabled={Boolean(busy)} onClick={() => setRemoving(false)}>Keep it</button>
          </span>
        ) : <button type="button" disabled={Boolean(busy)} onClick={() => setRemoving(true)} className={button}>Remove</button>}
      </div>
      {error ? <p role="alert" className="text-xs text-red-700">{error}</p> : null}
    </li>
  );
}

export default function CompanyList({ companies, keptByCompany }) {
  return <ul className="grid gap-3 md:grid-cols-2">{companies.map((company) => <CompanyRow key={company.id} company={company} kept={keptByCompany[company.id] || 0} />)}</ul>;
}
