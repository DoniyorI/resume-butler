"use client";
import React, { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { RiDeleteBack2Line } from "react-icons/ri";

export default function SkillForm() {
  const [skills, setSkills] = useState([]);
  const [newSkill, setNewSkill] = useState("");

  const handleAddSkill = () => {
    if (newSkill.trim() !== "") {
      setSkills([...skills, { value: newSkill, isEditable: false }]);
      setNewSkill("");
    }
  };

  const handleDeleteSkill = (index) => {
    const filteredSkills = skills.filter((_, i) => i !== index);
    setSkills(filteredSkills);
  };

  return (
    <div>
         <div className="flex space-x-6 justify-between items-center py-4">
            <h1 className=" text-2xl text-[#5CA78F] cursor-default">Technical Skills</h1>
          </div>
      <div className="flex items-center space-x-2 mt-2">
        
        <Input
          value={newSkill}
          onChange={(e) => setNewSkill(e.target.value)}
          placeholder="Add a new skill"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleAddSkill();
            }
          }}
        />
         <Button
              className="text-[#188665] font-light hover:bg-green-100"
              variant="ghost" onClick={handleAddSkill}>
          + Add
        </Button>
      </div>
      <div className="flex justify-center flex-wrap gap-2 mt-6 p-2">
        {skills.map((skill, index) => {
          const rotation = index % 2 === 0 ? 2 : -2;
          const zIndex = skills.length - index;
          return (
            <div
              key={index}
              style={{
                transform: `rotate(${rotation}deg)`,
                zIndex: zIndex,
              }}
              className="bg-green-100 hover:bg-green-200 py-1 pl-4 pr-2 space-x-2 rounded-md flex items-center shadow-lg"
            >
              <div className="font-light text-sm">{skill.value}</div>
              <div className="text-red-500 hover:bg-emerald-100  rounded-md  p-2">
                <RiDeleteBack2Line
                  onClick={() => handleDeleteSkill(index)}
                  className=""
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
