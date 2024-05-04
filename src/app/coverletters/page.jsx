"use client";
import {
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  collection,
} from "firebase/firestore";
import {
  ref,
  listAll,
  getMetadata,
  getDownloadURL,
  uploadBytes,
  deleteObject,
} from "firebase/storage";
import { useAuthState } from "react-firebase-hooks/auth";
import { db, auth, storage } from "@/lib/firebase/config";

import { useState, useEffect, use } from "react";
import { EllipsisVertical, CloudUpload } from "lucide-react";
import { FiDownload, FiTrash2 } from "react-icons/fi";
import { MdOutlineEdit } from "react-icons/md";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import CoverLetterDialog from "@/components/CoverLetterDialog";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function Page() {
  const [coverLetters, setCoverLetters] = useState([]);
  const [PDFLetter, setPDFLetter] = useState([]);
  const [file, setFile] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState("Recently Opened");
  const [user, loading, error] = useAuthState(auth);
  const router = useRouter();
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");

  useEffect(() => {
    const filteredCoverLetters = coverLetters
      .filter((coverLetter) =>
        coverLetter.title.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => {
        if (sortOrder === "A-Z") {
          return a.title.localeCompare(b.title);
        } else if (sortOrder === "Z-A") {
          return b.title.localeCompare(a.title);
        } else if (sortOrder === "Recently Created") {
          return new Date(b.created) - new Date(a.created);
        } else if (sortOrder === "Latest Updated") {
          return new Date(b.lastUpdated) - new Date(a.lastUpdated);
        }
        return 0;
      });
    setCoverLetters(filteredCoverLetters);
  }, [searchTerm, sortOrder]);

  useEffect(() => {
  if (loading) return;
  if (error) console.error("Auth error:", error); // Handle possible auth errors
  if (!user) {
    router.push("/login");
    return;
  }

  const fetchData = async () => {
    try {
      const [fetchedCoverLetters, pdfLetters] = await Promise.all([
        fetchCoverLetters(user),
        fetchLetters(user),
      ]);
      
      setCoverLetters(fetchedCoverLetters);
      setPDFLetter(pdfLetters);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  fetchData();
}, [user, loading, error, router]);

const fetchCoverLetters = async (user) => {
  try {
    const coverLettersRef = collection(
      db,
      `users/${user.uid}/coverletters`
    );
    const querySnapshot = await getDocs(coverLettersRef);
    const fetchedCoverLetters = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      dateCreated: doc
        .data()
        .dateCreated.toDate()
        .toLocaleDateString("en-US", {
          month: "2-digit",
          day: "2-digit",
          year: "numeric",
        }),
      lastUpdated: doc
        .data()
        .lastUpdated.toDate()
        .toLocaleDateString("en-US", {
          month: "2-digit",
          day: "2-digit",
          year: "numeric",
        }),
    }));
    return fetchedCoverLetters;
  } catch (error) {
    console.error("Error fetching cover letters:", error);
    return [];
  }
};

