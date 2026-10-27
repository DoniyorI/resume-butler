"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";
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
          <Button
            variant="ghost"
            size="sm"
            className="group -ml-1.5 h-7 select-none gap-0.5 px-1.5 outline-none"
            aria-label={`Status: ${status}. Change status`}
          >
            <Badge variant={status.toLowerCase()} className="whitespace-nowrap px-2 py-0">
              {status}
            </Badge>
            <ChevronDown className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-data-[state=open]:opacity-100" />
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
