"use client";

import { useReducer, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Calendar as CalendarIcon,
  ExternalLink,
  MapPin,
  Save,
  Trash2,
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
import { parseDate } from "@/lib/dates";
import { safeHttpUrl } from "@/lib/safeUrl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const EDITABLE_FIELDS = [
  "company",
  "role",
  "location",
  "portalLink",
  "status",
  "comments",
  "jobDescription",
  "appliedDate",
];

function initForm(application) {
  return Object.fromEntries(EDITABLE_FIELDS.map((field) => [field, application[field]]));
}

function formReducer(state, { field, value }) {
  return { ...state, [field]: value };
}

function LabeledInput({ icon: Icon, label, value, onChange }) {
  return (
    <div>
      <Label className="flex items-center gap-1.5 mb-1.5">
        <Icon size={14} /> {label}
      </Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} maxLength={200} />
    </div>
  );
}

export default function ApplicationEditor({ application, statusHistory, resumeContent }) {
  const router = useRouter();
  const [form, dispatch] = useReducer(formReducer, application, initForm);
  const [isSaving, startSaving] = useTransition();
  const [isDeleting, startDeleting] = useTransition();

  const setField = (field) => (value) => dispatch({ field, value });
  const appliedDate = parseDate(form.appliedDate);
  const portalHref = safeHttpUrl(form.portalLink);

  const handleSave = () =>
    startSaving(async () => {
      const result = await updateApplication(application.id, form);
      if (result.ok) toast("Application saved");
      else toast.error(result.error || "Failed to save application");
    });

  // Status saves immediately; the server re-renders the timeline
  const handleStatusChange = async (newStatus) => {
    const previous = form.status;
    dispatch({ field: "status", value: newStatus });
    const result = await updateApplicationStatus(application.id, newStatus);
    if (result.ok) {
      toast(`Status updated to ${newStatus}`);
    } else {
      dispatch({ field: "status", value: previous });
      toast.error(result.error);
    }
  };

  const handleDelete = () => {
    if (!confirm("Are you sure you want to delete this application?")) return;
    startDeleting(async () => {
      // On success the action redirects to the list and returns nothing
      const result = await deleteApplicationAndReturn(application.id);
      if (result && !result.ok) toast.error(result.error);
      else toast("Application deleted");
    });
  };

  return (
    <div className="max-w-4xl mx-auto py-20 px-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
            <ArrowLeft size={16} className="mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{form.company}</h1>
            <p className="text-gray-500">{form.role}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            <Trash2 size={14} className="mr-1" /> Delete
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            <Save size={14} className="mr-1" /> {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Application Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <LabeledInput
                  icon={Building2}
                  label="Company"
                  value={form.company}
                  onChange={setField("company")}
                />
                <LabeledInput
                  icon={Briefcase}
                  label="Role"
                  value={form.role}
                  onChange={setField("role")}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <LabeledInput
                  icon={MapPin}
                  label="Location"
                  value={form.location}
                  onChange={setField("location")}
                />
                <div>
                  <Label className="flex items-center gap-1.5 mb-1.5">
                    <CalendarIcon size={14} /> Applied Date
                  </Label>
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
                        onSelect={(date) =>
                          setField("appliedDate")(date ? format(date, "yyyy-MM-dd") : "")
                        }
                        fromYear={2020}
                        toYear={2030}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div>
                <Label className="flex items-center gap-1.5 mb-1.5">
                  <ExternalLink size={14} /> Portal Link
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="url"
                    value={form.portalLink}
                    onChange={(e) => setField("portalLink")(e.target.value)}
                    placeholder="https://..."
                    className="flex-grow"
                  />
                  {portalHref && (
                    <a href={portalHref} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="icon" className="h-10 w-10 flex-shrink-0">
                        <ExternalLink size={16} />
                      </Button>
                    </a>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Job Description</CardTitle>
              <CardDescription>
                Save the full job posting — it gets taken down after the role closes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={form.jobDescription}
                onChange={(e) => setField("jobDescription")(e.target.value)}
                placeholder="Paste the full job description here..."
                className="min-h-[200px] text-sm"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={form.comments}
                onChange={(e) => setField("comments")(e.target.value)}
                placeholder="Interview prep, contact info, follow-up notes..."
                maxLength={5000}
                className="min-h-[100px] text-sm"
              />
            </CardContent>
          </Card>

          {resumeContent && form.jobDescription && (
            <AtsScanner resumeContent={resumeContent} initialJobDescription={form.jobDescription} />
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Status</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={form.status} onValueChange={handleStatusChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {APPLICATION_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        <Badge variant={status.toLowerCase()}>{status}</Badge>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <StatusTimeline history={statusHistory} />

          <LinkedDocuments
            resumeId={application.resumeId}
            coverLetterId={application.coverLetterId}
          />
        </div>
      </div>
    </div>
  );
}
