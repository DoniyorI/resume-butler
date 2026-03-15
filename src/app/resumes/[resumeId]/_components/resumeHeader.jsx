"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { InputSizer } from "./InputSizer";

export const ResumeHeader = ({ params }) => {
  const { user, loading, supabase } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [github, setGithub] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    if (!user || !params.resumeId) return;

    const fetchHeader = async () => {
      // Fetch resume content and profile in parallel
      const [resumeRes, profileRes] = await Promise.all([
        supabase
          .from("resumes")
          .select("content")
          .eq("id", params.resumeId)
          .eq("user_id", user.id)
          .single(),
        supabase
          .from("profiles")
          .select("first_name, last_name, email, phone, linkedin, github")
          .eq("id", user.id)
          .single(),
      ]);

      if (resumeRes.error || !resumeRes.data) {
        console.error("Resume not found:", resumeRes.error);
        return;
      }

      const header = resumeRes.data.content?.header || {};
      const profile = profileRes.data || {};

      // Use resume header values, falling back to profile for empty fields
      const resolvedName = header.name || [profile.first_name, profile.last_name].filter(Boolean).join(" ");
      const resolvedEmail = header.email || profile.email || "";
      const resolvedPhone = header.phone || profile.phone || "";
      const resolvedLinkedin = header.linkedin || profile.linkedin || "";
      const resolvedGithub = header.github || profile.github || "";

      setName(resolvedName);
      setEmail(resolvedEmail);
      setPhone(resolvedPhone);
      setLinkedin(resolvedLinkedin);
      setGithub(resolvedGithub);

      // If we auto-filled from profile, save it to the resume so it persists
      if (!header.name || !header.email || !header.phone || !header.linkedin || !header.github) {
        const content = resumeRes.data.content || {};
        content.header = {
          name: resolvedName,
          email: resolvedEmail,
          phone: resolvedPhone,
          linkedin: resolvedLinkedin,
          github: resolvedGithub,
        };
        await supabase
          .from("resumes")
          .update({ content })
          .eq("id", params.resumeId);
      }
    };

    fetchHeader();
  }, [user, params.resumeId, supabase]);

  const saveField = async (field, value) => {
    if (!user || !params.resumeId) return;

    // First get current content
    const { data } = await supabase
      .from("resumes")
      .select("content")
      .eq("id", params.resumeId)
      .single();

    const content = data?.content || {};
    const header = content.header || {};
    header[field] = value;
    content.header = header;

    await supabase
      .from("resumes")
      .update({ content })
      .eq("id", params.resumeId);
  };

  const handleChange = (setter, field) => (value) => {
    setter(value);
    saveField(field, value);
  };

  const handleSaveName = (event) => {
    const newName = event.target.value;
    setName(newName);
    saveField("name", newName);
  };

  return (
    <>
      <div className="text-center">
        <input
          type="text"
          className="bg-transparent text-center w-full focus:outline-none text-3xl uppercase font-bold"
          placeholder="Your Name"
          value={name}
          onChange={handleSaveName}
        />
      </div>
      <div className="flex -mt-2 mb-2 text-sm justify-center items-center font-light">
        <div className="flex justify-center items-center">
          <InputSizer
            placeholder="Email"
            value={email}
            onChange={handleChange(setEmail, "email")}
          />
          <span>|</span>
          <InputSizer
            placeholder="Phone Number"
            value={phone}
            onChange={handleChange(setPhone, "phone")}
          />
          <span>|</span>
          <InputSizer
            placeholder="LinkedIn Profile"
            value={linkedin}
            onChange={handleChange(setLinkedin, "linkedin")}
          />
          <span>|</span>
          <InputSizer
            placeholder="GitHub Profile"
            value={github}
            onChange={handleChange(setGithub, "github")}
          />
        </div>
      </div>
    </>
  );
};
