"use client";
import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from "@/hooks/useAuth";

function CommentsCell({ row }) {
    const { supabase } = useAuth();
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(row.getValue("comments") || "");

    const toggleEdit = () => {
        setEditing(!editing);
    };

    const handleChange = (e) => {
        setValue(e.target.value);
    };

    const handleBlur = async () => {
        setEditing(false);
        const newComment = value.trim();
        try {
          const { error } = await supabase
            .from("applications")
            .update({ comments: newComment })
            .eq("id", row.original.id);
          if (error) throw error;
        } catch (error) {
          console.error("Failed to update comment:", error);
        }
    };

    return (
        <div onDoubleClick={toggleEdit}>
            {editing ? (
                <Textarea
                    type="text"
                    value={value}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    autoFocus
                />
            ) : (
                <span onDoubleClick={toggleEdit}>{value || <span className="text-gray-300">No Comment</span>}</span>
            )}
        </div>
    );
}

export default CommentsCell;
