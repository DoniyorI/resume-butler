"use client";
import { useState, useEffect, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db, storage } from "@/lib/firebase/config";
import { doc, setDoc, Timestamp } from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  listAll,
  getMetadata,
} from "firebase/storage";
import { AiOutlineFilePdf } from "react-icons/ai";
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
  const [selectedResume, setSelectedResume] = useState("");
  const [selectedCoverLetter, setSelectedCoverLetter] = useState("");
  const [resumes, setResumes] = useState([]);
  const [coverLetters, setCoverLetters] = useState([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log("User signed in:", user);
        setCurrentUser(user);
      } else {
        router.push("/login");
      }
    });
    return () => unsubscribe();
  }, []);

  const prevIsDialogOpen = useRef();

  useEffect(() => {
    // Check if isDialogOpen is true and the previous value was false
    if (isDialogOpen && !prevIsDialogOpen.current) {
      if (!currentUser) return;
      fetchResumes(currentUser.uid)
        .then((resumes) => {
          setResumes(resumes);
        })
        .catch((error) => {
          console.error("Error fetching resumes:", error);
        });

      fetchLetters(currentUser.uid)
        .then((coverLetter) => {
          setCoverLetters(coverLetter);
        })
        .catch((error) => {
          console.error("Error fetching cover letter:", error);
        });
    }

    // Update the previous value of isDialogOpen
    prevIsDialogOpen.current = isDialogOpen;
  }, [isDialogOpen, currentUser]);

  const fetchResumes = async (userId) => {
    if (!userId) {
      console.error("User ID is null or undefined.");
      return [];
    }
    const resumesRef = ref(storage, `users/${userId}/resumes`);
    try {
      const snapshot = await listAll(resumesRef);
      const metadataPromises = snapshot.items.map(async (itemRef) => {
        const metadata = await getMetadata(itemRef);
        const url = await getDownloadURL(itemRef);
        return {
          name: itemRef.name,
          path: itemRef.fullPath,
          url: url,
          date: formatDate(metadata.timeCreated),
        };
      });

      const resumeFiles = await Promise.all(metadataPromises);
      return resumeFiles;
    } catch (error) {
      console.error("Error fetching resumes: ", error);
      return [];
    }
  };
  const fetchLetters = async (user) => {
    if (!user) {
      console.error("User is null or undefined.");
      return [];
    }
    const coverLetterRef = ref(storage, `users/${user}/coverletters`);
    try {
      const snapshot = await listAll(coverLetterRef);
      const metadataPromises = snapshot.items.map((itemRef) =>
        Promise.all([getMetadata(itemRef), getDownloadURL(itemRef)]).then(
          ([metadata, url]) => ({
            name: itemRef.name,
            path: itemRef.fullPath,
            url: url,
            date: formatDate(metadata.timeCreated),
          })
        )
      );

      const letterFiles = await Promise.all(metadataPromises);
      return letterFiles;
    } catch (error) {
      console.error("Error fetching PDF letters: ", error);
      return [];
    }
  };

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
      let resume;
      if (resumeFile) {
        resume = await uploadFile(currentUser.uid, resumeFile, "resumes");
      } else {
        resume = selectedResume; // Use the selected existing resume URL
      }
      let coverLetter;
      if (coverLetterFile) {
        coverLetter = await uploadFile(
          currentUser.uid,
          resumeFile,
          "coverletters"
        );
      } else {
        coverLetter = selectedCoverLetter; // Use the selected existing resume URL
      }
      // const coverLetter = await uploadFile(
      //   currentUser.uid,
      //   coverLetterFile,
      //   "coverletters"
      // );

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
      window.dispatchEvent(
        new CustomEvent("newApplication", { detail: applicationData })
      );
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

  const handleFileUpload = async (file) => {
    if (!file) return; // Handle case when no file is selected
    await uploadFile(currentUser.uid, file, "resumes").then((url) => {
      setResumes((prevResumes) => [
        ...prevResumes,
        { name: file.name, url: url },
      ]);
      setSelectedResume(file.name);
      setResumeFile(file);
    });
  };

  const handleResumeChange = async (value) => {
    if (value === "upload") {
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.onchange = (event) => {
        const file = event.target.files[0];
        setSelectedResume(`New File: ${file.name}`); // Update the selectedResume state with a custom value indicating a new file
        setResumeFile(file); // Store the selected file in state
      };
      fileInput.click(); // Simulate a click event to open the file picker
    } else {
      setSelectedResume(value); // Set selected resume to the URL
      setResumeFile(null); // Set resumeFile to null when selecting an existing resume
    }
  };
  const handleCoverLetterChange = async (value) => {
    if (value === "upload") {
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.onchange = (event) => {
        const file = event.target.files[0];
        setSelectedCoverLetter(`New File: ${file.name}`); // Update the selectedResume state with a custom value indicating a new file
        setCoverLetterFile(file); // Store the selected file in state
      };
      fileInput.click(); // Simulate a click event to open the file picker
    } else {
      setSelectedCoverLetter(value); // Set selected resume to the URL
      setCoverLetterFile(null); // Set resumeFile to null when selecting an existing resume
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
                <Select
                  id="resume"
                  value={selectedResume}
                  onValueChange={handleResumeChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a Resume" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="upload">
                        <Input
                          className="border-none w-full bg-transparent px-0"
                          id="cover-letter"
                          type="file"
                          onChange={(e) => handleFileChange(e, setResumeFile)}
                        />
                      </SelectItem>
                      {resumes.map((resume) => (
                        <SelectItem key={resume.path} value={resume.url}>
                          <div className="flex justify-center items-center">
                            <AiOutlineFilePdf className="text-red-700 mr-1" />
                            {resume.name}
                          </div>
                        </SelectItem>
                      ))}
                      {selectedResume &&
                        selectedResume.startsWith("New File:") && (
                          <SelectItem value={selectedResume}>
                            <div className="flex justify-center items-center">
                              <AiOutlineFilePdf className="text-red-700 mr-1" />
                              {selectedResume.slice(10)}
                            </div>
                          </SelectItem>
                        )}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-grow">
                <Label htmlFor="cover-letter" className="text-right">
                  Cover Letter
                </Label>
                <Select
                  id="cover-letter"
                  value={selectedCoverLetter}
                  onValueChange={handleCoverLetterChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a Cover Letter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="upload">
                        <Input
                          className="border-none w-full bg-transparent px-0"
                          id="cover-letter-file"
                          type="file"
                          onChange={(e) =>
                            handleFileChange(e, setCoverLetterFile)
                          }
                        />
                      </SelectItem>
                      {coverLetters.map((letter) => (
                        <SelectItem key={letter.path} value={letter.url}>
                          <div className="flex justify-center items-center">
                            <AiOutlineFilePdf className="text-red-700 mr-1" />
                            {letter.name}
                          </div>
                        </SelectItem>
                      ))}
                      {selectedCoverLetter &&
                        selectedCoverLetter.startsWith("New File:") && (
                          <SelectItem value={selectedCoverLetter}>
                            <div className="flex justify-center items-center">
                              <AiOutlineFilePdf className="text-red-700 mr-1" />
                              {selectedCoverLetter.slice(10)}
                            </div>
                          </SelectItem>
                        )}
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
const formatDate = (dateString) => {
  const date = new Date(dateString);
  return `${padTo2Digits(date.getMonth() + 1)}/${padTo2Digits(
    date.getDate()
  )}/${date.getFullYear()}`;
};
const padTo2Digits = (num) => {
  return num.toString().padStart(2, "0");
};
