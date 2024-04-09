"use client";
import React, { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { FiUpload } from "react-icons/fi";

export default function FileUpload() {
  const [dragging, setDragging] = useState(false);

  const onDragEnter = useCallback((event) => {
    event.preventDefault();
    setDragging(true);
  }, []);
  const onDragLeave = useCallback((event) => {
    event.preventDefault();
    setDragging(false);
  }, []);
  const onDrop = useCallback((event) => {
    event.preventDefault();
    setDragging(false);
    // Handle file upload here with event.dataTransfer.files
  }, []);
  const onChange = useCallback((event) => {
    // Handle file upload here with event.target.files
  }, []);

  return (
    <div className="w-[600px] mx-auto">
      <div
        className={`flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg p-4 ${
          dragging
            ? "bg-green-100 border-green-400"
            : "bg-white border-green-200"
        }`}
        onDragEnter={onDragEnter}
        onDragOver={onDragEnter}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <div className="flex flex-col items-center justify-center space-y-7">
          <FiUpload />
          <div className="text-center">
            <p className="text-sm font-medium text-gray-700 mb-1">
              Upload a Resume or CV
            </p>
            <p className="text-xs text-gray-500">PDF, DOCX, TXT</p>
          </div>
          <Button
            className="bg-green-200 hover:bg-green-300 text-black rounded shadow font-light"
            onClick={() => document.getElementById("fileInput").click()}
          >
            Choose File
          </Button>
        </div>
        <input
          id="fileInput"
          type="file"
          className="hidden"
          onChange={onChange}
          multiple
        />
      </div>
    </div>
  );
}
