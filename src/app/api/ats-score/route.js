import { NextResponse } from "next/server";

// Common tech skills and their aliases/related terms
const SKILL_ALIASES = {
  "javascript": ["js", "javascript", "ecmascript"],
  "typescript": ["ts", "typescript"],
  "python": ["python", "py"],
  "react": ["react", "reactjs", "react.js"],
  "next.js": ["next", "nextjs", "next.js"],
  "node.js": ["node", "nodejs", "node.js"],
  "express": ["express", "expressjs", "express.js"],
  "mongodb": ["mongodb", "mongo"],
  "postgresql": ["postgresql", "postgres", "psql"],
  "mysql": ["mysql"],
  "aws": ["aws", "amazon web services"],
  "gcp": ["gcp", "google cloud", "google cloud platform"],
  "azure": ["azure", "microsoft azure"],
  "docker": ["docker", "containerization", "containers"],
  "kubernetes": ["kubernetes", "k8s"],
  "ci/cd": ["ci/cd", "cicd", "continuous integration", "continuous deployment", "continuous delivery"],
  "git": ["git", "version control"],
  "github": ["github"],
  "rest api": ["rest", "restful", "rest api", "rest apis", "api"],
  "graphql": ["graphql"],
  "sql": ["sql"],
  "html": ["html", "html5"],
  "css": ["css", "css3"],
  "tailwind": ["tailwind", "tailwindcss"],
  "redux": ["redux"],
  "vue": ["vue", "vuejs", "vue.js"],
  "angular": ["angular", "angularjs"],
  "java": ["java"],
  "c++": ["c++", "cpp"],
  "c#": ["c#", "csharp", "c sharp"],
  "go": ["go", "golang"],
  "rust": ["rust"],
  "swift": ["swift"],
  "kotlin": ["kotlin"],
  "ruby": ["ruby"],
  "rails": ["rails", "ruby on rails"],
  "django": ["django"],
  "flask": ["flask"],
  "spring": ["spring", "spring boot", "springboot"],
  "terraform": ["terraform", "iac", "infrastructure as code"],
  "linux": ["linux", "unix"],
  "agile": ["agile", "scrum", "kanban"],
  "machine learning": ["machine learning", "ml"],
  "deep learning": ["deep learning", "dl"],
  "ai": ["ai", "artificial intelligence"],
  "data structures": ["data structures"],
  "algorithms": ["algorithms"],
  "microservices": ["microservices", "micro-services"],
  "redis": ["redis"],
  "elasticsearch": ["elasticsearch", "elastic search"],
  "kafka": ["kafka"],
  "rabbitmq": ["rabbitmq"],
  "webpack": ["webpack"],
  "vite": ["vite"],
  "jest": ["jest"],
  "testing": ["testing", "unit testing", "integration testing", "e2e testing"],
  "selenium": ["selenium"],
  "firebase": ["firebase"],
  "supabase": ["supabase"],
  "figma": ["figma"],
  "jira": ["jira"],
  "oauth": ["oauth", "oauth2", "authentication"],
  "websocket": ["websocket", "websockets", "real-time"],
  "s3": ["s3"],
  "ec2": ["ec2"],
  "lambda": ["lambda", "serverless"],
};

