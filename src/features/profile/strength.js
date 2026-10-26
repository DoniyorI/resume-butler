// What makes a master CV useful for tailoring resumes. Each check links to the
// section that fixes it.
export function cvStrength(profile, cv) {
  const checks = [
    {
      id: "contact",
      label: "Name, phone and location",
      done: Boolean(profile.firstName && profile.lastName && profile.phone && profile.location),
      section: "profile",
    },
    {
      id: "links",
      label: "LinkedIn or GitHub",
      done: Boolean(profile.linkedin || profile.github),
      section: "profile",
    },
    {
      id: "experience",
      label: "Experience with bullet points",
      done: cv.experience.some((entry) => entry.bullets.some(Boolean)),
      section: "experience",
    },
    { id: "education", label: "Education", done: cv.education.length > 0, section: "education" },
    { id: "projects", label: "At least one project", done: cv.projects.length > 0, section: "projects" },
    { id: "skills", label: "Five or more skills", done: cv.skills.length >= 5, section: "skills" },
  ];
  const done = checks.filter((check) => check.done).length;
  return { checks, percent: Math.round((done / checks.length) * 100) };
}
