"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { FiUpload } from "react-icons/fi";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function FileUpload({ onComplete }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState("");

  const handleFile = async (file) => {
    if (!file) return;

    const allowedTypes = ["application/pdf", "text/plain"];
    if (!allowedTypes.includes(file.type)) {
      toast("Unsupported file type", {
        description: "Please upload a PDF or TXT file.",
      });
      return;
    }

    setFileName(file.name);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/parse-resume", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to parse resume");
      }

      const data = await response.json();
      const r = data.results;

      toast("Resume imported successfully", {
        description: `Added ${r.education} education, ${r.experience} experience, ${r.projects} projects, ${r.skills} skills`,
      });

      if (onComplete) {
        onComplete(data.parsed);
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast("Failed to import resume", {
        description: error.message,
      });
    } finally {
      setUploading(false);
    }
  };

  const onDragOver = (e) => {
    e.preventDefault();
    setDragging(true);
  };

  const onDragLeave = (e) => {
    e.preventDefault();
    setDragging(false);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  const onChange = (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
  };

  return (
    <div className="w-full max-w-[600px] mx-auto">
      <div
        className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg p-4 transition-colors ${
          dragging
            ? "bg-green-50 border-green-400"
            : "bg-white border-green-200 hover:border-green-300"
        }`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {uploading ? (
          <div className="flex flex-col items-center space-y-3">
            <Loader2 className="h-6 w-6 animate-spin text-[#559F87]" />
            <p className="text-sm text-gray-600">
              Parsing <span className="font-medium">{fileName}</span>...
            </p>
            <p className="text-xs text-gray-400">
              Extracting education, experience, projects, and skills
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-4">
            <FiUpload className="h-6 w-6 text-gray-400" />
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700">
                Upload your existing resume to auto-fill your CV
              </p>
              <p className="text-xs text-gray-400 mt-1">
                PDF or TXT — we&apos;ll extract your info, not rewrite it
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-green-200 text-[#188665] hover:bg-green-50"
              onClick={() => document.getElementById("cv-file-input").click()}
            >
              Choose File
            </Button>
          </div>
        )}
        <input
          id="cv-file-input"
          type="file"
          className="hidden"
          accept=".pdf,.txt"
          onChange={onChange}
        />
      </div>
    </div>
  );
}
