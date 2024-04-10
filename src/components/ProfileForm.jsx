"use client";
import React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import {
  Form,
  FormField,
  FormItem,
  FormControl,
  FormLabel,
  FormDescription,
  FormMessage,
} from "@/components/ui/form";
const profileSchema = z.object({
    firstName: z.string().min(1, "First Name is required"),
    lastName: z.string().min(1, "Last Name is required"),
    username: z.string().min(2, "Username must be at least 2 characters"),
    email: z.string().email("Invalid email address").optional(), // Assuming this is fetched and displayed
    phoneNumber: z.string().min(1, "Phone Number is required"),
    location: z.string().optional(),
    linkedin: z.string().url("Invalid URL").optional().or(z.string().length(0)),
    github: z.string().url("Invalid URL").optional().or(z.string().length(0)),
    portfolio: z.string().url("Invalid URL").optional().or(z.string().length(0)),
    otherLinks: z.string().url("Invalid URL").optional().or(z.string().length(0)),
  });

// The profile form component
export default function ProfileForm() {
    const router = useRouter();
  const form = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      username: "",
      email: "example@resumebutler.io", // Assuming this is fetched elsewhere
      phoneNumber: "",
      location: "",
      linkedin: "",
      github: "",
      portfolio: "",
      otherLinks: "",
    },
  });

  // Form submission handler
  const onSubmit = (data) => {
    console.log(data);
    router.push("/cv");
    // Here you would typically integrate with backend API to update the profile
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="w-full space-y-6">
        <div className="flex space-x-4">
          {/* First Name and Last Name in the same row */}
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>First Name</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="First Name" />
                </FormControl>
                <FormDescription />
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>Last Name</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Last Name" />
                </FormControl>
                <FormDescription />
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        {[
          { name: "username", label: "Username", type: "text" },
          { name: "email", label: "Email", type: "email", disabled: true },
          { name: "phoneNumber", label: "Phone Number", type: "tel" },
          { name: "location", label: "Location", type: "text" },
          { name: "linkedin", label: "LinkedIn", type: "url" },
          { name: "github", label: "Github", type: "url" },
          { name: "portfolio", label: "Portfolio", type: "url" },
          { name: "otherLinks", label: "Other Links", type: "url" },
        ].map(({ name, label, type, disabled }) => (
          <FormField
            key={name}
            control={form.control}
            name={name}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{label}</FormLabel>
                <FormControl>
                  <Input {...field} placeholder={label} type={type} disabled={disabled} />
                </FormControl>
                <FormDescription />
                <FormMessage />
              </FormItem>
            )}
          />
        ))}
        <div className="flex justify-end">
          <Button type="submit">Save</Button>
        </div>
      </form>
    </Form>
  );
}
