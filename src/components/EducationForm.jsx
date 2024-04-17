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
import { format } from "date-fns";
import { Trash2 } from "lucide-react";

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
import { cn } from "@/lib/utils";

export default function EducationForm() {
  const [educationEntries, setEducationEntries] = useState([]);
  const [user, setUser] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        setUser(authUser);
        const educationCollectionRef = collection(db, "users", authUser.uid, "education");
        const snapshot = await getDocs(educationCollectionRef);
        const educationData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), startDate: doc.data().startDate?.toDate() || "", endDate: doc.data().endDate?.toDate() || "" }));
        setEducationEntries(educationData);
      } else {
        router.push("/login");
      }
    });
    return () => unsubscribe();
  }, [router]);

  const addEducationEntry = () => {
    setEducationEntries([
      ...educationEntries,
      { school: "", major: "", degreeType: "", gpa: "", startDate: "", endDate: "", isNew: true },
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

  const deleteEducationEntry = async (index) => {
    const entryToDelete = educationEntries[index];
    if (entryToDelete.isNew) {
      setEducationEntries(educationEntries.filter((_, idx) => idx !== index));
    } else {
      await deleteDoc(doc(db, "users", user.uid, "education", entryToDelete.id));
      setEducationEntries(educationEntries.filter((_, idx) => idx !== index));
    }
  };

  const handleSave = async () => {
    if (user) {
      const educationCollectionRef = collection(db, "users", user.uid, "education");
      try {
        await Promise.all(educationEntries.map(entry => {
          const { id, isNew, ...data } = entry;
          const entryWithTimestamps = {
            ...data,
            startDate: data.startDate ? Timestamp.fromDate(new Date(data.startDate)) : null,
            endDate: data.endDate ? Timestamp.fromDate(new Date(data.endDate)) : null,
          };
          return isNew
            ? addDoc(educationCollectionRef, entryWithTimestamps)
            : updateDoc(doc(db, "users", user.uid, "education", id), entryWithTimestamps);
        }));
        alert("Education entries saved successfully!");
      } catch (error) {
        console.error("Error saving education entries: ", error);
        alert("Failed to save education entries.");
      }
    }
  };

  if (!user) {
    return <div>Loading...</div>;
  }

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
        <div className="flex flex-col space-y-4 pb-8 relative" key={index}>
          <Trash2
            strokeWidth={1.25}
            size={18}
            className="absolute left-[-50px] top-1/2 -translate-y-1/2 cursor-pointer hover:text-red-500"
            onClick={() => deleteEducationEntry(index)}
          />
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
              <Select
                value={entry.degreeType}
                onValueChange={(value) =>
                  updateEducationEntry(index, "degreeType", value)
                }
              >
                <SelectTrigger className="max-w-[200px] md:w-[200px]">
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
                        updateEducationEntry(index, "startDate", date)
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
                        updateEducationEntry(index, "endDate", date)
                      }
                      fromYear={1960}
                      toYear={2030}
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
