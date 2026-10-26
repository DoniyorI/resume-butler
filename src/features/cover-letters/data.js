import "server-only";
import { cache } from "react";
import { requirePageUser } from "@/server/auth";

export async function listCoverLetters(supabase, userId) {
  const { data, error } = await supabase
    .from("cover_letters")
    .select("id, title, created_at, updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    title: row.title || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

// cover_letters.content is { body: Draft.js raw content, header, date }.
// Very old rows stored it as a JSON string.
function parseContent(content) {
  if (typeof content !== "string") return content || {};
  try {
    return JSON.parse(content) || {};
  } catch {
    return {};
  }
}

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

  const content = parseContent(letterRes.data.content);
  const saved = content.header || {};
  const profile = profileRes.data || {};

  return {
    id: letterRes.data.id,
    title: letterRes.data.title || "",
    header: {
      contactPhone: saved.contactPhone || profile.phone || "",
      contactEmail: saved.contactEmail || profile.email || user.email || "",
      name: saved.name || `${profile.first_name || ""} ${profile.last_name || ""}`.trim(),
      linkedin: saved.linkedin || profile.linkedin || "",
      portfolio: saved.portfolio || profile.portfolio || "",
    },
    date: typeof content.date === "string" ? content.date : null,
    body: content.body && typeof content.body === "object" ? content.body : null,
  };
});
