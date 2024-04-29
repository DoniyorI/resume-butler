"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { auth } from "@/lib/firebase/config"; // Adjust the path as needed
import { sendPasswordResetEmail } from "firebase/auth";

// Define the form schema
const formSchema = z.object({
    email: z.string().email({
        message: "Please enter a valid email address.",
    }),
});

export default function ForgotPasswordForm() {
    const form = useForm({
        resolver: zodResolver(formSchema),
    });

    const onSubmit = async (data) => {
        try {
            await sendPasswordResetEmail(auth, data.email);
            form.setError("formMessage", { message: "A reset link has been sent to your email." });
        } catch (err) {
            form.setError("formMessage", { message: "Error sending reset link: " + err.message });
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-white">
            <div className="w-full max-w-md p-6 bg-white rounded-lg border border-gray-100 shadow-md">
                <h2 className="text-2xl font-bold text-[#559F87] text-center mb-6">Forgot Password</h2>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Email</FormLabel>
                                    <FormControl>
                                        <Input placeholder="your.email@example.com" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button type="submit" className="w-full">Send Reset Link</Button>
                        {form.formState.errors.formMessage && <p className="text-red-500">{form.formState.errors.formMessage.message}</p>}
                    </form>
                </Form>
            </div>
        </div>
    );
}
