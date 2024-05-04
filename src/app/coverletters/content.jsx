"use client";
// CoverLetterEditor.jsx
import React, { useState, useEffect } from "react";
import { Editor, EditorState, convertToRaw, convertFromRaw } from "draft-js";
import "draft-js/dist/Draft.css";
import { auth, db } from "@/lib/firebase/config";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useAuthState } from "react-firebase-hooks/auth";

function CoverLetterEditor({
  coverLetterId,
  coverLetterTitle,
  header,
  content,
  setCoverLetterTitle,
  setHeader,
  setContent,
}) {
  const [user, loading, error] = useAuthState(auth);
  const [editorState, setEditorState] = useState(() => {
    try {
      // Convert from raw content if available
      return content
        ? EditorState.createWithContent(convertFromRaw(content))
        : EditorState.createEmpty();
    } catch (error) {
      console.error("Error initializing editor state:", error);
      return EditorState.createEmpty(); // Fallback to an empty state
    }
  });

  const handleSave = async () => {
    const contentState = editorState.getCurrentContent();
    const rawContent = convertToRaw(contentState);

    const coverLetterRef = doc(
      db,
      `users/${user.uid}/coverletters`,
      coverLetterId
    );

    await setDoc(
      coverLetterRef,
      {
        title: coverLetterTitle,
        content: rawContent,
        header: header,
      },
      { merge: true }
    );

    console.log("Cover letter saved");
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
