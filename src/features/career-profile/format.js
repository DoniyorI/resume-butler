import { parseDate } from "@/lib/dates";

// The CV stores dates as "YYYY-MM-DD"; month inputs use "YYYY-MM"
export const toMonthInput = (value) => (value ? String(value).slice(0, 7) : "");
export const fromMonthInput = (value) => (value ? `${value}-01` : null);

const monthYear = (value) =>
  parseDate(value)?.toLocaleDateString("en-US", { month: "short", year: "numeric" }) ?? "";

// "Jan 2024 – Present", "Jan 2022 – May 2024", "May 2024", or ""
export function formatRange(start, end, current = false) {
  const from = monthYear(start);
  const to = current ? "Present" : monthYear(end);
  if (from && to) return `${from} – ${to}`;
  return from || to;
}

export const fullName = (profile) => [profile.firstName, profile.lastName].filter(Boolean).join(" ");

export const initials = (profile) =>
  [profile.firstName, profile.lastName]
    .map((part) => part?.trim()?.[0] ?? "")
    .join("")
    .toUpperCase() || "?";

// "https://www.linkedin.com/in/jane/" -> "linkedin.com/in/jane"
export const displayUrl = (url) =>
  String(url || "")
    .replace(/^https?:\/\/(www\.)?/, "")
    .replace(/\/$/, "");

// Bullets are edited one field each; there is always at least one field
export const bulletsForEditing = (bullets) => {
  const kept = (bullets || []).filter(Boolean);
  return kept.length ? kept : [""];
};
export const cleanBullets = (bullets) => bullets.map((b) => b.trim()).filter(Boolean);
