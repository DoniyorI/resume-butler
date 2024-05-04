"use client";
import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db, storage } from "@/lib/firebase/config";
import { doc, setDoc, Timestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
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
import { useRouter } from "next/navigation";

export default function AddApplicationDialog() {
  const [currentUser, setCurrentUser] = useState(null);
  const [resumeFile, setResumeFile] = useState(null);
  const [coverLetterFile, setCoverLetterFile] = useState(null);
  const [companyName, setCompanyName] = useState("");
  const [portalLink, setPortalLink] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("applied");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState(new Date());
  const [comments, setComments] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
      } else {
        router.push("/login");
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
    setIsSaving(true);
    try {
      const resume = await uploadFile(currentUser.uid, resumeFile, "resumes");
      const coverLetter = await uploadFile(
        currentUser.uid,
        coverLetterFile,
        "coverletters"
      );

      const applicationData = {
        resume,
        coverLetter,
        companyName,
        portalLink,
        role,
        status,
        location,
        date: new Date(date).toLocaleDateString("en-US"), 
        comments,
      };
      const userDocRef = doc(
        db,
        `users/${currentUser.uid}/applications`,
        `${Date.now()}`
      );
      await setDoc(userDocRef, applicationData);
      setIsDialogOpen(false);
      
      setResumeFile(null);
      setCoverLetterFile(null);
      setCompanyName("");
      setPortalLink("");
      setRole("");
      setStatus("");
      setLocation("");
      setDate(new Date());
      setComments("");
      window.dispatchEvent(new CustomEvent('newApplication', { detail: applicationData }));
      toast("Application successfully uploaded", {
        description: "Your application data has been saved.",
        action: {
          label: "OK",
          onClick: () => {},
        },
      });
    } catch (error) {
      console.error("Error saving application data:", error);
      toast("Failed to upload application", {
        description: "An error occurred while saving your data.",
        action: {
          label: "Retry",
          onClick: handleSave,
        },
      });
    } finally {
      setIsSaving(false);
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
