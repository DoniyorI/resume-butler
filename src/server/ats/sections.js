import "server-only";
import { STRONG_VERBS, firstWord, hasMetrics, startsWithWeakVerb } from "@/server/ats/bullets";
import { allBullets } from "@/server/ats/resumeText";

function hasBullets(entry) {
  if (Array.isArray(entry.description)) return entry.description.filter(Boolean).length > 0;
  return !!entry.description;
}

function headerChecks(header) {
  const hasName = header?.name && header.name !== "Your Name" && header.name.trim().length > 0;
  return [
    { label: "Name", present: hasName, category: "header" },
    { label: "Email", present: !!header?.email, category: "header" },
    { label: "LinkedIn", present: !!header?.linkedin, category: "header" },
    { label: "GitHub", present: !!header?.github, category: "header" },
  ];
}

function sectionPresenceChecks({ education, experience, projects, skills }) {
  return [
    { label: "Education section", present: education.length > 0, category: "sections" },
    { label: "Experience section", present: experience.length > 0, category: "sections" },
    { label: "Projects section", present: projects.length > 0, category: "sections" },
    { label: "Skills section", present: skills.length > 0, category: "sections" },
  ];
}

function entryChecks(experience, projects) {
  const checks = [];

  if (experience.length > 0) {
    checks.push({
      label: "All experiences have bullet points",
      present: experience.every(hasBullets),
      category: "quality",
    });
    // Only array descriptions are counted; free-text descriptions pass
    const goodBulletCount = experience.every((exp) => {
      if (!Array.isArray(exp.description)) return true;
      const count = exp.description.filter(Boolean).length;
      return count >= 2 && count <= 6;
    });
    checks.push({ label: "2-6 bullet points per experience", present: goodBulletCount, category: "quality" });
  }

  if (projects.length > 0) {
    checks.push({
      label: "All projects have bullet points",
      present: projects.every(hasBullets),
      category: "quality",
    });
  }

  return checks;
}

function bulletQualityChecks(bullets) {
  if (bullets.length === 0) return [];
  const total = bullets.length;

  const strong = bullets.filter((b) => STRONG_VERBS.includes(firstWord(b))).length;
  const quantified = bullets.filter(hasMetrics).length;
  const goodLength = bullets.filter((b) => b.length >= 30 && b.length <= 200).length;

  return [
    {
      label: "Bullet points start with strong action verbs",
      present: strong / total >= 0.6,
      category: "quality",
      detail: `${strong}/${total} bullets`,
    },
    {
      label: "No weak verbs (helped, assisted, worked on)",
      present: !bullets.some(startsWithWeakVerb),
      category: "quality",
    },
    {
      label: "Bullet points include metrics/numbers",
      present: quantified / total >= 0.3,
      category: "quality",
      detail: `${quantified}/${total} bullets have metrics`,
    },
    {
      label: "Bullet points are proper length (not too short/long)",
      present: goodLength / total >= 0.7,
      category: "quality",
      detail: `${goodLength}/${total} bullets are good length`,
    },
  ];
}

// Header, section-presence and quality checks, each tagged with a category
export function checkSections(content) {
  const sections = {
    education: content.education || [],
    experience: content.experience || [],
    projects: content.projects || [],
    skills: content.skills || [],
  };

  return [
    ...headerChecks(content.header),
    ...sectionPresenceChecks(sections),
    ...entryChecks(sections.experience, sections.projects),
    ...bulletQualityChecks(allBullets(content)),
  ];
}
