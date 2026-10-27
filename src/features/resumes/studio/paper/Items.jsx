import { MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { formatMonthYear } from "@/lib/dates";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { itemBullets } from "@/features/resumes/resumeDocument";
import { Field } from "@/features/resumes/studio/paper/Field";
import BulletList from "@/features/resumes/studio/paper/BulletList";

// A left/right pair of lines, like the PDF's \resumeSubheading rows
function Row({ children, className }) {
  return <div className={cn("rb-row flex items-baseline justify-between gap-4", className)}>{children}</div>;
}

// Joins two fields with literal text (" in ", ", GPA: "), dimmed while either side is empty
function Joiner({ text, active }) {
  return <span className={active ? undefined : "text-zinc-300"}>{text}</span>;
}

// "May 2023 - Present". Typing "Present" as the end marks the item as current.
function DateRange({ item, onChange }) {
  const end = item.currentlyWorking ? "Present" : formatMonthYear(item.endDate);
  return (
    <span className="shrink-0 whitespace-nowrap">
      <Field
        value={formatMonthYear(item.startDate)}
        placeholder="Start"
        onCommit={(startDate) => onChange({ startDate })}
      />
      {" - "}
      <Field
        value={end}
        placeholder="End"
        onCommit={(value) =>
          onChange(
            /^(present|current|now)$/i.test(value)
              ? { currentlyWorking: true, endDate: "" }
              : { currentlyWorking: false, endDate: value }
          )
        }
      />
    </span>
  );
}

// Hover menu in the page's left margin for one entry
// `unprinted`: the PDF leaves this entry out (see PaperCanvas's measurement)
function ItemFrame({ label, onAddBullet, onRemove, className, unprinted, children }) {
  return (
    <div className={cn("rb-item group/item relative", className)} data-unprinted={unprinted || undefined}>
      {children}
      <div className="absolute -left-[0.4in] top-0 font-sans opacity-0 transition-opacity focus-within:opacity-100 group-hover/item:opacity-100 has-[[data-state=open]]:opacity-100">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Options for ${label}`}
              className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-white text-muted-foreground shadow-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="left" className="w-44">
            {onAddBullet && (
              <>
                <DropdownMenuItem onSelect={onAddBullet}>
                  <Plus className="mr-2 h-4 w-4" /> Add a bullet
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onSelect={onRemove} className="text-destructive focus:text-destructive">
              <Trash2 className="mr-2 h-4 w-4" /> Remove from resume
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export function EducationItem({ item, onChange, onRemove }) {
  return (
    <ItemFrame label={item.school || "education"} onRemove={onRemove} className="rb-education">
      <Row>
        <Field
          className="font-bold"
          value={item.school}
          placeholder="School"
          onCommit={(school) => onChange({ school })}
        />
        <Field
          className="rb-small shrink-0 font-bold"
          value={item.location}
          placeholder="Location"
          onCommit={(location) => onChange({ location })}
        />
      </Row>
      <Row className="rb-small italic">
        <span>
          <Field
            value={item.degreeType}
            placeholder="Degree"
            onCommit={(degreeType) => onChange({ degreeType })}
          />
          <Joiner text=" in " active={item.degreeType && item.major} />
          <Field value={item.major} placeholder="Major" onCommit={(major) => onChange({ major })} />
          <Joiner text=", GPA: " active={Boolean(item.gpa)} />
          <Field value={item.gpa} placeholder="GPA" onCommit={(gpa) => onChange({ gpa })} />
        </span>
        <Field
          className="shrink-0"
          value={formatMonthYear(item.endDate)}
          placeholder="Graduation"
          onCommit={(endDate) => onChange({ endDate })}
        />
      </Row>
    </ItemFrame>
  );
}

// Experience and project entries share the bullets; `bulletProps` carries the
// review state for this entry (feedback, suggestions, AI context)
function bulletEditor(item, onChange, bulletProps) {
  return (
    <BulletList
      bullets={itemBullets(item)}
      onChange={(description) => onChange({ description })}
      {...bulletProps}
    />
  );
}

const addBullet = (item, onChange) => () =>
  onChange({ description: [...itemBullets(item).filter(Boolean), ""] });

export function ExperienceItem({ item, onChange, onRemove, bulletProps }) {
  return (
    <ItemFrame
      label={item.companyName || "experience"}
      onRemove={onRemove}
      onAddBullet={addBullet(item, onChange)}
    >
      <Row>
        <Field
          className="font-bold"
          value={item.companyName}
          placeholder="Company"
          onCommit={(companyName) => onChange({ companyName })}
        />
        <Field
          className="rb-small shrink-0 font-bold"
          value={item.location}
          placeholder="Location"
          onCommit={(location) => onChange({ location })}
        />
      </Row>
      <Row className="rb-small italic">
        <Field
          value={item.position}
          placeholder="Job title"
          onCommit={(position) => onChange({ position })}
        />
        <DateRange item={item} onChange={onChange} />
      </Row>
      {bulletEditor(item, onChange, bulletProps)}
    </ItemFrame>
  );
}

export function ProjectItem({ item, onChange, onRemove, bulletProps }) {
  return (
    <ItemFrame
      label={item.projectName || "project"}
      onRemove={onRemove}
      onAddBullet={addBullet(item, onChange)}
    >
      <Row>
        <Field
          className="font-bold"
          value={item.projectName}
          placeholder="Project name"
          onCommit={(projectName) => onChange({ projectName })}
        />
        <span className="rb-small font-bold">
          <DateRange item={item} onChange={onChange} />
        </span>
      </Row>
      {bulletEditor(item, onChange, bulletProps)}
    </ItemFrame>
  );
}

// "Languages: Python, Go". Older resumes may store the skills as an array.
export function SkillLine({ item, onChange, onRemove }) {
  const skills = Array.isArray(item.skills) ? item.skills.join(", ") : item.skills;
  return (
    <ItemFrame label={item.header || "skills"} onRemove={onRemove} unprinted={!item.header || !skills}>
      <p className="rb-small rb-skills">
        <Field
          className="font-bold"
          value={item.header}
          placeholder="Category"
          onCommit={(header) => onChange({ header })}
        />
        <span className="font-bold">: </span>
        <Field
          value={skills}
          placeholder="Skill, another skill"
          onCommit={(value) => onChange({ skills: value })}
        />
      </p>
    </ItemFrame>
  );
}
