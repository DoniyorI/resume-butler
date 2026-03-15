// CoverLetterEditor.jsx
"use client";

import React, { useState, useEffect } from "react";
import { Editor, EditorState, convertToRaw, convertFromRaw } from "draft-js";
import "draft-js/dist/Draft.css";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { isValid, format } from "date-fns";

function CoverLetterEditor({ params }) {
  const { user, loading, supabase } = useAuth({ redirect: true });
  const [editorState, setEditorState] = useState(EditorState.createEmpty());
  const [date, setDate] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);

  const router = useRouter();
  const [header, setHeader] = useState({
    contactPhone: "",
    contactEmail: "",
    name: "",
    linkedin: "",
    portfolio: "",
  });
  const [coverLetterTitle, setCoverLetterTitle] = useState("");

  useEffect(() => {
    if (!user || !params.coverLetterId) return;

    const fetchCoverLetter = async () => {
      const { data, error } = await supabase
        .from("cover_letters")
        .select("*")
        .eq("id", params.coverLetterId)
        .eq("user_id", user.id)
        .single();

      if (error || !data) {
        console.error("Cover letter not found:", error);
        return;
      }

      setCoverLetterTitle(data.title);
      if (data.content) {
        const content = typeof data.content === "string" ? JSON.parse(data.content) : data.content;
        if (content.header) setHeader(content.header);
        if (content.date) setDate(new Date(content.date));
        if (content.body) {
          try {
            setEditorState(EditorState.createWithContent(convertFromRaw(content.body)));
          } catch (e) {
            console.error("Error parsing editor content:", e);
          }
        }
      }
    };

    fetchCoverLetter();
  }, [user, params.coverLetterId, supabase]);

  const handleSave = async () => {
    if (!user) return;

    const contentState = editorState.getCurrentContent();
    const rawContent = convertToRaw(contentState);

    const { error } = await supabase
      .from("cover_letters")
      .update({
        title: coverLetterTitle,
        content: {
          body: rawContent,
          header: header,
          date: date ? date.toISOString() : null,
        },
      })
      .eq("id", params.coverLetterId);

    if (error) {
      console.error("Error saving cover letter:", error);
      return;
    }
    toast("Cover letter saved");
  };

  const autoSave = async () => {
    if (!user || !params.coverLetterId) return;

    const { error } = await supabase
      .from("cover_letters")
      .update({ title: coverLetterTitle })
      .eq("id", params.coverLetterId);

    if (!error) {
      toast("Title Updated Successfully", {
        action: { label: "OK", onClick: () => toast.dismiss() },
      });
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setHeader({ ...header, [name]: value });
    handleSave();
  };

  const handleDateChange = (selectedDate) => {
    setDate(selectedDate);
    handleSave();
  };

  if (loading || !user) {
    return <p>Loading...</p>;
  }

  return (
    <div className="flex flex-col w-full p-10 font-sans my-10">
      <Header
        title={coverLetterTitle}
        setCoverLetterTitle={setCoverLetterTitle}
        editingTitle={editingTitle}
        setEditingTitle={setEditingTitle}
        autoSave={autoSave}
      />
      <div className="flex flex-col items-center justify-center flex-grow p-4">
        <div className="w-[850px] h-[1100px] border border-gray-800 rounded-md bg-white box-border overflow-hidden p-4">
          <div className="border-b-2 border-black p-4 flex justify-between items-center">
            <div className="flex flex-col space-y-1">
              <input type="text" name="contactPhone" value={header.contactPhone} onChange={handleInputChange} className="border px-1" />
              <input type="text" name="contactEmail" value={header.contactEmail} onChange={handleInputChange} className="border px-1 flex-grow" />
            </div>
            <div className="text-center">
              <input type="text" name="name" value={header.name} onChange={handleInputChange} className="text-2xl font-bold border text-center" />
            </div>
            <div className="flex flex-col space-y-1 text-right">
              <input type="text" name="linkedin" value={header.linkedin} onChange={handleInputChange} className="border px-1 text-right" />
              <input type="text" name="portfolio" value={header.portfolio} onChange={handleInputChange} className="border px-1 text-right" />
            </div>
          </div>
          <div className="flex flex-col p-4">
            <div className="flex items-center pb-1">
              <div>Date:</div>
              <div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" className="text-left text-md p-2 font-medium">
                      {isValid(date) ? format(date, "PPP") : "Select a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent>
                    <Calendar mode="single" selected={date} onSelect={handleDateChange} />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="py-1 pb-3">Dear Hiring Manager,</div>
            <Editor
              editorState={editorState}
              onChange={setEditorState}
              onBlur={handleSave}
              placeholder="Write your cover letter here..."
            />
            <div className="mt-3">Sincerely,</div>
            <input type="text" name="name" value={header.name} onChange={handleInputChange} className="w-1/5" />
            <input type="text" name="contactPhone" value={header.contactPhone} onChange={handleInputChange} className="w-1/5" />
            <input type="text" name="contactEmail" value={header.contactEmail} onChange={handleInputChange} className="w-1/3" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default CoverLetterEditor;

const Header = ({ title, setCoverLetterTitle, editingTitle, setEditingTitle, autoSave }) => (
  <h1 className="text-3xl font-medium text-[#559F87] mb-4">
    Cover Letter:
    {editingTitle ? (
      <input
        type="text"
        value={title}
        onChange={(e) => setCoverLetterTitle(e.target.value)}
        onBlur={() => { autoSave(); setEditingTitle(false); }}
        className="bg-transparent border-gray-600 ml-2"
        placeholder="Untitled Cover Letter"
      />
    ) : (
      <span onDoubleClick={() => setEditingTitle(true)} className="ml-2 cursor-pointer">
        {title || "Untitled Cover Letter"}
      </span>
    )}
  </h1>
);
