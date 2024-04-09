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
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";

export default function ExpensesPage() {
  const [experienceEntries, setExperienceEntries] = useState([
    {
      companyName: "",
      location: "",
      position: "",
      experienceType: "",
      currentlyWorking: false,
      startDate: "",
      endDate: "",
      description: [""], // Initialize with one empty string for the first bullet point
    },
  ]);

  const addExperienceEntry = () => {
    setExperienceEntries([
      ...experienceEntries,
      {
        companyName: "",
        location: "",
        position: "",
        experienceType: "",
        currentlyWorking: false,
        startDate: "",
        endDate: "",
        description: [""], // Initialize with one empty string for the first bullet point
      },
    ]);
  };

  const updateExperienceEntry = (index, field, value) => {
    const updatedEntries = experienceEntries.map((entry, idx) => {
      if (idx === index) {
        return { ...entry, [field]: value };
      }
      return entry;
    });
    setExperienceEntries(updatedEntries);
  };

  const updateCurrentlyWorking = (index, checked) => {
    const updatedEntries = experienceEntries.map((entry, idx) =>
      idx === index ? { ...entry, currentlyWorking: checked } : entry
    );
    setExperienceEntries(updatedEntries);
  };


  const addDescriptionBullet = (index) => {
    const updatedEntries = experienceEntries.map((entry, idx) => {
      if (idx === index) {
        return { ...entry, description: [...entry.description, ""] };
      }
      return entry;
    });
    setExperienceEntries(updatedEntries);
  };

  const updateDescriptionBullet = (entryIndex, bulletIndex, value) => {
    const updatedEntries = experienceEntries.map((entry, idx) => {
      if (idx === entryIndex) {
        const updatedDescription = entry.description.map((desc, dIdx) => {
          if (dIdx === bulletIndex) {
            return value;
          }
          return desc;
        });
        return { ...entry, description: updatedDescription };
      }
      return entry;
    });
    setExperienceEntries(updatedEntries);
  };

  const handleSave = () => {
    console.log(experienceEntries);
  };

  return (
    <>
      {experienceEntries.map((entry, index) => (
        <div className="flex flex-col space-y-4 pb-8" key={index}>
          <div className="flex space-x-6">
            <div className="flex-grow">
              <Label>Company Name</Label>
              <Input
                value={entry.companyName}
                onChange={(e) =>
                  updateExpenseEntry(index, "companyName", e.target.value)
                }
              />
            </div>
            <div className="flex-grow">
              <Label>Location</Label>
              <Input
                value={entry.location}
                onChange={(e) =>
                  updateExpenseEntry(index, "location", e.target.value)
                }
              />
            </div>
          </div>
          <div className="flex space-x-6">
            <div className="flex-grow">
              <Label>Position</Label>
              <Input
                value={entry.position}
                onChange={(e) =>
                  updateExperienceEntry(index, "position", e.target.value)
                }
              />
            </div>
            <div>
              <Label>Experience Type</Label>
              <Select>
                <SelectTrigger
                  value={entry.experienceType}
                  onChange={(e) =>
                    updateExperienceEntry(
                      index,
                      "experienceType",
                      e.target.value
                    )
                  }
                  className="max-w-[300px] sm:w-[200px] md:w-[300px]"
                >
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
                        updateExperienceEntry(index, "startDate", date)
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
                        updateExperienceEntry(index, "endDate", date)
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {/* <Checkbox
                id="terms"
              checked={entry.currentlyWorking}
              onChange={(e) =>
                updateExperienceEntry(index, "currentlyWorking", e.target.checked)
              }
            />
            
            <Label>Currently Working</Label> */}
            <Checkbox
            id={`currently-working-${index}`}
            checked={entry.currentlyWorking}
            onCheckedChange={(checked) => updateCurrentlyWorking(index, checked)}
          />
          <Label htmlFor={`currently-working-${index}`}>Currently Working</Label>

          </div>

          {/* Instruction Text */}
          <div className="text-center">
            Please add as much information about your role so we can tailor to
            the job description later.
          </div>

          {/* Description Bullet Points */}
          <div>
            <Label>Description (Min 4 Bullet points)</Label>
            {entry.description.map((desc, dIndex) => (
              <div
                key={dIndex}
                className="flex items-center ml-4 space-x-2 space-y-2"
              >
                <span>•</span>
                <Input
                  value={desc}
                  onChange={(e) =>
                    updateDescriptionBullet(index, dIndex, e.target.value)
                  }
                />
              </div>
            ))}
            <Button onClick={() => addDescriptionBullet(index)}>+ Add</Button>
          </div>
        </div>
      ))}

      <div className="flex space-x-6 justify-between">
        <Button variant="outline" onClick={addExperienceEntry}>
          Add Experience
        </Button>
        <Button type="button" onClick={handleSave}>
          Save
        </Button>
      </div>
    </>
  );
}
