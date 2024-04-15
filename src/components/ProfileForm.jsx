"use client";
import React from "react";
import { useEffect, useState } from "react";
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
import { auth, db } from "@/lib/firebase/config";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

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
  const [user, setUser] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const router = useRouter();
  const form = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      username: "",
      email: "example@resumebutler.io",
      phoneNumber: "",
      location: "",
      linkedin: "",
      github: "",
      portfolio: "",
      otherLinks: "",
    },
  });
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        // Fetch the user's document from Firestore
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          // Populate the form with the existing data
          form.reset(userDoc.data());
        } else {
          // No document found, create it with the email address
          await setDoc(doc(db, "users", user.uid), { email: user.email });
          form.setValue("email", user.email);
        }
        setInitialLoading(false);
      } else {
        // Not signed in
        router.push("/login");
      }
    });

    return () => unsubscribe();
  }, [form, router]);

  const onSubmit = async (data) => {
    if (!user) {
      console.error("No user authenticated");
      return;
    }
    // Convert any undefined optional fields to null
    const sanitizedData = Object.keys(data).reduce((acc, key) => {
      acc[key] = data[key] === undefined ? null : data[key];
      return acc;
    }, {});
    try {
      await setDoc(doc(db, "users", user.uid), sanitizedData, { merge: true });
      router.push("/cv"); // Navigate to CV page or confirmation page
    } catch (error) {
      console.error("Error updating profile: ", error);
      // Handle error (e.g., show error message to user)
    }
  };

  if (initialLoading) {
    return <div>Loading...</div>; // Or your loading component
  }

  return (
    <Form {...form} onSubmit={form.handleSubmit(onSubmit)}>
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
                  <Input
                    {...field}
                    placeholder={label}
                    type={type}
                    disabled={disabled}
                  />
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
