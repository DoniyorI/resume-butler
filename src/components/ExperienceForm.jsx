"use client";
import React, { useState, useEffect } from "react";
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
import { Trash2 } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { MonthYearPicker } from "@/components/ui/month-year-picker";

export default function ExperienceForm() {
  const [experienceEntries, setExperienceEntries] = useState([]);
  const { user, loading, supabase } = useAuth({ redirect: true });

  useEffect(() => {
    if (!user) return;
    const fetchExperience = async () => {
      // Fetch experiences
      const { data: experiences, error } = await supabase
        .from("cv_experience")
        .select("*")
        .eq("user_id", user.id)
        .order("sort_order", { ascending: true });

      if (error) {
        console.error("Error fetching experience:", error);
        return;
      }

      // Fetch bullets for all experiences
      const experienceIds = (experiences || []).map((exp) => exp.id);
      let bulletsMap = {};
      if (experienceIds.length > 0) {
        const { data: bullets, error: bulletsError } = await supabase
          .from("cv_experience_bullets")
          .select("*")
          .in("experience_id", experienceIds)
          .order("sort_order", { ascending: true });

        if (!bulletsError && bullets) {
          bullets.forEach((bullet) => {
            if (!bulletsMap[bullet.experience_id]) {
              bulletsMap[bullet.experience_id] = [];
            }
            bulletsMap[bullet.experience_id].push(bullet);
          });
        }
      }

      const experienceData = (experiences || []).map((row) => {
        const rowBullets = bulletsMap[row.id] || [];
        return {
          id: row.id,
          companyName: row.company || "",
          location: row.location || "",
          position: row.position || "",
          experienceType: row.type || "",
          currentlyWorking: row.currently_working || false,
          startDate: row.start_date ? new Date(row.start_date) : "",
          endDate: row.end_date ? new Date(row.end_date) : "",
          description: rowBullets.length > 0
            ? rowBullets.map((b) => b.content)
            : [""],
          bulletIds: rowBullets.map((b) => b.id),
        };
      });
      setExperienceEntries(experienceData);
    };
    fetchExperience();
  }, [user, supabase]);

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
        description: [""],
        bulletIds: [],
        isNew: true,
      },
    ]);
  };

  const deleteExperienceEntry = async (index) => {
    const entryToDelete = experienceEntries[index];
    if (entryToDelete.isNew) {
      setExperienceEntries(experienceEntries.filter((_, idx) => idx !== index));
    } else {
      // Delete bullets first, then the experience
      await supabase
        .from("cv_experience_bullets")
        .delete()
        .eq("experience_id", entryToDelete.id);

      const { error } = await supabase
        .from("cv_experience")
        .delete()
        .eq("id", entryToDelete.id);

      if (error) {
        console.error("Error deleting experience entry:", error);
        return;
      }
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
        const updatedDescription = entry.description.filter(
          (_, dIdx) => dIdx !== bulletIndex
        );
        const updatedBulletIds = (entry.bulletIds || []).filter(
          (_, dIdx) => dIdx !== bulletIndex
        );
        return { ...entry, description: updatedDescription, bulletIds: updatedBulletIds };
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
      try {
        for (let index = 0; index < experienceEntries.length; index++) {
          const entry = experienceEntries[index];
          const { id, isNew, description, bulletIds, ...data } = entry;
          const row = {
            user_id: user.id,
            company: data.companyName,
            position: data.position,
            location: data.location,
            type: data.experienceType,
            currently_working: data.currentlyWorking,
            start_date: data.startDate
              ? format(new Date(data.startDate), "yyyy-MM-dd")
              : null,
            end_date: data.endDate
              ? format(new Date(data.endDate), "yyyy-MM-dd")
              : null,
            sort_order: index,
          };

          let experienceId = id;

          if (isNew) {
            const { data: inserted, error } = await supabase
              .from("cv_experience")
              .insert(row)
              .select()
              .single();

            if (error) throw error;
            experienceId = inserted.id;
          } else {
            const { error } = await supabase
              .from("cv_experience")
              .update(row)
              .eq("id", id);

            if (error) throw error;
          }

          // Delete existing bullets for this experience and re-insert
          await supabase
            .from("cv_experience_bullets")
            .delete()
            .eq("experience_id", experienceId);

          const bulletRows = description
            .filter((content) => content.trim() !== "" || description.length === 1)
            .map((content, bIndex) => ({
              experience_id: experienceId,
              content: content,
              sort_order: bIndex,
            }));

          if (bulletRows.length > 0) {
            const { error: bulletError } = await supabase
              .from("cv_experience_bullets")
              .insert(bulletRows);

            if (bulletError) throw bulletError;
          }
        }

        toast("Experience entries saved successfully!");

        // Re-fetch to sync state with database
        const { data: experiences } = await supabase
          .from("cv_experience")
          .select("*")
          .eq("user_id", user.id)
          .order("sort_order", { ascending: true });

        const experienceIds = (experiences || []).map((exp) => exp.id);
        let bulletsMap = {};
        if (experienceIds.length > 0) {
          const { data: bullets } = await supabase
            .from("cv_experience_bullets")
            .select("*")
            .in("experience_id", experienceIds)
            .order("sort_order", { ascending: true });

          if (bullets) {
            bullets.forEach((bullet) => {
              if (!bulletsMap[bullet.experience_id]) {
                bulletsMap[bullet.experience_id] = [];
              }
              bulletsMap[bullet.experience_id].push(bullet);
            });
          }
        }

        const experienceData = (experiences || []).map((row) => {
          const rowBullets = bulletsMap[row.id] || [];
          return {
            id: row.id,
            companyName: row.company || "",
            location: row.location || "",
            position: row.position || "",
            experienceType: row.type || "",
            currentlyWorking: row.currently_working || false,
            startDate: row.start_date ? new Date(row.start_date) : "",
            endDate: row.end_date ? new Date(row.end_date) : "",
            description: rowBullets.length > 0
              ? rowBullets.map((b) => b.content)
              : [""],
            bulletIds: rowBullets.map((b) => b.id),
          };
        });
        setExperienceEntries(experienceData);
      } catch (error) {
        console.error("Error saving experience entries: ", error);
        toast("Failed to save experience entries.");
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
                  updateExperienceEntry(index, "experienceType", value)
                }
              >
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
          <div className="flex space-x-6">
            <div>
              <Label>Start Date</Label>
              <MonthYearPicker
                value={entry.startDate}
                onChange={(date) =>
                  updateExperienceEntry(index, "startDate", date)
                }
              />
            </div>
            <div>
              <Label>End Date</Label>
              <MonthYearPicker
                value={entry.endDate}
                onChange={(date) =>
                  updateExperienceEntry(index, "endDate", date)
                }
              />
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
