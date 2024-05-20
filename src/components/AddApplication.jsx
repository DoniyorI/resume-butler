"use client";
import { useState, useEffect, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db, storage } from "@/lib/firebase/config";
import { doc, setDoc, getDocs, collection } from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  listAll,
  getMetadata,
} from "firebase/storage";
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
import { useRouter } from "next/navigation";

export default function AddApplicationDialog() {
  const [currentUser, setCurrentUser] = useState(null);
  const [resumeFile, setResumeFile] = useState(null);
  const [coverLetterFile, setCoverLetterFile] = useState(null);
  const [companyName, setCompanyName] = useState("");
  const [portalLink, setPortalLink] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("Applied");
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

    // Fetch from storage
    const resumesRef = ref(storage, `users/${userId}/resumes`);
    const storageResumes = await fetchFromStorage(resumesRef);

    // Fetch from Firestore
    const dbResumesRef = collection(db, `users/${userId}/resumes`);
    const firestoreResumes = await fetchFromFirestore(dbResumesRef);

    // Combine results
    return [...storageResumes, ...firestoreResumes];
  };

  const fetchFromStorage = async (resumesRef) => {
    try {
      const snapshot = await listAll(resumesRef);
      const metadataPromises = snapshot.items.map(async (itemRef) => {
        const metadata = await getMetadata(itemRef);
        const url = await getDownloadURL(itemRef);
        return {
          title: itemRef.name,
          path: itemRef.fullPath,
          url: url,
          date: formatDate(metadata.timeCreated),
          type: "pdf",
          resumeType: "storage",
        };
      });
      return await Promise.all(metadataPromises);
    } catch (error) {
      console.error("Error fetching resumes from storage: ", error);
      return [];
    }
  };

  const fetchFromFirestore = async (resumesRef) => {
    try {
      const querySnapshot = await getDocs(resumesRef);
      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        title: doc.data().title || "Untitled",
        url: `/resumes/${doc.id}`,
        date: doc.data().dateCreated.toDate().toLocaleDateString("en-US"),
        type: doc.data().type || "doc",
        resumeType: "database",
      }));
    } catch (error) {
      console.error("Error fetching resumes from Firestore: ", error);
      return [];
    }
  };

  const fetchLetters = async (userId) => {
    if (!userId) {
      console.error("User ID is null or undefined.");
      return [];
    }

    // Fetch from storage
    const coverLetterRef = ref(storage, `users/${userId}/coverletters`);
    const storageLetters = await fetchLetterFromStorage(coverLetterRef);

    // Fetch from Firestore
    const dbLettersRef = collection(db, `users/${userId}/coverletters`);
    const firestoreLetters = await fetchLetterFromFirestore(dbLettersRef);

    // Combine results from both storage and Firestore
    return [...storageLetters, ...firestoreLetters];
  };

  const fetchLetterFromStorage = async (coverLetterRef) => {
    try {
      const snapshot = await listAll(coverLetterRef);
      const metadataPromises = snapshot.items.map(async (itemRef) => {
        const metadata = await getMetadata(itemRef);
        const url = await getDownloadURL(itemRef);
        return {
          title: itemRef.name,
          path: itemRef.fullPath,
          url: url,
          date: formatDate(metadata.timeCreated),
          type: "pdf",
          letterType: "storage",
        };
      });
      return await Promise.all(metadataPromises);
    } catch (error) {
      console.error("Error fetching cover letters from storage: ", error);
      return [];
    }
  };

  const fetchLetterFromFirestore = async (coverLetterRef) => {
    try {
      const querySnapshot = await getDocs(coverLetterRef);
      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        title: doc.data().title || "Untitled",
        url: `/coverletters/${doc.id}`,
        date: doc.data().dateCreated.toDate().toLocaleDateString("en-US"),
        type: doc.data().type || "doc",
        letterType: "database",
      }));
    } catch (error) {
      console.error("Error fetching cover letters from Firestore: ", error);
      return [];
    }
  };

  const handleSave = async () => {
    if (!currentUser) {
      toast("No user signed in", {
        description: "Please sign in to save the application.",
      });
      return;
    }
    setIsSaving(true);
    try {
      let resumeInfo, coverLetter;
      if (resumeFile) {
        const uploadResult = await uploadFile(
          currentUser.uid,
          resumeFile,
          "resumes"
        );
        resumeInfo = {
          url: uploadResult,
          type: "pdf",
        };
      } else if (selectedResume) {
        resumeInfo = {
          url: selectedResume.url,
          type: selectedResume.type,
        };
      }

      if (coverLetterFile) {
        const uploadResult = await uploadFile(
          currentUser.uid,
          coverLetterFile,
          "coverletters"
        );
        coverLetter = {
          url: uploadResult,
          type: "pdf",
        };
      } else if (selectedResume) {
        coverLetter = {
          url: selectedCoverLetter.url,
          type: selectedCoverLetter.type,
        };
      }
      const applicationData = {
        resume: resumeInfo?.url ?? "",
        resumeType: resumeInfo?.type ?? "",
        coverLetter: coverLetter?.url ?? "",
        coverLetterType: coverLetter?.type ?? "",        
        companyName,
        portalLink,
        role,
        status,
        location,
        date: new Date(date).toLocaleDateString("en-US"),
        comments,
      };

      // Save application data
      const userDocRef = doc(
        db,
        `users/${currentUser.uid}/applications`,
        `${Date.now()}`
      );
      await setDoc(userDocRef, applicationData);
      setIsDialogOpen(false);

      // Reset fields
      setResumeFile(null);
      setCoverLetterFile(null);
      setSelectedCoverLetter("");
      setSelectedResume("");
      setCompanyName("");
      setPortalLink("");
      setRole("");
      setStatus("applied");
      setLocation("");
      setDate(new Date());
      setComments("");

      // Dispatch event and show success message
      window.dispatchEvent(
        new CustomEvent("newApplication", { detail: applicationData })
      );
      toast("Application successfully uploaded", {
        description: "Your application data has been saved.",
      });
    } catch (error) {
      console.error("Error saving application data:", error);
      toast("Failed to upload application", {
        description:
          error.message || "An error occurred while saving your data.",
        action: { label: "Retry", onClick: handleSave },
      });
    } finally {
      setIsSaving(false);
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

  const handleResumeChange = (selectedValue) => {
    if (selectedValue === "upload") {
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.onchange = (event) => {
        const file = event.target.files[0];
        if (file) {
          setSelectedResume({
            url: `New File: ${file.name}`,
            type: "pdf",
            isNew: true, // Additional flag to indicate this is a new file
          });
          setResumeFile(file); // Store the selected file in state
        }
      };
      fileInput.click(); // Simulate a click event to open the file picker
    } else {
      const selected = resumes.find((resume) => resume.url === selectedValue);
      setSelectedResume(selected || {});
    }
  };

  const handleCoverLetterChange = async (selectedValue) => {
    if (selectedValue === "upload") {
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.onchange = (event) => {
        const file = event.target.files[0];
        if (file) {
          setSelectedCoverLetter({
            url: `New File: ${file.name}`,
            type: file.type.split("/")[1] || "unknown",
            isNew: true,
          });
          setCoverLetterFile(file); // Store the selected file in state
        }
      };
      fileInput.click(); // Simulate a click event to open the file picker
    } else {
      const selected = coverLetters.find(
        (letter) => letter.url === selectedValue
      );
      setSelectedCoverLetter(selected || {});
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
                  id="resume"
                  value={selectedResume.url} // Ensure the value reflects the selected object's URL
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
                      {resumes.map((resume, index) => (
                        <SelectItem key={index} value={resume.url}>
                          <div className="flex justify-center items-center">
                            {resume.type === "pdf" ? (
                              <AiOutlineFilePdf className="text-red-700 mr-1" />
                            ) : (
                              <AiOutlineFileText className="text-blue-700 mr-1" />
                            )}
                            {resume.title}
                          </div>
                        </SelectItem>
                      ))}
                      {selectedResume &&
                        selectedResume.url &&
                        selectedResume.url.startsWith("New File:") && (
                          <SelectItem value={selectedResume.url}>
                            <div className="flex justify-center items-center">
                              <AiOutlineFilePdf className="text-red-700 mr-1" />
                              {selectedResume.url.slice(10)}
                            </div>
                          </SelectItem>
                        )}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-1/2">
                <Label htmlFor="cover-letter" className="text-right">
                  Cover Letter
                </Label>
                <Select
                  id="cover-letter"
                  value={selectedCoverLetter.url} // Ensure the value reflects the selected object's URL
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
                      {coverLetters.map((letter, index) => (
                        <SelectItem key={index} value={letter.url}>
                          <div className="flex justify-center items-center">
                            {letter.type === "pdf" ? (
                              <AiOutlineFilePdf className="text-red-700 mr-1" />
                            ) : (
                              <AiOutlineFileText className="text-blue-700 mr-1" />
                            )}
                            {letter.title}
                          </div>
                        </SelectItem>
                      ))}
                      {selectedCoverLetter &&
                        selectedCoverLetter.url &&
                        selectedCoverLetter.url.startsWith("New File:") && (
                          <SelectItem value={selectedCoverLetter.url}>
                            <div className="flex justify-center items-center">
                              <AiOutlineFilePdf className="text-red-700 mr-1" />
                              {selectedCoverLetter.url.slice(10)}
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
