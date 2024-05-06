"use client";
import { useState, useEffect } from 'react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { doc, updateDoc } from "firebase/firestore";
import { db, user } from "@/lib/firebase/config";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
function StatusCell({ row }) {
    const [user, setUser] = useState(null); 
    const [value, setValue] = useState(row.getValue("status"));
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
    const handleChange = (newStatus) => {
        updateStatus(row.original.id, newStatus); 
        setValue(newStatus);
    };

    const updateStatus = async (id, newStatus) => {
        console.log(`Changing status for ID ${id} to ${newStatus}`);
        const applicationRef = doc(db, "users", user.uid, "applications", id);
        try {
          await updateDoc(applicationRef, {
            status: newStatus,
          });
          console.log(`Status updated to ${newStatus} for ID ${id}`);
        } catch (error) {
          console.error("Failed to update status:", error);
        }
      };
    return (
        <div className="flex justify-start">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="outline-none select-none -ml-3">
                        <Badge variant={value.toLowerCase()}>{value}</Badge>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="text-sm">
                    {["Applied", "Interviewed", "Pending", "Rejected", "Offered", "Withdrew"].map((status) => (
                        <DropdownMenuItem key={status} onClick={() => handleChange(status)} className="text-xs cursor-pointer">
                            <Badge variant={status.toLowerCase()}>{status}</Badge>
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}

export default StatusCell;