"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const ALLOWED_TYPES = ["application/pdf", "text/plain"];

// Sends a resume to /api/parse-resume, which adds the parsed entries to the
// master CV, then refreshes the page's server data
export default function FileUpload({ onComplete }) {
  const router = useRouter();
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState("");

  const handleFile = async (file) => {
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
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
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Failed to parse resume");
      }

      const r = data.results;
      toast("Resume imported successfully", {
        description: `Added ${r.education} education, ${r.experience} experience, ${r.projects} projects, ${r.skills} skills`,
      });

      router.refresh();
      onComplete?.();
    } catch (error) {
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
    handleFile(e.dataTransfer.files[0]);
  };

  const onChange = (e) => {
    handleFile(e.target.files[0]);
    // Lets the same file be picked again
    e.target.value = "";
  };

  return (
    <div className="w-full max-w-[600px] mx-auto">
      <div
        className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg p-4 transition-colors ${
          dragging ? "bg-green-50 border-green-400" : "bg-white border-green-200 hover:border-green-300"
        }`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {uploading ? (
          <div className="flex flex-col items-center space-y-3">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
            <p className="text-sm text-gray-600">
              Parsing <span className="font-medium">{fileName}</span>...
            </p>
            <p className="text-xs text-gray-400">Extracting education, experience, projects, and skills</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-4">
            <Upload className="h-6 w-6 text-gray-400" />
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
              onClick={() => inputRef.current?.click()}
            >
              Choose File
            </Button>
          </div>
        )}
        <input ref={inputRef} type="file" className="hidden" accept=".pdf,.txt" onChange={onChange} />
      </div>
    </div>
  );
}
