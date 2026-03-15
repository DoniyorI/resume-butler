"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { toast } from "sonner";
import Link from "next/link";
import AtsScanner from "@/components/AtsScanner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ExternalLink,
  Save,
  Clock,
  FileText,
  Briefcase,
  MapPin,
  Calendar as CalendarIcon,
  Building2,
  Trash2,
} from "lucide-react";

const STATUSES = ["Applied", "Interviewed", "Pending", "Offered", "Rejected", "Withdrew"];

export default function ApplicationDetailPage({ params }) {
  const { user, loading, supabase } = useAuth({ redirect: true });
  const router = useRouter();
  const [application, setApplication] = useState(null);
  const [statusHistory, setStatusHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [location, setLocation] = useState("");
  const [portalLink, setPortalLink] = useState("");
  const [status, setStatus] = useState("Applied");
  const [comments, setComments] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [appliedDate, setAppliedDate] = useState("");
  const [resumeContent, setResumeContent] = useState(null);

  useEffect(() => {
    if (!user || !params.id) return;

    const fetchApplication = async () => {
      const { data, error } = await supabase
        .from("applications")
        .select("*")
        .eq("id", params.id)
        .eq("user_id", user.id)
        .single();

      if (error || !data) {
        console.error("Application not found:", error);
        router.push("/");
        return;
      }

      setApplication(data);
      setCompany(data.company || "");
      setRole(data.role || "");
      setLocation(data.location || "");
      setPortalLink(data.portal_link || "");
      setStatus(data.status || "Applied");
      setComments(data.comments || "");
      setJobDescription(data.job_description || "");
      setAppliedDate(data.applied_date || "");

      // Fetch status history
      const { data: history } = await supabase
        .from("application_status_history")
        .select("*")
        .eq("application_id", params.id)
        .order("changed_at", { ascending: true });

      setStatusHistory(history || []);

      // Fetch linked resume content for ATS scanner
      if (data.resume_id) {
        const { data: resume } = await supabase
          .from("resumes")
          .select("content")
          .eq("id", data.resume_id)
          .single();
        if (resume?.content) setResumeContent(resume.content);
      }

      setIsLoading(false);
    };

    fetchApplication();
  }, [user, params.id, supabase, router]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("applications")
        .update({
          company,
          role,
          location,
          portal_link: portalLink,
          status,
          comments,
          job_description: jobDescription,
          applied_date: appliedDate || null,
        })
        .eq("id", params.id);

      if (error) throw error;
      toast("Application saved");
    } catch (error) {
      console.error("Error saving:", error);
      toast("Failed to save application");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    setStatus(newStatus);
    // Save immediately on status change
    const { error } = await supabase
      .from("applications")
      .update({ status: newStatus })
      .eq("id", params.id);

    if (!error) {
      // Refresh history
      const { data: history } = await supabase
        .from("application_status_history")
        .select("*")
        .eq("application_id", params.id)
        .order("changed_at", { ascending: true });
      setStatusHistory(history || []);
      toast(`Status updated to ${newStatus}`);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this application?")) return;
    const { error } = await supabase
      .from("applications")
      .delete()
      .eq("id", params.id);

    if (!error) {
      toast("Application deleted");
      router.push("/");
    }
  };

  if (isLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-20 px-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
            <ArrowLeft size={16} className="mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{company}</h1>
            <p className="text-gray-500">{role}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={handleDelete}
          >
            <Trash2 size={14} className="mr-1" /> Delete
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Save size={14} className="mr-1" /> {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — main info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Application Details Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Application Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="flex items-center gap-1.5 mb-1.5">
                    <Building2 size={14} /> Company
                  </Label>
                  <Input
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="flex items-center gap-1.5 mb-1.5">
                    <Briefcase size={14} /> Role
                  </Label>
                  <Input
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="flex items-center gap-1.5 mb-1.5">
                    <MapPin size={14} /> Location
                  </Label>
                  <Input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>
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
                        {appliedDate
                          ? format(new Date(appliedDate + "T00:00:00"), "PPP")
                          : "Select a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-auto p-0">
                      <Calendar
                        mode="single"
                        captionLayout="dropdown-buttons"
                        selected={appliedDate ? new Date(appliedDate + "T00:00:00") : undefined}
                        onSelect={(date) =>
                          setAppliedDate(date ? format(date, "yyyy-MM-dd") : "")
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
                    value={portalLink}
                    onChange={(e) => setPortalLink(e.target.value)}
                    placeholder="https://..."
                    className="flex-grow"
                  />
                  {portalLink && (
                    <a href={portalLink} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="icon" className="h-10 w-10 flex-shrink-0">
                        <ExternalLink size={16} />
                      </Button>
                    </a>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Job Description Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Job Description</CardTitle>
              <CardDescription>
                Save the full job posting — it gets taken down after the role closes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the full job description here..."
                className="min-h-[200px] text-sm"
              />
            </CardContent>
          </Card>

          {/* Notes Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Interview prep, contact info, follow-up notes..."
                className="min-h-[100px] text-sm"
              />
            </CardContent>
          </Card>
          {/* ATS Scanner */}
          {resumeContent && jobDescription && (
            <AtsScanner resumeContent={resumeContent} initialJobDescription={jobDescription} />
          )}
        </div>

        {/* Right column — status + timeline */}
        <div className="space-y-6">
          {/* Status Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Status</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={status} onValueChange={handleStatusChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        <Badge variant={s.toLowerCase()}>{s}</Badge>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Timeline Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock size={16} /> Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statusHistory.length === 0 ? (
                <p className="text-sm text-gray-400">No history yet</p>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-[7px] top-2 bottom-2 w-[2px] bg-gray-200" />

                  <div className="space-y-4">
                    {statusHistory.map((entry, index) => (
                      <div key={entry.id} className="flex gap-3 relative">
                        <div
                          className={`w-4 h-4 rounded-full border-2 bg-white z-10 mt-0.5 flex-shrink-0 ${
                            index === statusHistory.length - 1
                              ? "border-[#559F87]"
                              : "border-gray-300"
                          }`}
                        />
                        <div className="flex-grow">
                          <Badge variant={entry.status.toLowerCase()} className="text-xs">
                            {entry.status}
                          </Badge>
                          <p className="text-xs text-gray-400 mt-1">
                            {format(new Date(entry.changed_at), "MMM d, yyyy 'at' h:mm a")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Linked Documents Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText size={16} /> Documents
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {application?.resume_id ? (
                <Link href={`/resumes/${application.resume_id}`}>
                  <div className="flex items-center gap-2 p-2 rounded-md border hover:bg-gray-50 cursor-pointer">
                    <FileText size={14} className="text-blue-600" />
                    <span className="text-sm">View Resume</span>
                  </div>
                </Link>
              ) : (
                <p className="text-sm text-gray-400">No resume linked</p>
              )}

              {application?.cover_letter_id ? (
                <Link href={`/coverletters/${application.cover_letter_id}`}>
                  <div className="flex items-center gap-2 p-2 rounded-md border hover:bg-gray-50 cursor-pointer">
                    <FileText size={14} className="text-green-600" />
                    <span className="text-sm">View Cover Letter</span>
                  </div>
                </Link>
              ) : (
                <p className="text-sm text-gray-400">No cover letter linked</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
