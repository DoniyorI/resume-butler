"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Copy, MoreHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteApplications, duplicateApplication } from "@/features/applications/actions";

export default function RowActions({ application }) {
  const [isPending, startTransition] = useTransition();

  const handleDuplicate = () =>
    startTransition(async () => {
      const result = await duplicateApplication(application.id);
      if (result.ok) toast("Application duplicated");
      else toast.error(result.error);
    });

  const handleDelete = () =>
    startTransition(async () => {
      const result = await deleteApplications([application.id]);
      if (result.ok) toast("Application deleted");
      else toast.error(result.error);
    });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-7 w-7 p-0" disabled={isPending}>
          <span className="sr-only">Open menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleDuplicate}>
          <Copy size={14} className="mr-2" /> Duplicate
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleDelete} className="text-red-600">
          <Trash2 size={14} className="mr-2" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
