import Link from "next/link";
import { Check, Plus } from "lucide-react";
import { formatMonthYear } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { cvToResumeItem, skillLines } from "@/features/resumes/resumeDocument";

const shortDate = (value) => formatMonthYear(value, { month: "short" });
const same = (a, b) => (a || "").trim().toLowerCase() === (b || "").trim().toLowerCase();

// Whether a CV entry is already on the page, so it isn't added twice by accident
const ON_PAGE = {
  education: (cv, items) => items.some((item) => same(item.school, cv.school) && same(item.major, cv.major)),
  experience: (cv, items) =>
    items.some((item) => same(item.companyName, cv.company) && same(item.position, cv.position)),
  projects: (cv, items) => items.some((item) => same(item.projectName, cv.name)),
};

function Entry({ title, subtitle, meta, onPage, onAdd }) {
  return (
    <li className="flex items-start gap-2 rounded-md border p-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
        {meta && <p className="text-xs text-muted-foreground">{meta}</p>}
      </div>
      {onPage ? (
        <span className="flex h-7 shrink-0 items-center gap-1 px-1 text-xs text-muted-foreground">
          <Check className="h-3.5 w-3.5 text-brand" /> On page
        </span>
      ) : (
        <Button size="sm" variant="outline" className="h-7 shrink-0 px-2 text-xs" onClick={onAdd}>
          <Plus className="mr-1 h-3 w-3" /> Add
        </Button>
      )}
    </li>
  );
}

function Group({ title, empty, children }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {empty ? (
        <p className="text-xs text-muted-foreground">Nothing in your Master CV yet.</p>
      ) : (
        <ul className="space-y-1.5">{children}</ul>
      )}
    </section>
  );
}

const range = (entry) =>
  [shortDate(entry.startDate), entry.currentlyWorking ? "Present" : shortDate(entry.endDate)]
    .filter(Boolean)
    .join(" - ");

// The master CV, one click to add an entry to the page. onAdd(sectionId, item)
export default function CvLibrary({ cv, sections, onAdd }) {
  const itemsOf = (id) => sections.find((section) => section.id === id)?.items || [];

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground">
        Entries are copied, so edits here don&apos;t change your{" "}
        <Link href="/profile" className="font-medium text-brand hover:underline">
          Master CV
        </Link>
        .
      </p>

      <Group title={cv.sectionTitles?.experience || "Experience"} empty={cv.experience.length === 0}>
        {cv.experience.map((exp) => (
          <Entry
            key={exp.id}
            title={exp.position || exp.company}
            subtitle={exp.position ? exp.company : null}
            meta={range(exp)}
            onPage={ON_PAGE.experience(exp, itemsOf("experience"))}
            onAdd={() => onAdd("experience", cvToResumeItem.experience(exp))}
          />
        ))}
      </Group>

      <Group title={cv.sectionTitles?.projects || "Projects"} empty={cv.projects.length === 0}>
        {cv.projects.map((proj) => (
          <Entry
            key={proj.id}
            title={proj.name}
            subtitle={proj.description}
            meta={range(proj)}
            onPage={ON_PAGE.projects(proj, itemsOf("projects"))}
            onAdd={() => onAdd("projects", cvToResumeItem.projects(proj))}
          />
        ))}
      </Group>

      <Group title={cv.sectionTitles?.education || "Education"} empty={cv.education.length === 0}>
        {cv.education.map((edu) => (
          <Entry
            key={edu.id}
            title={edu.school}
            subtitle={[edu.degreeType, edu.major].filter(Boolean).join(" in ")}
            meta={shortDate(edu.endDate)}
            onPage={ON_PAGE.education(edu, itemsOf("education"))}
            onAdd={() => onAdd("education", cvToResumeItem.education(edu))}
          />
        ))}
      </Group>

      <Group title={cv.sectionTitles?.certifications || "Certifications"} empty={!cv.certifications?.length}>
        {(cv.certifications || []).map(cert => <Entry key={cert.id} title={cert.name} subtitle={cert.issuer} meta={shortDate(cert.dateEarned)}
          onPage={itemsOf("certifications").some(item => item.id === cert.id)}
          onAdd={() => onAdd("certifications", cvToResumeItem.certifications(cert))} />)}
      </Group>
      {(cv.customSections || []).map(section => <Group key={section.id} title={section.title} empty={!section.items.length}>
        <Entry title={section.title} subtitle={section.items.length + " entries · copied independently"}
          onPage={sections.some(s => s.id === section.id)} onAdd={() => onAdd("custom-section", section)} />
      </Group>)}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Skills</h3>
          {cv.skills.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              onClick={() => skillLines(cv.skills).forEach((line) => onAdd("skills", line))}
            >
              <Plus className="mr-1 h-3 w-3" /> Add all by category
            </Button>
          )}
        </div>
        {cv.skills.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nothing in your Master CV yet.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {cv.skills.map((skill) => (
              <span key={skill.id} className="rounded-full border bg-muted/50 px-2 py-0.5 text-xs">
                {skill.name}
              </span>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
