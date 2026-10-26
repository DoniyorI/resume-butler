"use client";

import { deleteEducation, saveEducation } from "@/features/cv/actions";
import EditDialog from "@/features/career-profile/EditDialog";
import { MonthField, SelectField, TextField } from "@/features/career-profile/fields";
import { formatRange, fromMonthInput, toMonthInput } from "@/features/career-profile/format";
import { EditButton, Section } from "@/features/career-profile/Section";
import { useEntryList } from "@/features/career-profile/useEntryList";

const DEGREE_TYPES = ["Associate", "Bachelor", "Master", "PhD"];

const BLANK = {
  id: null,
  school: "",
  location: "",
  major: "",
  degreeType: "Bachelor",
  gpa: "",
  startDate: "",
  endDate: "",
};

const toDraft = (entry) => ({
  ...entry,
  gpa: entry.gpa === null || entry.gpa === undefined ? "" : String(entry.gpa),
  start: toMonthInput(entry.startDate),
  end: toMonthInput(entry.endDate),
});
const fromDraft = ({ start, end, ...entry }) => ({
  ...entry,
  startDate: fromMonthInput(start),
  endDate: fromMonthInput(end),
});

const degreeLine = (entry) =>
  entry.degreeType && entry.major ? `${entry.degreeType} in ${entry.major}` : entry.degreeType || entry.major;

export default function EducationSection({ initialItems }) {
  const list = useEntryList(initialItems, {
    saveAll: saveEducation,
    deleteOne: deleteEducation,
    noun: "Education",
  });
  const editingItem = list.editing && (list.editing.index === null ? BLANK : list.items[list.editing.index]);

  return (
    <Section
      id="education"
      title="Education"
      count={list.items.length}
      addLabel="Add education"
      onAdd={list.startAdd}
      empty={{
        title: "Add your education",
        body: "Degrees, bootcamps and programs, with your GPA if it helps.",
      }}
    >
      <div className="space-y-5">
        {list.items.map((entry, index) => (
          <article key={entry.id ?? index} className="group flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-medium leading-snug">{entry.school || "Untitled school"}</h3>
              <p className="text-sm text-muted-foreground">
                {degreeLine(entry)}
                {entry.gpa !== "" && entry.gpa !== null ? `, GPA ${entry.gpa}` : ""}
              </p>
              {entry.location && <p className="text-sm text-muted-foreground">{entry.location}</p>}
            </div>
            <div className="flex shrink-0 items-start gap-1">
              <span className="pt-0.5 text-sm tabular-nums text-muted-foreground">
                {formatRange(entry.startDate, entry.endDate)}
              </span>
              <EditButton
                label={`Edit ${entry.school || "education"}`}
                onClick={() => list.startEdit(index)}
              />
            </div>
          </article>
        ))}
      </div>

      <EditDialog
        open={Boolean(list.editing)}
        onOpenChange={(open) => !open && list.close()}
        title={list.editing?.index === null ? "Add education" : "Edit education"}
        initial={editingItem && toDraft(editingItem)}
        onSave={(draft) => list.save(fromDraft(draft))}
        onDelete={list.editing?.index !== null ? list.remove : undefined}
      >
        {(draft, update) => (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="edu-school"
              label="School"
              value={draft.school}
              onChange={(school) => update({ school })}
              required
              className="sm:col-span-2"
            />
            <SelectField
              id="edu-degree"
              label="Degree"
              value={draft.degreeType}
              onChange={(degreeType) => update({ degreeType })}
              options={DEGREE_TYPES}
            />
            <TextField
              id="edu-major"
              label="Field of study"
              value={draft.major}
              onChange={(major) => update({ major })}
              placeholder="Computer Science"
            />
            <TextField
              id="edu-location"
              label="Location"
              value={draft.location}
              onChange={(location) => update({ location })}
            />
            <TextField
              id="edu-gpa"
              label="GPA"
              value={draft.gpa}
              onChange={(gpa) => update({ gpa })}
              inputMode="decimal"
              placeholder="Optional"
            />
            <MonthField
              id="edu-start"
              label="Started"
              value={draft.start}
              onChange={(start) => update({ start })}
            />
            <MonthField
              id="edu-end"
              label="Graduated (or expected)"
              value={draft.end}
              onChange={(end) => update({ end })}
            />
          </div>
        )}
      </EditDialog>
    </Section>
  );
}
