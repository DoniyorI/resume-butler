import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";

// Column header that toggles ascending/descending sort on click
export default function SortableHeader({ column, title }) {
  return (
    <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
      {title}
      <ArrowUpDown className="ml-2 h-3 w-3" />
    </Button>
  );
}
