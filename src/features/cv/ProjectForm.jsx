"use client";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteProject, saveProjects } from "@/features/cv/actions";
import { useCvEntries } from "@/features/cv/hooks/useCvEntries";
import { toDateString, toPickerDate } from "@/features/cv/pickerDates";
import BulletListEditor from "@/features/cv/BulletListEditor";
import DateRangeFields, { CurrentlyWorkingField } from "@/features/cv/DateRangeFields";

// "present" is the picker's Present option; it is stored as currently_working
const toState = (entry) => ({
  ...entry,
  startDate: toPickerDate(entry.startDate),
  endDate: entry.currentlyWorking ? "present" : toPickerDate(entry.endDate),
});

// description has no input here but is kept (resume parsing can fill it)
const toInput = (entry) => ({
  id: entry.id,
  name: entry.name,
  description: entry.description,
  url: entry.url,
  currentlyWorking: Boolean(entry.currentlyWorking) || entry.endDate === "present",
  startDate: toDateString(entry.startDate),
  endDate: toDateString(entry.endDate),
  bullets: entry.bullets,
});

const newEntry = () => ({
  name: "",
  description: "",
  url: "",
  currentlyWorking: false,
  startDate: "",
  endDate: "",
  bullets: [""],
});

export default function ProjectForm({ initialEntries }) {
  const {
    entries,
    saving,
    addEntry,
    updateEntry,
    deleteEntry,
    addBullet,
    updateBullet,
    deleteBullet,
    save,
  } = useCvEntries(initialEntries, {
    toState,
    toInput,
    newEntry,
    saveAction: saveProjects,
    deleteAction: deleteProject,
    savedMessage: "Project entries saved successfully!",
  });

  return (
    <>
      <div className="flex space-x-6 justify-between items-center py-4">
        <h1 className=" text-2xl text-[#5CA78F] cursor-default">Personal Project</h1>
        <Button
          className="text-[#188665] font-light hover:bg-green-100"
          variant="ghost"
          onClick={addEntry}
        >
          + Add Project
        </Button>
      </div>
      {entries.map((entry, index) => (
        <div className="flex flex-col space-y-4 pb-8 relative" key={entry.key}>
          <Trash2
            strokeWidth={1.25}
            className="absolute left-[-50px] top-1/3 -translate-y-1/2 cursor-pointer hover:text-red-500"
            onClick={() => deleteEntry(index)}
          />
          <div className="flex space-x-6">
            <div className="flex-grow">
              <Label>Project Name</Label>
              <Input
                value={entry.name}
                onChange={(e) => updateEntry(index, "name", e.target.value)}
              />
            </div>
          </div>
          <div className="flex space-x-6">
            <div className="flex-grow">
              <Label>Project URL</Label>
              <Input
                value={entry.url}
                placeholder="https://github.com/..."
                onChange={(e) => updateEntry(index, "url", e.target.value)}
              />
            </div>
          </div>
          <DateRangeFields
            startDate={entry.startDate}
            endDate={entry.endDate}
            onChange={(field, value) => updateEntry(index, field, value)}
            allowPresent
            />
          <CurrentlyWorkingField
            id={`currently-working-${entry.key}`}
            checked={entry.currentlyWorking}
            onChange={(checked) => {
              // Unticking must also clear a "Present" end date, which implies currently working
              if (!checked && entry.endDate === "present") updateEntry(index, "endDate", "");
              updateEntry(index, "currentlyWorking", checked);
            }}
          />

          <div className="text-center font-light text-xs my-2">
            Please add as much information about your role so we can better tailor to the job
            application
          </div>

          <BulletListEditor
            bullets={entry.bullets}
            onAdd={() => addBullet(index)}
            onChange={(bulletIndex, value) => updateBullet(index, bulletIndex, value)}
            onDelete={(bulletIndex) => deleteBullet(index, bulletIndex)}
          />
        </div>
      ))}

      <div className="flex space-x-6 justify-end">
        <Button type="button" onClick={save} disabled={saving}>
          Save
        </Button>
      </div>
    </>
  );
}
