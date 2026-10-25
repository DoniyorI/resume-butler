"use client";
import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { X, Plus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SKILL_CATEGORIES = [
  "Languages",
  "Frameworks",
  "Tools",
  "Platforms",
  "Databases",
  "Other",
];

export default function SkillForm() {
  const [skills, setSkills] = useState([]);
  const [newSkill, setNewSkill] = useState("");
  const [newCategory, setNewCategory] = useState("Languages");
  const { user, loading, supabase } = useAuth({ redirect: true });

  useEffect(() => {
    if (!user) return;
    const fetchSkills = async () => {
      const { data, error } = await supabase
        .from("cv_skills")
        .select("*")
        .eq("user_id", user.id)
        .order("sort_order", { ascending: true });

      if (error) {
        console.error("Error fetching skills:", error);
        return;
      }

      setSkills(
        (data || []).map((row) => ({
          id: row.id,
          name: row.name || "",
          category: row.category || "Other",
        }))
      );
    };
    fetchSkills();
  }, [user, supabase]);

  const handleAddSkill = async () => {
    if (newSkill.trim() === "" || !user) return;

    const { data, error } = await supabase
      .from("cv_skills")
      .insert({
        user_id: user.id,
        name: newSkill.trim(),
        category: newCategory,
        sort_order: skills.length,
      })
      .select()
      .single();

    if (error) {
      console.error("Error adding skill:", error);
      return;
    }

    setSkills([...skills, { id: data.id, name: data.name, category: data.category }]);
    setNewSkill("");
  };

  const handleDeleteSkill = async (skillId) => {
    const { error } = await supabase.from("cv_skills").delete().eq("id", skillId);
    if (error) {
      console.error("Error deleting skill:", error);
      return;
    }
    setSkills(skills.filter((s) => s.id !== skillId));
  };

  // Group skills by category
  const grouped = skills.reduce((acc, skill) => {
    const cat = skill.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(skill);
    return acc;
  }, {});

  return (
    <div>
      <div className="flex space-x-6 justify-between items-center py-4">
        <h1 className="text-2xl text-[#5CA78F] cursor-default">
          Technical Skills
        </h1>
      </div>

      {/* Add skill input */}
      <div className="flex items-center gap-2 mt-2">
        <Select value={newCategory} onValueChange={setNewCategory}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {SKILL_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Input
          value={newSkill}
          onChange={(e) => setNewSkill(e.target.value)}
          placeholder="Add a skill (e.g. React, Python, AWS)"
          className="flex-grow"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAddSkill();
          }}
        />
        <Button
          className="text-[#188665] font-light hover:bg-green-100"
          variant="ghost"
          onClick={handleAddSkill}
        >
          <Plus size={16} className="mr-1" /> Add
        </Button>
      </div>

      {/* Grouped skills display */}
      <div className="mt-6 space-y-4">
        {Object.entries(grouped).map(([category, categorySkills]) => (
          <div key={category}>
            <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              {category}
            </Label>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {categorySkills.map((skill) => (
                <div
                  key={skill.id}
                  className="bg-green-50 border border-green-200 py-1 pl-3 pr-1.5 rounded-full flex items-center gap-1.5 text-sm"
                >
                  <span>{skill.name}</span>
                  <button
                    onClick={() => handleDeleteSkill(skill.id)}
                    className="text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full p-0.5 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}

        {skills.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-8">
            No skills added yet. Start typing above to add your first skill.
          </p>
        )}
      </div>
    </div>
  );
}
