// export default function Page() {
//     return (
//         <div className="flex flex-col items-center justify-center h-screen">
//         <h1 className="text-4xl font-bold">Welcome to your CV</h1>
//         <p className="text-lg text-gray-500">Create your CV here</p>
//         </div>
//     );
// }

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

export default function PersonalProjectsPage() {
  const [projectEntries, setProjectEntries] = useState([
    {
      projectName: "",
      position: "",
      location: "",
      currentlyWorking: false,
      startDate: "",
      endDate: "",
      description: [""], // Initialize with one empty string for the first bullet point
    },
  ]);

  const addProjectEntry = () => {
    setProjectEntries([
      ...projectEntries,
      {
        projectName: "",
        position: "",
        location: "",
        currentlyWorking: false,
        startDate: "",
        endDate: "",
        description: [""], // Initialize with one empty string for the first bullet point
      },
    ]);
  };

  const updateProjectEntry = (index, field, value) => {
    const updatedEntries = projectEntries.map((entry, idx) => {
      if (idx === index) {
        return { ...entry, [field]: value };
      }
      return entry;
    });
    setProjectEntries(updatedEntries);
  };

  const updateCurrentlyWorking = (index, checked) => {
    const updatedEntries = projectEntries.map((entry, idx) =>
      idx === index ? { ...entry, currentlyWorking: checked } : entry
    );
    setProjectEntries(updatedEntries);
  };

  const addDescriptionBullet = (index) => {
    const updatedEntries = projectEntries.map((entry, idx) => {
      if (idx === index) {
        return { ...entry, description: [...entry.description, ""] };
      }
      return entry;
    });
    setProjectEntries(updatedEntries);
  };

  const updateDescriptionBullet = (entryIndex, bulletIndex, value) => {
    const updatedEntries = projectEntries.map((entry, idx) => {
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
    setProjectEntries(updatedEntries);
  };

  const handleSave = () => {
    console.log(projectEntries);
  };

  return (
    <>
      {projectEntries.map((entry, index) => (
        <div className="flex flex-col space-y-4 pb-8" key={index}>
          <div className="flex space-x-6">
            <div className="flex-grow">
              <Label>Project Name</Label>
              <Input
                value={entry.projectName}
                onChange={(e) =>
                  updateProjectEntry(index, "projectName", e.target.value)
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
                  updateProjectEntry(index, "position", e.target.value)
                }
              />
            </div>
            <div className="flex-grow">
              <Label>Location</Label>
              <Input
                value={entry.location}
                onChange={(e) =>
                  updateProjectEntry(index, "location", e.target.value)
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
                        updateProjectEntry(index, "startDate", date)
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
                        updateProjectEntry(index, "endDate", date)
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id={`currently-working-${index}`}
              checked={entry.currentlyWorking}
              onCheckedChange={(checked) =>
                updateCurrentlyWorking(index, checked)
              }
            />
            <Label htmlFor={`currently-working-${index}`}>
              Currently Working
            </Label>
          </div>

          {/* Instruction Text */}
          <div className="text-center">
            Please add as much information about your project so we can tailor
            to the job description later.
          </div>

          {/* Description Bullet Points */}
          <div>
            <div className="flex justify-between">
              <Label>Description (Min 4 Bullet points)</Label>
              <Button
                variant="ghost"
                onClick={() => addDescriptionBullet(index)}
              >
                + Add
              </Button>
            </div>
            {entry.description.map((desc, dIndex) => (
              <div
                key={dIndex}
                className="flex items-center ml-4 space-x-2 space-y-2 "
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
          </div>
        </div>
      ))}

      <div className="flex space-x-6 justify-between">
        <Button variant="outline" onClick={addProjectEntry}>
          Add Project
        </Button>
        <Button type="button" onClick={handleSave}>
          Save
        </Button>
      </div>
    </>
  );
}
