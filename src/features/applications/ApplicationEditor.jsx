"use client";

import { useMemo, useReducer, useState, useTransition } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Briefcase,
  Building2,
  Calendar as CalendarIcon,
  ChevronRight,
  ExternalLink,
  Globe,
  Laptop,
  MapPin,
  Pencil,
  Save,
  Trash2,
  Wallet,
} from "lucide-react";
import AtsScanner from "@/features/ats/AtsScanner";
import StatusTimeline from "@/features/applications/StatusTimeline";
import LinkedDocuments from "@/features/applications/LinkedDocuments";
import {
  deleteApplicationAndReturn,
  updateApplication,
  updateApplicationStatus,
} from "@/features/applications/actions";
import { APPLICATION_STATUSES } from "@/lib/constants";
import { formatShortDate, parseDate } from "@/lib/dates";
import { sourceSiteLabel, WORKPLACE_TYPES } from "@/lib/jobDetails";
import { formatSalary, SALARY_PERIODS } from "@/lib/salary";
import { safeHttpUrl } from "@/lib/safeUrl";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const EDITABLE_FIELDS = [
  "company",
  "role",
  "location",
  "portalLink",
  "status",
  "comments",
  "jobDescription",
  "appliedDate",
  "jobDetails",
];
const CURRENCIES = ["USD", "CAD", "GBP", "EUR", "AUD", "INR"];
const EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Contract", "Internship", "Temporary"];
const PERIOD_LABELS = {
  hour: "per hour",
  day: "per day",
  week: "per week",
  month: "per month",
  year: "per year",
};
// The description shows this much until "Show more"
const DESCRIPTION_PREVIEW = 1200;

function initForm(application) {
  return Object.fromEntries(EDITABLE_FIELDS.map((field) => [field, application[field]]));
}

function formReducer(state, { field, value }) {
  return { ...state, [field]: value };
}

function Field({ icon: Icon, label, htmlFor, children, className }) {
  return (
    <div className={className}>
      <Label
        htmlFor={htmlFor}
        className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
      >
        {Icon && <Icon size={13} />} {label}
      </Label>
      {children}
    </div>
  );
}

// One fact under the title: "$120K – $150K /yr", "Remote", "Applied Oct 27, 2026"
function Fact({ icon: Icon, children }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {children}
    </span>
  );
}

// Whole-number pay field: empty means "not known"
function PayInput({ id, value, onChange, placeholder }) {
  return (
    <Input
      id={id}
      inputMode="numeric"
      placeholder={placeholder}
      value={value ?? ""}
      onChange={(e) => {
        const digits = e.target.value.replace(/[^\d]/g, "");
        onChange(digits ? Number(digits) : null);
      }}
    />
  );
}

