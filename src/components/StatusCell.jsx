"use client";
import { useState } from 'react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from "@/hooks/useAuth";

function StatusCell({ row }) {
    const { supabase } = useAuth();
    const [value, setValue] = useState(row.getValue("status"));

    const handleChange = async (newStatus) => {
        setValue(newStatus);
        try {
          const { error } = await supabase
            .from("applications")
            .update({ status: newStatus })
            .eq("id", row.original.id);
          if (error) throw error;
        } catch (error) {
          console.error("Failed to update status:", error);
          setValue(value); // revert on error
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
