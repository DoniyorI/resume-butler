'use client';

import React from "react";
import { EllipsisVertical } from "lucide-react";
import { FiDownload, FiTrash2 } from "react-icons/fi";
import { MdOutlineEdit } from "react-icons/md";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const coverLetters = [
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
    <div className="flex flex-col w-full min-h-screen py-10 px-10">
      <h1 className="text-2xl text-[#559F87] font-semibold">Cover Letters</h1>
      <p className="mt-2 mb-6">Create and manage your cover letters here.</p>
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
