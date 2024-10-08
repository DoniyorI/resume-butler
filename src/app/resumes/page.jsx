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
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";

import { useAuthState } from "react-firebase-hooks/auth";
import { db, auth, storage } from "@/lib/firebase/config";
import { useState, useEffect } from "react";
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

import ResumeDialog from "@/components/ResumeDialog";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function Page() {
  const [resumes, setResumes] = useState([]);
  const [PDFresumes, setPDFResumes] = useState([]);
  const [file, setFile] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState("Recently Opened");
  const [user, loading, error] = useAuthState(auth);
  const router = useRouter();

  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  useEffect(() => {
    if (loading) return;
    if (error) console.error("Auth error:", error);
    if (!user) {
      router.push("/login");
      return;
    }

    const fetchData = async () => {
      try {
        const [fetchedResumes, uploadedResumes] = await Promise.all([
          fetchResumes(user),
          fetchUploadedResumes(user),
        ]);

        setResumes(fetchedResumes);
        setPDFResumes(uploadedResumes);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
  }, [user, loading, error, router]);

  const fetchResumes = async (user) => {
    try {
      const resumesRef = collection(db, `users/${user.uid}/resumes`);
      const querySnapshot = await getDocs(resumesRef);
      const fetchedResumes = querySnapshot.docs.map((doc) => ({
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
      return fetchedResumes;
    } catch (error) {
      console.error("Error fetching resumes:", error);
      return [];
    }
  };

  const fetchUploadedResumes = async (user) => {
    if (!user) {
      console.error("User is null or undefined.");
      return [];
    }
    const resumesRef = ref(storage, `users/${user.uid}/resumes`);
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
      console.error("Error fetching uploaded resumes: ", error);
      return [];
    }
  };

  useEffect(() => {
    const filteredResumes = resumes
      .filter((resume) =>
        resume.title.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => {
        if (sortOrder === "A-Z") {
          return a.title.localeCompare(b.title);
        } else if (sortOrder === "Z-A") {
          return b.title.localeCompare(a.title);
        } else if (sortOrder === "Recently Created") {
          return new Date(b.dateCreated) - new Date(a.dateCreated);
        } else if (sortOrder === "Latest Updated") {
          return new Date(b.lastUpdated) - new Date(a.lastUpdated);
        }
        return 0;
      });
    setResumes(filteredResumes);
  }, [searchTerm, sortOrder]);

  const handleDownloadPDF = (id) => {
    console.log("Download PDF");
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
      const resumeRef = doc(db, `users/${user.uid}/resumes`, id);
      await updateDoc(resumeRef, { title: editingTitle });
      setResumes((resumes) =>
        resumes.map((resume) =>
          resume.id === id ? { ...resume, title: editingTitle } : resume
        )
      );
      setEditingId(null);
      toast("Title updated successfully");
    } catch (error) {
      console.error("Error updating title:", error);
      toast("Title failed updated");
    }
  };

  const handleDelete = async (id) => {
    if (!id) return;
    try {
      const resumeRef = doc(db, `users/${user.uid}/resumes`, id);
      await deleteDoc(resumeRef);
      setResumes((resumes) => resumes.filter((resume) => resume.id !== id));
      toast("Resume deleted successfully");
    } catch (error) {
      console.error("Error deleting resume:", error);
      toast("Resume Failed to delete");
    }
  };

  const handleDeletePDF = async (fullPath) => {
    const fileRef = ref(storage, fullPath);
    try {
      await deleteObject(fileRef);
      toast("File successfully deleted!");
      setPDFResumes((prevFiles) =>
        prevFiles.filter((PDFresumes) => PDFresumes.path !== fullPath)
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

  const validateFileType = (file) => {
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];
    return allowedTypes.includes(file.type);
  };

  const uploadFile = async (file) => {
    if (!file) return "";
    const fileRef = ref(storage, `users/${user.uid}/resumes/${file.name}`);
    await uploadBytes(fileRef, file);
    // Add the newly uploaded file to PDFResumes
    const newResume = {
      name: file.name,
      path: fileRef.fullPath,
      url: await getDownloadURL(fileRef),
      date: formatDate(new Date()),
    };
    setPDFResumes((prevResumes) => [...prevResumes, newResume]);
  };

  return (
    <div className="flex flex-col w-full min-h-screen pt-24 pb-10 px-10">
      <h1 className="text-2xl font-semibold text-[#559F87]">Resumes</h1>
      <div className="flex justify-between mx-2 my-1 mt-3">
        <Input
          placeholder="Filter by Resume Name"
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
        Editable Resumes
      </h2>
      <div className="flex flex-wrap ">
        <ResumeDialog />
        {resumes.map((resume) => (
          <div
            key={resume.id}
            className="flex flex-col m-2 h-[220px] w-[170px] border rounded-md shadow"
          >
            <div
              className="h-full flex justify-center items-center cursor-pointer"
              onClick={() => router.push(`/resumes/${resume.id}`)}
            >
              Preview
            </div>
            <div className=" flex justify-between py-2 px-2 bg-slate-100">
              <div>
                {editingId === resume.id ? (
                  <input
                    type="text"
                    value={editingTitle}
                    onChange={handleTitleChange}
                    onBlur={() => saveTitle(resume.id)}
                    onKeyPress={(event) => {
                      if (event.key === "Enter") {
                        saveTitle(resume.id);
                      }
                    }}
                    className="text-sm w-full bg-inherit focus:ring-0"
                    autoFocus
                  />
                ) : (
                  <div
                    className="flex justify-center items-center cursor-pointer"
                    onDoubleClick={() => handleRename(resume.id, resume.title)}
                  >
                    {resume.title.length > 18
                      ? `${resume.title.substring(0, 15)}...`
                      : resume.title}
                  </div>
                )}

                <div className="text-xs text-slate-400">
                  {resume.lastUpdated}
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
                  {/* <DropdownMenuItem
                    className="text-xs cursor-pointer"
                    onClick={() => handleDownloadPDF(resume.id)}
                  >
                    <FiDownload className="mr-2" /> Download PDF
                  </DropdownMenuItem> */}
                  <DropdownMenuItem
                    className="text-xs cursor-pointer"
                    onClick={() => handleRename(resume.id, resume.title)}
                  >
                    <MdOutlineEdit className="mr-2" /> Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-xs cursor-pointer text-red-500"
                    onClick={() => handleDelete(resume.id)}
                  >
                    <FiTrash2 className="mr-2" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}
      </div>
      <h2 className="text-lg text-[#559F87] font-semibold">Uploaded Resumes</h2>

      <div className="flex flex-wrap">
        <Button
          variant="ghost"
          className="hover:bg-green-50 mx-2 h-[220px] w-[170px] border border-dashed rounded-lg shadow p-4 flex justify-center items-center m-2"
        >
          <Label
            className="space-x-2 flex justify-center items-center font-light w-full h-full cursor-pointer"
            htmlFor="file-upload"
          >
            <CloudUpload strokeWidth={1} />
            <p>Upload</p>
            <Input
              id="file-upload"
              type="file"
              accept=".pdf,.docx,.txt"
              style={{ display: "none" }}
              onChange={(e) => handleFileChange(e)}
            />
          </Label>
        </Button>

        {PDFresumes.map((resume) => (
          <div
            key={resume.path}
            className="h-[220px] w-[170px] border rounded-md shadow justify-between flex flex-col m-2"
          >
            <a
              href={resume.url}
              target="_blank"
              rel="noopener noreferrer"
              className="h-full flex justify-center items-center cursor-pointer"
            >
              View
            </a>
            <div className="flex justify-between py-2 px-2 bg-slate-100">
              <div className="flex flex-col">
                <div>
                  {resume.name.length > 18
                    ? `${resume.name.substring(0, 15)}...`
                    : resume.name}
                </div>
                <div className="text-xs text-slate-400">{resume.date}</div>
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
                    onClick={() => handleDownloadPDF(resume.id)}
                  >
                    <FiDownload className="mr-2" /> Download PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-xs cursor-pointer"
                    onClick={() => handleRename(resume.id)}
                  >
                    <MdOutlineEdit className="mr-2" /> Rename
                  </DropdownMenuItem> */}
                  <DropdownMenuItem
                    className="text-xs cursor-pointer text-red-500"
                    onClick={() => handleDeletePDF(resume.path)}
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
