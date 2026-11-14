import { z } from "zod";
import { APPLICATION_STATUSES, DEFAULT_STATUS } from "@/lib/constants";
import { normalizeHttpUrl } from "@/lib/safeUrl";

// Field rules shared by the add dialog, the detail page and the spreadsheet
// import. Not a "use server" file, so actions.js can import it and the import
// planner can reuse the same rules.

export const statusSchema = z.enum(APPLICATION_STATUSES, {
  errorMap: () => ({ message: "Unknown status" }),
});
export const commentsSchema = z.string().trim().max(5000, "Comments are too long");
export const optionalText = (max, label) => z.string().trim().max(max, `${label} is too long`).default("");

// The fields the add dialog and the detail page both edit
export const applicationFields = {
  company: z.string().trim().min(1, "Company name is required").max(200, "Company name is too long"),
  role: optionalText(200, "Role"),
  location: optionalText(200, "Location"),
  portalLink: z.string().max(2048, "Portal link is too long").default("").transform(normalizeHttpUrl),
  status: statusSchema.default(DEFAULT_STATUS),
  comments: commentsSchema.default(""),
  appliedDate: z
    .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"), z.literal(""), z.null()])
    .optional()
    .transform((value) => value || null),
};
