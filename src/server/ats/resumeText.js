import "server-only";

function descriptionParts(description) {
  if (Array.isArray(description)) return description;
  return description ? [description] : [];
}

// Flatten resume content (the resumes.content JSON) to one searchable string
export function resumeToText(content) {
  const parts = [];

  if (content.header) {
    parts.push(content.header.name || "");
    parts.push(content.header.email || "");
    parts.push(content.header.linkedin || "");
    parts.push(content.header.github || "");
  }

  (content.education || []).forEach((edu) => {
    parts.push(edu.school || "");
    parts.push(edu.major || "");
    parts.push(edu.degreeType || edu.degree_type || "");
    parts.push(edu.location || "");
  });

  (content.experience || []).forEach((exp) => {
    parts.push(exp.companyName || exp.company || "");
    parts.push(exp.position || "");
    parts.push(exp.location || "");
    parts.push(...descriptionParts(exp.description));
  });

  (content.projects || []).forEach((proj) => {
    parts.push(proj.projectName || proj.name || "");
    parts.push(...descriptionParts(proj.description));
    parts.push(proj.location || "");
  });

  (content.skills || []).forEach((skill) => {
    if (typeof skill === "string") {
      parts.push(skill);
      return;
    }
    parts.push(skill.header || "");
    if (typeof skill.skills === "string") {
      parts.push(skill.skills);
    } else if (Array.isArray(skill.skills)) {
      parts.push(...skill.skills);
    }
  });

  return parts.join(" ");
}

// Bullets of one experience or project entry. description is either an array
// of bullets or a newline-separated string.
export function entryBullets(entry) {
  if (Array.isArray(entry.description)) return entry.description;
  return entry.description ? String(entry.description).split("\n") : [];
}

export function allBullets(content) {
  return [...(content.experience || []), ...(content.projects || [])].flatMap((entry) =>
    entryBullets(entry).filter(Boolean)
  );
}
