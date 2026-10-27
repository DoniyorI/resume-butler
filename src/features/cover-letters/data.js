import "server-only";
import { cache } from "react";
import { requirePageUser } from "@/server/auth";
import { normalizeLetter } from "@/features/cover-letters/letterDocument";

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
    letter: normalizeLetter(letterRes.data.content, fallbackHeader),
  };
});
