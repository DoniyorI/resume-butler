"use client";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { AiOutlineFilePdf, AiOutlineFileText } from "react-icons/ai";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "./ui/badge";
import { isValid, format } from "date-fns";
import { Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export default function AddApplicationDialog() {
  const { user: currentUser, supabase } = useAuth({ redirect: true });
  const [companyName, setCompanyName] = useState("");
  const [portalLink, setPortalLink] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("Applied");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState(new Date());
  const [comments, setComments] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [resumes, setResumes] = useState([]);
  const [coverLetters, setCoverLetters] = useState([]);
  const [selectedResumeId, setSelectedResumeId] = useState("");
  const [selectedCoverLetterId, setSelectedCoverLetterId] = useState("");

  const prevIsDialogOpen = useRef();

  useEffect(() => {
    if (isDialogOpen && !prevIsDialogOpen.current && currentUser) {
      // Fetch resumes
      supabase
        .from("resumes")
        .select("id, title, created_at")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false })
        .then(({ data }) => setResumes(data || []));

      // Fetch cover letters
      supabase
        .from("cover_letters")
        .select("id, title, created_at")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false })
        .then(({ data }) => setCoverLetters(data || []));
    }
    prevIsDialogOpen.current = isDialogOpen;
  }, [isDialogOpen, currentUser, supabase]);

  const handleSave = async () => {
    if (!currentUser) {
      toast("No user signed in", {
        description: "Please sign in to save the application.",
      });
      return;
    }
    setIsSaving(true);
    try {
      const applicationData = {
        user_id: currentUser.id,
        company: companyName,
        portal_link: portalLink,
        role,
        status,
        location,
        applied_date: date ? format(date, "yyyy-MM-dd") : null,
        comments,
        resume_id: selectedResumeId || null,
        cover_letter_id: selectedCoverLetterId || null,
      };

      const { data, error } = await supabase
        .from("applications")
        .insert(applicationData)
        .select()
        .single();

      if (error) throw error;

      setIsDialogOpen(false);

      // Reset fields
      setCompanyName("");
      setPortalLink("");
      setRole("");
      setStatus("Applied");
      setLocation("");
      setDate(new Date());
      setComments("");
      setSelectedResumeId("");
      setSelectedCoverLetterId("");

      // Dispatch event for table update
      window.dispatchEvent(
        new CustomEvent("newApplication", {
          detail: {
            id: data.id,
            companyName: data.company,
            role: data.role,
            status: data.status,
            location: data.location,
            date: data.applied_date
              ? new Date(data.applied_date).toLocaleDateString("en-US")
              : "",
            comments: data.comments,
            portalLink: data.portal_link,
          },
        })
      );
      toast("Application successfully saved", {
        description: "Your application data has been saved.",
      });
    } catch (error) {
      console.error("Error saving application data:", error);
      toast("Failed to save application", {
        description:
          error.message || "An error occurred while saving your data.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const statuses = [
    { label: "Applied", value: "Applied" },
    { label: "Interviewed", value: "Interviewed" },
    { label: "Pending", value: "Pending" },
    { label: "Offered", value: "Offered" },
    { label: "Rejected", value: "Rejected" },
    { label: "Withdrew", value: "Withdrew" },
  ];

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button
          className="text-[#188665] font-medium hover:bg-green-100"
          variant="outline"
          onClick={() => setIsDialogOpen(true)}
        >
          New Application
        </Button>
      </DialogTrigger>
      <DialogContent className="lg:min-w-[60vw]">
        <DialogHeader>
          <DialogTitle>New Application</DialogTitle>
          <DialogDescription>
            Fill in the application details and click save.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[70vh] w-full px-3 rounded-md border">
          <div className="grid gap-4 py-3 mx-1">
            <div className="flex gap-4">
              <div className="w-1/2">
                <Label htmlFor="resume" className="text-right">
                  Resume
                </Label>
                <Select
                  value={selectedResumeId}
                  onValueChange={setSelectedResumeId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a Resume" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {resumes.map((resume) => (
                        <SelectItem key={resume.id} value={resume.id}>
                          <div className="flex justify-center items-center">
                            <AiOutlineFileText className="text-blue-700 mr-1" />
                            {resume.title}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-1/2">
                <Label htmlFor="cover-letter" className="text-right">
                  Cover Letter
                </Label>
                <Select
                  value={selectedCoverLetterId}
                  onValueChange={setSelectedCoverLetterId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a Cover Letter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {coverLetters.map((letter) => (
                        <SelectItem key={letter.id} value={letter.id}>
                          <div className="flex justify-center items-center">
                            <AiOutlineFileText className="text-blue-700 mr-1" />
                            {letter.title}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="company-name" className="text-right">
                Company Name
              </Label>
              <Input
                id="company-name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div>
              <Label htmlFor="portal-Link" className="text-right">
                Portal Link
              </Label>
              <Input
                id="portal-link"
                type="url"
                value={portalLink}
                onChange={(e) => setPortalLink(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div className="flex justify-between space-x-4">
              <div className="w-full">
                <Label htmlFor="role" className="text-right">
                  Role
                </Label>
                <Input
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="col-span-3"
                />
              </div>
              <div className="">
                <Label htmlFor="status" className="text-right">
                  Status
                </Label>
                <Select
                  id="status"
                  value={status}
                  onValueChange={(value) => setStatus(value)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {statuses.map((statusOption) => (
                        <SelectItem
                          key={statusOption.label}
                          value={statusOption.value}
                        >
                          <Badge variant={statusOption.value.toLowerCase()}>
                            {statusOption.label}
                          </Badge>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="location" className="text-right">
                Location
              </Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div>
              <Label htmlFor="date-picker" className="text-right">
                Date
              </Label>
              <div className="col-span-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="date-picker"
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {isValid(date) ? format(date, "PPP") : "Select a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={setDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div>
              <Label htmlFor="comments" className="text-right">
                Comments
              </Label>
              <Textarea
                id="comments"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
        </ScrollArea>
        <DialogFooter>
          {isSaving ? (
            <Button disabled>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Please wait
            </Button>
          ) : (
            <Button type="button" onClick={handleSave} disabled={isSaving}>
              Add Application
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
