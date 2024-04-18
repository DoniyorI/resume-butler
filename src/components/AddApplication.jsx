"use client";
import { useState, useEffect } from "react";
import { auth, db, storage } from "@/lib/firebase/config";
import { doc, setDoc, Timestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { onAuthStateChanged } from "firebase/auth";

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
import { Calendar as CalendarIcon } from "lucide-react";
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

const locations = [
  { city: "New York", state: "NY" },
  { city: "Los Angeles", state: "CA" },
  { city: "Chicago", state: "IL" },
];

export default function AddApplicationDialog() {
  const [currentUser, setCurrentUser] = useState(null);
  const [resumeFile, setResumeFile] = useState(null);
  const [coverLetterFile, setCoverLetterFile] = useState(null);
  const [companyName, setCompanyName] = useState("");
  const [portalLink, setPortalLink] = useState("");
  // const [jobDescription, setJobDescription] = useState('');
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState(new Date());
  const [comments, setComments] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleFileChange = (event, setter) => {
    setter(event.target.files[0]);
  };

  const uploadFile = async (userId, file, folder) => {
    if (!file) return "";
    const fileRef = ref(storage, `users/${userId}/${folder}/${file.name}`);
    await uploadBytes(fileRef, file);
    return getDownloadURL(fileRef);
  };

  const handleSave = async () => {
    if (!currentUser) {
      alert("No user signed in");
      return;
    }
    setIsSaving(true); // Start loading indication
    try {
      const resumeUrl = await uploadFile(
        currentUser.uid,
        resumeFile,
        "resumes"
      );
      const coverLetterUrl = await uploadFile(
        currentUser.uid,
        coverLetterFile,
        "coverletters"
      );

      const applicationData = {
        resumeUrl,
        coverLetterUrl,
        companyName,
        portalLink,
        role,
        status,
        location,
        date: Timestamp.fromDate(date),
        comments,
      };

      const userDocRef = doc(
        db,
        `users/${currentUser.uid}/applications`,
        `${Date.now()}`
      );
      await setDoc(userDocRef, applicationData);
      setIsDialogOpen(false);
      toast("Application successfully uploaded", {
        description: "Your application data has been saved.",
        action: {
          label: "OK",
          onClick: () => {}, // Optionally handle the action click
        },
      });
      // clear form fields after saving
      setResumeFile(null);
      setCoverLetterFile(null);
      setCompanyName("");
      setPortalLink("");
      setRole("");
      setStatus("");
      setLocation("");
      setDate(new Date());
      setComments("");
    } catch (error) {
      console.error("Error saving application data:", error);
      toast("Failed to upload application", {
        description: "An error occurred while saving your data.",
        action: {
          label: "Retry",
          onClick: handleSave, // Optionally retry the save operation
        },
      });
    } finally {
      setIsSaving(false); // End loading indication
    }
  };

  const statuses = [
    { label: "Applied", value: "applied" },
    { label: "Interviewed", value: "interviewed" },
    { label: "Pending", value: "pending" },
    { label: "Offered", value: "offered" },
    { label: "Rejected", value: "rejected" },
    { label: "Withdrew", value: "withdrew" },
  ];

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" onClick={() => setIsDialogOpen(true)}>
          Add Application
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
              <div className="flex-grow">
                <Label htmlFor="resume" className="text-right">
                  Resume
                </Label>
                <Input
                  id="resume"
                  type="file"
                  onChange={(e) => handleFileChange(e, setResumeFile)}
                />
              </div>
              <div className="flex-grow">
                <Label htmlFor="cover-letter" className="text-right">
                  Cover Letter
                </Label>
                <Input
                  id="cover-letter"
                  type="file"
                  onChange={(e) => handleFileChange(e, setCoverLetterFile)}
                />
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
                      {statuses.map((status) => (
                        <SelectItem key={status.label} value={status.value}>
                          <Badge variant={status.value.toLowerCase()}>
                            {status.label}
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
          <Button type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={cn("animate-spin", "mr-2 h-4 w-4 animate-spin")}
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
            ) : (
              "Add Application"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
