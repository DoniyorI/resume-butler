import "server-only";
import { entryBullets } from "@/server/ats/resumeText";

// Action verbs a bullet should start with
export const STRONG_VERBS = [
  "developed", "optimized", "shipped", "deployed", "enabled", "built",
  "implemented", "pioneered", "applied", "presented", "leveraged",
  "researched", "enhanced", "enriched", "spearheaded", "engineered",
  "released", "devised", "tested", "integrated", "collaborated",
  "crafted", "published", "piloted", "designed", "architected",
  "created", "led", "managed", "reduced", "increased", "improved",
  "automated", "migrated", "refactored", "launched", "scaled",
  "streamlined", "established", "configured", "maintained",
  "constructed", "delivered", "drove", "executed", "facilitated",
  "generated", "initiated", "introduced", "mentored", "orchestrated",
  "overhauled", "produced", "proposed", "resolved", "restructured",
  "revamped", "secured", "simplified", "supervised", "transformed",
  "unified", "upgraded", "wrote", "analyzed", "assessed", "coordinated",
  "customized", "debugged", "defined", "directed", "documented",
  "eliminated", "evaluated", "expanded", "extracted", "formulated",
  "founded", "identified", "instructed", "invented", "iterated",
  "modernized", "monitored", "negotiated", "operated", "organized",
  "performed", "planned", "prepared", "programmed", "prototyped",
  "provisioned", "rebuilt", "recommended", "redesigned", "reviewed",
  "trained", "translated", "troubleshot", "utilized", "validated",
];

// Openers that read as passive. "utilized" is in both lists; kept so existing scores don't shift.
export const WEAK_VERBS = [
  "helped", "assisted", "worked on", "was responsible for",
  "participated in", "involved in", "utilized", "used",
  "did", "made", "got",
];

export function firstWord(bullet) {
  return bullet.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, "");
}

export function startsWithWeakVerb(bullet) {
  const lower = bullet.toLowerCase();
  return WEAK_VERBS.some((verb) => lower.startsWith(verb));
}

export function hasMetrics(bullet) {
  return /\d/.test(bullet);
}

function bulletIssues(text) {
  const issues = [];
  const verb = firstWord(text);

  if (!STRONG_VERBS.includes(verb)) {
    issues.push(
      startsWithWeakVerb(text)
        ? { type: "error", message: `Starts with weak verb "${verb}" — use a strong action verb` }
        : { type: "warning", message: "Should start with a strong action verb (e.g. Developed, Built, Implemented)" }
    );
  }

  if (!hasMetrics(text)) {
    issues.push({ type: "suggestion", message: "Consider adding numbers or metrics to quantify impact" });
  }

  if (text.length < 30) {
    issues.push({ type: "error", message: "Too short — add more detail about what you did and the impact" });
  } else if (text.length > 200) {
    issues.push({ type: "suggestion", message: "Consider shortening — keep to 1-2 lines" });
  }

  return issues;
}

// error = weak verb or too short; warning = no strong verb, or two suggestions;
// a single suggestion stays "ok" so the editor doesn't highlight it
function severityOf(issues) {
  const count = (type) => issues.filter((i) => i.type === type).length;
  if (count("error") > 0) return "error";
  if (count("warning") > 0 || count("suggestion") >= 2) return "warning";
  return "ok";
}

// Feedback for every experience and project bullet, with its position in the resume
export function analyzeBullets(content) {
  const feedback = [];

  const analyzeSection = (entries, section) => {
    (entries || []).forEach((entry, itemIndex) => {
      entryBullets(entry).forEach((bullet, bulletIndex) => {
        if (!bullet || !bullet.trim()) return;
        const text = bullet.trim();
        const issues = bulletIssues(text);
        feedback.push({ section, itemIndex, bulletIndex, text, severity: severityOf(issues), issues });
      });
    });
  };

  analyzeSection(content.experience, "experience");
  analyzeSection(content.projects, "projects");

  return feedback;
}