// Extract keywords from job description
function extractKeywords(text) {
  const lower = text.toLowerCase();
  const found = new Map(); // keyword -> { original: string, category: string }

  // Match known skills
  for (const [skill, aliases] of Object.entries(SKILL_ALIASES)) {
    for (const alias of aliases) {
      // Word boundary matching
      const regex = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (regex.test(lower)) {
        found.set(skill, { original: skill, matched: alias });
        break;
      }
    }
  }

  // Extract years of experience requirements
  const yearsMatch = lower.match(/(\d+)\+?\s*years?\s*(of\s*)?(experience|exp)/gi);
  if (yearsMatch) {
    yearsMatch.forEach((m) => {
      found.set(m.trim(), { original: m.trim(), matched: m.trim() });
    });
  }

  // Extract degree/role requirements
  const compoundPatterns = [
    { re: /bachelor'?s?\s*(degree)?/i, label: "bachelor's degree" },
    { re: /master'?s?\s*(degree)?/i, label: "master's degree" },
    { re: /ph\.?d\.?/i, label: "PhD" },
    { re: /computer science/i, label: "computer science" },
    { re: /software engineer(ing)?/i, label: "software engineering" },
    { re: /full[\s-]?stack/i, label: "full stack" },
    { re: /front[\s-]?end/i, label: "frontend" },
    { re: /back[\s-]?end/i, label: "backend" },
    { re: /machine learning/i, label: "machine learning" },
    { re: /data (science|scientist|engineer)/i, label: "data science" },
    { re: /devops/i, label: "devops" },
    { re: /cloud (engineer|architect)/i, label: "cloud engineering" },
    { re: /project manage(ment|r)/i, label: "project management" },
    { re: /product manage(ment|r)/i, label: "product management" },
  ];
  compoundPatterns.forEach(({ re, label }) => {
    const match = lower.match(re);
    if (match) {
      found.set(label, { original: label, matched: match[0].trim() });
    }
  });

  return found;
}

// Simple stem: remove common suffixes for fuzzy matching
function stem(word) {
  return word.toLowerCase()
    .replace(/(ing|ed|er|ment|tion|sion|ness|ity|ous|ive|able|ible|ist|ent|ant|al|ful|less|ly)$/, "")
    .replace(/s$/, "");
}

// Check if a keyword exists in resume text
function findInResume(keyword, aliases, resumeText) {
  const lower = resumeText.toLowerCase();

  // Direct match
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const keywordRegex = new RegExp(`\\b${esc(keyword)}\\b`, "i");
  if (keywordRegex.test(lower)) return true;

  // Check aliases
  if (SKILL_ALIASES[keyword]) {
    for (const alias of SKILL_ALIASES[keyword]) {
      const aliasRegex = new RegExp(`\\b${esc(alias)}\\b`, "i");
      if (aliasRegex.test(lower)) return true;
    }
  }

  // Stem-based matching for compound terms (e.g. "software engineering" matches "software engineer")
  const keywordWords = keyword.toLowerCase().split(/\s+/);
  if (keywordWords.length >= 2) {
    const keywordStems = keywordWords.map(stem);
    const resumeWords = lower.split(/\s+/).map(stem);
    const allStemsFound = keywordStems.every((ks) => resumeWords.includes(ks));
    if (allStemsFound) return true;
  }

  return false;
}

// Flatten resume content to plain text
function resumeToText(content) {
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
    if (Array.isArray(exp.description)) {
      parts.push(...exp.description);
    } else if (exp.description) {
      parts.push(exp.description);
    }
  });

  (content.projects || []).forEach((proj) => {
    parts.push(proj.projectName || proj.name || "");
    if (Array.isArray(proj.description)) {
      parts.push(...proj.description);
    } else if (proj.description) {
      parts.push(proj.description);
    }
    parts.push(proj.location || "");
  });

  (content.skills || []).forEach((skill) => {
    if (typeof skill === "string") {
      parts.push(skill);
    } else {
      parts.push(skill.header || "");
      if (typeof skill.skills === "string") {
        parts.push(skill.skills);
      } else if (Array.isArray(skill.skills)) {
        parts.push(...skill.skills);
      }
    }
  });

  return parts.join(" ");
}

