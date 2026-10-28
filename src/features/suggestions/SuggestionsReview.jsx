"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Inbox, Loader2, Pencil, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import LocalDateTime from "@/components/shared/LocalDateTime";
import { APPLICATION_STATUSES } from "@/lib/constants";
import { CATEGORY_LABELS } from "@/lib/emailCategories";
import MatchTargetPicker from "@/features/suggestions/MatchTargetPicker";
import { approveSuggestion, resolveSuggestion, dismissAllSuggestions, dismissSuggestion } from "@/features/suggestions/actions";

// Columns on wide screens: what it is, the status to set, the email it came from, actions.
// Narrow screens stack the same cells.
const ROW_GRID =
  "grid gap-x-4 gap-y-2 md:grid-cols-[minmax(0,1.3fr)_9.5rem_minmax(0,1.5fr)_auto] md:items-center";

function SuggestionRow({ suggestion, onDone }) {
  const [company, setCompany] = useState(suggestion.company);
  const [role, setRole] = useState(suggestion.role);
  const [status, setStatus] = useState(suggestion.status);
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const isUpdate = suggestion.kind === "update";
  const router = useRouter();

  const run = (action, successMessage) =>
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(successMessage);
        onDone?.();
      } else { toast.error(result.error); router.refresh(); }
    });

  const approve = () =>
    run(
      () => approveSuggestion(suggestion.id, { company, role, status }),
      isUpdate ? `${company} updated to ${status}` : `${company} added to your applications`
    );
  const dismiss = () => run(() => dismissSuggestion(suggestion.id), "Suggestion dismissed");

  return (
    <li className={`${ROW_GRID} px-4 py-3 ${pending ? "opacity-60" : ""}`}>
      {/* What it is: the application, and whether it's new or a status change */}
      <div className="min-w-0">
        {editing && !isUpdate ? (
          <div className="grid grid-cols-2 gap-2">
            <Input aria-label="Company" value={company} onChange={(e) => setCompany(e.target.value)} />
            <Input
              aria-label="Role"
              placeholder="Role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            />
          </div>
        ) : (
          <>
            <p className="truncate text-sm font-medium">
              {company}
              {role && <span className="font-normal text-muted-foreground"> · {role}</span>}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              {isUpdate ? (
                <>
                  Status update
                  {suggestion.current && (
                    <>
                      : <span>{suggestion.current.status}</span>
                      <ArrowRight className="h-3 w-3" aria-label="to" />
                      <span className="font-medium text-foreground">{status}</span>
                    </>
                  )}
                </>
              ) : (
                "New application"
              )}
            </p>
          </>
        )}
      </div>

      {/* The status it will get */}
      <Select value={status} onValueChange={setStatus} disabled={pending}>
        <SelectTrigger aria-label="Status" className="h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {APPLICATION_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              <Badge variant={s.toLowerCase()}>{s}</Badge>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* The email behind it */}
      <div className="min-w-0 text-xs" title={suggestion.summary || undefined}>
        <p className="truncate text-sm text-foreground">{suggestion.emailSubject || "No subject"}</p>
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-muted-foreground">
          <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[11px] font-normal">
            {CATEGORY_LABELS[suggestion.category] || suggestion.category}
          </Badge>
          <span className="truncate">{suggestion.emailFrom}</span>
          {suggestion.emailDate && (
            <span className="shrink-0">
              · <LocalDateTime value={suggestion.emailDate} format="date" />
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-1">
        {!isUpdate && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setEditing((on) => !on)}
            disabled={pending}
            aria-label={editing ? "Done editing" : "Edit company and role"}
            title={editing ? "Done editing" : "Edit company and role"}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={dismiss}
          disabled={pending}
          aria-label="Dismiss"
          title="Dismiss"
        >
          <X className="h-4 w-4" />
        </Button>
        <Button size="sm" className="h-8" onClick={approve} disabled={pending || !company.trim()}>
          {pending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
          {isUpdate ? "Update" : "Add"}
        </Button>
      </div>
    </li>
  );
}

function MatchingSuggestion({ suggestion }) {
  const [status, setStatus] = useState(suggestion.status);
  const [resolved, setResolved] = useState(false);
  if (resolved) return null;
  return (
    <li className="space-y-4 bg-muted/15 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
            <span>{suggestion.company} · {suggestion.role || "Untitled role"}</span>
            <Badge variant="outline" className="font-normal">Needs matching</Badge>
          </div>
          <p className="text-xs text-muted-foreground">{suggestion.emailSubject || "No subject"} · {suggestion.emailFrom}</p>
          {suggestion.summary && <p className="max-w-2xl text-sm text-muted-foreground">{suggestion.summary}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Proposed status</span>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger aria-label="Proposed status" className="h-8 w-36"><SelectValue /></SelectTrigger>
            <SelectContent>{APPLICATION_STATUSES.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <MatchTargetPicker candidates={suggestion.candidates} onResolve={async choice => {
        const result = await resolveSuggestion(suggestion.id, { ...choice, company: suggestion.company, role: suggestion.role, status });
        if (result.ok) setResolved(true);
        return result;
      }} />
      <Button variant="ghost" size="sm" className="h-7 px-0 text-xs text-muted-foreground" onClick={async () => {
        const result = await dismissSuggestion(suggestion.id);
        if (result.ok) setResolved(true); else toast.error(result.error);
      }}>Dismiss this email</Button>
    </li>
  );
}

// Applications detected by email scans, waiting for the user to approve or dismiss
export default function SuggestionsReview({ suggestions }) {
  const [pending, startTransition] = useTransition();

  const dismissAll = () =>
    startTransition(async () => {
      const result = await dismissAllSuggestions();
      if (result.ok) toast.success("All suggestions dismissed");
      else toast.error(result.error);
    });

  // Approves each as suggested (no edits), one at a time, and reports the total
  const safeSuggestions = suggestions.filter(suggestion => !suggestion.needsMatching);
  const approveAll = () =>
    startTransition(async () => {
      let approved = 0;
      for (const s of safeSuggestions) {
        const result = await approveSuggestion(s.id, { company: s.company, role: s.role, status: s.status });
        if (result.ok) approved += 1;
      }
      const failed = safeSuggestions.length - approved;
      if (failed) toast.error(`Approved ${approved}; ${failed} couldn't be applied`);
      else toast.success(`Approved ${approved} suggestion${approved === 1 ? "" : "s"}`);
    });

  return (
    <Card id="review">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2 text-base">
            <Inbox className="h-4 w-4" /> Review suggestions
            {suggestions.length > 0 && <Badge>{suggestions.length}</Badge>}
          </CardTitle>
          <CardDescription>
            Scans never change your applications on their own. Approve what&apos;s right; edit it first if
            needed.
          </CardDescription>
        </div>
        {suggestions.length > 1 && (
          <div className="flex shrink-0 gap-1">
            <Button variant="ghost" size="sm" onClick={dismissAll} disabled={pending}>
              Dismiss all
            </Button>
            <Button variant="outline" size="sm" onClick={approveAll} disabled={pending || safeSuggestions.length === 0}>
              {pending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              {safeSuggestions.length === suggestions.length ? "Approve all" : "Approve matched"}
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {suggestions.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nothing to review. Run a scan to look for updates.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <div
              className={`${ROW_GRID} hidden border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground md:grid`}
            >
              <span>Application</span>
              <span>Status</span>
              <span>From email</span>
              <span className="sr-only">Actions</span>
            </div>
            <ul className="divide-y">
              {suggestions.map((suggestion) => (
                suggestion.needsMatching ? <MatchingSuggestion key={suggestion.id} suggestion={suggestion} /> : <SuggestionRow key={suggestion.id} suggestion={suggestion} />
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
