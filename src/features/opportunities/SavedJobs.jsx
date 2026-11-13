"use client";
import { useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { Bookmark, Check, ExternalLink, FileText, MapPin, Plus, Sparkles, Trash2 } from "lucide-react";
import { saveJob, removeSavedJob, tailorSavedJob, markSavedJobApplied } from "./actions";
import { safeHttpUrl } from "@/lib/safeUrl";
import JobFit from "./JobFit";

const field = "w-full rounded-lg border border-input bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 disabled:opacity-60";

function JobEditor({ job, resumes, onClose }) {
  const formId = useId();
  const router = useRouter();
  const p = job?.payload || {};
  const [values, setValues] = useState({ company: p.company || "", role: p.role || "", location: p.location || "", url: p.portal_link || "", jobDescription: p.job_description || "", resumeId: job?.resume_id || "" });
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const update = e => setValues(v => ({ ...v, [e.target.name]: e.target.value }));
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError("");
    const result = await saveJob({ ...values, resumeId: values.resumeId || null,
      // Preserve captured pay and metadata when correcting text.
      salary: p.salary_min != null || p.salary_max != null ? { min: p.salary_min ?? null, max: p.salary_max ?? null, currency: p.salary_currency || "USD", period: p.salary_period || null } : null,
      employmentType: p.employment_type || "", workplaceType: p.workplace_type || "", detectedBy: p.source_site || "",
    });
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    router.refresh(); onClose();
  }
  return <form onSubmit={submit} className="space-y-4 rounded-xl border bg-white p-5 shadow-sm">
    <div className="flex items-center justify-between"><h2 className="font-semibold">{job ? "Review saved job" : "Save an opening"}</h2><button type="button" disabled={busy} onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">Cancel</button></div>
    <div className="grid gap-4 sm:grid-cols-2">{[["company", "Company"], ["role", "Job title"], ["location", "Location"]].map(([name, label]) => <label key={name} className="space-y-1.5 text-xs font-medium">{label}<input className={field} name={name} value={values[name]} maxLength={200} required={name === "company"} onChange={update} disabled={busy} /></label>)}
      <div className="space-y-1.5 text-xs font-medium"><label htmlFor={`${formId}-resume`}>Working resume</label><select id={`${formId}-resume`} className={field} name="resumeId" value={values.resumeId} onChange={update} disabled={busy}><option value="">Master CV / decide later</option>{resumes.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}</select></div>
    </div>
    <label className="block space-y-1.5 text-xs font-medium">Posting link<input type="url" required name="url" className={field} value={values.url} onChange={update} maxLength={2000} disabled={busy || Boolean(job)} /></label>
    <div className="space-y-1.5 text-xs font-medium"><label htmlFor={`${formId}-description`}>Job description</label><textarea id={`${formId}-description`} name="jobDescription" className={`${field} min-h-48 resize-y font-normal`} value={values.jobDescription} onChange={update} maxLength={50000} disabled={busy} placeholder="Paste the full job description to keep it available later." /></div>
    <p className="text-xs leading-relaxed text-muted-foreground">The resume choice is for preparation. Your actual submitted file will be recorded separately.</p>
    {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
    <button disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-60"><Check size={15} />{busy ? "Saving…" : "Save job"}</button>
  </form>;
}

// "Tailor resume": open the working resume aimed at this job, or create one that is
function TailorButton({ job, resume, onError }) {
  const [busy, setBusy] = useState(false);
  const className = "inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-white hover:bg-brand/90 disabled:opacity-60";
  if (resume) return <Link href={`/resumes/${resume.id}?job=${job.id}`} className={className}><Sparkles size={13} />Tailor resume</Link>;
  async function start() {
    setBusy(true); onError("");
    // Redirects to the new resume on success
    const result = await tailorSavedJob(job.id);
    if (result && !result.ok) { onError(result.error); setBusy(false); }
  }
  return <button type="button" disabled={busy} onClick={start} className={className}><Sparkles size={13} />{busy ? "Creating…" : "Tailor resume"}</button>;
}

// "I applied": track the job as an application on the chosen date
function ApplyConfirm({ job, resume, onDone, onCancel }) {
  const router = useRouter();
  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function confirm() {
    setBusy(true); setError("");
    const result = await markSavedJobApplied({ opportunityId: job.id, appliedDate: date });
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    const { applicationId, created } = result.data;
    toast(created ? "Tracked as an application" : "Already tracked as an application", {
      description: created ? `Its description and job details came with it.${resume ? " Your working resume is linked; change it there if you sent a different file." : ""}` : undefined,
      action: { label: "View", onClick: () => router.push(`/applications/${applicationId}`) },
    });
    onDone(applicationId);
    router.refresh();
  }
  return <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs">
    <label className="flex flex-wrap items-center gap-2">Applied on<input type="date" required value={date} max="9999-12-31" onChange={e => setDate(e.target.value)} disabled={busy} className="rounded-md border border-input bg-white px-2 py-1" /></label>
    <div className="mt-2 flex gap-4"><button type="button" disabled={busy || !date} onClick={confirm} className="font-medium text-brand">{busy ? "Tracking…" : "Track application"}</button><button type="button" disabled={busy} onClick={onCancel}>Cancel</button></div>
    {error ? <p role="alert" className="mt-2 text-red-700">{error}</p> : null}
  </div>;
}

function JobCard({ job, resumes, fit }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false), [removing, setRemoving] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [applying, setApplying] = useState(false), [applied, setApplied] = useState(null);
  // The server's link wins. The optimistic one only lasts until the refresh delivers a new job row.
  const trackedId = job.application_id || (applied?.job === job ? applied.id : null), p = job.payload, resume = resumes.find(r => r.id === job.resume_id), href = safeHttpUrl(p.portal_link);
  async function remove() {
    setBusy(true); setError("");
    const result = await removeSavedJob(job.id);
    if (!result.ok) { setError(result.error); setBusy(false); return; }
    router.refresh();
  }
  if (editing) return <JobEditor job={job} resumes={resumes} onClose={() => setEditing(false)} />;
  return <article className="flex flex-col rounded-xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
    <div className="mb-4 flex items-center justify-between gap-2"><span className={`rounded-full px-2 py-1 text-[11px] font-medium ${trackedId ? "bg-brand/10 text-brand" : "bg-slate-100 text-slate-600"}`}>{trackedId ? "Tracked application" : "Saved for later"}</span><button type="button" aria-label={`Remove ${p.role || "job"} at ${p.company}`} onClick={() => setRemoving(!removing)} className="rounded p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-700"><Trash2 size={15} /></button></div>
    <h2 className="text-lg font-semibold leading-snug">{p.role || "Untitled role"}</h2><p className="mt-1 text-sm text-muted-foreground">{p.company}</p>
    {p.location ? <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin size={13} />{p.location}</p> : null}
    {p.salary_min != null || p.salary_max != null ? <p className="mt-2 text-xs text-muted-foreground">{p.salary_currency || "USD"} {p.salary_min?.toLocaleString() || "—"} – {p.salary_max?.toLocaleString() || "—"}{p.salary_period ? ` / ${p.salary_period}` : ""}</p> : null}
    <p className="my-4 line-clamp-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{p.job_description || "No description captured. Add it while the posting is available."}</p>
    <JobFit fit={fit} described={(p.job_description || "").trim().length >= 40} tailor={<TailorButton job={job} resume={resume} onError={setError} />} />
    <div className="mt-auto space-y-4 border-t pt-4"><p className="flex items-center gap-2 text-xs"><FileText size={14} className="text-brand" />{resume ? <Link href={`/resumes/${resume.id}`} className="truncate hover:underline">{resume.title}</Link> : <span className="text-muted-foreground">Master CV / decide later</span>}</p>
      <div className="flex flex-wrap items-center gap-3 text-xs font-medium"><TailorButton job={job} resume={resume} onError={setError} /><button type="button" onClick={() => setEditing(true)} className="rounded-md border px-3 py-2 hover:bg-muted">Review details</button>{trackedId ? null : <button type="button" onClick={() => setApplying(!applying)} className="rounded-md border px-3 py-2 hover:bg-muted">I applied</button>}</div>
      <div className="flex flex-wrap items-center gap-3 text-xs font-medium">{href ? <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand hover:underline">Open posting <ExternalLink size={12} /></a> : null}{trackedId ? <Link href={`/applications/${trackedId}`} className="text-brand hover:underline">View application →</Link> : null}</div>
    </div>
    {applying && !trackedId ? <ApplyConfirm job={job} resume={resume} onDone={id => { setApplied({ id, job }); setApplying(false); }} onCancel={() => setApplying(false)} /> : null}
    {removing ? <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs"><p>Remove this saved job? Its application and documents will stay.</p><div className="mt-2 flex gap-4"><button disabled={busy} onClick={remove} className="font-medium text-red-700">{busy ? "Removing…" : "Remove saved job"}</button><button disabled={busy} onClick={() => setRemoving(false)}>Keep it</button></div></div> : null}
    {error ? <p role="alert" className="mt-3 text-xs text-red-700">{error}</p> : null}
  </article>;
}

export default function SavedJobs({ jobs, resumes, fits = {} }) {
  const [adding, setAdding] = useState(false);
  return <>
    <div className="flex items-center justify-between gap-4 rounded-xl border border-brand/15 bg-brand/5 px-4 py-3"><p className="text-xs leading-relaxed text-muted-foreground">Saved openings stay out of your application counts until you apply.</p><button onClick={() => setAdding(!adding)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-xs font-medium text-white hover:bg-brand/90"><Plus size={14} /> Save a job</button></div>
    {adding ? <JobEditor resumes={resumes} onClose={() => setAdding(false)} /> : null}
    {jobs.length ? <div className="grid items-start gap-4 md:grid-cols-2">{jobs.map(job => <JobCard key={`${job.id}:${job.updated_at}`} job={job} resumes={resumes} fit={fits[job.id] ?? null} />)}</div> : <div className="rounded-xl border border-dashed bg-white px-6 py-14 text-center"><Bookmark className="mx-auto mb-4 text-brand/70" size={30} /><h2 className="text-lg font-semibold">A shortlist worth coming back to</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">Save an opening from the extension, or paste a posting here. Keep its description and your resume choice together.</p></div>}
  </>;
}
