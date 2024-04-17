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
  deleteDoc,
  Timestamp
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

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
import { Calendar as CalendarIcon, Trash2 } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { cn } from "@/lib/utils"


export default function ExperienceForm() {
  const [experienceEntries, setExperienceEntries] = useState([]);
  const [user, setUser] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        setUser(authUser);
        const experienceCollectionRef = collection(db, "users", authUser.uid, "experience");
        const snapshot = await getDocs(experienceCollectionRef);
        const experienceData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          startDate: doc.data().startDate?.toDate() || "",
          endDate: doc.data().endDate?.toDate() || ""
        }));
        setExperienceEntries(experienceData);
      } else {
        router.push("/login");
      }
    });
    return () => unsubscribe();
  }, [router]);

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
        isNew: true,
      },
    ]);
  };

  const deleteExperienceEntry = async (index) => {
    const entryToDelete = experienceEntries[index];
    if (entryToDelete.isNew) {
      setExperienceEntries(experienceEntries.filter((_, idx) => idx !== index));
    } else {
      await deleteDoc(doc(db, "users", user.uid, "experience", entryToDelete.id));
      setExperienceEntries(experienceEntries.filter((_, idx) => idx !== index));
    }
  };

  const updateCurrentlyWorking = (index, checked) => {
    const updatedEntries = experienceEntries.map((entry, idx) =>
      idx === index ? { ...entry, currentlyWorking: checked } : entry
    );
    setExperienceEntries(updatedEntries);
  };


  const updateExperienceEntry = (index, field, value) => {
    console.log("updateExperienceEntry", index, field, value);
    const updatedEntries = experienceEntries.map((entry, idx) => {
      if (idx === index) {
        return { ...entry, [field]: value };
      }
      return entry;
    });
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

  const deleteDescriptionBullet = (entryIndex, bulletIndex) => {
    const updatedEntries = experienceEntries.map((entry, idx) => {
      if (idx === entryIndex) {
        const updatedDescription = entry.description.filter((_, dIdx) => dIdx !== bulletIndex);
        return { ...entry, description: updatedDescription };
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

  const handleSave = async () => {
    if (user) {
      const experienceCollectionRef = collection(db, "users", user.uid, "experience");
      try {
        await Promise.all(experienceEntries.map(entry => {
          const { id, isNew, ...data } = entry;
          const entryWithTimestamps = {
            ...data,
            startDate: data.startDate ? Timestamp.fromDate(new Date(data.startDate)) : null,
            endDate: data.endDate ? Timestamp.fromDate(new Date(data.endDate)) : null,
          };
          return isNew
            ? addDoc(experienceCollectionRef, entryWithTimestamps)
            : updateDoc(doc(db, "users", user.uid, "experience", id), entryWithTimestamps);
        }));
        alert("Experience entries saved successfully!");
      } catch (error) {
        console.error("Error saving experience entries: ", error);
        alert("Failed to save experience entries.");
      }
    }
  };

  return (
    <>
      <div className="flex space-x-6 justify-between items-center py-4">
        <h1 className=" text-2xl text-[#5CA78F] cursor-default">Experience</h1>
        <Button
          className="text-[#188665] font-light hover:bg-green-100"
          variant="ghost"
          onClick={addExperienceEntry}
        >
          + Add Education
        </Button>
      </div>
      {experienceEntries.map((entry, index) => ( 
        <div className="flex flex-col space-y-4 pb-8 relative" key={index}>
                  <Trash2
          strokeWidth={1.25}
          className="absolute left-[-50px] top-1/3 -translate-y-1/2 cursor-pointer hover:text-red-500"
          onClick={() => deleteExperienceEntry(index)}
        />
          <div className="flex space-x-6">
            <div className="flex-grow">
  
              <Label>Company Name</Label>
              <Input
                value={entry.companyName}
                onChange={(e) =>
                  updateExperienceEntry(index, "companyName", e.target.value)
                }
              />
            </div>
            <div className="flex-grow">
              <Label>Location</Label>
              <Input
                value={entry.location}
                onChange={(e) =>
                  updateExperienceEntry(index, "location", e.target.value)
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
              <Select
              value={entry.experienceType}
              onValueChange={(value) =>
                updateExperienceEntry(index,"experienceType", value)
              }
              >
                <SelectTrigger
                  
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
                        updateExperienceEntry(index, "startDate", date)
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
                        updateExperienceEntry(index, "endDate", date)
                      }
                      fromYear={1960}
                      toYear={2030}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2 pb-4 mt-0">
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
                className="flex items-center ml-4 space-x-2 space-y-2"
              >
                <span>•</span>
                <Input
                  value={desc}
                  onChange={(e) =>
                    updateDescriptionBullet(index, dIndex, e.target.value)
                  }
                />
                <Trash2
                strokeWidth={1.25}
                className="cursor-pointer hover:text-red-500"
                onClick={() => deleteDescriptionBullet(index, dIndex)}
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
