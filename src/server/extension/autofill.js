import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { HttpError } from "@/server/http";
import { approvedAnswerChoices } from "@/server/answers/data";
import { answerError } from "@/server/answers/service";

export const autofillSelectionInput = z.object({
  profileFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  answerSelections: z.array(z.object({ id: z.string().uuid(), revision: z.number().int().min(1).max(1000000000) }).strict())
    .max(50).refine(items => new Set(items.map(item => item.id)).size === items.length, "Select each answer once."),
}).strict();

function contactText(value, max) {
  if (typeof value !== "string" || value.length > max) return "";
  return value.trim().replace(/\s+/g, " ");
}

function contactUrl(value) {
  if (typeof value !== "string" || value.length > 2048 || !value.trim()) return "";
  try {
    const url = new URL(value.trim());
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : "";
  } catch { return ""; }
}

async function contactSources(admin, userId) {
  const { data: profile, error } = await admin.from("profiles")
    .select("first_name,last_name,email,phone,linkedin,github,portfolio").eq("id", userId).maybeSingle();
  if (error) throw error;
  if (!profile) throw new HttpError(404, "Complete your Master CV profile before filling an application.");
  const first = contactText(profile.first_name, 100), last = contactText(profile.last_name, 100);
  const email = contactText(profile.email, 254);
  const facts = {
    name: first && last ? `${first} ${last}` : "",
    email: z.string().email().safeParse(email).success ? email : "",
    phone: contactText(profile.phone, 50),
    linkedin: contactUrl(profile.linkedin), github: contactUrl(profile.github), portfolio: contactUrl(profile.portfolio),
  };
  return { facts, profileFingerprint: createHash("sha256").update(JSON.stringify(facts)).digest("hex") };
}

export async function getAutofillContext(admin, userId) {
  const [source, choices] = await Promise.all([contactSources(admin, userId), approvedAnswerChoices(admin, userId)]);
  return { ...source, choices };
}

export async function resolveAutofillSources(admin, userId, input) {
  const source = await contactSources(admin, userId);
  if (source.profileFingerprint !== input.profileFingerprint) throw new HttpError(409, "Your contact details changed. Review the fields again before filling.");
  if (!input.answerSelections.length) return { ...source, answers: [] };
  const { data, error } = await admin.from("reusable_answers")
    .select("id,label,question,answer,revision,approved_at,archived_at").eq("user_id", userId)
    .in("id", input.answerSelections.map(item => item.id));
  answerError(error);
  const answers = input.answerSelections.map(selection => {
    const current = (data || []).find(item => item.id === selection.id);
    if (!current) throw new HttpError(404, "A selected answer is no longer available. Review the fields again.");
    if (current.revision !== selection.revision || !current.approved_at || current.archived_at) {
      throw new HttpError(409, "A selected answer changed or is no longer approved. Review the fields again.");
    }
    return { id: current.id, label: current.label, question: current.question, answer: current.answer, revision: current.revision };
  });
  return { ...source, answers };
}
