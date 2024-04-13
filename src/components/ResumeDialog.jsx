"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";

function ResumeDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [useAI, setUseAI] = useState(false);
  const [resumeName, setResumeName] = useState("");
  const [jobDescription, setJobDescription] = useState("");

  const handleAIChange = (e) => {
    setUseAI(e.target.checked);
    if (e.target.checked) {
      // Fetch the job description from the database or generate one
      setJobDescription("Generated job description based on previous CVs");
    } else {
      setJobDescription("");
    }
  };

  return (
    <div>
      <Button onClick={() => setIsOpen(true)}>Create New Resume</Button>
      <Dialog isOpen={isOpen} onClose={() => setIsOpen(false)}>
        <DialogContent>
          <DialogTitle>
            <div className="fixed bottom-10 right-10 flex items-center">
              {isHovered && (
                <Label className="mr-2 text-sm py-1 px-2 border rounded shadow-lg">
                  Create new resume
                </Label>
              )}
              <Button
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className="w-12 h-12 flex justify-center items-center rounded-full shadow-md focus:outline-none transition duration-150 ease-in-out"
              >
                +
              </Button>
            </div>
          </DialogTitle>
          <div className="space-y-4">
            <div>
              <Label htmlFor="resumeName">Resume Name:</Label>
              <Input
                id="resumeName"
                value={resumeName}
                onChange={(e) => setResumeName(e.target.value)}
                placeholder="Enter resume name"
              />
            </div>
            <div>
              <Label>
                <Checkbox checked={useAI} onChange={handleAIChange} />
                Use Alfie to tailor your resume
              </Label>
            </div>
            {useAI && (
              <div>
                <Label htmlFor="jobDescription">Job Description:</Label>
                <Textarea id="jobDescription" value={jobDescription} readOnly />
              </div>
            )}
            <Button
              onClick={() => {
                // Submit logic here
                setIsOpen(false);
              }}
            >
              Save Resume
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ResumeDialog;
