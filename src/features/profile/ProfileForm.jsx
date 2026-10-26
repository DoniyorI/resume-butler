"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormField,
  FormItem,
  FormControl,
  FormLabel,
  FormDescription,
  FormMessage,
} from "@/components/ui/form";
import { updateProfile } from "@/features/profile/actions";
import { profileSchema } from "@/features/profile/schema";

const FIELDS = [
  { name: "email", label: "Email", type: "email", disabled: true },
  { name: "phone", label: "Phone Number", type: "tel" },
  { name: "location", label: "Location", type: "text" },
  { name: "linkedin", label: "LinkedIn", type: "url" },
  { name: "github", label: "Github", type: "url" },
  { name: "portfolio", label: "Portfolio", type: "url" },
  { name: "otherLinks", label: "Other Links", type: "url" },
];

export default function ProfileForm({ initialProfile }) {
  const router = useRouter();
  const form = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: initialProfile,
  });

  const onSubmit = async (values) => {
    const result = await updateProfile(values);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast("Profile updated successfully");
    router.push("/cv");
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="w-full space-y-6">
        <div className="flex space-x-4">
          {[
            { name: "firstName", label: "First Name" },
            { name: "lastName", label: "Last Name" },
          ].map(({ name, label }) => (
            <FormField
              key={name}
              control={form.control}
              name={name}
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel>{label}</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder={label} />
                  </FormControl>
                  <FormDescription />
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
        </div>
        {FIELDS.map(({ name, label, type, disabled }) => (
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
          <Button type="submit" disabled={form.formState.isSubmitting}>
            Save
          </Button>
        </div>
      </form>
    </Form>
  );
}
