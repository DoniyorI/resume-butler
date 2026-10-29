import Link from "next/link";
import { Archive, ArrowLeft, ArrowRight, FileCheck2 } from "lucide-react";
import { requirePageUser } from "@/server/auth";
import { SUBMISSION_SUMMARY } from "@/server/applications/submissionData";
import { archiveError } from "@/server/applications/submissions";
import { SUBMISSION_LABELS } from "@/features/applications/submissionLabels";
import LocalDateTime from "@/components/shared/LocalDateTime";

export const metadata = { title: "Submitted versions" };

export default async function SubmissionsPage({ searchParams }) {
  const { supabase, user } = await requirePageUser();
  const page = Math.min(100000, Math.max(1, Math.floor(Number(searchParams.page) || 1)));
  const { data, error, count } = await supabase.from("application_submissions")
    .select(SUBMISSION_SUMMARY + ",company:application_snapshot->>company,role:application_snapshot->>role", { count: "exact" })
    .eq("user_id", user.id).order("created_at", { ascending: false }).order("id", { ascending: false }).range((page - 1) * 50, page * 50 - 1);
  let message;
  try { archiveError(error); } catch (cause) { message = cause.status === 503 ? cause.message : "Records could not be loaded. Refresh to try again."; }
  return <div className="mx-auto w-full max-w-5xl space-y-6 px-5 pb-16 pt-24 md:px-8">
    <header className="space-y-3"><Link href="/documents" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" />Documents</Link><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand"><Archive className="h-5 w-5" /></div><div><h1 className="text-2xl font-semibold tracking-tight">Submitted versions</h1><p className="mt-1 text-sm text-muted-foreground">A lasting record of what you used for each application.</p></div></div></header>
    <p className="rounded-lg border border-brand/15 bg-brand/5 px-4 py-3 text-sm leading-relaxed text-muted-foreground">Record a version from an application’s detail page. Saved records preserve the job description and your chosen resume source, even after working copies are removed.</p>
    {message ? <p role="alert" className="text-sm text-red-700">{message}</p> : data?.length ? <>
      <p className="text-xs text-muted-foreground">{count} {count === 1 ? "record" : "records"} · page {page}</p>
      <ul className="divide-y rounded-xl border bg-card shadow-sm">{data.map(record => <li key={record.id}><Link href={`/submissions/${record.id}`} className="group flex items-start gap-3 p-4 transition-colors hover:bg-muted/40 sm:p-5"><FileCheck2 className="mt-1 h-4 w-4 shrink-0 text-brand/70" /><div className="min-w-0 flex-1 space-y-1"><h2 className="break-words text-sm font-semibold group-hover:text-brand">{record.role || "Application"}{record.company ? ` at ${record.company}` : ""}</h2><p className="break-words text-sm text-muted-foreground">{record.resume_title || "No resume file recorded"}</p><p className="text-xs leading-relaxed text-muted-foreground">{record.submitted_on} · {SUBMISSION_LABELS[record.kind]}{record.supersedes_id ? " · Correction" : ""}</p><p className="text-xs text-muted-foreground">Recorded <LocalDateTime value={record.created_at} />{!record.application_id ? " · Application removed" : ""}</p></div><ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" /></Link></li>)}</ul>
      <nav aria-label="Submission records pages" className="flex justify-between text-sm font-medium text-brand">{page > 1 ? <Link href={`/submissions?page=${page - 1}`} className="inline-flex items-center gap-1 hover:underline"><ArrowLeft className="h-3.5 w-3.5" />Previous</Link> : <span />}{page * 50 < count && <Link href={`/submissions?page=${page + 1}`} className="inline-flex items-center gap-1 hover:underline">Next<ArrowRight className="h-3.5 w-3.5" /></Link>}</nav>
    </> : <div className="rounded-xl border border-dashed py-14 text-center"><Archive className="mx-auto mb-4 h-8 w-8 text-brand/60" /><h2 className="text-lg font-semibold">Keep a copy before things change</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">Your next submitted version will live here, together with the job description and any answers you record.</p><Link href="/applications" className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline">Go to applications<ArrowRight className="h-3.5 w-3.5" /></Link></div>}
  </div>;
}
