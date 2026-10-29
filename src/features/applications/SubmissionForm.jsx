"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const sources = [
  ["export", "Use an app-exported PDF", "Choose a PDF previously downloaded from Resume Butler."],
  ["upload", "Upload the PDF I submitted", "Preserve your file exactly as supplied. Up to 3 MB."],
  ["selected", "Record a working resume version", "Freeze its current content. No submitted PDF is verified."],
  ["unknown", "I don’t have the file", "Keep the saved job description, date and known answers."],
];
const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

export default function SubmissionForm({ applicationId, initialDate, exports, resumes, records }) {
  const router = useRouter();
  const event = useRef(null);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("");
  const [artifactId, setArtifactId] = useState("");
  const [date, setDate] = useState(initialDate?.slice(0, 10) || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const now = new Date();
    const today = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
    setDate(value => value || today);
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const fields = new FormData(e.currentTarget);
    const answers = String(fields.get("answers") || "").trim();
    const file = fields.get("pdf");
    if (kind === "upload" && (!file?.size || file.size > 3 * 1024 * 1024)) {
      setError("Choose a PDF no larger than 3 MB."); return;
    }
    event.current ||= crypto.randomUUID();
    const payload = new FormData();
    payload.set("record", JSON.stringify({
      eventId: event.current, applicationId, kind,
      artifactId: fields.get("artifactId") || null, resumeId: fields.get("resumeId") || null,
      submittedOn: date, notes: fields.get("notes") || "", supersedesId: fields.get("supersedesId") || null,
      answers: answers ? [{ question: "Submitted answers", answer: answers }] : [],
    }));
    if (kind === "upload") payload.set("pdf", file);
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/submissions", { method: "POST", body: payload });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 409) event.current = null;
        throw new Error(result.error || "The version could not be recorded.");
      }
      event.current = null; setOpen(false); setKind(""); router.refresh();
    } catch (cause) { setError(cause.message || "Connection interrupted. Your input is kept here; retry to confirm the same record."); }
    finally { setBusy(false); }
  }

  if (!open) return <Button variant="outline" size="sm" onClick={() => setOpen(true)}><Plus className="mr-1.5 h-4 w-4" /> Record a submitted version</Button>;
  return <form onSubmit={submit} onChange={() => { event.current = null; setError(""); }} className="space-y-5 rounded-lg border bg-muted/20 p-4">
    <div className="flex items-center justify-between gap-3"><h4 className="text-sm font-semibold">What did you send?</h4><Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => { setOpen(false); setError(""); setKind(""); event.current = null; }}><X className="mr-1 h-3.5 w-3.5" />Cancel</Button></div>
    <fieldset disabled={busy} className="space-y-5">
      <fieldset className="space-y-2"><legend className="mb-2 text-xs font-medium text-muted-foreground">Choose a source</legend>{sources.map(([value, title, detail]) => <label key={value} className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors ${kind === value ? "border-brand/50 bg-brand/5" : "bg-background hover:border-brand/30"}`}>
        <input className="mt-1 accent-brand" type="radio" name="kind" value={value} checked={kind === value} onChange={() => setKind(value)} required />
        <span className="space-y-0.5"><span className="block text-sm font-medium">{title}</span><span className="block text-xs leading-relaxed text-muted-foreground">{detail}</span></span>
      </label>)}</fieldset>
      {kind === "export" && <label className="block space-y-2 text-sm font-medium">Exported PDF<select name="artifactId" className={selectClass} required value={artifactId} onChange={e => setArtifactId(e.target.value)}><option value="">Choose the exact export…</option>{exports.map(file => <option key={file.id} value={file.id}>{file.title || file.filename} · {new Date(file.created_at).toLocaleString()}</option>)}</select><span className="block text-xs font-normal leading-relaxed text-muted-foreground">Latest 100 exports. Download the right version from its editor first, or upload an older file. An app export proves what we generated; you confirm which file you sent.</span>{artifactId && <a href={`/api/resume-artifacts/${artifactId}`} className="inline-flex text-xs font-medium text-brand hover:underline">Download this export to check</a>}</label>}
      {kind === "upload" && <label className="block space-y-2 text-sm font-medium">Submitted PDF<Input type="file" name="pdf" accept="application/pdf,.pdf" required className="h-auto py-2" /><span className="block text-xs font-normal text-muted-foreground">Upload the original file you sent. Its bytes stay unchanged.</span></label>}
      {kind === "selected" && <label className="block space-y-2 text-sm font-medium">Working resume<select name="resumeId" className={selectClass} required defaultValue=""><option value="">Choose a resume…</option>{resumes.map(resume => <option key={resume.id} value={resume.id}>{resume.title || "Untitled resume"}</option>)}</select><span className="block text-xs font-normal text-muted-foreground">This records its current saved content. It does not reconstruct an earlier version.</span></label>}
      <label className="block space-y-2 text-sm font-medium">Date submitted<Input type="date" required value={date} onChange={e => setDate(e.target.value)} /></label>
      <label className="block space-y-2 text-sm font-medium">Answers used <span className="font-normal text-muted-foreground">(optional)</span><Textarea name="answers" rows={3} maxLength={10000} placeholder="Paste the questions and the answers you actually sent." /></label>
      <label className="block space-y-2 text-sm font-medium">Note <span className="font-normal text-muted-foreground">(optional)</span><Textarea name="notes" rows={2} maxLength={5000} placeholder="For example: uploaded through the company’s careers page." /></label>
      {records.length > 0 && <label className="block space-y-2 text-sm font-medium">Corrects an earlier record <span className="font-normal text-muted-foreground">(optional)</span><select name="supersedesId" defaultValue="" className={selectClass}><option value="">New submission / no correction</option>{records.map(record => <option key={record.id} value={record.id}>{record.submitted_on} · {record.resume_title || "No file"} · {record.id.slice(0, 8)}</option>)}</select><span className="block text-xs font-normal text-muted-foreground">A correction adds a new record. The original remains available.</span></label>}
      <p className="text-xs leading-relaxed text-muted-foreground">Records preserve the saved job description and your chosen source. Resume Butler cannot verify the file an employer received.</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <Button disabled={busy || !kind} size="sm">{busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}{busy ? "Recording version…" : "Record version"}</Button>
    </fieldset>
  </form>;
}
