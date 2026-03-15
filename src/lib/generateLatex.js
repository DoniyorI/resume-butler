// Escape LaTeX special characters
function esc(text) {
  if (!text) return "";
  return String(text)
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/&/g, "\\&")
    .replace(/%/g, "\\%")
    .replace(/\$/g, "\\$")
    .replace(/#/g, "\\#")
    .replace(/_/g, "\\_")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function buildHeader(header) {
  const name = esc(header.name || "Your Name");
  const parts = [];

  if (header.email) {
    parts.push(
      `\\href{mailto:${header.email}}{\\raisebox{-0.2\\height}\\faEnvelope\\  \\underline{${esc(header.email)}}}`
    );
  }
  if (header.phone) {
    parts.push(
      `\\raisebox{-0.2\\height}\\faPhone\\  ${esc(header.phone)}`
    );
  }
  if (header.linkedin) {
    const display = header.linkedin.replace(/^https?:\/\/(www\.)?/, "");
    parts.push(
      `\\href{${header.linkedin}}{\\raisebox{-0.2\\height}\\faLinkedin\\ \\underline{${esc(display)}}}`
    );
  }
  if (header.github) {
    const display = header.github.replace(/^https?:\/\/(www\.)?/, "");
    parts.push(
      `\\href{${header.github}}{\\raisebox{-0.2\\height}\\faGithub\\ \\underline{${esc(display)}}}`
    );
  }

  return `    \\begin{center}
        {\\Huge\\scshape ${name}} \\\\
        \\small
        ${parts.join(" ~ \n        ")}
    \\end{center}`;
}

function buildExperience(experiences) {
  if (!experiences || experiences.length === 0) return "";

  let items = "";
  for (const exp of experiences) {
    const company = esc(exp.companyName || exp.company || "");
    const location = esc(exp.location || "");
    const position = esc(exp.position || "");
    const startDate = formatDate(exp.startDate || exp.start_date);
    const endDate = exp.currentlyWorking || exp.currently_working
      ? "Present"
      : formatDate(exp.endDate || exp.end_date);
    const dateRange = startDate ? `${startDate} - ${endDate}` : "";

    items += `\n  \\resumeSubheading
    {${company}}{${location}}
    {${position}}{${dateRange}}`;

    const bullets = getBullets(exp);
    if (bullets.length > 0) {
      items += "\n        \\resumeItemListStart";
      for (const bullet of bullets) {
        items += `\n        \\resumeItem{${esc(bullet)}}`;
      }
      items += "\n        \\resumeItemListEnd";
    }
  }

  return `\\section{Experience}
  \\resumeSubHeadingListStart
${items}
  \\resumeSubHeadingListEnd`;
}

function buildEducation(educationList) {
  if (!educationList || educationList.length === 0) return "";

  let items = "";
  for (const edu of educationList) {
    const school = esc(edu.school || "");
    const location = esc(edu.location || "");
    const degree = [edu.degreeType || edu.degree_type, edu.major]
      .filter(Boolean)
      .join(" in ");
    const gpa = edu.gpa ? `, GPA: ${edu.gpa}` : "";
    const subtitle = `${esc(degree)}${gpa}`;
    const endDate = formatDate(edu.endDate || edu.end_date);

    items += `\n    \\resumeSubheading
    {${school}}{${location}}
    {${subtitle}}{${endDate}}`;
  }

  return `\\section{Education}
  \\resumeSubHeadingListStart${items}
  \\resumeSubHeadingListEnd`;
}

function buildProjects(projects) {
  if (!projects || projects.length === 0) return "";

  let items = "";
  for (const proj of projects) {
    const name = esc(proj.projectName || proj.name || "");
    const startDate = formatDate(proj.startDate || proj.start_date);
    const endDate = proj.currentlyWorking || proj.currently_working
      ? "Present"
      : formatDate(proj.endDate || proj.end_date);
    const dateRange = startDate ? `${startDate} - ${endDate}` : "";

    items += `\n    \\resumeProjectHeading
      {${name}}{${dateRange}}`;

    const bullets = getBullets(proj);
    if (bullets.length > 0) {
      items += "\n      \\resumeItemListStart";
      for (const bullet of bullets) {
        items += `\n        \\resumeItem{${esc(bullet)}}`;
      }
      items += "\n      \\resumeItemListEnd";
    }
  }

  return `\\section{Projects}
  \\resumeSubHeadingListStart${items}
  \\resumeSubHeadingListEnd`;
}

function buildSkills(skillsData) {
  if (!skillsData || skillsData.length === 0) return "";

  let lines = "";
  for (const group of skillsData) {
    if (group.header && group.skills) {
      const skillStr =
        typeof group.skills === "string" ? group.skills : group.skills.join(", ");
      lines += `\\textbf{${esc(group.header)}: } ${esc(skillStr)} \\\\\n`;
    }
  }

  if (!lines) return "";

  return `\\section{Technical Skills}
 \\begin{itemize}[leftmargin=0.15in, label={}]
    \\small{\\item{
${lines}    }}
 \\end{itemize}`;
}

function getBullets(item) {
  if (!item.description) return [];
  if (Array.isArray(item.description)) {
    return item.description.filter((b) => b && b.trim());
  }
  // String with newlines
  return String(item.description)
    .split("\n")
    .filter((b) => b.trim());
}

const PREAMBLE = `\\documentclass[letterpaper,11pt]{article}
\\usepackage{latexsym}
\\usepackage[empty]{fullpage}
\\usepackage{titlesec}
\\usepackage{marvosym}
\\usepackage[usenames,dvipsnames]{color}
\\usepackage{verbatim}
\\usepackage{enumitem}
\\usepackage{xcolor}
\\definecolor{lightblue}{RGB}{70, 130, 180}
\\usepackage[colorlinks=true, urlcolor=lightblue]{hyperref}
\\usepackage{fancyhdr}
\\usepackage[english]{babel}
\\usepackage{tabularx}
\\usepackage{fontawesome5}
\\usepackage{multicol}
\\setlength{\\multicolsep}{-3.0pt}
\\setlength{\\columnsep}{-1pt}
\\input{glyphtounicode}
\\pagestyle{fancy}
\\fancyhf{}
\\fancyfoot{}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0pt}
\\addtolength{\\oddsidemargin}{-0.7in}
\\addtolength{\\evensidemargin}{-0.5in}
\\addtolength{\\textwidth}{1.19in}
\\addtolength{\\topmargin}{-0.5in}
\\addtolength{\\textheight}{1in}
\\urlstyle{same}
\\raggedbottom
\\raggedright
\\setlength{\\tabcolsep}{0in}
\\titleformat{\\section}{
  \\vspace{-7pt}\\scshape\\raggedright\\large\\bfseries
}{}{0em}{}[\\color{black}\\titlerule \\vspace{0pt}]
\\pdfgentounicode=1

\\newcommand{\\resumeItem}[1]{
  \\item\\small{
    {#1 \\vspace{-3pt}}
  }
}
\\newcommand{\\resumeSubheading}[4]{
  \\vspace{-3pt}\\item
    \\begin{tabular*}{1.0\\textwidth}[t]{l@{\\extracolsep{\\fill}}r}
      \\textbf{#1} & \\textbf{\\small #2} \\\\
      \\textit{\\small#3} & \\textit{\\small #4} \\\\
    \\end{tabular*}\\vspace{-7pt}
}
\\newcommand{\\resumeProjectHeading}[2]{
  \\vspace{-3pt}\\item
    \\begin{tabular*}{1.0\\textwidth}[t]{l@{\\extracolsep{\\fill}}r}
      \\textbf{#1} & \\textbf{\\small #2} \\\\
    \\end{tabular*}\\vspace{-7pt}
}
\\newcommand{\\resumeSubItem}[1]{\\resumeItem{#1}\\vspace{0pt}}
\\renewcommand\\labelitemi{$\\vcenter{\\hbox{\\tiny$\\bullet$}}$}
\\renewcommand\\labelitemii{$\\vcenter{\\hbox{\\tiny$\\bullet$}}$}
\\newcommand{\\resumeSubHeadingListStart}{\\begin{itemize}[leftmargin=0.0in, label={}]}
\\newcommand{\\resumeSubHeadingListEnd}{\\end{itemize}}
\\newcommand{\\resumeItemListStart}{\\begin{itemize}}
\\newcommand{\\resumeItemListEnd}{\\end{itemize}\\vspace{0pt}}`;

/**
 * Generate LaTeX source from resume data.
 * @param {object} resumeData - { header, education, experience, projects, skills, order }
 * @returns {string} Complete .tex file content
 */
export function generateLatex(resumeData) {
  const header = resumeData.header || {};
  const education = resumeData.education || [];
  const experience = resumeData.experience || [];
  const projects = resumeData.projects || [];
  const skills = resumeData.skills || [];

  // Build sections in the order defined by the user's drag-and-drop
  const order = resumeData.order || [
    { id: "experience" },
    { id: "skills" },
    { id: "projects" },
    { id: "education" },
  ];

  const sectionBuilders = {
    experience: () => buildExperience(experience),
    education: () => buildEducation(education),
    projects: () => buildProjects(projects),
    skills: () => buildSkills(skills),
  };

  const sectionContent = order
    .map((s) => sectionBuilders[s.id]?.())
    .filter(Boolean)
    .join("\n\n");

  return `${PREAMBLE}

\\begin{document}

${buildHeader(header)}

${sectionContent}

\\end{document}`;
}
