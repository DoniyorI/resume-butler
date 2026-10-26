import { z } from "zod";
import { safeHttpUrl } from "@/lib/safeUrl";

// Shared by ProfileForm (client validation) and updateProfile (server)
const optionalUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => value === "" || safeHttpUrl(value), "Invalid URL");

export const profileSchema = z.object({
  firstName: z.string().trim().min(1, "First Name is required").max(100),
  lastName: z.string().trim().min(1, "Last Name is required").max(100),
  // Shown read-only; the account email is never updated from this form
  email: z.string().optional(),
  phone: z.string().trim().min(1, "Phone Number is required").max(50),
  location: z.string().trim().max(200),
  linkedin: optionalUrl,
  github: optionalUrl,
  portfolio: optionalUrl,
  otherLinks: optionalUrl,
});
