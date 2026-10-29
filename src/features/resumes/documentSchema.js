import { z } from "zod";
import { SECTION_IDS, CUSTOM_SECTION_TYPES, CUSTOM_SECTION_ID } from "@/features/resumes/resumeDocument";

const text = z.string().max(10000).default("");
export const customItemSchema = z.object({
  id: z.string().uuid(), title: text, subtitle: text, date: z.string().max(200).default(""),
  location: z.string().max(200).default(""), url: z.string().max(2000).default(""), text,
  description: z.union([z.string().max(20000), z.array(z.string().max(10000)).max(100)]).default([]),
});
export const customSectionSchema = z.object({
  id: z.string().regex(CUSTOM_SECTION_ID), title: z.string().trim().min(1).max(100),
  type: z.enum(CUSTOM_SECTION_TYPES), items: z.array(customItemSchema).max(100),
}).refine(s => new Set(s.items.map(i => i.id)).size === s.items.length, "Entry IDs must be unique");
const customSections = z.array(customSectionSchema).max(20)
  .refine(sections => new Set(sections.map(s => s.id)).size === sections.length, "Section IDs must be unique");
export const cvSectionsSchema = z.object({
  revision: z.number().int().nonnegative(),
  titles: z.object(Object.fromEntries(SECTION_IDS.map(id => [id, z.string().trim().min(1).max(100).optional()]))),
  customSections,
}).refine(value => JSON.stringify(value).length <= 250000, "Master CV custom sections are too large");

const items = z.array(z.record(z.unknown())).max(100);
export const resumeContentSchema = z.object({
  schemaVersion: z.literal(2, { errorMap: () => ({ message: "Update the app before saving this resume." }) }),
  revision: z.number().int().nonnegative(),
  header: z.record(z.string().max(1000).nullable()),
  education: items, experience: items, projects: items, skills: items,
  certifications: z.array(customItemSchema.extend({ id: z.string().uuid().optional() })).max(100),
  customSections,
  order: z.array(z.object({ id: z.string().refine(id => SECTION_IDS.includes(id) || CUSTOM_SECTION_ID.test(id)), title: z.string().trim().min(1).max(100), hidden: z.boolean().optional(), type: z.enum(CUSTOM_SECTION_TYPES).optional() })).max(25),
  target: z.object({ jobDescription: z.string().max(50000), applicationId: z.string().uuid().nullable(), company: z.string().max(200), role: z.string().max(200) }),
}).refine(doc => new Set(doc.order.map(s => s.id)).size === doc.order.length && [...SECTION_IDS, ...doc.customSections.map(s => s.id)].every(id => doc.order.some(s => s.id === id)), "Every section must have one heading")
  .refine(doc => JSON.stringify(doc).length <= 250000, "Resume is too large to save");
