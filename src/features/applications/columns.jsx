import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { safeHttpUrl } from "@/lib/safeUrl";
import SortableHeader from "@/features/applications/SortableHeader";
import StatusCell from "@/features/applications/StatusCell";
import CommentsCell from "@/features/applications/CommentsCell";
import RowActions from "@/features/applications/RowActions";

// Cells that handle their own clicks, so clicking them doesn't open the detail page
export const INTERACTIVE_COLUMNS = ["select", "status", "comments", "actions"];

function CompanyCell({ row }) {
  const href = safeHttpUrl(row.original.portalLink);
  const name = row.getValue("companyName");
  if (!href) return <span>{name}</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      <Button className="p-0 m-0 font-normal" variant="link">
        {name}
      </Button>
    </a>
  );
}

const sortableHeader = (title) =>
  function Header({ column }) {
    return <SortableHeader column={column} title={title} />;
  };

export const applicationColumns = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "companyName",
    header: sortableHeader("Company Name"),
    cell: CompanyCell,
  },
  {
    accessorKey: "role",
    header: sortableHeader("Role"),
    cell: ({ row }) => <div>{row.getValue("role")}</div>,
  },
  {
    accessorKey: "status",
    header: sortableHeader("Status"),
    cell: StatusCell,
  },
  {
    accessorKey: "location",
    header: sortableHeader("Location"),
    cell: ({ row }) => <div>{row.getValue("location")}</div>,
  },
  {
    accessorKey: "date",
    header: sortableHeader("Date"),
    // Sort on the ISO date, not the displayed "M/D/YYYY" text
    sortingFn: (a, b) => a.original.appliedDate.localeCompare(b.original.appliedDate),
    cell: ({ row }) => <div>{row.getValue("date")}</div>,
  },
  {
    accessorKey: "comments",
    header: sortableHeader("Comments"),
    cell: CommentsCell,
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => <RowActions application={row.original} />,
  },
];
