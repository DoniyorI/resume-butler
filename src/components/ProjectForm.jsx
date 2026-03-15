"use client";
import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2 } from "lucide-react";

import { MonthYearPicker } from "@/components/ui/month-year-picker";

export default function ProjectForm() {
  const [projectEntries, setProjectEntries] = useState([]);
  const { user, loading, supabase } = useAuth({ redirect: true });

  useEffect(() => {
    if (!user) return;
    const fetchProjects = async () => {
      // Fetch projects
      const { data: projects, error } = await supabase
        .from("cv_projects")
        .select("*")
        .eq("user_id", user.id)
        .order("sort_order", { ascending: true });

      if (error) {
        console.error("Error fetching projects:", error);
        return;
      }

      // Fetch bullets for all projects
      const projectIds = (projects || []).map((p) => p.id);
      let bulletsMap = {};
      if (projectIds.length > 0) {
        const { data: bullets, error: bulletsError } = await supabase
          .from("cv_project_bullets")
          .select("*")
          .in("project_id", projectIds)
          .order("sort_order", { ascending: true });

        if (!bulletsError && bullets) {
          bullets.forEach((bullet) => {
            if (!bulletsMap[bullet.project_id]) {
              bulletsMap[bullet.project_id] = [];
            }
            bulletsMap[bullet.project_id].push(bullet);
          });
        }
      }

      const projectData = (projects || []).map((row) => {
        const rowBullets = bulletsMap[row.id] || [];
        return {
          id: row.id,
          projectName: row.name || "",
          position: row.description || "",
          location: row.url || "",
          currentlyWorking: row.currently_working || false,
          startDate: row.start_date ? new Date(row.start_date) : "",
          endDate: row.end_date ? new Date(row.end_date) : "",
          description: rowBullets.length > 0
            ? rowBullets.map((b) => b.content)
            : [""],
          bulletIds: rowBullets.map((b) => b.id),
        };
      });
      setProjectEntries(projectData);
    };
    fetchProjects();
  }, [user, supabase]);

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
        description: [""],
        bulletIds: [],
        isNew: true,
      },
    ]);
  };

  const deleteProjectEntry = async (index) => {
    const entryToDelete = projectEntries[index];
    if (entryToDelete.isNew) {
      setProjectEntries(projectEntries.filter((_, idx) => idx !== index));
    } else {
      // Delete bullets first, then the project
      await supabase
        .from("cv_project_bullets")
        .delete()
        .eq("project_id", entryToDelete.id);

      const { error } = await supabase
        .from("cv_projects")
        .delete()
        .eq("id", entryToDelete.id);

      if (error) {
        console.error("Error deleting project entry:", error);
        return;
      }
      setProjectEntries(projectEntries.filter((_, idx) => idx !== index));
    }
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
      try {
        for (let index = 0; index < projectEntries.length; index++) {
          const entry = projectEntries[index];
          const { id, isNew, description, bulletIds, ...data } = entry;
          const row = {
            user_id: user.id,
            name: data.projectName,
            description: data.position,
            url: data.location,
            currently_working: data.currentlyWorking,
            start_date: data.startDate
              ? format(new Date(data.startDate), "yyyy-MM-dd")
              : null,
            end_date: data.endDate
              ? format(new Date(data.endDate), "yyyy-MM-dd")
              : null,
            sort_order: index,
          };

          let projectId = id;

          if (isNew) {
            const { data: inserted, error } = await supabase
              .from("cv_projects")
              .insert(row)
              .select()
              .single();

            if (error) throw error;
            projectId = inserted.id;
          } else {
            const { error } = await supabase
              .from("cv_projects")
              .update(row)
              .eq("id", id);

            if (error) throw error;
          }

          // Delete existing bullets for this project and re-insert
          await supabase
            .from("cv_project_bullets")
            .delete()
            .eq("project_id", projectId);

          const bulletRows = description
            .filter((content) => content.trim() !== "" || description.length === 1)
            .map((content, bIndex) => ({
              project_id: projectId,
              content: content,
              sort_order: bIndex,
            }));

          if (bulletRows.length > 0) {
            const { error: bulletError } = await supabase
              .from("cv_project_bullets")
              .insert(bulletRows);

            if (bulletError) throw bulletError;
          }
        }

        toast("Project entries saved successfully!");

        // Re-fetch to sync state with database
        const { data: projects } = await supabase
          .from("cv_projects")
          .select("*")
          .eq("user_id", user.id)
          .order("sort_order", { ascending: true });

        const projectIds = (projects || []).map((p) => p.id);
        let bulletsMap = {};
        if (projectIds.length > 0) {
          const { data: bullets } = await supabase
            .from("cv_project_bullets")
            .select("*")
            .in("project_id", projectIds)
            .order("sort_order", { ascending: true });

          if (bullets) {
            bullets.forEach((bullet) => {
              if (!bulletsMap[bullet.project_id]) {
                bulletsMap[bullet.project_id] = [];
              }
              bulletsMap[bullet.project_id].push(bullet);
            });
          }
        }

        const projectData = (projects || []).map((row) => {
          const rowBullets = bulletsMap[row.id] || [];
          return {
            id: row.id,
            projectName: row.name || "",
            position: row.description || "",
            location: row.url || "",
            currentlyWorking: row.currently_working || false,
            startDate: row.start_date ? new Date(row.start_date) : "",
            endDate: row.end_date ? new Date(row.end_date) : "",
            description: rowBullets.length > 0
              ? rowBullets.map((b) => b.content)
              : [""],
            bulletIds: rowBullets.map((b) => b.id),
          };
        });
        setProjectEntries(projectData);
      } catch (error) {
        console.error("Error saving project entries: ", error);
        toast("Failed to save project entries.");
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

  const deleteDescriptionBullet = (entryIndex, bulletIndex) => {
    const updatedEntries = projectEntries.map((entry, idx) => {
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
          + Add Project
        </Button>
      </div>
      {projectEntries.map((entry, index) => (
        <div className="flex flex-col space-y-4 pb-8 relative" key={index}>
          <Trash2
            strokeWidth={1.25}
            className="absolute left-[-50px] top-1/3 -translate-y-1/2 cursor-pointer hover:text-red-500"
            onClick={() => deleteProjectEntry(index)}
          />
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
              <Label>Project URL</Label>
              <Input
                value={entry.location}
                placeholder="https://github.com/..."
                onChange={(e) =>
                  updateProjectEntry(index, "location", e.target.value)
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
                  updateProjectEntry(index, "startDate", date)
                }
              />
            </div>
            <div>
              <Label>End Date</Label>
              <MonthYearPicker
                value={entry.endDate}
                onChange={(date) =>
                  updateProjectEntry(index, "endDate", date)
                }
              />
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
