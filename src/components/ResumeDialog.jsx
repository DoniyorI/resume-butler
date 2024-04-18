"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Checkbox } from "@/components/ui/checkbox";

export default function ResumeDialog() {
  const [useAI, setUseAI] = useState(false);
  const [resumeName, setResumeName] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const router = useRouter();

  const updateCheckBox = () => {
    setUseAI(!useAI);
  };

  const handleNextStep = () => {
    const uuid = Math.random().toString(36).substring(7); // Generate a simple pseudo-random UUID
    router.push(`/resumes/${uuid}`);
    setIsDialogOpen(false);
  };

  const handleOpenDialog = () => {
    setIsDialogOpen(true);
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <div onClick={handleOpenDialog} className="h-[220px] w-[170px] border rounded-lg shadow p-4 flex justify-center items-center cursor-pointer m-2">
          <div className="font-bold text-slate-400">New</div>
        </div>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] md:min-w-[60vw]">
        <DialogHeader>
          <DialogTitle>Create a New Resume</DialogTitle>
          <DialogDescription>
            Let's create a new resume to help you land your dream job!
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="resumeName">Resume Name</Label>
            <Input
              id="resumeName"
              value={resumeName}
              onChange={(e) => setResumeName(e.target.value)}
              placeholder="Enter resume name"
            />
          </div>
          <div className="flex space-x-2 justify-start items-center">
            <Checkbox
              id="useAI"
              checked={useAI}
              onCheckedChange={updateCheckBox}
            />
            <Label htmlFor="useAI">Use Ali to tailor your resume</Label>
          </div>
          {useAI && (
            <div>
              <Label htmlFor="jobDescription">Paste Job Description</Label>
              <Textarea
                id="jobDescription"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Watch AI tailor your resume to your qualifications and experiences to elevate your application!"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" onClick={handleNextStep}>
            Next Step
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}