"use client";

import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { updateApplicationComments } from "@/features/applications/actions";

// Double-click to edit; saves on blur
export default function CommentsCell({ row }) {
  const saved = row.getValue("comments") || "";
  const [comments, setOptimisticComments] = useOptimistic(saved);
  const [draft, setDraft] = useState(null);
  const [, startTransition] = useTransition();

  const startEditing = () => setDraft(comments);

  const handleBlur = () => {
    const newComments = draft.trim();
    setDraft(null);
    if (newComments === saved) return;

    startTransition(async () => {
      setOptimisticComments(newComments);
      const result = await updateApplicationComments(row.original.id, newComments);
      if (!result.ok) toast.error(result.error);
    });
  };

  if (draft !== null) {
    return (
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleBlur}
        className="min-h-[60px] text-xs"
        autoFocus
      />
    );
  }

  return (
    <div
      onDoubleClick={startEditing}
      className="max-w-[360px] cursor-text truncate rounded px-2 py-1 hover:bg-muted"
      title={comments ? `${comments}\n\nDouble-click to edit` : "Double-click to add a comment"}
    >
      {comments || <span className="text-muted-foreground/50">Add a comment</span>}
    </div>
  );
}
