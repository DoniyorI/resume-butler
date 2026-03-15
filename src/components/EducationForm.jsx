"use client";
import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

import { toast } from "sonner";
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
import { MonthYearPicker } from "@/components/ui/month-year-picker";

export default function EducationForm() {
  const [educationEntries, setEducationEntries] = useState([]);
  const { user, loading, supabase } = useAuth({ redirect: true });

  useEffect(() => {
    if (!user) return;
    const fetchEducation = async () => {
      const { data, error } = await supabase
        .from("cv_education")
        .select("*")
        .eq("user_id", user.id)
        .order("sort_order", { ascending: true });

      if (error) {
        console.error("Error fetching education:", error);
        return;
      }

      const educationData = (data || []).map((row) => ({
        id: row.id,
        school: row.school || "",
        location: row.location || "",
        major: row.major || "",
        minor: row.minor || "",
        degreeType: row.degree_type || "",
        gpa: row.gpa || "",
        startDate: row.start_date ? new Date(row.start_date) : "",
        endDate: row.end_date ? new Date(row.end_date) : "",
      }));
      setEducationEntries(educationData);
    };
    fetchEducation();
  }, [user, supabase]);

  const addEducationEntry = () => {
    setEducationEntries([
      ...educationEntries,
      {
        school: "",
        location: "",
        major: "",
        degreeType: "",
        gpa: "",
        startDate: "",
        endDate: "",
        isNew: true,
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

  const deleteEducationEntry = async (index) => {
    const entryToDelete = educationEntries[index];
    if (entryToDelete.isNew) {
      setEducationEntries(educationEntries.filter((_, idx) => idx !== index));
    } else {
      const { error } = await supabase
        .from("cv_education")
        .delete()
        .eq("id", entryToDelete.id);

      if (error) {
        console.error("Error deleting education entry:", error);
        return;
      }
      setEducationEntries(educationEntries.filter((_, idx) => idx !== index));
    }
  };

  const handleSave = async () => {
    if (user) {
      try {
        await Promise.all(
          educationEntries.map((entry, index) => {
            const { id, isNew, ...data } = entry;
            const row = {
              user_id: user.id,
              school: data.school,
              location: data.location,
              degree_type: data.degreeType,
              major: data.major,
              gpa: data.gpa,
              start_date: data.startDate
                ? format(new Date(data.startDate), "yyyy-MM-dd")
                : null,
              end_date: data.endDate
                ? format(new Date(data.endDate), "yyyy-MM-dd")
                : null,
              sort_order: index,
            };
            if (isNew) {
              return supabase
                .from("cv_education")
                .insert(row)
                .select()
                .single();
            } else {
              return supabase
                .from("cv_education")
                .update(row)
                .eq("id", id);
            }
          })
        );
        toast("Education entries saved successfully!");
        // Re-fetch to get IDs for newly created entries
        const { data } = await supabase
          .from("cv_education")
          .select("*")
          .eq("user_id", user.id)
          .order("sort_order", { ascending: true });

        if (data) {
          const educationData = data.map((row) => ({
            id: row.id,
            school: row.school || "",
            location: row.location || "",
            major: row.major || "",
            minor: row.minor || "",
            degreeType: row.degree_type || "",
            gpa: row.gpa || "",
            startDate: row.start_date ? new Date(row.start_date) : "",
            endDate: row.end_date ? new Date(row.end_date) : "",
          }));
          setEducationEntries(educationData);
        }
      } catch (error) {
        console.error("Error saving education entries: ", error);
        toast("Education entires FAILED to save!");
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
          <div className="flex space-x-6 ">
            <div className="flex-grow">
              <Label>School</Label>
              <Input
                value={entry.school}
                onChange={(e) =>
                  updateEducationEntry(index, "school", e.target.value)
                }
              />
            </div>
            <div className="flex-grow">
              <Label>Location</Label>
              <Input
                value={entry.location}
                onChange={(e) =>
                  updateEducationEntry(index, "location", e.target.value)
                }
              />
            </div>
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
                onChange={(e) =>
                  updateEducationEntry(index, "gpa", e.target.value)
                }
              />
            </div>
          </div>
          <div className="flex space-x-6">
            <div>
              <Label>Start Date</Label>
              <MonthYearPicker
                value={entry.startDate}
                onChange={(date) =>
                  updateEducationEntry(index, "startDate", date)
                }
              />
            </div>
            <div>
              <Label>End Date</Label>
              <MonthYearPicker
                value={entry.endDate}
                onChange={(date) =>
                  updateEducationEntry(index, "endDate", date)
                }
              />
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
