"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { APPLICATION_STATUSES } from "@/lib/constants";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { updateApplicationStatus } from "@/features/applications/actions";

export default function StatusCell({ row }) {
  const [status, setOptimisticStatus] = useOptimistic(row.getValue("status"));
  const [, startTransition] = useTransition();

  const handleChange = (newStatus) => {
    startTransition(async () => {
      setOptimisticStatus(newStatus);
      const result = await updateApplicationStatus(row.original.id, newStatus);
      if (!result.ok) toast.error(result.error);
    });
  };

  return (
    <div className="flex justify-start">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="outline-none select-none -ml-3">
            <Badge variant={status.toLowerCase()}>{status}</Badge>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="text-sm">
          {APPLICATION_STATUSES.map((option) => (
            <DropdownMenuItem
              key={option}
              onClick={() => handleChange(option)}
              className="text-xs cursor-pointer"
            >
              <Badge variant={option.toLowerCase()}>{option}</Badge>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
