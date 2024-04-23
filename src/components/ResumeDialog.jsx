"use client";

import { onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, collection, addDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase/config";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z, ZodError } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";


const formSchema = z.object({
  resumeName: z.string().min(1, "Resume Name is required."),
  jobDescription: z.string().optional(),
  useAI: z.boolean(),
}).refine((data) => data.useAI ? data.jobDescription && data.jobDescription.length > 0 : true, {
  message: "Job Description is required when using AI.",
  path: ["jobDescription"],
});

export default function ResumeDialog() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [useAI, setUseAI] = useState(false);
  const [user, setUser] = useState(null);
  const router = useRouter();
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      resumeName: "",
      jobDescription: "",
      useAI: false,
    }
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, currentUser => {
      setUser(currentUser);
    });
    return () => unsubscribe(); // Clean up subscription
  }, []);

  const handleNextStep = async (formData) => {
    if (user) {
      const resumesRef = collection(db, `users/${user.uid}/resumes`);
      const resumeRef = await addDoc(resumesRef, {
        title: formData.resumeName,
        dateCreated: new Date(),
        lastUpdated: new Date(),
        education: [], // list of dict with school, major, degree, graduation, gpa  
        experience: [], // list of dict with company, position, dates, description
        projects: [], // list of dict with name, dates, description
        skills: [] // list of skills
      });
      router.push(`/resumes/${resumeRef.id}`);clear
      setIsDialogOpen(false);
    } else {
      alert("You must be logged in to create a resume.");
    }
  };

  const handleOpenDialog = () => {
    setIsDialogOpen(true);
  };

  const toggleUseAI = () => {
    setUseAI(!useAI);
    form.setValue("useAI", !useAI);
  };

      //create a new resume in database user/{userid}/resumes/{resumeid}
      //resume structure
      //subcollections for each section
        //Education
          //School
          //Major, Type of Degree
          //Expected Graduation
          //GPA
        //Experience
          //Company
          //Position
          //Dates
          //Description
            //dictionary for each bullet points
        //Projects
          //Name
          //Dates
          //Description
            //dictionary for each bullet points
        //Skills
          //List of skills
      // calls backend to generate a resume based on the job description fills in the resume structure with the generated resume
      //navigate to the new resume page

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
        <form onSubmit={form.handleSubmit(handleNextStep)} className="space-y-4">
          <div>
            <Label htmlFor="resumeName">Resume Name</Label>
            <Input
              id="resumeName"
              {...form.register("resumeName")}
              placeholder="Enter resume name"
            />
            {form.formState.errors.resumeName && (
              <p className="text-red-500">{form.formState.errors.resumeName.message}</p>
            )}
          </div>
          <div className="flex space-x-2 justify-start items-center">
            <Checkbox
              id="useAI"
              checked={useAI}
              onCheckedChange={toggleUseAI}
            />
            <Label htmlFor="useAI">Use AI to tailor your resume</Label>
          </div>
          {useAI && (
            <div>
              <Label htmlFor="jobDescription">Paste Job Description</Label>
              <Textarea
                id="jobDescription"
                {...form.register("jobDescription")}
                placeholder="Watch AI tailor your resume..."
              />
              {form.formState.errors.jobDescription && (
                <p className="text-red-500">{form.formState.errors.jobDescription.message}</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button type="submit">
              Next Step
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}