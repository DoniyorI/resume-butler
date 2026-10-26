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
import { deleteEducation, saveEducation } from "@/features/cv/actions";
import { useCvEntries } from "@/features/cv/hooks/useCvEntries";
import { toDateString, toPickerDate } from "@/features/cv/pickerDates";
import DateRangeFields from "@/features/cv/DateRangeFields";

const toState = (entry) => ({
  ...entry,
  startDate: toPickerDate(entry.startDate),
  endDate: toPickerDate(entry.endDate),
});

const toInput = (entry) => ({
  id: entry.id,
  school: entry.school,
  location: entry.location,
  major: entry.major,
  degreeType: entry.degreeType,
  gpa: entry.gpa,
  startDate: toDateString(entry.startDate),
  endDate: toDateString(entry.endDate),
});

const newEntry = () => ({
  school: "",
  location: "",
  major: "",
  degreeType: "",
  gpa: "",
  startDate: "",
  endDate: "",
});

export default function EducationForm({ initialEntries }) {
  const { entries, saving, addEntry, updateEntry, deleteEntry, save } = useCvEntries(
    initialEntries,
    {
      toState,
      toInput,
      newEntry,
      saveAction: saveEducation,
      deleteAction: deleteEducation,
      savedMessage: "Education entries saved successfully!",
    }
  );

  return (
    <>
      <div className="flex space-x-6 justify-between items-center py-4">
        <h1 className=" text-2xl text-[#5CA78F] cursor-default">Education</h1>
        <Button
          className="text-[#188665] font-light hover:bg-green-100"
          variant="ghost"
          onClick={addEntry}
        >
          + Add Education
        </Button>
      </div>
      {entries.map((entry, index) => (
        <div className="flex flex-col space-y-4 pb-8 relative" key={entry.key}>
          <Trash2
            strokeWidth={1.25}
            size={18}
            className="absolute left-[-50px] top-1/2 -translate-y-1/2 cursor-pointer hover:text-red-500"
            onClick={() => deleteEntry(index)}
          />
          <div className="flex space-x-6 ">
            <div className="flex-grow">
              <Label>School</Label>
              <Input
                value={entry.school}
                onChange={(e) => updateEntry(index, "school", e.target.value)}
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
              <Label>Major</Label>
              <Input
                value={entry.major}
                onChange={(e) => updateEntry(index, "major", e.target.value)}
              />
            </div>
            <div>
              <Label>Degree Type</Label>
              <Select
                value={entry.degreeType}
                onValueChange={(value) => updateEntry(index, "degreeType", value)}
              >
                <SelectTrigger className="max-w-[200px] md:w-[200px]">
                  <SelectValue placeholder="Select Degree Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="Bachelor">Bachelor</SelectItem>
                    <SelectItem value="Master">Master</SelectItem>
                    <SelectItem value="PhD">PhD</SelectItem>
                    <SelectItem value="Associate">Associate</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>GPA</Label>
              <Input
                type="number"
                step="0.01"
                value={entry.gpa}
                className="max-w-[200px] md:w-[200px]"
                onChange={(e) => updateEntry(index, "gpa", e.target.value)}
              />
            </div>
          </div>
          <DateRangeFields
            startDate={entry.startDate}
            endDate={entry.endDate}
            onChange={(field, value) => updateEntry(index, field, value)}
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
