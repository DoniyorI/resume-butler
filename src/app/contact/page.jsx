"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import emailjs from "emailjs-com";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

// Define the form validation schema using Zod
const formSchema = z.object({
  firstName: z.string().min(1, "Please enter your first name."),
  lastName: z.string().min(1, "Please enter your last name."),
  user_email: z.string().email("Please enter a valid email address."),
  message: z.string().min(1, "Please enter a comment."),
});

export default function Contact() {
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      user_email: "",
      message: "",
    },
  });

  const onSubmit = async (data) => {
    console.log(data);
    try {
      const result = await emailjs.send(
        "service_2rq05gv",
        "template_dzw2uvk",
        data,
        "wUjMvvLPRp-kZOhsv"
      );
      toast("Message sent successfully!");
      console.log(result.text);
      form.reset(); // Reset the form fields after successful submission
    } catch (error) {
      console.error("Failed to send message:", error);
      toast("Failed to send message, please try again.");
    }
  };

  return (
    <div className="flex flex-col w-full min-h-screen pt-24 pb-10 px-10">
      <h1 className="text-2xl font-semibold text-[#559F87]">Contact Us</h1>
      <p className="mt-4 text-lg">
        We would love to hear from you! Please feel free to reach out to us.
      </p>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First Name</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last Name</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="user_email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" {...field} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="message"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Comment</FormLabel>
                <FormControl>
                  <Input as="textarea" {...field} />
                </FormControl>
              </FormItem>
            )}
          />
          <Button type="submit">Submit</Button>
        </form>
      </Form>
    </div>
  );
}