// Strong action verbs for resume bullet points
const STRONG_VERBS = [
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

// Weak verbs to flag
const WEAK_VERBS = [
  "helped", "assisted", "worked on", "was responsible for",
  "participated in", "involved in", "utilized", "used",
  "did", "made", "got",
];

function getBulletPoints(content) {
  const bullets = [];
  (content.experience || []).forEach((exp) => {
    if (Array.isArray(exp.description)) {
      bullets.push(...exp.description.filter(Boolean));
    } else if (exp.description) {
      bullets.push(...String(exp.description).split("\n").filter(Boolean));
    }
  });
  (content.projects || []).forEach((proj) => {
    if (Array.isArray(proj.description)) {
      bullets.push(...proj.description.filter(Boolean));
    } else if (proj.description) {
      bullets.push(...String(proj.description).split("\n").filter(Boolean));
    }
  });
  return bullets;
}

// Check section completeness + bullet point quality
function checkSections(content) {
  const checks = [];

  // --- Header checks ---
  const hasName = content.header?.name && content.header.name !== "Your Name" && content.header.name.trim().length > 0;
  const hasEmail = !!content.header?.email;
  const hasLinkedin = !!content.header?.linkedin;
  const hasGithub = !!content.header?.github;

  checks.push({ label: "Name", present: hasName, category: "header" });
  checks.push({ label: "Email", present: hasEmail, category: "header" });
  checks.push({ label: "LinkedIn", present: hasLinkedin, category: "header" });
  checks.push({ label: "GitHub", present: hasGithub, category: "header" });

  // --- Section presence ---
  const education = content.education || [];
  const experience = content.experience || [];
  const projects = content.projects || [];
  const skills = content.skills || [];

  checks.push({ label: "Education section", present: education.length > 0, category: "sections" });
  checks.push({ label: "Experience section", present: experience.length > 0, category: "sections" });
  checks.push({ label: "Projects section", present: projects.length > 0, category: "sections" });
  checks.push({ label: "Skills section", present: skills.length > 0, category: "sections" });

  // --- Experience quality ---
  if (experience.length > 0) {
    const allHaveBullets = experience.every((exp) => {
      if (Array.isArray(exp.description)) return exp.description.filter(Boolean).length > 0;
      return !!exp.description;
    });
    checks.push({ label: "All experiences have bullet points", present: allHaveBullets, category: "quality" });

    // Check bullet count (2-6 per experience is ideal)
    const goodBulletCount = experience.every((exp) => {
      if (Array.isArray(exp.description)) {
        const count = exp.description.filter(Boolean).length;
        return count >= 2 && count <= 6;
      }
      return true;
    });
    checks.push({ label: "2-6 bullet points per experience", present: goodBulletCount, category: "quality" });
  }

  if (projects.length > 0) {
    const allHaveBullets = projects.every((proj) => {
      if (Array.isArray(proj.description)) return proj.description.filter(Boolean).length > 0;
      return !!proj.description;
    });
    checks.push({ label: "All projects have bullet points", present: allHaveBullets, category: "quality" });
  }

  // --- Bullet point quality checks ---
  const allBullets = getBulletPoints(content);

  if (allBullets.length > 0) {
    // Check for strong action verbs (bullets should start with one)
    const startsWithVerb = allBullets.filter((b) => {
      const firstWord = b.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, "");
      return STRONG_VERBS.includes(firstWord);
    });
    const verbRatio = startsWithVerb.length / allBullets.length;
    checks.push({
      label: "Bullet points start with strong action verbs",
      present: verbRatio >= 0.6,
      category: "quality",
      detail: `${startsWithVerb.length}/${allBullets.length} bullets`,
    });

    // Check for weak verbs
    const hasWeakVerbs = allBullets.some((b) => {
      const lower = b.toLowerCase();
      return WEAK_VERBS.some((wv) => lower.startsWith(wv));
    });
    checks.push({
      label: "No weak verbs (helped, assisted, worked on)",
      present: !hasWeakVerbs,
      category: "quality",
    });

    // Check for quantified impact (any number counts)
    const quantified = allBullets.filter((b) => /\d/.test(b));
    const quantifiedRatio = quantified.length / allBullets.length;
    checks.push({
      label: "Bullet points include metrics/numbers",
      present: quantifiedRatio >= 0.3,
      category: "quality",
      detail: `${quantified.length}/${allBullets.length} bullets have metrics`,
    });

    // Check bullet length (ideally 1-2 lines, ~50-150 chars)
    const goodLength = allBullets.filter((b) => b.length >= 30 && b.length <= 200);
    const lengthRatio = goodLength.length / allBullets.length;
    checks.push({
      label: "Bullet points are proper length (not too short/long)",
      present: lengthRatio >= 0.7,
      category: "quality",
      detail: `${goodLength.length}/${allBullets.length} bullets are good length`,
    });
  }

  return checks;
}

