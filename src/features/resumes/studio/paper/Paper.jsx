import { Github, Linkedin, Mail, Phone, Plus } from "lucide-react";
import CustomItem from "./CustomItem";
import { Field } from "@/features/resumes/studio/paper/Field";
import { EducationItem, ExperienceItem, ProjectItem, SkillLine } from "@/features/resumes/studio/paper/Items";

const CONTACTS = [
  { field: "email", placeholder: "Email", Icon: Mail, underline: true },
  { field: "phone", placeholder: "Phone", Icon: Phone },
  { field: "linkedin", placeholder: "LinkedIn URL", Icon: Linkedin, underline: true },
  { field: "github", placeholder: "GitHub URL", Icon: Github, underline: true },
];

const ITEMS = {
  education: EducationItem,
  experience: ExperienceItem,
  projects: ProjectItem,
  skills: SkillLine,
};

const ADD_LABEL = {
  education: "Add school",
  experience: "Add job",
  projects: "Add project",
  skills: "Add skill line",
};

function Header({ header, onChange }) {
  return (
    <header className="text-center">
      <Field
        as="h1"
        className="rb-name"
        value={header.name}
        placeholder="Your name"
        onCommit={(value) => onChange("name", value)}
      />
      <div className="rb-small rb-contacts flex flex-wrap items-center justify-center gap-x-[0.9em]">
        {CONTACTS.map(({ field, placeholder, Icon, underline }) => (
          <span key={field} className="inline-flex items-center gap-[0.3em]">
            <Icon aria-hidden className="h-[9pt] w-[9pt]" strokeWidth={2.25} />
            <Field
              className={underline ? "underline underline-offset-2" : undefined}
              value={header[field]}
              placeholder={placeholder}
              onCommit={(value) => onChange(field, value)}
            />
          </span>
        ))}
      </div>
    </header>
  );
}

// A section without entries isn't printed, so its heading doesn't count toward the page
function SectionHeading({ section, onRename, onAdd }) {
  return (
    <h2
      className="rb-heading group/heading relative flex items-end justify-between"
      data-unprinted={section.items.length === 0 || undefined}
    >
      <Field
        value={section.title}
        placeholder="Section title"
        onCommit={(title) => onRename(title || section.id)}
      />
      <button
        type="button"
        onClick={onAdd}
        className="flex items-center gap-1 rounded-md px-1.5 font-sans text-[11px] font-medium normal-case leading-5 text-brand opacity-0 transition-opacity hover:bg-brand/10 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover/heading:opacity-100"
        style={{ fontVariant: "normal" }}
      >
        <Plus className="h-3 w-3" /> {ADD_LABEL[section.id] || "Add entry"}
      </button>
    </h2>
  );
}

/**
 * The editable resume page: header, then the visible sections in order.
 * `review` holds the AI and ATS state shown on the bullets:
 * { feedbackFor(sectionId, itemIndex), suggestedFor(...), activeFor(...),
 *   onShowSuggestion(sectionId, itemIndex, bulletIndex), jobDescription }
 */
export default function Paper({ resumeDoc, review, onRemoveItem }) {
  const visible = resumeDoc.sections.filter((section) => !section.hidden);

  return (
    <>
      <Header header={resumeDoc.header} onChange={resumeDoc.updateHeaderField} />
      {visible.length === 0 && (
        <p className="mt-[24pt] text-center font-sans text-sm text-muted-foreground">
          Every section is hidden. Show one from the outline.
        </p>
      )}
      {visible.map((section) => {
        const Item = ITEMS[section.id] || CustomItem;
        return (
          <section key={section.id} aria-label={section.title} className="rb-section">
            <SectionHeading
              section={section}
              onRename={(title) => resumeDoc.updateSectionMeta(section.id, { title })}
              onAdd={() => resumeDoc.addBlankItem(section.id)}
            />
            {section.items.map((item, itemIndex) => (
              <Item
                key={item.id || itemIndex}
                item={item}
                type={section.type || "entries"}
                onChange={(changes) => resumeDoc.updateItem(section.id, itemIndex, changes)}
                onRemove={() => onRemoveItem(section.id, itemIndex)}
                bulletProps={{
                  itemKey: `${section.id}:${itemIndex}`,
                  context:
                    section.id === "experience"
                      ? [item.position, item.companyName].filter(Boolean).join(" at ")
                      : item.projectName || "",
                  jobDescription: review.jobDescription,
                  feedback: review.feedbackFor(section.id, itemIndex),
                  suggested: review.suggestedFor(section.id, itemIndex),
                  active: review.activeFor(section.id, itemIndex),
                  onShowSuggestion: (bulletIndex) =>
                    review.onShowSuggestion(section.id, itemIndex, bulletIndex),
                }}
              />
            ))}
          </section>
        );
      })}
    </>
  );
}
