"use client";
import { useState } from "react";
import { X, Plus } from "lucide-react";
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
import { addSkill, deleteSkill } from "@/features/cv/actions";

const SKILL_CATEGORIES = ["Languages", "Frameworks", "Tools", "Platforms", "Databases", "Other"];

export default function SkillForm({ initialSkills }) {
  const [skills, setSkills] = useState(initialSkills);
  const [newSkill, setNewSkill] = useState("");
  const [newCategory, setNewCategory] = useState("Languages");
  const [adding, setAdding] = useState(false);

  const handleAddSkill = async () => {
    const name = newSkill.trim();
    if (name === "" || adding) return;

    setAdding(true);
    const result = await addSkill({ name, category: newCategory, sortOrder: skills.length });
    setAdding(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setSkills((current) => [...current, result.data]);
    setNewSkill("");
  };

  const handleDeleteSkill = async (skillId) => {
    const result = await deleteSkill(skillId);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setSkills((current) => current.filter((skill) => skill.id !== skillId));
  };

  const grouped = skills.reduce((groups, skill) => {
    const category = skill.category || "Other";
    (groups[category] ||= []).push(skill);
    return groups;
  }, {});

  return (
    <div>
      <div className="flex space-x-6 justify-between items-center py-4">
        <h1 className="text-2xl text-[#5CA78F] cursor-default">Technical Skills</h1>
      </div>

      <div className="flex items-center gap-2 mt-2">
        <Select value={newCategory} onValueChange={setNewCategory}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {SKILL_CATEGORIES.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
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
          disabled={adding}
        >
          <Plus size={16} className="mr-1" /> Add
        </Button>
      </div>

      <div className="mt-6 space-y-4">
        {Object.entries(grouped).map(([category, categorySkills]) => (
          <div key={category}>
            <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">{category}</Label>
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
