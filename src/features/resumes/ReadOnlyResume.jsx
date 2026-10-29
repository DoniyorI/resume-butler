"use client";
import Link from "next/link";
import { ArrowLeft, Download, FileLock2 } from "lucide-react";
import { downloadRecoveryCopy } from "./recoveryDownload";

export default function ReadOnlyResume({ resume }) {
  return <div className="mx-auto w-full max-w-3xl space-y-6 px-5 pb-12 pt-[97px]">
    <Link href="/documents" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={15} /> Documents</Link>
    <div className="rounded-xl border bg-background p-6 shadow-sm sm:p-8">
      <FileLock2 className="mb-4 text-brand" size={28} />
      <h1 className="text-2xl font-semibold tracking-tight">{resume.title}</h1>
      <p className="mt-3 inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900">Read only · original preserved</p>
      <p role="status" className="mt-4 text-sm leading-relaxed text-muted-foreground">{resume.reason}</p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Open it with the version that saved it, or keep a recovery copy while the app is updated. No content has been converted or overwritten.</p>
      <button type="button" onClick={() => downloadRecoveryCopy(resume.rawContent, resume.title)} className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90"><Download size={15} /> Download original data (.json)</button>
    </div>
    <details className="rounded-xl border bg-background p-5"><summary className="cursor-pointer text-sm font-medium">View original saved data</summary><pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground">{JSON.stringify(resume.rawContent, null, 2)}</pre></details>
  </div>;
}
