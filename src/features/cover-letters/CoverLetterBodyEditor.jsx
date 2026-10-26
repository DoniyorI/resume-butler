"use client";
import { useEffect, useRef, useState } from "react";
import { ContentState, Editor, EditorState, convertFromRaw, convertToRaw } from "draft-js";
import "draft-js/dist/Draft.css";

function createInitialState({ raw, text }) {
  if (typeof text === "string") {
    return EditorState.createWithContent(ContentState.createFromText(text));
  }
  if (raw) {
    try {
      return EditorState.createWithContent(convertFromRaw(raw));
    } catch {
      // Unreadable saved content: start empty rather than crash the editor
    }
  }
  return EditorState.createEmpty();
}

function report(state, onChange) {
  const content = state.getCurrentContent();
  onChange({ raw: convertToRaw(content), plainText: content.getPlainText("\n") });
}

// Draft.js body of the cover letter, loaded with next/dynamic (client only).
// It starts from `initial` ({ raw } saved content or { text } from the AI
// panel); remount it with a new key to replace the text. onChange receives
// { raw, plainText } on mount and whenever the text changes.
export default function CoverLetterBodyEditor({ initial, onChange }) {
  const [editorState, setEditorState] = useState(() => createInitialState(initial));
  const initialStateRef = useRef(editorState);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Report the starting content once so the parent can save or download it
  useEffect(() => {
    report(initialStateRef.current, onChangeRef.current);
  }, []);

  const handleChange = (nextState) => {
    const contentChanged = nextState.getCurrentContent() !== editorState.getCurrentContent();
    setEditorState(nextState);
    if (contentChanged) report(nextState, onChange);
  };

  return (
    <Editor
      editorState={editorState}
      onChange={handleChange}
      placeholder="Write your cover letter here..."
    />
  );
}
