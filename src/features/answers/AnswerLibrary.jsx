"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, Check, CheckCheck, Copy, Download, Loader2, Pencil, Plus, RotateCcw, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import LocalDateTime from "@/components/shared/LocalDateTime";
import { safeHttpUrl } from "@/lib/safeUrl";
import { saveBlob } from "@/features/resumes/hooks/useResumeDownload";
import { copyApprovedAnswer, deleteReusableAnswer, readLatestAnswer, saveReusableAnswer } from "./actions";

const empty = { label: "", question: "", answer: "", category: "general", tags: "", sourceNote: "", sourceUrl: "" };
const fromRow = row => row ? { label: row.label, question: row.question, answer: row.answer, category: row.category, tags: row.tags.join(", "), sourceNote: row.source_note, sourceUrl: row.source_url } : { ...empty };

function AnswerEditor({ initial, categories, onClose, onSaved }) {
  const attempt = useRef(null);
  const [record, setRecord] = useState(initial), [values, setValues] = useState(() => fromRow(initial));
  const [baseline, setBaseline] = useState(() => fromRow(initial));
  const [id, setId] = useState(() => initial?.id || crypto.randomUUID());
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [blocked, setBlocked] = useState(false);
  const dirty = JSON.stringify(values) !== JSON.stringify(baseline);
  useEffect(() => {
    if (!dirty) return;
    const warn = event => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const update = event => { setValues(current => ({ ...current, [event.target.name]: event.target.value })); attempt.current = null; };
  const content = () => ({ ...values, tags: [...new Set(values.tags.split(",").map(tag => tag.trim()).filter(Boolean))] });
  async function submit(event) {
    event.preventDefault(); if (busy || blocked) return;
    const action = event.nativeEvent.submitter?.value || "draft";
    const input = { id, expectedRevision: record?.revision || 0, action, content: content() };
    const signature = JSON.stringify(input);
    if (attempt.current?.signature !== signature) attempt.current = { signature, eventId: crypto.randomUUID() };
    setBusy(true); setError("");
    try {
      const result = await saveReusableAnswer({ ...input, eventId: attempt.current.eventId });
      if (!result.ok) { setBlocked([404,409].includes(result.status)); setError(result.error); return; }
      onSaved(result.data);
    } catch { setError("Connection interrupted. Your input is kept here; retry the same save."); }
    finally { setBusy(false); }
  }
  async function reload() {
    setBusy(true);
    try {
      const result = await readLatestAnswer(id);
      if (!result.ok || !result.data) { setError(result.error || "This answer was removed. Keep your local draft or save a new copy."); return; }
      setRecord(result.data); setValues(fromRow(result.data)); setBaseline(fromRow(result.data));
      setBlocked(Boolean(result.data.archived_at)); setError(result.data.archived_at ? "This answer is archived. Close the editor and restore it before editing." : ""); attempt.current = null;
    } catch { setError("Latest version could not be loaded. Your input is kept."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="space-y-5 rounded-xl border border-brand/25 bg-card p-5 shadow-sm sm:p-6">
    <div className="flex items-start justify-between gap-3"><div><h2 className="text-base font-semibold">{initial ? "Edit answer" : "Write an answer"}</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Drafts stay private to your library. Approve the exact wording before reuse.</p></div><Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onClose}><X className="mr-1 h-3.5 w-3.5" />Cancel</Button></div>
    <fieldset disabled={busy} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_11rem]"><label className="space-y-1.5 text-sm font-medium">Short label<Input name="label" required maxLength={120} value={values.label} onChange={update} placeholder="For example: my backend project" /></label><label className="space-y-1.5 text-sm font-medium">Category<select name="category" value={values.category} onChange={update} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{categories.map(category => <option key={category} value={category}>{category[0].toUpperCase()+category.slice(1)}</option>)}</select></label></div>
      <label className="block space-y-1.5 text-sm font-medium">Question<Input name="question" required maxLength={1000} value={values.question} onChange={update} placeholder="What question does this answer address?" /></label>
      <label className="block space-y-1.5 text-sm font-medium">Your answer<Textarea name="answer" required maxLength={10000} rows={7} value={values.answer} onChange={update} placeholder="Use your own facts, examples and preferred wording." /><span className="block text-right text-xs font-normal text-muted-foreground">{values.answer.length.toLocaleString()} / 10,000</span></label>
      <details className="rounded-md border p-3"><summary className="cursor-pointer text-sm font-medium">Reference and tags <span className="font-normal text-muted-foreground">(optional)</span></summary><div className="mt-4 space-y-4"><label className="block space-y-1.5 text-sm font-medium">Source note<Textarea name="sourceNote" maxLength={2000} rows={2} value={values.sourceNote} onChange={update} placeholder="Which experience or project supports this answer?" /></label><label className="block space-y-1.5 text-sm font-medium">Reference link<Input type="url" name="sourceUrl" maxLength={2000} value={values.sourceUrl} onChange={update} placeholder="https://…" /></label><label className="block space-y-1.5 text-sm font-medium">Tags<Input name="tags" value={values.tags} maxLength={270} onChange={update} placeholder="backend, teamwork, leadership" /><span className="block text-xs font-normal text-muted-foreground">Up to 8 tags, separated by commas; 32 characters each.</span></label></div></details>
      <p className="text-xs leading-relaxed text-muted-foreground">Approval applies to this version. Saving edits as a draft removes its approval. Review company-specific wording before using an answer.</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {blocked && <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" onClick={() => saveBlob(new Blob([JSON.stringify(content(),null,2)],{type:"application/json"}),"answer-draft.json")}><Download className="mr-1.5 h-3.5 w-3.5" />Keep my draft (.json)</Button><Button type="button" variant="outline" size="sm" onClick={reload}>Reload latest (discard mine)</Button><Button type="button" variant="outline" size="sm" onClick={() => { setId(crypto.randomUUID()); setRecord(null); setBlocked(false); setError(""); attempt.current = null; }}>Save as a new answer</Button></div>}
      <div className="flex flex-wrap items-center gap-2"><Button type="submit" name="intent" value="draft" variant="outline" disabled={blocked}>{busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}Save draft</Button><Button type="submit" name="intent" value="approve" className="bg-brand hover:bg-brand/90" disabled={blocked}><CheckCheck className="mr-1.5 h-4 w-4" />Approve & save</Button><span className="text-xs text-muted-foreground">{busy ? "Saving…" : dirty ? "Unsaved changes" : record ? `Version ${record.revision}` : "Not saved yet"}</span></div>
    </fieldset>
  </form>;
}

export default function AnswerLibrary({ answers, count, categories, search, archived, page }) {
  const router = useRouter();
  const [editing, setEditing] = useState(null), [deleting, setDeleting] = useState(null), [busy, setBusy] = useState(false);
  const [error, setError] = useState(""), [copied, setCopied] = useState(null), [fallback, setFallback] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => { setRefreshing(false); }, [answers]);
  const pending = busy || refreshing;
  const link = (nextPage, showArchived = archived) => `/answers?${new URLSearchParams({ page: String(nextPage), ...(search ? { q: search } : {}), ...(showArchived ? { archived: "1" } : {}) })}`;
  useEffect(() => { if (!copied) return; const timer = setTimeout(() => setCopied(null),2500); return () => clearTimeout(timer); },[copied]);
  async function copy(answer) {
    setBusy(true); setError("");
    try {
      const result = await copyApprovedAnswer({ id: answer.id, revision: answer.revision });
      if (!result.ok) { setError(result.error); router.refresh(); return; }
      try { await navigator.clipboard.writeText(result.data.answer); setCopied(answer.id); }
      catch { setFallback(result.data); }
    } catch { setError("Could not check the current approved version. Please try again."); }
    finally { setBusy(false); }
  }
  async function archive(answer) {
    setBusy(true); setError("");
    try {
      const result = await saveReusableAnswer({ id: answer.id, eventId: crypto.randomUUID(), expectedRevision: answer.revision, action: answer.archived_at ? "restore" : "archive" });
      if (!result.ok) setError(result.error); setRefreshing(true); router.refresh();
    } catch { setError("Connection interrupted. Refresh to check the answer’s status before retrying."); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!deleting || busy) return; setBusy(true); setError("");
    try {
      const result = await deleteReusableAnswer({ id: deleting.id, revision: deleting.revision });
      if (!result.ok) { setError(result.error); return; }
      setDeleting(null); router.refresh();
    } catch { setError("Connection interrupted. Retry to confirm whether the answer was removed."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><Link href="/documents" className="text-xs text-muted-foreground hover:text-foreground">Documents /</Link><h1 className="mt-2 text-2xl font-semibold tracking-tight">Answer library</h1><p className="mt-1 text-sm text-muted-foreground">Your stories and facts, ready for the next application.</p></div><div className="flex gap-2"><Button variant="outline" asChild><a href="/api/answers/export"><Download className="mr-1.5 h-4 w-4" />Export</a></Button><Button className="bg-brand hover:bg-brand/90" disabled={pending || Boolean(editing)} onClick={() => { setEditing({}); setError(""); }}><Plus className="mr-1.5 h-4 w-4" />New answer</Button></div></header>
    <div className="flex items-start gap-3 rounded-lg border border-brand/15 bg-brand/5 p-4"><CheckCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" /><p className="text-sm leading-relaxed text-muted-foreground">Write once, review carefully, then approve a version for copying or recording with a submission. Salary, eligibility and personal answers stay entirely under your control.</p></div>
    {editing && <AnswerEditor key={editing.id || "new"} initial={editing.id ? editing : null} categories={categories} onClose={() => setEditing(null)} onSaved={() => { setRefreshing(true); setEditing(null); router.refresh(); }} />}
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><form className="flex w-full min-w-0 flex-1 gap-2" action="/answers"><div className="relative max-w-sm flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input name="q" defaultValue={search} placeholder="Search answer labels…" aria-label="Search answer labels" maxLength={100} className="pl-9" /></div>{archived && <input type="hidden" name="archived" value="1" />}<Button variant="outline">Search</Button></form><Link href={link(1,!archived)} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"><Archive className="h-3.5 w-3.5" />{archived ? "Active answers" : "Archived answers"}</Link></div>
    {refreshing && <p role="status" className="text-xs text-muted-foreground">Updating library…</p>}
    {error && !deleting && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <p className="text-xs text-muted-foreground">{count} {archived ? "archived " : ""}{count === 1 ? "answer" : "answers"}{search ? " matching this label" : ""}</p>
    {answers.length ? <div className="grid items-start gap-4 lg:grid-cols-2">{answers.map(answer => <article key={`${answer.id}:${answer.revision}`} className="min-w-0 space-y-4 rounded-xl border bg-card p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="break-words text-base font-semibold">{answer.label}</h2><p className="mt-1 text-xs capitalize text-muted-foreground">{answer.category} · version {answer.revision}</p></div><div className="flex shrink-0 items-center gap-1"><span className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${answer.approved_at && !answer.archived_at ? "bg-brand/10 text-brand" : "bg-muted text-muted-foreground"}`}>{answer.archived_at ? "Archived" : answer.approved_at ? "Approved" : "Draft"}</span><Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-red-700" disabled={pending || Boolean(editing)} onClick={() => { setDeleting(answer); setError(""); }} aria-label={`Delete ${answer.label}`}><Trash2 className="h-3.5 w-3.5" /></Button></div></div><div><h3 className="text-sm font-medium">{answer.question}</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">{answer.answer.length>450 ? answer.answer.slice(0,450)+"…" : answer.answer}</p>{answer.answer.length>450 && <details className="mt-2 text-sm"><summary className="cursor-pointer text-brand">Read full answer</summary><p className="mt-2 whitespace-pre-wrap break-words text-muted-foreground">{answer.answer}</p></details>}</div>{answer.source_note && <p className="break-words text-xs leading-relaxed text-muted-foreground">Reference: {answer.source_note}</p>}{safeHttpUrl(answer.source_url) && <a className="inline-flex text-xs font-medium text-brand hover:underline" href={safeHttpUrl(answer.source_url)} target="_blank" rel="noopener noreferrer">User-provided reference ↗</a>}{answer.tags.length>0 && <div className="flex flex-wrap gap-1.5">{answer.tags.map(tag => <span key={tag} className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">{tag}</span>)}</div>}<p className="text-xs text-muted-foreground">{answer.approved_at ? "Approved" : "Updated"} <LocalDateTime value={answer.approved_at || answer.updated_at} /></p><div className="flex flex-wrap gap-1.5 border-t pt-3"><Button size="sm" variant="outline" disabled={pending || !answer.approved_at || Boolean(answer.archived_at)} onClick={() => copy(answer)}>{copied===answer.id ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}{copied===answer.id ? "Copied" : "Copy answer"}</Button>{!answer.archived_at && <Button size="sm" variant="ghost" disabled={pending || Boolean(editing)} onClick={() => { setEditing(answer); setError(""); window.scrollTo({top:0,behavior:"smooth"}); }}><Pencil className="mr-1 h-3.5 w-3.5" />Edit</Button>}<Button size="sm" variant="ghost" disabled={pending || Boolean(editing)} onClick={() => archive(answer)}>{answer.archived_at ? <RotateCcw className="mr-1 h-3.5 w-3.5" /> : <Archive className="mr-1 h-3.5 w-3.5" />}{answer.archived_at ? "Restore as draft" : "Archive"}</Button></div>{!answer.approved_at && !answer.archived_at && <p className="text-xs text-muted-foreground">Edit and approve this version to enable reuse.</p>}</article>)}</div> : <div className="rounded-xl border border-dashed p-10 text-center"><Copy className="mx-auto mb-3 h-7 w-7 text-brand/60" /><h2 className="font-semibold">{archived ? "No archived answers" : search ? "No matching labels" : "Start with a question you see often"}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{archived ? "Archived answers stay out of reuse until restored and approved again." : "A project story, availability or a teamwork example is a useful first entry. Write the facts in your own words."}</p></div>}
    <nav aria-label="Answer library pages" className="flex justify-between text-sm font-medium text-brand">{page>1 ? <Link href={link(page-1)}>← Previous</Link> : <span />}{page*50<count && <Link href={link(page+1)}>Next →</Link>}</nav>
    <Dialog open={Boolean(fallback)} onOpenChange={open => { if (!open) setFallback(null); }}><DialogContent><DialogHeader><DialogTitle>Copy approved answer</DialogTitle><DialogDescription>Clipboard access is unavailable. Select this freshly checked version and copy it manually.</DialogDescription></DialogHeader><Textarea readOnly rows={10} value={fallback?.answer || ""} onFocus={event => event.target.select()} aria-label="Approved answer to copy" /><p className="text-xs text-muted-foreground">Version {fallback?.revision} · use Ctrl+C or ⌘C</p></DialogContent></Dialog>
    <Dialog open={Boolean(deleting)} onOpenChange={open => { if (!open && !busy) { setDeleting(null); setError(""); router.refresh(); } }}><DialogContent><DialogHeader><DialogTitle>Delete this answer?</DialogTitle><DialogDescription>This removes the library entry and its revision history. Submitted versions keep copies of answers already recorded there. Archive instead if you may want this answer again.</DialogDescription></DialogHeader><p className="break-words text-sm font-medium">{deleting?.label}</p>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<DialogFooter><Button variant="outline" disabled={busy} onClick={() => { setDeleting(null); setError(""); router.refresh(); }}>Cancel</Button><Button variant="destructive" disabled={pending || Boolean(error)} onClick={remove}>{busy ? "Deleting…" : "Delete answer and history"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
