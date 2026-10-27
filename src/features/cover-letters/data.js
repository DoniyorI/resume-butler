import "server-only";
import { cache } from "react";
import { requirePageUser } from "@/server/auth";
import { normalizeLetter, parseStoredContent } from "@/features/cover-letters/letterDocument";

// Cached per request so generateMetadata and the page share one query.
// Empty header fields fall back to the profile. Returns null when the cover
// letter doesn't exist or belongs to someone else.
export const getCoverLetterForEditor = cache(async (coverLetterId) => {
  const { supabase, user } = await requirePageUser();

  const [letterRes, profileRes] = await Promise.all([
    supabase
      .from("cover_letters")
      .select("id, title, content")
      .eq("id", coverLetterId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("first_name, last_name, email, phone, linkedin, portfolio")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  if (letterRes.error || !letterRes.data) return null;

  const content = parseStoredContent(letterRes.data.content);
  const saved = content.header || {};
  const profile = profileRes.data || {};
  const fallbackHeader = {
    contactPhone: profile.phone || "",
    contactEmail: profile.email || user.email || "",
    name: `${profile.first_name || ""} ${profile.last_name || ""}`.trim(),
    linkedin: profile.linkedin || "",
    portfolio: profile.portfolio || "",
  };

  return {
    id: letterRes.data.id,
    title: letterRes.data.title || "",
    // For the classic editor
    header: {
      contactPhone: saved.contactPhone || fallbackHeader.contactPhone,
      contactEmail: saved.contactEmail || fallbackHeader.contactEmail,
      name: saved.name || fallbackHeader.name,
      linkedin: saved.linkedin || fallbackHeader.linkedin,
      portfolio: saved.portfolio || fallbackHeader.portfolio,
    },
    date: typeof content.date === "string" ? content.date : null,
    body: content.body && typeof content.body === "object" ? content.body : null,
    // For the letter editor (features/cover-letters/studio)
    letter: normalizeLetter(content, fallbackHeader),
  };
});
