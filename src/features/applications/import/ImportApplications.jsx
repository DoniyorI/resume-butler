"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { undoImportAction } from "@/features/applications/importActions";

const FIELD_LABELS = [
  ["company", "Company"], ["role", "Role"], ["status", "Status"], ["appliedDate", "Applied date"], ["location", "Location"],
  ["link", "Link"], ["pay", "Pay"], ["workplace", "Workplace"], ["employmentType", "Employment type"], ["notes", "Notes"],
];
const OUTCOMES = {
  ready: ["Ready", "bg-emerald-50 text-emerald-800"],
  duplicate: ["Already tracked", "bg-amber-50 text-amber-900"],
  undated: ["No date", "bg-amber-50 text-amber-900"],
  error: ["Problem", "bg-red-50 text-red-800"],
};
const select = "w-full rounded-lg border border-input bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 disabled:opacity-60";
const card = "space-y-4 rounded-xl border bg-white p-5 shadow-sm";

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const localToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

function totalsLine({ ready, duplicates, undated, errors }) {
  const parts = [`${ready} ready`];
  if (duplicates) parts.push(`${duplicates} already tracked`);
  if (undated) parts.push(`${undated} without a readable date`);
  if (errors) parts.push(`${plural(errors, "problem", "problems")}`);
  return parts.join(", ");
}

function skippedLine(result) {
  const { duplicates, undated, errors } = result.skipped;
  const parts = [];
  if (duplicates) parts.push(`${plural(duplicates, "row", "rows")} already tracked`);
  if (undated) parts.push(`${plural(undated, "row", "rows")} without a readable date`);
  if (errors) parts.push(`${plural(errors, "row", "rows")} with a problem`);
  return parts.length ? `Skipped: ${parts.join(", ")}.` : "";
}

