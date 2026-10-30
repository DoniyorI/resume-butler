"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { format, isValid } from "date-fns";
import { Calendar as CalendarIcon, FileText, Loader2, Plus } from "lucide-react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { APPLICATION_STATUSES, DEFAULT_STATUS } from "@/lib/constants";
import { createApplication, listLinkableDocuments } from "@/features/applications/actions";

const emptyForm = () => ({
  companyName: "",
  portalLink: "",
  role: "",
  status: DEFAULT_STATUS,
  location: "",
  date: new Date(),
  comments: "",
  resumeId: "",
  coverLetterId: "",
});

function DocumentSelect({ id, label, placeholder, value, onChange, options }) {
  return (
    <div className="w-1/2">
      <Label htmlFor={id} className="text-right">
        {label}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((doc) => (
              <SelectItem key={doc.id} value={doc.id}>
                <div className="flex justify-center items-center">
                  <FileText className="h-4 w-4 text-blue-700 mr-1" />
                  {doc.title}
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

// Rendered in the nav bar on every signed-in page. The trigger keeps its own
// styling; NavBar's className prop has never been applied.
export default function AddApplicationDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [documents, setDocuments] = useState({ resumes: [], coverLetters: [] });
  const [isSaving, startSaving] = useTransition();

  const setField = (field) => (value) => setForm((current) => ({ ...current, [field]: value }));
  const setFieldFromEvent = (field) => (event) => setField(field)(event.target.value);

  const handleOpenChange = async (open) => {
    setIsOpen(open);
    if (!open) return;
    const result = await listLinkableDocuments();
    if (result.ok) setDocuments(result.data);
    else toast.error(result.error);
  };

  const handleSave = () =>
    startSaving(async () => {
      const result = await createApplication({
        company: form.companyName,
        portalLink: form.portalLink,
        role: form.role,
        status: form.status,
        location: form.location,
        appliedDate: isValid(form.date) ? format(form.date, "yyyy-MM-dd") : null,
        comments: form.comments,
        resumeId: form.resumeId,
        coverLetterId: form.coverLetterId,
      });

      if (!result.ok) {
        toast("Failed to save application", { description: result.error });
        return;
      }

      setIsOpen(false);
      setForm(emptyForm());
      toast("Application successfully saved", {
        description: "Your application data has been saved.",
      });
    });

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5 border-slate-200 bg-white px-3 font-medium text-slate-700 shadow-none hover:bg-slate-50 hover:text-slate-950">
          <Plus className="h-4 w-4" />
          {/* Just the icon on narrow phones, where the header has little room */}
          <span className="hidden min-[400px]:inline">New application</span>
          <span className="sr-only min-[400px]:hidden">New application</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="lg:min-w-[60vw]">
        <DialogHeader>
          <DialogTitle>New Application</DialogTitle>
          <DialogDescription>Fill in the application details and click save.</DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[70vh] w-full px-3 rounded-md border">
          <div className="grid gap-4 py-3 mx-1">
            <div className="flex gap-4">
              <DocumentSelect
                id="resume"
                label="Resume"
                placeholder="Select a Resume"
                value={form.resumeId}
                onChange={setField("resumeId")}
                options={documents.resumes}
              />
              <DocumentSelect
                id="cover-letter"
                label="Cover Letter"
                placeholder="Select a Cover Letter"
                value={form.coverLetterId}
                onChange={setField("coverLetterId")}
                options={documents.coverLetters}
              />
            </div>
            <div>
              <Label htmlFor="company-name" className="text-right">
                Company Name
              </Label>
              <Input
                id="company-name"
                value={form.companyName}
                onChange={setFieldFromEvent("companyName")}
                maxLength={200}
                className="col-span-3"
              />
            </div>
            <div>
              <Label htmlFor="portal-link" className="text-right">
                Portal Link
              </Label>
              <Input
                id="portal-link"
                type="url"
                value={form.portalLink}
                onChange={setFieldFromEvent("portalLink")}
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
                  value={form.role}
                  onChange={setFieldFromEvent("role")}
                  maxLength={200}
                  className="col-span-3"
                />
              </div>
              <div>
                <Label htmlFor="status" className="text-right">
                  Status
                </Label>
                <Select value={form.status} onValueChange={setField("status")}>
                  <SelectTrigger id="status" className="w-[180px]">
                    <SelectValue placeholder="Select Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {APPLICATION_STATUSES.map((option) => (
                        <SelectItem key={option} value={option}>
                          <Badge variant={option.toLowerCase()}>{option}</Badge>
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
                value={form.location}
                onChange={setFieldFromEvent("location")}
                maxLength={200}
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
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {isValid(form.date) ? format(form.date, "PPP") : "Select a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={form.date} onSelect={setField("date")} initialFocus />
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
                value={form.comments}
                onChange={setFieldFromEvent("comments")}
                maxLength={5000}
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
            <Button type="button" onClick={handleSave}>
              Add Application
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
