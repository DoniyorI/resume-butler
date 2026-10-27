"use client";
import { useRef } from "react";
import { toast } from "sonner";

// "Resume: <title>" / "Cover Letter: <title>" heading with an inline title
// input. The title is saved on blur (or Enter) through `saveTitle`, a Server
// Action that returns { ok, error }. An empty title reverts to the saved one.
export function EditableTitleHeader({ label, title, onTitleChange, saveTitle, placeholder }) {
  const savedTitleRef = useRef(title);

  const handleBlur = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      onTitleChange(savedTitleRef.current);
      return;
    }
    if (trimmed === savedTitleRef.current) return;

    const result = await saveTitle(trimmed).catch(() => ({ ok: false, error: "Failed to update title" }));
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    savedTitleRef.current = trimmed;
    toast("Title Updated Successfully", {
      action: { label: "OK", onClick: () => toast.dismiss() },
    });
  };

  return (
    <h1 className="text-3xl font-medium text-brand cursor-default">
      {label}:
      <input
        type="text"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        maxLength={200}
        className="bg-transparent ml-2"
        placeholder={placeholder}
      />
    </h1>
  );
}
