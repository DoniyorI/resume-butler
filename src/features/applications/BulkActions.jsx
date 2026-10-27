"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { APPLICATION_STATUSES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { bulkUpdateApplicationStatus, deleteApplications } from "@/features/applications/actions";

// Status change and delete for the selected rows; onDone clears the selection
export default function BulkActions({ ids, onDone }) {
  const [isPending, startTransition] = useTransition();

  const handleStatus = (status) =>
    startTransition(async () => {
      const result = await bulkUpdateApplicationStatus(ids, status);
      if (!result.ok) return toast.error(result.error);
      onDone();
      toast(`Updated ${result.data.count} applications to ${status}`);
    });

  const handleDelete = () => {
    if (!confirm(`Delete ${ids.length} applications?`)) return;
    startTransition(async () => {
      const result = await deleteApplications(ids);
      if (!result.ok) return toast.error(result.error);
      onDone();
      toast(`Deleted ${result.data.count} applications`);
    });
  };

  return (
    <>
      <span className="text-xs tabular-nums text-muted-foreground">{ids.length} selected</span>
      <Select value="" onValueChange={handleStatus} disabled={isPending}>
        <SelectTrigger className="h-8 w-[130px] text-xs">
          <SelectValue placeholder="Set status..." />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {APPLICATION_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                <Badge variant={status.toLowerCase()}>{status}</Badge>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="sm"
        className="h-8 text-red-600"
        onClick={handleDelete}
        disabled={isPending}
      >
        <Trash2 size={14} className="mr-1" /> Delete
      </Button>
    </>
  );
}
