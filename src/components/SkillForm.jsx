"use client";
import React, { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase/config";
import { collection, doc, setDoc, getDocs, deleteDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RiDeleteBack2Line } from "react-icons/ri";

export default function SkillForm() {
  const [skills, setSkills] = useState([]);
  const [newSkill, setNewSkill] = useState("");
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        setUser(authUser);
        const skillsRef = collection(db, "users", authUser.uid, "skills");
        const snapshot = await getDocs(skillsRef);
        const loadedSkills = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setSkills(loadedSkills);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleAddSkill = async () => {
    if (newSkill.trim() !== "") {
      const skillRef = doc(collection(db, "users", user.uid, "skills"));
      await setDoc(skillRef, { name: newSkill.trim() });
      setSkills([...skills, { id: skillRef.id, name: newSkill.trim() }]);
      setNewSkill("");
    }
  };

  const handleDeleteSkill = async (skillId) => {
    await deleteDoc(doc(db, "users", user.uid, "skills", skillId));
    setSkills(skills.filter(skill => skill.id !== skillId));
  };

  return (
    <div>
      <div className="flex space-x-6 justify-between items-center py-4">
        <h1 className="text-2xl text-[#5CA78F] cursor-default">
          Technical Skills
        </h1>
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
          variant="ghost"
          onClick={handleAddSkill}
        >
          + Add
        </Button>
      </div>
      <div className="flex justify-center flex-wrap gap-2 mt-6 p-2 max-w-[750px]">
        {skills.map((skill, index) => {
          const rotation = index % 2 === 0 ? 2 : -2;
          const zIndex = skills.length - index;
          return (
            <div
              key={skill.id}  // Changed from index to skill.id
              style={{
                transform: `rotate(${rotation}deg)`,
                zIndex
              }}
              className="bg-green-100 hover:bg-green-200 py-1 pl-4 pr-2 space-x-2 rounded-md flex items-center shadow-lg"
            >
              <div className="font-light text-sm">{skill.name}</div>
              <div className="text-red-500 hover:bg-emerald-100 rounded-md p-2">
                <RiDeleteBack2Line
                  onClick={() => handleDeleteSkill(skill.id)}  // Changed from skill to skill.id
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