export default function ImportApplications() {
  const [file, setFile] = useState(null);
  const [options, setOptions] = useState({ undated: "skip", includeDuplicates: false });
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [undone, setUndone] = useState(null);
  const latest = useRef(0);

  async function send(mode, nextFile, nextOptions) {
    const body = new FormData();
    body.append("file", nextFile);
    body.append("mode", mode);
    body.append("options", JSON.stringify({ ...nextOptions, today: localToday() }));
    const response = await fetch("/api/import-applications", { method: "POST", body });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Something went wrong. Please try again.");
    return data;
  }

  async function refresh(nextFile, nextOptions) {
    const ticket = ++latest.current;
    setBusy(true);
    try {
      const data = await send("preview", nextFile, nextOptions);
      if (ticket === latest.current) setPreview(data);
    } catch (error) {
      if (ticket === latest.current) { setPreview(null); toast.error(error.message); }
    } finally {
      if (ticket === latest.current) setBusy(false);
    }
  }

  function choose(event) {
    const chosen = event.target.files?.[0];
    if (!chosen) return;
    const fresh = { undated: "skip", includeDuplicates: false };
    setFile(chosen); setOptions(fresh); setResult(null); setUndone(null); setPreview(null);
    refresh(chosen, fresh);
  }

  function change(patch) {
    const next = { ...options, ...patch };
    setOptions(next);
    refresh(file, next);
  }

  const setMapping = (field, value) => change({ mapping: { ...preview.mapping, [field]: value === "" ? null : Number(value) } });

  async function runImport() {
    if (busy) return;
    setBusy(true);
    try {
      const data = await send("commit", file, options);
      setResult(data); setUndone(null); setPreview(null);
      toast.success(`Imported ${plural(data.imported, "application", "applications")}.`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    if (busy || !result?.ids.length) return;
    setBusy(true);
    try {
      const outcome = await undoImportAction({ ids: result.ids });
      if (!outcome.ok) { toast.error(outcome.error); return; }
      setUndone(outcome.data.removed);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    latest.current++;
    setFile(null); setPreview(null); setResult(null); setUndone(null); setOptions({ undated: "skip", includeDuplicates: false });
  }

  const totals = preview?.totals;
  const dateMapped = preview && preview.mapping.appliedDate !== null && preview.mapping.appliedDate !== undefined;

  return (
    <div className="space-y-6">
      {result ? (
        <section className={card} aria-live="polite">
          <h2 className="font-semibold">Imported {plural(result.imported, "application", "applications")}.</h2>
          {skippedLine(result) ? <p className="text-sm text-muted-foreground">{skippedLine(result)}</p> : null}
          {result.failed ? <p className="text-sm text-red-700">{plural(result.failed, "row", "rows")} could not be saved. Try importing the file again; rows already added are skipped as already tracked.</p> : null}
          {result.truncated ? <p className="text-sm text-muted-foreground">The file has more than 500 rows. Only the first 500 were read; import the rest in a second file.</p> : null}
          {undone !== null ? <p className="text-sm">Removed {plural(undone, "application", "applications")}.</p> : null}
          <div className="flex flex-wrap items-center gap-3">
            {undone === null && result.ids.length ? <Button type="button" variant="outline" size="sm" onClick={undo} disabled={busy}>Undo import</Button> : null}
            <Link href="/applications" className="text-sm font-medium text-brand hover:underline">Go to applications</Link>
            <Button type="button" variant="ghost" size="sm" onClick={reset}>Import another file</Button>
          </div>
        </section>
      ) : (
        <section className={card}>
          <div className="space-y-1.5">
            <label htmlFor="import-file" className="text-xs font-medium">Spreadsheet file (CSV)</label>
            <input id="import-file" type="file" accept=".csv,.tsv,.txt,text/csv" onChange={choose} disabled={busy}
              className="block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-white file:px-3 file:py-2 file:text-xs file:font-medium hover:file:bg-muted" />
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Export your sheet as CSV. The first row must be column headings. Resume Butler recognises company, role, status, applied date, location, link, pay, workplace, employment type and notes, and you can match columns yourself after choosing a file. Files can be up to 1 MB and 500 rows. Nothing is imported until you confirm.
          </p>
        </section>
      )}

      {!result && file && !preview && busy ? <p className="text-sm text-muted-foreground" role="status">Reading {file.name}…</p> : null}

      {preview && !result ? (
        <>
          <section className={card} aria-label="Columns">
            <h2 className="font-semibold">Check the columns</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FIELD_LABELS.map(([field, label]) => (
                <div key={field} className="space-y-1.5 text-xs font-medium">
                  <label htmlFor={`map-${field}`}>{label}{field === "company" ? " (required)" : ""}</label>
                  <select id={`map-${field}`} className={select} disabled={busy} value={preview.mapping[field] ?? ""} onChange={(e) => setMapping(field, e.target.value)}>
                    <option value="">Not in this file</option>
                    {preview.headers.map((heading, index) => <option key={index} value={index}>{heading || `Column ${index + 1}`}</option>)}
                  </select>
                </div>
              ))}
              {dateMapped ? (
                <div className="space-y-1.5 text-xs font-medium">
                  <label htmlFor="import-date-order">Date order</label>
                  <select id="import-date-order" className={select} disabled={busy} value={preview.dateOrder} onChange={(e) => change({ dateOrder: e.target.value })}>
                    <option value="mdy">Month/day/year</option>
                    <option value="dmy">Day/month/year</option>
                  </select>
                </div>
              ) : null}
            </div>
            {dateMapped && preview.dateOrderAmbiguous ? <p className="text-sm text-amber-900">These dates can be read both ways; check the first rows below.</p> : null}
          </section>

          {preview.needsMapping ? (
            <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">Resume Butler could not tell which column holds the company name. Choose it above.</p>
          ) : (
            <>
              <section className={card} aria-label="Preview">
                <h2 className="font-semibold">Preview</h2>
                <p className="text-sm" role="status">{totalsLine(totals)}</p>
                {totals.truncated ? <p className="text-sm text-muted-foreground">This file has more than 500 rows. Only the first 500 will be imported; import the rest in a second file.</p> : null}
                {preview.unknownStatuses.length ? (
                  <p className="text-sm text-muted-foreground">
                    These statuses are not ones Resume Butler uses and will be imported as Applied, with the original kept in the notes: {preview.unknownStatuses.map((s) => `${s.value} (${s.count})`).join(", ")}.
                  </p>
                ) : null}
                {totals.undated > 0 || options.undated === "today" ? (
                  <fieldset className="space-y-2 text-sm" disabled={busy}>
                    <legend className="mb-1 text-xs font-medium">Rows without a readable date</legend>
                    <label className="flex items-center gap-2"><input type="radio" name="undated" checked={options.undated !== "today"} onChange={() => change({ undated: "skip" })} /> Skip rows without a readable date</label>
                    <label className="flex items-center gap-2"><input type="radio" name="undated" checked={options.undated === "today"} onChange={() => change({ undated: "today" })} /> Import them dated today</label>
                  </fieldset>
                ) : null}
                {totals.duplicates > 0 || options.includeDuplicates ? (
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={busy} checked={options.includeDuplicates} onChange={(e) => change({ includeDuplicates: e.target.checked })} /> Import rows that look already tracked too</label>
                ) : null}
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <caption className="sr-only">First rows of the file and what will happen to each</caption>
                    <thead className="bg-muted/50 text-xs text-muted-foreground">
                      <tr>{["Line", "Company", "Role", "Status", "Applied", "Outcome"].map((h) => <th key={h} scope="col" className="px-3 py-2 font-medium">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y">
                      {preview.rows.map((row) => {
                        const [label, tone] = OUTCOMES[row.outcome];
                        return (
                          <tr key={row.line} className="align-top">
                            <td className="px-3 py-2 tabular-nums text-muted-foreground">{row.line}</td>
                            <td className="px-3 py-2">{row.company}</td>
                            <td className="px-3 py-2">{row.role}</td>
                            <td className="px-3 py-2">{row.status}</td>
                            <td className="px-3 py-2 tabular-nums">{row.appliedDate || ""}{row.usedToday ? " (today)" : ""}</td>
                            <td className="px-3 py-2"><span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>{label}</span>{row.reason ? <span className="mt-1 block text-xs text-muted-foreground">{row.reason}</span> : null}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {totals.rows > preview.rows.length ? <p className="text-xs text-muted-foreground">Showing the first {preview.rows.length} of {totals.rows} rows.</p> : null}
                {preview.problems.length ? (
                  <div className="space-y-1">
                    <h3 className="text-sm font-medium">Rows that will be skipped</h3>
                    <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
                      {preview.problems.map((p) => <li key={p.line}>Line {p.line}: {p.reason}</li>)}
                    </ul>
                  </div>
                ) : null}
              </section>
              <div>
                <Button type="button" onClick={runImport} disabled={busy || totals.ready === 0} className="bg-brand text-white hover:bg-brand/90">
                  <Upload size={15} className="mr-2" />{busy ? "Working…" : `Import ${plural(totals.ready, "application", "applications")}`}
                </Button>
              </div>
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