const fetchLetters = async (user) => {
  if (!user) {
    console.error("User is null or undefined.");
    return [];
  }
  const coverLetterRef = ref(storage, `users/${user.uid}/coverletters`);
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
  const handleDownloadPDF = (id) => {
    console.log("Download PDF");
  };

  const handleDownloadDOCX = (id) => {
    console.log("Download DOCX");
  };

  const handleRename = (id, title) => {
    setEditingId(id);
    setEditingTitle(title || "");
  };

  const handleTitleChange = (event) => {
    setEditingTitle(event.target.value);
  };

  const saveTitle = async (id) => {
    if (editingTitle.trim() === "") {
      return;
    }
    try {
      const letterRef = doc(db, `users/${user.uid}/coverletters`, id);
      await updateDoc(letterRef, { title: editingTitle });
      setCoverLetters((coverLetters) =>
        coverLetters.map((letter) =>
          letter.id === id ? { ...letter, title: editingTitle } : letter
        )
      );
      setEditingId(null);
      toast("Title updated successfully");
    } catch (error) {
      console.error("Error updating title:", error);
      toast("Failed to update title");
    }
  };

  const handleDelete = async (id) => {
    if (!id) return;

    try {
      const letterRef = doc(db, `users/${user.uid}/coverletters`, id);
      await deleteDoc(letterRef);
      setCoverLetters((coverLetters) =>
        coverLetters.filter((letter) => letter.id !== id)
      );
      toast("Cover letter deleted successfully");
    } catch (error) {
      console.error("Error deleting cover letter:", error);
      toast("Failed to delete cover letter");
    }
  };

  const handleDeletePDF = async (fullPath) => {
    const fileRef = ref(storage, fullPath);

    try {
      await deleteObject(fileRef);
      toast("File successfully deleted!");
      setPDFLetter((prevFiles) =>
        prevFiles.filter((PDFLetter) => PDFLetter.path !== fullPath)
      );
    } catch (error) {
      console.error("Error deleting file: ", error);
    }
  };

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      if (validateFileType(selectedFile)) {
        setFile(selectedFile);
        uploadFile(selectedFile);
      } else {
        console.error(
          "Unsupported file type. Please upload PDF, DOCX, or TXT files."
        );
      }
    }
  };

  const uploadFile = async (file) => {
    if (!file) return "";
    console.log("Uploading file...");
    const fileRef = ref(storage, `users/${user.uid}/coverletters/${file.name}`);
    await uploadBytes(fileRef, file);
    console.log("File uploaded successfully!");
    const newCoverLetter = {
      name: file.name,
      path: fileRef.fullPath,
      url: await getDownloadURL(fileRef),
      date: formatDate(new Date()),
    };
    setPDFLetter((prevLetters) => [...prevLetters, newCoverLetter]);
  };

  const validateFileType = (file) => {
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];
    return allowedTypes.includes(file.type);
  };



  return (
    <div className="flex flex-col w-full min-h-screen pt-24 pb-10 px-10">
      <h1 className="text-2xl font-semibold text-[#559F87]">Cover Letters</h1>
      <div className="flex justify-between mx-2 my-1 mt-3">
        <Input
          placeholder="Filter by Cover Letter Name"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="max-w-sm"
        />
        <Select defaultValue="Recently Opened" onValueChange={setSortOrder}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Recently Opened" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="Recently Opened">Recently Opened</SelectItem>
              <SelectItem value="A-Z">A-Z</SelectItem>
              <SelectItem value="Z-A">Z-A</SelectItem>
              <SelectItem value="Recently Created">Recently Created</SelectItem>
              <SelectItem value="Latest Updated">Latest Updated</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <h2 className="text-lg text-[#559F87] font-semibold mt-4">
        Editable Cover Letters
      </h2>
      <div className="flex flex-wrap ">
        <CoverLetterDialog />
        {coverLetters.map((letter) => (
          <div
            key={letter.id}
            className="h-[220px] w-[170px] border rounded-md shadow justify-between flex flex-col m-2"
          >
            <div
              className="h-full flex justify-center items-center cursor-pointer"
              onClick={() => router.push(`/coverletters/${letter.id}`)}
            >
              Preview
            </div>
            <div className=" flex justify-between py-2 px-2 bg-slate-100">
              <div>
                <div className="text-sm">
                  {letter.title.length > 18
                    ? `${letter.title.substring(0, 15)}...`
                    : letter.title}
                </div>

                <div className="text-xs text-slate-400">
                  {letter.lastUpdated}
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="p-0 m-0 outline-none select-none "
                  >
                    <EllipsisVertical size={18} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="text-sm">
                  <DropdownMenuItem
                    className="text-xs cursor-pointer"
                    onClick={() => handleDownloadPDF(letter.id)}
                  >
                    <FiDownload className="mr-2" /> Download PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-xs cursor-pointer"
                    onClick={() => handleDownloadDOCX(letter.id)}
                  >
                    <FiDownload className="mr-2" /> Download DOCX
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-xs cursor-pointer"
                    onClick={() => handleRename(letter.id)}
                  >
                    <MdOutlineEdit className="mr-2" /> Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-xs cursor-pointer text-red-500"
                    onClick={() => handleDelete(letter.id)}
                  >
                    <FiTrash2 className="mr-2" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}
      </div>
      <h2 className="text-lg text-[#559F87] font-semibold">
        Uploaded Cover Letters
      </h2>
      
      <div className="flex flex-wrap">
      <Button variant="ghost" className="hover:bg-green-50 mx-2 h-[220px] w-[170px] border  border-dashed  rounded-lg shadow p-4 flex justify-center items-center cursor-pointer m-2 ">
          <Label className="space-x-2 flex justify-center items-center font-light" htmlFor="file-upload">
            <CloudUpload strokeWidth={1}/>
            <p>Upload</p>
          </Label>
          <Input
            id="file-upload"
            type="file"
            accept=".pdf,.docx,.txt"
            style={{ display: "none" }}
            onChange={(e) => handleFileChange(e)}
          />
        </Button>
        {PDFLetter.map((letter) => (
          <div
            key={letter.path}
            className="h-[220px] w-[170px] border rounded-md shadow justify-between flex flex-col m-2"
          >
            <a
              href={letter.url}
              target="_blank"
              rel="noopener noreferrer"
              className="h-full flex justify-center items-center cursor-pointer"
            >
            View
            </a>
            <div className="flex justify-between py-2 px-2 bg-slate-100">
              <div className="flex flex-col">
                <div>
                  {letter.name.length > 18
                    ? `${letter.name.substring(0, 15)}...`
                    : letter.name}
                </div>
                <div className="text-xs text-slate-400">{letter.date}</div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="p-0 m-0 outline-none select-none "
                  >
                    <EllipsisVertical size={18} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="text-sm">
                  {/* <DropdownMenuItem
                    className="text-xs cursor-pointer"
                    onClick={() => handleDownloadPDF(letter.id)}
                  >
                    <FiDownload className="mr-2" /> Download PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-xs cursor-pointer"
                    onClick={() => handleRename(letter.id)}
                  >
                    <MdOutlineEdit className="mr-2" /> Rename
                  </DropdownMenuItem> */}
                  <DropdownMenuItem
                    className="text-xs cursor-pointer text-red-500"
                    onClick={() => handleDeletePDF(letter.path)}
                  >
                    <FiTrash2 className="mr-2" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}
        
      </div>
    </div>
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
