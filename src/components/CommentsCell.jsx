"use client";
import { useState, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/config";

function CommentsCell({ row }) {
    const [user, setUser] = useState(null);
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(row.getValue("comments") || "");
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
          if (user) {
            setUser(user);
          } else {
            router.push("/login");
          }
        });
        return () => unsubscribe();
      }, []);
    const toggleEdit = () => {
        setEditing(!editing);
    };

    const handleChange = (e) => {
        setValue(e.target.value);
    };

    const handleBlur = () => {
        updateComment(row.original.id, value.trim()); // Update the comment in the database
        setEditing(false);
    };

    const updateComment = async (id, newComment) => {
        console.log(`Updating comment for ID ${id} to ${newComment}`);
        const applicationRef = doc(db, "users", user.uid, "applications", id);
        try {
          await updateDoc(applicationRef, {
            comments: newComment,
          });
          console.log(`Comment updated to "${newComment}" for ID ${id}`);
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