// Analyze each bullet point individually
function analyzeBullets(content) {
  const bulletFeedback = [];

  const analyzeBulletList = (items, sectionType) => {
    (items || []).forEach((item, itemIndex) => {
      let bullets = [];
      if (Array.isArray(item.description)) {
        bullets = item.description;
      } else if (item.description) {
        bullets = String(item.description).split("\n");
      }

      bullets.forEach((bullet, bulletIndex) => {
        if (!bullet || !bullet.trim()) return;

        const issues = [];
        const trimmed = bullet.trim();
        const firstWord = trimmed.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, "");

        // Check strong verb
        const hasStrongVerb = STRONG_VERBS.includes(firstWord);
        if (!hasStrongVerb) {
          // Check if it's a weak verb
          const lower = trimmed.toLowerCase();
          const hasWeakVerb = WEAK_VERBS.some((wv) => lower.startsWith(wv));
          if (hasWeakVerb) {
            issues.push({ type: "error", message: `Starts with weak verb "${firstWord}" — use a strong action verb` });
          } else {
            issues.push({ type: "warning", message: "Should start with a strong action verb (e.g. Developed, Built, Implemented)" });
          }
        }

        // Check for metrics — any number counts (team size, percentages, counts, dollar amounts)
        const hasMetrics = /\d/.test(trimmed);
        if (!hasMetrics) {
          issues.push({ type: "suggestion", message: "Consider adding numbers or metrics to quantify impact" });
        }

        // Check length
        if (trimmed.length < 30) {
          issues.push({ type: "error", message: "Too short — add more detail about what you did and the impact" });
        } else if (trimmed.length > 200) {
          issues.push({ type: "suggestion", message: "Consider shortening — keep to 1-2 lines" });
        }

        // Determine severity based on issue types
        // error = weak verb or too short (real problems)
        // warning = missing strong verb AND missing metrics (multiple issues)
        // ok = at most one minor suggestion
        let severity = "ok";
        const errorCount = issues.filter((i) => i.type === "error").length;
        const warningCount = issues.filter((i) => i.type === "warning").length;
        const suggestionCount = issues.filter((i) => i.type === "suggestion").length;

        if (errorCount > 0) severity = "error";
        else if (warningCount > 0) severity = "warning";
        else if (suggestionCount >= 2) severity = "warning";
        // Single suggestion = ok (don't highlight)

        bulletFeedback.push({
          section: sectionType,
          itemIndex,
          bulletIndex,
          text: trimmed,
          severity,
          issues,
        });
      });
    });
  };

  analyzeBulletList(content.experience, "experience");
  analyzeBulletList(content.projects, "projects");

  return bulletFeedback;
}

export async function POST(request) {
  try {
    const { jobDescription, resumeContent } = await request.json();

    if (!jobDescription || !resumeContent) {
      return NextResponse.json(
        { error: "jobDescription and resumeContent are required" },
        { status: 400 }
      );
    }

    // Extract keywords from job description
    const keywords = extractKeywords(jobDescription);
    const resumeText = resumeToText(resumeContent);

    // Score each keyword
    const matched = [];
    const missing = [];

    for (const [keyword, info] of keywords) {
      if (findInResume(keyword, SKILL_ALIASES[keyword] || [], resumeText)) {
        matched.push(keyword);
      } else {
        missing.push(keyword);
      }
    }

    // Calculate keyword score
    const totalKeywords = keywords.size;
    const keywordScore = totalKeywords > 0
      ? Math.round((matched.length / totalKeywords) * 100)
      : 0;

    // Section completeness & quality
    const sectionChecks = checkSections(resumeContent);

    const headerChecks = sectionChecks.filter((c) => c.category === "header");
    const sectionPresenceChecks = sectionChecks.filter((c) => c.category === "sections");
    const qualityChecks = sectionChecks.filter((c) => c.category === "quality");

    const sectionScore = sectionPresenceChecks.length > 0
      ? Math.round((sectionPresenceChecks.filter((c) => c.present).length / sectionPresenceChecks.length) * 100)
      : 0;

    const qualityScore = qualityChecks.length > 0
      ? Math.round((qualityChecks.filter((c) => c.present).length / qualityChecks.length) * 100)
      : 100;

    // Overall score (weighted: 50% keywords, 20% sections, 30% quality)
    const overallScore = Math.round(keywordScore * 0.5 + sectionScore * 0.2 + qualityScore * 0.3);

    // Per-bullet feedback
    const bulletFeedback = analyzeBullets(resumeContent);

    return NextResponse.json({
      overallScore,
      keywordScore,
      sectionScore,
      qualityScore,
      totalKeywords,
      matched,
      missing,
      sectionChecks,
      bulletFeedback,
    });
  } catch (error) {
    console.error("ATS score error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to calculate ATS score" },
      { status: 500 }
    );
  }
}
