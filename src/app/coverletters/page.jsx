'use client';

import React from "react";
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

const FetchedCoverLetters = [
  {
    id: "1",
    title: "Software Engineer",
    created: "2023-04-01",
    lastUpdated: "2023-04-05",
  },
  {
    id: "2",
    title: "Product Manager",
    created: "2023-03-15",
    lastUpdated: "2023-03-20",
  },
];

export default function Page() {
    const [coverLetters, setCoverLetters] = useState(FetchedCoverLetters);
    const [searchTerm, setSearchTerm] = useState("");
    const [sortOrder, setSortOrder] = useState("Recently Opened");
  
    useEffect(() => {
      const filteredCoverLetters = FetchedCoverLetters.filter((coverLetter) =>
      coverLetter.title.toLowerCase().includes(searchTerm.toLowerCase())
      ).sort((a, b) => {
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
    const handleDownloadPDF = (id) => {
        console.log("Download PDF");
      };
      
      const handleDownloadDOCX = (id) => {
        console.log("Download DOCX");
      };
      
      const handleRename = (id) => {
        console.log("Rename");
      };
      
      const handleDelete = (id) => {
        console.log("Delete");
      };
  return (
    <div className="flex flex-col w-full min-h-screen py-16 px-10 my-10">
      <h1 className="text-2xl font-semibold text-[#559F87]">Cover Letters</h1>
      <p className="mt-2 mb-6">Create and manage your cover letters here.</p>
      <div className="flex justify-between pb-6 mx-2">
        <Input
          placeholder="Filter by Resume Name"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="max-w-sm"
        />
        <Select defaultValue="Recently Opened"onValueChange={setSortOrder}>
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
      <div className="flex flex-wrap ">
        <div className="h-[220px] w-[170px] border rounded-lg shadow p-4 flex justify-center items-center cursor-pointer m-2 ">
          <div className="font-bold text-slate-400">New</div>
        </div>
        {coverLetters.map((letter) => (
          <div
            key={letter.id}
            className="h-[220px] w-[170px] border rounded-md shadow justify-between flex flex-col m-2"
          >
            <div className="h-full flex justify-center items-center cursor-pointer ">
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
                <DropdownMenuItem className="text-xs cursor-pointer" onClick={() => handleDownloadPDF(letter.id)}>
                  <FiDownload className="mr-2" /> Download PDF
                </DropdownMenuItem>
                <DropdownMenuItem className="text-xs cursor-pointer" onClick={() => handleDownloadDOCX(letter.id)}>
                  <FiDownload className="mr-2" /> Download DOCX
                </DropdownMenuItem>
                <DropdownMenuItem className="text-xs cursor-pointer" onClick={() => handleRename(letter.id)}>
                  <MdOutlineEdit className="mr-2" /> Rename
                </DropdownMenuItem>
                <DropdownMenuItem className="text-xs cursor-pointer text-red-500" onClick={() => handleDelete(letter.id)}>
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
