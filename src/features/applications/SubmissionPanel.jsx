import Link from "next/link";
import { Archive, ArrowUpRight, Download } from "lucide-react";
import { requireUser } from "@/server/auth";
import { submissionChoices } from "@/server/applications/submissionData";
import { approvedAnswerChoices } from "@/server/answers/data";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import LocalDateTime from "@/components/shared/LocalDateTime";
import SubmissionForm from "./SubmissionForm";
import { SUBMISSION_LABELS } from "./submissionLabels";

export default async function SubmissionPanel({ application }) {
  let choices, error, answerMessage = "", answerChoices = [];
  try {
    const { supabase, user } = await requireUser();
    choices = await submissionChoices(supabase, user.id, application.id);
    try { answerChoices = await approvedAnswerChoices(supabase, user.id); }
    catch { answerMessage = "Library choices could not be loaded. You can still record manually entered answers below."; }
  } catch (cause) {
    error = cause.status === 503 ? cause.message : "Submission records could not be loaded. Refresh to try again.";
    console.error("submissionPanel", { status: cause.status || 500 });
  }
  return <Card><CardHeader className="pb-4"><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle className="flex items-center gap-2 text-base"><Archive className="h-4 w-4 text-brand" />Submitted versions</CardTitle><Link href="/submissions" className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">All records<ArrowUpRight className="h-3 w-3" /></Link></div><CardDescription>Keep the resume and job description you used, even when your working copies change.</CardDescription></CardHeader>
    <CardContent className="space-y-4">{error ? <p role="alert" className="text-sm text-red-700">{error}</p> : <>
      {choices.records.length ? <ul className="divide-y rounded-md border">{choices.records.map(record => <li key={record.id} className="flex flex-wrap items-start justify-between gap-3 p-3"><div className="min-w-0 space-y-1"><Link href={`/submissions/${record.id}`} className="break-words text-sm font-medium hover:text-brand hover:underline">{record.resume_title || "Submission record"}</Link><p className="text-xs text-muted-foreground">{record.submitted_on} · {SUBMISSION_LABELS[record.kind]}</p><p className="text-xs text-muted-foreground">Recorded <LocalDateTime value={record.created_at} />{record.supersedes_id ? " · Correction" : ""}</p></div>{record.artifact_id && <a href={`/api/resume-artifacts/${record.artifact_id}`} className="inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:underline"><Download className="h-3.5 w-3.5" />PDF</a>}</li>)}</ul> : <p className="rounded-md border border-dashed p-4 text-sm leading-relaxed text-muted-foreground">No version recorded yet. A linked working resume can still change; record the version you used when you apply.</p>}
      <SubmissionForm applicationId={application.id} initialDate={application.appliedDate} exports={choices.exports} resumes={choices.resumes} records={choices.records} answers={answerChoices} answerMessage={answerMessage} />
    </>}</CardContent>
  </Card>;
}
