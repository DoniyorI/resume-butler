"use client";

import {
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  collection,
} from "firebase/firestore";
import { useAuthState } from "react-firebase-hooks/auth";
import { db, auth } from "@/lib/firebase/config";

import { useState, useEffect } from "react";
import { EllipsisVertical } from "lucide-react";
import { FiDownload, FiTrash2 } from "react-icons/fi";
import { MdOutlineEdit } from "react-icons/md";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export default function Page() {
  const [resumes, setResumes] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState("Recently Opened");
  const [user, loading, error] = useAuthState(auth);
  const router = useRouter();

  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");

  useEffect(() => {
    if (loading) return;
    if (error) console.error("Auth error:", error); // Handle possible auth errors
    if (!user) {
      router.push("/login");
      return;
    }

    const fetchResumes = async () => {
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
        setResumes(fetchedResumes);
      } catch (error) {
        console.error("Error fetching resumes:", error);
      }
    };

    fetchResumes();
  }, [user, loading, error, router]);

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
    setEditingTitle(title || "");  // Ensures editingTitle is never undefined
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
      setEditingId(null); // Stop editing
      console.log("Title updated successfully");
    } catch (error) {
      console.error("Error updating title:", error);
    }
  };

  const handleDelete = async (id) => {
    if (!id) return;

    try {
      const resumeRef = doc(db, `users/${user.uid}/resumes`, id);
      await deleteDoc(resumeRef);
      setResumes((resumes) => resumes.filter((resume) => resume.id !== id));

      console.log("Resume deleted successfully");
    } catch (error) {
      console.error("Error deleting resume:", error);
    }
  };

  return (
    <div className="flex flex-col w-full min-h-screen py-10 px-10">
      <h1 className="text-2xl text-[#559F87] font-semibold">Resumes</h1>
      <p className="mt-2 mb-6">Create and manage your Resume here</p>
      <div className="flex justify-between pb-6 mx-2">
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
      Resumes with our AI will appear here
      <div className="flex flex-wrap ">
        <ResumeDialog />
        {resumes.map((resume) => (
          <div
            key={resume.id}
            className="h-[220px] w-[170px] border rounded-md shadow justify-between flex flex-col m-2"
          >
            <div className="h-full flex justify-center items-center cursor-pointer"
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
                    className="text-sm p-1 w-full"
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
                  <DropdownMenuItem
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
      Your Resumes will appear here
    </div>
  );
}
