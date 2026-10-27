import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { safeHttpUrl } from "@/lib/safeUrl";
import SortableHeader from "@/features/applications/SortableHeader";
import StatusCell from "@/features/applications/StatusCell";
import CommentsCell from "@/features/applications/CommentsCell";
import RowActions from "@/features/applications/RowActions";

// Cells that handle their own clicks, so clicking them doesn't open the detail page
export const INTERACTIVE_COLUMNS = ["select", "status", "comments", "actions"];

const stopRowClick = (event) => event.stopPropagation();

// One line of text, cut off with an ellipsis; the full value shows on hover
function TruncatedText({ value, className = "max-w-[220px]" }) {
  if (!value) return <span className="text-muted-foreground/50">-</span>;
  return (
    <div className={`truncate ${className}`} title={value}>
      {value}
    </div>
  );
}

// A real link to the detail page (so it opens in a new tab too) plus the job portal, if any
function CompanyCell({ row }) {
  const { id, companyName, portalLink } = row.original;
  const href = safeHttpUrl(portalLink);
  return (
    <div className="flex max-w-[240px] items-center gap-1.5">
      <Link
        href={`/applications/${id}`}
        onClick={stopRowClick}
        className="truncate font-medium hover:underline"
        title={companyName}
      >
        {companyName}
      </Link>
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={stopRowClick}
          className="shrink-0 text-muted-foreground hover:text-brand"
          aria-label={`Open the ${companyName} job posting`}
          title="Open job posting"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}

// Headers read the URL sort from the table's meta (see useApplicationsTable)
const sortableHeader = (title, field) =>
  function Header({ table }) {
    const { sort, onSort } = table.options.meta;
    return <SortableHeader title={title} field={field} sort={sort} onSort={onSort} />;
  };

// meta.label names the column in the Columns menu; meta.className sizes its cells
export const applicationColumns = [
  {
    id: "select",
    // A flex box centers the checkbox on the row; inline it sits on the text baseline
    header: ({ table }) => (
      <div className="flex items-center">
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      </div>
    ),
    enableHiding: false,
    meta: { className: "w-8" },
  },
  {
    accessorKey: "companyName",
    header: sortableHeader("Company", "company"),
    cell: CompanyCell,
    meta: { label: "Company" },
  },
  {
    accessorKey: "role",
    header: sortableHeader("Role", "role"),
    cell: ({ row }) => <TruncatedText value={row.original.role} className="max-w-[260px]" />,
    meta: { label: "Role" },
  },
  {
    accessorKey: "status",
    header: sortableHeader("Status", "status"),
    cell: StatusCell,
    meta: { label: "Status" },
  },
  {
    accessorKey: "location",
    header: sortableHeader("Location", "location"),
    cell: ({ row }) => <TruncatedText value={row.original.location} className="max-w-[180px]" />,
    meta: { label: "Location" },
  },
  {
    accessorKey: "date",
    header: sortableHeader("Applied", "applied_date"),
    cell: ({ row }) => (
      <span className="whitespace-nowrap tabular-nums text-muted-foreground">{row.original.date || "-"}</span>
    ),
    meta: { label: "Applied" },
  },
  {
    accessorKey: "comments",
    header: () => <span className="px-2">Comments</span>,
    cell: CommentsCell,
    meta: { label: "Comments", className: "w-full min-w-[200px]" },
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => <RowActions application={row.original} />,
    meta: { className: "w-10" },
  },
];
