import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ArrowLeft, Download, FileCheck2 } from "lucide-react";
import { requirePageUser } from "@/server/auth";
import { getSubmission } from "@/server/applications/submissionData";
import { SUBMISSION_LABELS } from "@/features/applications/submissionLabels";
import LocalDateTime from "@/components/shared/LocalDateTime";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Submitted version" };
const linkClass = "inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-muted";

export default async function SubmissionDetailPage({ params }) {
  const { supabase, user } = await requirePageUser();
  if (!z.string().uuid().safeParse(params.id).success) notFound();
  const record = await getSubmission(supabase, user.id, params.id);
  if (!record) notFound();
  const app = record.application_snapshot;
  return <div className="mx-auto w-full max-w-4xl space-y-5 px-5 pb-16 pt-24 md:px-8">
    <header className="space-y-4"><Link href="/submissions" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" />Submitted versions</Link><div className="flex items-start gap-3"><FileCheck2 className="mt-1 h-6 w-6 shrink-0 text-brand" /><div className="min-w-0 space-y-1"><h1 className="break-words text-2xl font-semibold">{app.role || "Application"}{app.company ? ` at ${app.company}` : ""}</h1><p className="text-sm text-muted-foreground">Submitted {record.submitted_on} · {SUBMISSION_LABELS[record.kind]}</p><p className="text-xs text-muted-foreground">Recorded <LocalDateTime value={record.created_at} /></p></div></div><div className="flex flex-wrap gap-2">{record.artifact && <a className={linkClass} href={`/api/resume-artifacts/${record.artifact.id}`}><Download className="h-4 w-4" />Download preserved PDF</a>}<a className={linkClass} href={`/api/submissions/${record.id}`}><Download className="h-4 w-4" />Download record (.json)</a>{record.application_id && <Link className={linkClass} href={`/applications/${record.application_id}`}>Current application</Link>}</div></header>
    <div className="rounded-lg border border-brand/15 bg-brand/5 p-4 text-sm leading-relaxed text-muted-foreground">This is a saved record reported by you. {record.kind === "export" ? "The PDF contains the exact bytes exported by Resume Butler; this does not verify which file the employer received." : record.kind === "upload" ? "The PDF is preserved exactly as you uploaded it. Its submission to the employer has not been verified." : record.kind === "selected" ? "The working resume’s content was copied when you recorded this version. There is no verified submitted PDF." : "No resume file or working version was recorded."}{!record.application_id && " The original application has been removed; this record is still available."}</div>
    {record.supersedes_id && <p className="text-sm text-muted-foreground">Correction to <Link className="font-medium text-brand hover:underline" href={`/submissions/${record.supersedes_id}`}>an earlier record</Link>. Both versions remain available.</p>}
    <Card><CardHeader><CardTitle className="text-base">Resume source</CardTitle></CardHeader><CardContent className="space-y-3"><p className="break-words text-sm font-medium">{record.resume_title || "No resume recorded"}</p>{record.artifact && <><p className="text-xs text-muted-foreground">{record.artifact.filename} · {Math.max(1, Math.round(record.artifact.size_bytes / 1024))} KB</p><details className="text-xs text-muted-foreground"><summary className="cursor-pointer">File integrity details</summary><p className="mt-2 break-all font-mono">SHA-256: {record.artifact.sha256}</p></details></>}{(record.resume_snapshot || record.artifact?.content) && <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Saved content snapshot</summary><pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-xs">{JSON.stringify(record.resume_snapshot || record.artifact.content, null, 2)}</pre></details>}</CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">Saved job description</CardTitle></CardHeader><CardContent><p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{record.job_description || "No job description was saved when this version was recorded."}</p></CardContent></Card>
    {record.answers.length > 0 && <Card><CardHeader><CardTitle className="text-base">Answers recorded</CardTitle></CardHeader><CardContent className="space-y-4">{record.answers.map((answer, index) => <div key={index}><h3 className="text-sm font-medium">{answer.question}</h3><p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">{answer.answer}</p></div>)}</CardContent></Card>}
    {record.notes && <Card><CardHeader><CardTitle className="text-base">Note</CardTitle></CardHeader><CardContent><p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{record.notes}</p></CardContent></Card>}
  </div>;
}
