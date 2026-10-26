"use client";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { deleteExperience, saveExperience } from "@/features/cv/actions";
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

const toInput = (entry) => ({
  id: entry.id,
  company: entry.company,
  position: entry.position,
  location: entry.location,
  type: entry.type,
  currentlyWorking: Boolean(entry.currentlyWorking) || entry.endDate === "present",
  startDate: toDateString(entry.startDate),
  endDate: toDateString(entry.endDate),
  bullets: entry.bullets,
});

const newEntry = () => ({
  company: "",
  location: "",
  position: "",
  type: "",
  currentlyWorking: false,
  startDate: "",
  endDate: "",
  bullets: [""],
});

export default function ExperienceForm({ initialEntries }) {
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
    saveAction: saveExperience,
    deleteAction: deleteExperience,
    savedMessage: "Experience entries saved successfully!",
  });

  return (
    <>
      <div className="flex space-x-6 justify-between items-center py-4">
        <h1 className=" text-2xl text-[#5CA78F] cursor-default">Experience</h1>
        <Button
          className="text-[#188665] font-light hover:bg-green-100"
          variant="ghost"
          onClick={addEntry}
        >
          + Add Experience
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
              <Label>Company Name</Label>
              <Input
                value={entry.company}
                onChange={(e) => updateEntry(index, "company", e.target.value)}
              />
            </div>
            <div className="flex-grow">
              <Label>Location</Label>
              <Input
                value={entry.location}
                onChange={(e) => updateEntry(index, "location", e.target.value)}
              />
            </div>
          </div>
          <div className="flex space-x-6">
            <div className="flex-grow">
              <Label>Position</Label>
              <Input
                value={entry.position}
                onChange={(e) => updateEntry(index, "position", e.target.value)}
              />
            </div>
            <div>
              <Label>Experience Type</Label>
              <Select value={entry.type} onValueChange={(value) => updateEntry(index, "type", value)}>
                <SelectTrigger className="max-w-[300px] sm:w-[200px] md:w-[300px]">
                  <SelectValue placeholder="Select Experience Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="Internship">Internship</SelectItem>
                    <SelectItem value="Part-time">Part-time</SelectItem>
                    <SelectItem value="Full-time">Full-time</SelectItem>
                    <SelectItem value="Contract">Contract</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
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
