"use client";
import React, { useState, useEffect } from "react";
import { Editor, EditorState, convertToRaw, convertFromRaw } from "draft-js";
import "draft-js/dist/Draft.css";
import { useAuth } from "@/hooks/useAuth";

function CoverLetterEditor({
  coverLetterId,
  coverLetterTitle,
  header,
  content,
  setCoverLetterTitle,
  setHeader,
  setContent,
}) {
  const { user, supabase } = useAuth();
  const [editorState, setEditorState] = useState(() => {
    try {
      return content
        ? EditorState.createWithContent(convertFromRaw(content))
        : EditorState.createEmpty();
    } catch (error) {
      console.error("Error initializing editor state:", error);
      return EditorState.createEmpty();
    }
  });

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
        },
      })
      .eq("id", coverLetterId);

    if (error) {
      console.error("Error saving cover letter:", error);
    }
  };

  return (
    <div className="border p-2">
      <Editor
        editorState={editorState}
        onChange={setEditorState}
        placeholder="Write your cover letter here..."
      />
      <button
        onClick={handleSave}
        className="mt-2 px-4 py-2 bg-blue-500 text-white"
      >
        Save
      </button>
    </div>
  );
}

export default CoverLetterEditor;
