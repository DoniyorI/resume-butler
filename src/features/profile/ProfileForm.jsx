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
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

const profileSchema = z.object({
  first_name: z.string().min(1, "First Name is required"),
  last_name: z.string().min(1, "Last Name is required"),
  email: z.string().email("Invalid email address").optional(),
  phone: z.string().min(1, "Phone Number is required"),
  location: z.string().optional(),
  linkedin: z.string().url("Invalid URL").optional().or(z.string().length(0)),
  github: z.string().url("Invalid URL").optional().or(z.string().length(0)),
  portfolio: z.string().url("Invalid URL").optional().or(z.string().length(0)),
  other_links: z.string().url("Invalid URL").optional().or(z.string().length(0)),
});

export default function ProfileForm() {
  const { user, loading: authLoading, supabase } = useAuth({ redirect: true });
  const [initialLoading, setInitialLoading] = useState(true);
  const router = useRouter();
  const form = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      location: "",
      linkedin: "",
      github: "",
      portfolio: "",
      other_links: "",
    },
  });

  useEffect(() => {
    if (authLoading || !user) return;
    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (data) {
        form.reset({
          first_name: data.first_name || "",
          last_name: data.last_name || "",
          email: data.email || user.email || "",
          phone: data.phone || "",
          location: data.location || "",
          linkedin: data.linkedin || "",
          github: data.github || "",
          portfolio: data.portfolio || "",
          other_links: data.other_links || "",
        });
      } else {
        form.setValue("email", user.email);
      }
      setInitialLoading(false);
    };
    fetchProfile();
  }, [user, authLoading, form, supabase]);

  const onSubmit = async (data) => {
    if (!user) return;
    const { email, ...updateData } = data;
    try {
      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", user.id);

      if (error) throw error;
      toast("Profile updated successfully");
      router.push("/cv");
    } catch (error) {
      toast("Error updating profile");
      console.error("Error updating profile: ", error);
    }
  };

  if (initialLoading) {
    return <div>Loading...</div>;
  }

  return (
    <Form {...form} onSubmit={form.handleSubmit(onSubmit)}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="w-full space-y-6">
        <div className="flex space-x-4">
          <FormField
            control={form.control}
            name="first_name"
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
            name="last_name"
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
          { name: "email", label: "Email", type: "email", disabled: true },
          { name: "phone", label: "Phone Number", type: "tel" },
          { name: "location", label: "Location", type: "text" },
          { name: "linkedin", label: "LinkedIn", type: "url" },
          { name: "github", label: "Github", type: "url" },
          { name: "portfolio", label: "Portfolio", type: "url" },
          { name: "other_links", label: "Other Links", type: "url" },
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
