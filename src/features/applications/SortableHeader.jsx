import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";

// Column header that sorts the list by a database field through the URL.
// Clicking the active column flips its direction; dates start newest first.
export default function SortableHeader({ title, field, sort, onSort }) {
  const active = sort.field === field;
  const Icon = !active ? ChevronsUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;

  const handleClick = () => {
    if (active) onSort({ field, dir: sort.dir === "asc" ? "desc" : "asc" });
    else onSort({ field, dir: field === "applied_date" ? "desc" : "asc" });
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      className={`-ml-1.5 h-7 px-1.5 text-xs font-medium ${active ? "text-foreground" : ""}`}
    >
      {title}
      <Icon className={`ml-1 h-3 w-3 ${active ? "" : "opacity-40"}`} />
    </Button>
  );
}
