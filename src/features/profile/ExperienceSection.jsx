"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { deleteExperience, saveExperience } from "@/features/cv/actions";
import EditDialog from "@/features/profile/EditDialog";
import { BulletsField, MonthField, SelectField, TextField } from "@/features/profile/fields";
import {
  bulletsForEditing,
  cleanBullets,
  formatRange,
  fromMonthInput,
  toMonthInput,
} from "@/features/profile/format";
import { Bullets, EditButton, Section } from "@/features/profile/Section";
import { useEntryList } from "@/features/profile/useEntryList";

const EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Internship", "Contract"];

const BLANK = {
  id: null,
  company: "",
  position: "",
  location: "",
  type: "Full-time",
  currentlyWorking: false,
  startDate: "",
  endDate: "",
  bullets: [],
};

// Dialog draft <-> stored entry
const toDraft = (entry) => ({
  ...entry,
  start: toMonthInput(entry.startDate),
  end: toMonthInput(entry.endDate),
  bullets: bulletsForEditing(entry.bullets),
});
const fromDraft = ({ start, end, ...entry }) => ({
  ...entry,
  startDate: fromMonthInput(start),
  endDate: entry.currentlyWorking ? null : fromMonthInput(end),
  bullets: cleanBullets(entry.bullets),
});

export default function ExperienceSection({ initialItems }) {
  const list = useEntryList(initialItems, {
    saveAll: saveExperience,
    deleteOne: deleteExperience,
    noun: "Experience",
  });
  const editingItem = list.editing && (list.editing.index === null ? BLANK : list.items[list.editing.index]);

  return (
    <Section
      id="experience"
      title="Experience"
      count={list.items.length}
      addLabel="Add experience"
      onAdd={list.startAdd}
      empty={{
        title: "Add your first role",
        body: "Jobs, internships and contract work. Tailored resumes pick from what you add here.",
      }}
    >
      {/* The timeline rail: one dot per role, current roles filled */}
      <ol className="relative space-y-7 border-l border-border pl-6">
        {list.items.map((entry, index) => (
          <li key={entry.id ?? index} className="group relative">
            <span
              aria-hidden
              className={
                entry.currentlyWorking
                  ? "absolute -left-[31px] top-1.5 h-3 w-3 rounded-full border-2 border-brand bg-brand"
                  : "absolute -left-[31px] top-1.5 h-3 w-3 rounded-full border-2 border-brand bg-background"
              }
            />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-medium leading-snug">{entry.position || "Untitled role"}</h3>
                <p className="text-sm text-muted-foreground">
                  {[entry.company, entry.location].filter(Boolean).join(", ")}
                  {entry.type && entry.type !== "Full-time" ? ` (${entry.type})` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-start gap-1">
                <span className="pt-0.5 text-sm tabular-nums text-muted-foreground">
                  {formatRange(entry.startDate, entry.endDate, entry.currentlyWorking)}
                </span>
                <EditButton
                  label={`Edit ${entry.position || "role"}`}
                  onClick={() => list.startEdit(index)}
                />
              </div>
            </div>
            <Bullets items={entry.bullets} />
          </li>
        ))}
      </ol>

      <EditDialog
        open={Boolean(list.editing)}
        onOpenChange={(open) => !open && list.close()}
        title={list.editing?.index === null ? "Add experience" : "Edit experience"}
        initial={editingItem && toDraft(editingItem)}
        onSave={(draft) => list.save(fromDraft(draft))}
        onDelete={list.editing?.index !== null ? list.remove : undefined}
      >
        {(draft, update) => (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                id="exp-position"
                label="Job title"
                value={draft.position}
                onChange={(position) => update({ position })}
                required
              />
              <TextField
                id="exp-company"
                label="Company"
                value={draft.company}
                onChange={(company) => update({ company })}
                required
              />
              <TextField
                id="exp-location"
                label="Location"
                value={draft.location}
                onChange={(location) => update({ location })}
                placeholder="New York, NY or Remote"
              />
              <SelectField
                id="exp-type"
                label="Type"
                value={draft.type}
                onChange={(type) => update({ type })}
                options={EMPLOYMENT_TYPES}
              />
              <MonthField
                id="exp-start"
                label="Started"
                value={draft.start}
                onChange={(start) => update({ start })}
              />
              <MonthField
                id="exp-end"
                label="Ended"
                value={draft.end}
                onChange={(end) => update({ end })}
                disabled={draft.currentlyWorking}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="exp-current"
                checked={draft.currentlyWorking}
                onCheckedChange={(checked) => update({ currentlyWorking: checked === true })}
              />
              <Label htmlFor="exp-current" className="text-sm font-normal">
                I currently work here
              </Label>
            </div>
            <BulletsField
              id="exp-bullets"
              value={draft.bullets}
              onChange={(bullets) => update({ bullets })}
            />
          </>
        )}
      </EditDialog>
    </Section>
  );
}
