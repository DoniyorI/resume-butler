"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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

const formSchema = z
  .object({
    resumeName: z.string().min(1, "Resume Name is required."),
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

export default function ResumeDialog() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [useAI, setUseAI] = useState(false);
  const { user, supabase } = useAuth();
  const router = useRouter();
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      resumeName: "",
      jobDescription: "",
      useAI: false,
    },
  });

  const handleNextStep = async (formData) => {
    if (!user) {
      alert("You must be logged in to create a resume.");
      return;
    }

    const { data, error } = await supabase
      .from("resumes")
      .insert({
        user_id: user.id,
        title: formData.resumeName,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating resume:", error);
      return;
    }

    router.push(`/resumes/${data.id}`);
    setIsDialogOpen(false);
  };

  const toggleUseAI = () => {
    setUseAI(!useAI);
    form.setValue("useAI", !useAI);
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <div
          onClick={() => setIsDialogOpen(true)}
          className="h-[220px] w-[170px] border rounded-lg shadow p-4 flex justify-center items-center cursor-pointer m-2"
        >
          <div className="font-bold text-slate-400">New</div>
        </div>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] md:min-w-[60vw]">
        <DialogHeader>
          <DialogTitle>Create a New Resume</DialogTitle>
          <DialogDescription>
            Let&apos;s create a new resume to help you land your dream job!
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(handleNextStep)}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="resumeName">Resume Name</Label>
            <Input
              id="resumeName"
              {...form.register("resumeName")}
              placeholder="Enter resume name"
            />
            {form.formState.errors.resumeName && (
              <p className="text-red-500">
                {form.formState.errors.resumeName.message}
              </p>
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
