"use client";
import React, { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";

export default function EducationForm() {
  const [educationEntries, setEducationEntries] = useState([
    {
      school: "",
      major: "",
      degreeType: "",
      gpa: "",
      startDate: "",
      endDate: "",
    },
  ]);

  const addEducationEntry = () => {
    setEducationEntries([
      ...educationEntries,
      {
        school: "",
        major: "",
        degreeType: "",
        gpa: "",
        startDate: new Date(),
        endDate: new Date(),
      },
    ]);
  };

  const updateEducationEntry = (index, field, value) => {
    const updatedEntries = educationEntries.map((entry, idx) => {
      if (idx === index) {
        return { ...entry, [field]: value };
      }
      return entry;
    });
    setEducationEntries(updatedEntries);
  };

  const handleSave = () => {
    console.log(educationEntries);
  };
  return (
    <>
      <div className="flex space-x-6 justify-between items-center py-4">
        <h1 className=" text-2xl text-[#5CA78F] cursor-default">Education</h1>
        <Button
          className="text-[#188665] font-light hover:bg-green-100"
          variant="ghost"
          onClick={addEducationEntry}
        >
          + Add Education
        </Button>
      </div>
      {educationEntries.map((entry, index) => (
        <div className="flex flex-col space-y-4 pb-8" key={index}>
          <div>
            <Label>School</Label>
            <Input
              value={entry.school}
              onChange={(e) =>
                updateEducationEntry(index, "school", e.target.value)
              }
            />
          </div>
          <div className="flex space-x-6">
            <div className="flex-grow">
              <Label>Major</Label>
              <Input
                value={entry.major}
                onChange={(e) =>
                  updateEducationEntry(index, "major", e.target.value)
                }
              />
            </div>
            <div>
              <Label>Degree Type</Label>
              <Select>
                <SelectTrigger
                  value={entry.degreeType}
                  onChange={(e) =>
                    updateEducationEntry(index, "degreeType", e.target.value)
                  }
                  className="max-w-[200px] md:w-[200px]"
                >
                  <SelectValue placeholder="Select Degree Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="Bachelor's">Bachelor's</SelectItem>
                    <SelectItem value="Master's">Master's</SelectItem>
                    <SelectItem value="PhD">PhD</SelectItem>
                    <SelectItem value="Associate's">Associate's</SelectItem>
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
                onChange={(e) =>
                  updateEducationEntry(index, "gpa", e.target.value)
                }
              />
            </div>
          </div>
          <div className="flex space-x-6">
            <div>
              <Label htmlFor="date-picker" className="text-right">
                Start Date
              </Label>
              <div className="col-span-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {entry.startDate
                        ? format(new Date(entry.startDate), "PPP")
                        : "Select Start Date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={entry.startDate}
                      onSelect={(date) =>
                        updateEducationEntry(index, "startDate", date)
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div>
              <Label htmlFor="date-picker" className=" text-right">
                End Date
              </Label>
              <div className="col-span-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {entry.endDate
                        ? format(new Date(entry.endDate), "PPP")
                        : "Select End Date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={entry.endDate}
                      onSelect={(date) =>
                        updateEducationEntry(index, "endDate", date)
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
        </div>
      ))}
      <div className="flex space-x-6 justify-end">
        <Button type="button" onClick={handleSave}>
          Save
        </Button>
      </div>
    </>
  );
}
