"use client";
import { useState } from "react";

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
import { useRouter } from "next/navigation";

export default function ResumeDialog() {
  const [isHovered, setIsHovered] = useState(false);
  const [useAI, setUseAI] = useState(false);
  const [resumeName, setResumeName] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const router = useRouter();

  const updateCheckBox = () => {
    setUseAI(!useAI);
    if (!useAI) {
      setJobDescription("");
    } else {
      setJobDescription("");
    }
  };

  const handelNextStep = () => {
    //random uuid
    const uuid = Math.random().toString(36).substring(7); //placeholder, replace when adding firebase
    //creates new resume and populates it with empty fields and saves to db
    if (useAI) {
      // Call Alfie API fills empty fields
      // Loading page while waiting for response
      router.push(`/resumes/${uuid}`);
    }else {
      router.push(`/resumes/${uuid}`);
  }
  setIsDialogOpen(false);
}

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <div className="fixed bottom-10 right-10 flex items-center">
          {isHovered && (
            <Label className="mr-2 text-sm py-1 px-2 border rounded shadow-lg">
              Create new resume
            </Label>
          )}
          <Button
            onClick={() => setIsDialogOpen(true)}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="w-12 h-12 flex justify-center items-center rounded-full shadow-md focus:outline-none transition duration-150 ease-in-out"
          >
            +
          </Button>
        </div>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] md: min-w-[60vw]">
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
              onCheckedChange={() => updateCheckBox()}
            />
            <Label>Use Alfie to tailor your resume</Label>
          </div>
          {useAI && (
            <div>
              <Label htmlFor="jobDescription">Paste Job Description</Label>
              <Textarea
                id="jobDescription"
                value={jobDescription}
                placeholder="Watch Alfie tailor your resume with your qualifications and experiences to elevate your application!"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" onClick={handelNextStep}>
          Next Step
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
