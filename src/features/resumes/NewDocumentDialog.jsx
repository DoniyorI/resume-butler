"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
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
    name: z.string().trim().min(1, "Name is required.").max(200, "Name is too long."),
    jobDescription: z.string().optional(),
    useAI: z.boolean(),
  })
  .refine((data) => (data.useAI ? Boolean(data.jobDescription) : true), {
    message: "Job Description is required when using AI.",
    path: ["jobDescription"],
  });

// "New" card + dialog for the resume and cover letter lists. `createAction`
// is a Server Action that redirects to the new item, or returns { ok: false, error }.
export function NewDocumentDialog({ noun, createAction }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", jobDescription: "", useAI: false },
  });
  const aiEnabled = form.watch("useAI");

  const handleSubmit = async ({ name }) => {
    const result = await createAction({ title: name });
    if (result && !result.ok) toast.error(result.error);
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <div className="h-[220px] w-[170px] border rounded-lg shadow p-4 flex justify-center items-center cursor-pointer m-2">
          <div className="font-bold text-slate-400">New</div>
        </div>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] md:min-w-[60vw]">
        <DialogHeader>
          <DialogTitle>Create a New {noun}</DialogTitle>
          <DialogDescription>
            Let&apos;s create a new {noun.toLowerCase()} to help you land your dream job!
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="documentName">{noun} Name</Label>
            <Input
              id="documentName"
              {...form.register("name")}
              placeholder={`Enter ${noun.toLowerCase()} name`}
            />
            {form.formState.errors.name && (
              <p className="text-red-500">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="flex space-x-2 justify-start items-center">
            <Checkbox
              id="useAI"
              checked={aiEnabled}
              onCheckedChange={(checked) => form.setValue("useAI", checked === true)}
            />
            <Label htmlFor="useAI">Use AI to tailor your {noun.toLowerCase()}</Label>
          </div>
          {aiEnabled && (
            <div>
              <Label htmlFor="jobDescription">Paste Job Description</Label>
              <Textarea
                id="jobDescription"
                {...form.register("jobDescription")}
                placeholder={`Watch AI tailor your ${noun.toLowerCase()}...`}
              />
              {form.formState.errors.jobDescription && (
                <p className="text-red-500">{form.formState.errors.jobDescription.message}</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              Next Step
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