export default function ApplicationEditor({ application, statusHistory, resumeContent }) {
  const [form, dispatch] = useReducer(formReducer, application, initForm);
  const [saved, setSaved] = useState(() => initForm(application));
  const [editingDescription, setEditingDescription] = useState(!application.jobDescription);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const [isDeleting, startDeleting] = useTransition();

  const setField = (field) => (value) => dispatch({ field, value });
  const setDetail = (key) => (value) =>
    dispatch({ field: "jobDetails", value: { ...form.jobDetails, [key]: value } });

  // Status saves on its own, so it never counts as unsaved
  const dirty = useMemo(
    () => EDITABLE_FIELDS.some((f) => f !== "status" && JSON.stringify(form[f]) !== JSON.stringify(saved[f])),
    [form, saved]
  );

  const appliedDate = parseDate(form.appliedDate);
  const portalHref = safeHttpUrl(form.portalLink);
  const details = form.jobDetails;
  const salary = formatSalary({
    min: details.salaryMin,
    max: details.salaryMax,
    currency: details.salaryCurrency,
    period: details.salaryPeriod,
  });
  const site = sourceSiteLabel(application.sourceSite);
  const source =
    application.source === "extension"
      ? `Added by the extension${site ? ` from ${site}` : ""}`
      : application.source === "email"
        ? "Added from email"
        : null;

  const handleSave = () =>
    startSaving(async () => {
      const { jobDetails, ...rest } = form;
      const result = await updateApplication(application.id, {
        ...rest,
        ...(application.hasJobDetails && { jobDetails }),
      });
      if (result.ok) {
        setSaved(form);
        toast.success("Application saved");
      } else toast.error(result.error || "Failed to save application");
    });

  // Status saves immediately; the server re-renders the timeline
  const handleStatusChange = async (newStatus) => {
    const previous = form.status;
    dispatch({ field: "status", value: newStatus });
    const result = await updateApplicationStatus(application.id, newStatus);
    if (result.ok) toast(`Status updated to ${newStatus}`);
    else {
      dispatch({ field: "status", value: previous });
      toast.error(result.error);
    }
  };

  const handleDelete = () => {
    if (!confirm("Delete this application? This can't be undone.")) return;
    startDeleting(async () => {
      // On success the action redirects to the list and returns nothing
      const result = await deleteApplicationAndReturn(application.id);
      if (result && !result.ok) toast.error(result.error);
      else toast("Application deleted");
    });
  };

  const description = form.jobDescription;
  const longDescription = description.length > DESCRIPTION_PREVIEW;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 pb-16 pt-[85px] md:px-6">
      {/* Title, status and the facts at a glance */}
      <header className="flex flex-col gap-4">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-muted-foreground">
          <Link href="/applications" className="hover:text-foreground">
            Applications
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="truncate text-foreground">{form.company || "Application"}</span>
        </nav>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="truncate text-2xl font-semibold">{form.role || form.company}</h1>
              <Select value={form.status} onValueChange={handleStatusChange}>
                <SelectTrigger aria-label="Status" className="h-8 w-auto gap-2 border-dashed px-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APPLICATION_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      <Badge variant={status.toLowerCase()}>{status}</Badge>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.role && <p className="text-base text-muted-foreground">{form.company}</p>}
          </div>

          <div className="flex items-center gap-2">
            {dirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              <Trash2 className="mr-1 h-4 w-4" /> Delete
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving || !dirty}>
              <Save className="mr-1 h-4 w-4" /> {isSaving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {salary && <Fact icon={Wallet}>{salary}</Fact>}
          {details.workplaceType && <Fact icon={Laptop}>{WORKPLACE_TYPES[details.workplaceType]}</Fact>}
          {details.employmentType && <Fact icon={Briefcase}>{details.employmentType}</Fact>}
          {form.location && <Fact icon={MapPin}>{form.location}</Fact>}
          {appliedDate && <Fact icon={CalendarIcon}>Applied {formatShortDate(form.appliedDate)}</Fact>}
          {source && <Fact icon={Globe}>{source}</Fact>}
          {portalHref && (
            <a
              href={portalHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open posting
            </a>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field icon={Building2} label="Company" htmlFor="company">
                <Input
                  id="company"
                  value={form.company}
                  onChange={(e) => setField("company")(e.target.value)}
                  maxLength={200}
                />
              </Field>
              <Field icon={Briefcase} label="Role" htmlFor="role">
                <Input
                  id="role"
                  value={form.role}
                  onChange={(e) => setField("role")(e.target.value)}
                  maxLength={200}
                />
              </Field>
              <Field icon={MapPin} label="Location" htmlFor="location">
                <Input
                  id="location"
                  value={form.location}
                  onChange={(e) => setField("location")(e.target.value)}
                  maxLength={200}
                />
              </Field>
              <Field icon={CalendarIcon} label="Applied">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !appliedDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {appliedDate ? format(appliedDate, "PPP") : "Select a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-auto p-0">
                    <Calendar
                      mode="single"
                      captionLayout="dropdown-buttons"
                      selected={appliedDate || undefined}
                      onSelect={(date) => setField("appliedDate")(date ? format(date, "yyyy-MM-dd") : "")}
                      fromYear={2020}
                      toYear={2030}
                    />
                  </PopoverContent>
                </Popover>
              </Field>
              <Field icon={ExternalLink} label="Posting link" htmlFor="portal" className="sm:col-span-2">
                <Input
                  id="portal"
                  type="url"
                  value={form.portalLink}
                  onChange={(e) => setField("portalLink")(e.target.value)}
                  placeholder="https://…"
                />
              </Field>

              {application.hasJobDetails && (
                <>
                  <Field icon={Wallet} label="Pay range" className="sm:col-span-2">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_6.5rem_8.5rem]">
                      <PayInput
                        id="salary-min"
                        placeholder="From"
                        value={details.salaryMin}
                        onChange={setDetail("salaryMin")}
                      />
                      <PayInput
                        id="salary-max"
                        placeholder="To"
                        value={details.salaryMax}
                        onChange={setDetail("salaryMax")}
                      />
                      <Select value={details.salaryCurrency} onValueChange={setDetail("salaryCurrency")}>
                        <SelectTrigger aria-label="Currency">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[...new Set([details.salaryCurrency, ...CURRENCIES])].map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={details.salaryPeriod} onValueChange={setDetail("salaryPeriod")}>
                        <SelectTrigger aria-label="Pay period">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SALARY_PERIODS.map((p) => (
                            <SelectItem key={p} value={p}>
                              {PERIOD_LABELS[p]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </Field>
                  <Field icon={Laptop} label="Workplace">
                    <Select
                      value={details.workplaceType || "unknown"}
                      onValueChange={(v) => setDetail("workplaceType")(v === "unknown" ? "" : v)}
                    >
                      <SelectTrigger aria-label="Workplace">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unknown">Not sure</SelectItem>
                        {Object.entries(WORKPLACE_TYPES).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field icon={Briefcase} label="Employment type">
                    <Select
                      value={details.employmentType || "unknown"}
                      onValueChange={(v) => setDetail("employmentType")(v === "unknown" ? "" : v)}
                    >
                      <SelectTrigger aria-label="Employment type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unknown">Not sure</SelectItem>
                        {[...new Set([details.employmentType, ...EMPLOYMENT_TYPES].filter(Boolean))].map(
                          (t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  </Field>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-4">
              <div className="space-y-1">
                <CardTitle className="text-base">Job description</CardTitle>
                <CardDescription>Kept here in case the posting is taken down.</CardDescription>
              </div>
              {description && (
                <Button variant="ghost" size="sm" onClick={() => setEditingDescription((on) => !on)}>
                  <Pencil className="mr-1 h-3.5 w-3.5" /> {editingDescription ? "Done" : "Edit"}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {editingDescription ? (
                <Textarea
                  aria-label="Job description"
                  value={description}
                  onChange={(e) => setField("jobDescription")(e.target.value)}
                  placeholder="Paste the full job description here…"
                  className="min-h-[260px] text-sm"
                />
              ) : (
                <>
                  <div className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">
                    {showFullDescription || !longDescription
                      ? description
                      : `${description.slice(0, DESCRIPTION_PREVIEW).trimEnd()}…`}
                  </div>
                  {longDescription && (
                    <Button
                      variant="link"
                      size="sm"
                      className="mt-2 h-auto px-0"
                      onClick={() => setShowFullDescription((on) => !on)}
                    >
                      {showFullDescription ? "Show less" : "Show more"}
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                aria-label="Notes"
                value={form.comments}
                onChange={(e) => setField("comments")(e.target.value)}
                placeholder="Interview prep, contacts, follow-ups…"
                maxLength={5000}
                className="min-h-[120px] text-sm"
              />
            </CardContent>
          </Card>

          {resumeContent && description && (
            <AtsScanner resumeContent={resumeContent} initialJobDescription={description} />
          )}
        </div>

        <aside className="space-y-5">
          <StatusTimeline history={statusHistory} />
          <LinkedDocuments resumeId={application.resumeId} coverLetterId={application.coverLetterId} />
        </aside>
      </div>
    </div>
  );
}
