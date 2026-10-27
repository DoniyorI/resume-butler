"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Inbox, Loader2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import LocalDateTime from "@/components/shared/LocalDateTime";
import { APPLICATION_STATUSES } from "@/lib/constants";
import { CATEGORY_LABELS } from "@/lib/emailCategories";
import { approveSuggestion, dismissAllSuggestions, dismissSuggestion } from "@/features/suggestions/actions";

function SuggestionRow({ suggestion }) {
  const [company, setCompany] = useState(suggestion.company);
  const [role, setRole] = useState(suggestion.role);
  const [status, setStatus] = useState(suggestion.status);
  const [pending, startTransition] = useTransition();

  const run = (action, successMessage) =>
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success(successMessage);
      else toast.error(result.error);
    });

  const approve = () =>
    run(
      () => approveSuggestion(suggestion.id, { company, role, status }),
      suggestion.kind === "update"
        ? `${company} updated to ${status}`
        : `${company} added to your applications`
    );
  const dismiss = () => run(() => dismissSuggestion(suggestion.id), "Suggestion dismissed");

  return (
    <div className="rounded-lg border p-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
        <Badge variant="outline">{CATEGORY_LABELS[suggestion.category] || suggestion.category}</Badge>
        <span>{suggestion.kind === "update" ? "Status update" : "New application"}</span>
        {suggestion.emailDate && (
          <>
            <span>&middot;</span>
            <LocalDateTime value={suggestion.emailDate} format="date" />
          </>
        )}
      </div>

      <div>
        <p className="text-sm font-medium truncate">{suggestion.emailSubject || "No subject"}</p>
        <p className="text-xs text-gray-400 truncate">{suggestion.emailFrom}</p>
        {suggestion.summary && <p className="text-xs text-gray-600 mt-1">{suggestion.summary}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_10rem] gap-2">
        <Input
          aria-label="Company"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          disabled={pending || suggestion.kind === "update"}
        />
        <Input
          aria-label="Role"
          placeholder="Role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          disabled={pending || suggestion.kind === "update"}
        />
        <Select value={status} onValueChange={setStatus} disabled={pending}>
          <SelectTrigger aria-label="Status">
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
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={dismiss} disabled={pending}>
          <X className="mr-1 h-4 w-4" /> Dismiss
        </Button>
        <Button size="sm" onClick={approve} disabled={pending || !company.trim()}>
          {pending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
          {suggestion.kind === "update" ? "Update status" : "Add application"}
        </Button>
      </div>
    </div>
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

  return (
    <Card id="review">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="text-base flex items-center gap-2">
            <Inbox className="h-4 w-4" /> Review suggestions
            {suggestions.length > 0 && <Badge>{suggestions.length}</Badge>}
          </CardTitle>
          <CardDescription>
            Scans never change your applications on their own. Approve what&apos;s right; edit it first if
            needed.
          </CardDescription>
        </div>
        {suggestions.length > 1 && (
          <Button variant="ghost" size="sm" onClick={dismissAll} disabled={pending}>
            Dismiss all
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {suggestions.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">
            Nothing to review. Run a scan to look for updates.
          </p>
        ) : (
          <div className="space-y-3">
            {suggestions.map((suggestion) => (
              <SuggestionRow key={suggestion.id} suggestion={suggestion} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
