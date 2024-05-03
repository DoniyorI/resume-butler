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
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const formSchema = z
  .object({
    coverLetterName: z.string().min(1, "Cover Letter Name is required."),
    jobDescription: z.string().optional(),
    useAI: z.boolean(),
  })
  .refine(
    (data) =>
      data.useAI ? data.jobDescription && data.jobDescription.length > 0 : true,
    {
      message: "Job Description is required when using AI.",
      path: ["jobDescription"],
    }
  );

export default function CoverLetterDialog() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [useAI, setUseAI] = useState(false);
  const [user, setUser] = useState(null);
  const router = useRouter();
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      coverLetter: "",
      jobDescription: "",
      useAI: false,
    },
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleNextStep = async (formData) => {
    if (user) {
      const coverLettersRef = collection(db, `users/${user.uid}/coverletters`);
      const coverLetterRef = await addDoc(coverLettersRef, {
        title: formData.coverLetterName,
        dateCreated: new Date(),
        lastUpdated: new Date(),
      });
      router.push(`/coverletters/${coverLetterRef.id}`);
      setIsDialogOpen(false);
    } else {
      alert("You must be logged in to create a cover letter.");
    }
  };

  const handleOpenDialog = () => {
    setIsDialogOpen(true);
  };

  const toggleUseAI = () => {
    setUseAI(!useAI);
    form.setValue("useAI", !useAI);
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <div
          onClick={handleOpenDialog}
          className="h-[220px] w-[170px] border rounded-lg shadow p-4 flex justify-center items-center cursor-pointer m-2"
        >
          <div className="font-bold text-slate-400">New</div>
        </div>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] md:min-w-[60vw]">
        <DialogHeader>
          <DialogTitle>Create a New Cover Letter</DialogTitle>
          <DialogDescription>
            Let's create a new cover letter to help you land your dream job!
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(handleNextStep)}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="coverLetterName">Cover Letter Name</Label>
            <Input
              id="coverLetterName"
              {...form.register("coverLetterName")}
              placeholder="Enter cover letter name"
            />
            {form.formState.errors.coverLetterName && (
              <p className="text-red-500">
                {form.formState.errors.coverLetterName.message}
              </p>
            )}
          </div>
          <div className="flex space-x-2 justify-start items-center">
            <Checkbox
              id="useAI"
              checked={useAI}
              onCheckedChange={toggleUseAI}
            />
            <Label htmlFor="useAI">Use AI to tailor your cover letter</Label>
          </div>
          {useAI && (
            <div>
              <Label htmlFor="jobDescription">Paste Job Description</Label>
              <Textarea
                id="jobDescription"
                {...form.register("jobDescription")}
                placeholder="Watch AI tailor your cover letter..."
              />
              {form.formState.errors.jobDescription && (
                <p className="text-red-500">
                  {form.formState.errors.jobDescription.message}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button type="submit">Next Step</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
