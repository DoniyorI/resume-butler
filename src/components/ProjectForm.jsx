"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase/config";
import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  Timestamp
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils"

export default function ProjectForm() {
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

  const [user, setUser] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        setUser(authUser);
        const projectsCollectionRef = collection(db, "users", authUser.uid, "projects");
        const snapshot = await getDocs(projectsCollectionRef);
        const projectData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          startDate: doc.data().startDate?.toDate() || "",
          endDate: doc.data().endDate?.toDate() || ""
        }));
        setProjectEntries(projectData);
      } else {
        router.push("/login");
      }
    });
    return () => unsubscribe();
  }, [router]);

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
        isNew: true,
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

  const handleSave = async () => {
    if (user) {
      const projectsCollectionRef = collection(db, "users", user.uid, "projects");
      try {
        await Promise.all(projectEntries.map(entry => {
          const { id, isNew, ...data } = entry;
          const entryWithTimestamps = {
            ...data,
            startDate: data.startDate ? Timestamp.fromDate(new Date(data.startDate)) : null,
            endDate: data.endDate ? Timestamp.fromDate(new Date(data.endDate)) : null,
          };
          return isNew
            ? addDoc(projectsCollectionRef, entryWithTimestamps)
            : updateDoc(doc(db, "users", user.uid, "projects", id), entryWithTimestamps);
        }));
        alert("Project entries saved successfully!");
      } catch (error) {
        console.error("Error saving project entries: ", error);
        alert("Failed to save project entries.");
      }
    }
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

  return (
    <>
      <div className="flex space-x-6 justify-between items-center py-4">
        <h1 className=" text-2xl text-[#5CA78F] cursor-default">
          Personal Project
        </h1>
        <Button
          className="text-[#188665] font-light hover:bg-green-100"
          variant="ghost"
          onClick={addProjectEntry}
        >
          + Add Education
        </Button>
      </div>
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
                      className={cn(
                        "w-[240px] justify-start text-left font-normal",
                        !entry.startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {entry.startDate
                        ? format(new Date(entry.startDate), "PPP")
                        : "Select End Date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className=" w-auto p-0">
                    <Calendar
                      mode="single"
                      captionLayout="dropdown-buttons"
                      selected={entry.startDate}
                      onSelect={(date) =>
                        updateProjectEntry(index, "startDate", date)
                      }
                      fromYear={1960}
                      toYear={2030}
                      
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
                      className={cn(
                        "w-[240px] justify-start text-left font-normal",
                        !entry.endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {entry.endDate
                        ? format(new Date(entry.endDate), "PPP")
                        : "Select End Date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className=" w-auto p-0">
                    <Calendar
                      mode="single"
                      captionLayout="dropdown-buttons"
                      selected={entry.endDate}
                      onSelect={(date) =>
                        updateProjectEntry(index, "endDate", date)
                      }
                      fromYear={1960}
                      toYear={2030}
                      
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2 pb-4">
            <Checkbox
              id={`currently-working-${index}`}
              checked={entry.currentlyWorking}
              onCheckedChange={(checked) =>
                updateCurrentlyWorking(index, checked)
              }
            />
            <Label
              className="font-light"
              htmlFor={`currently-working-${index}`}
            >
              Currently Working
            </Label>
          </div>

          {/* Instruction Text */}
          <div className="text-center font-light text-xs my-2">
            Please add as much information about your role so we can better
            tailor to the job application
          </div>

          {/* Description Bullet Points */}
          <div>
            <div className="flex justify-between items-center">
              <Label className="font-normal">Description</Label>
              <Button
                className="text-[#188665] font-light hover:bg-green-100"
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

      <div className="flex space-x-6 justify-end">
        <Button type="button" onClick={handleSave}>
          Save
        </Button>
      </div>
    </>
  );
}
