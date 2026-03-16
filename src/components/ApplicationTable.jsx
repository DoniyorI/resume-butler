"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, MoreHorizontal, ListFilter, Trash2, Copy, FileDown, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

import StatusCell from "@/components/StatusCell";
import CommentsCell from "@/components/CommentsCell";

const PAGE_SIZE = 50;
const STATUSES = ["Applied", "Interviewed", "Pending", "Offered", "Rejected", "Withdrew"];

function ApplicationTable() {
  const { user, supabase } = useAuth({ redirect: true });
  const router = useRouter();
  const [applications, setApplications] = useState([]);
  const [sorting, setSorting] = useState([]);
  const [columnFilters, setColumnFilters] = useState([]);
  const [columnVisibility, setColumnVisibility] = useState({});
  const [rowSelection, setRowSelection] = useState({});
  const [loading, setLoading] = useState(true);
  const [totalApplications, setTotalApplications] = useState(0);
  const [page, setPage] = useState(0);

  useEffect(() => {
    const handleNewApplication = (event) => {
      const newApp = event.detail;
      setApplications((prev) => [...prev, newApp]);
    };

    window.addEventListener("newApplication", handleNewApplication);
    return () => window.removeEventListener("newApplication", handleNewApplication);
  }, []);

  useEffect(() => {
    if (!user) return;

    const fetchApplications = async () => {
      setLoading(true);
      try {
        const { count } = await supabase
          .from("applications")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id);
        setTotalApplications(count || 0);

        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        const { data, error } = await supabase
          .from("applications")
          .select("*")
          .eq("user_id", user.id)
          .order("applied_date", { ascending: false })
          .range(from, to);

        if (error) throw error;

        const formatted = (data || []).map((app) => ({
          id: app.id,
          companyName: app.company,
          role: app.role,
          status: app.status,
          location: app.location,
          date: app.applied_date
            ? new Date(app.applied_date).toLocaleDateString("en-US")
            : "",
          comments: app.comments,
          portalLink: app.portal_link,
        }));

        setApplications(formatted);
      } catch (error) {
        console.error("Error fetching applications:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchApplications();
  }, [user, supabase, page]);

  // --- Bulk actions ---
  const selectedRows = Object.keys(rowSelection)
    .filter((key) => rowSelection[key])
    .map((key) => {
      const row = table?.getRowModel()?.rows?.[parseInt(key)];
      return row?.original;
    })
    .filter(Boolean);

  const handleBulkStatusUpdate = async (newStatus) => {
    const ids = selectedRows.map((r) => r.id);
    if (ids.length === 0) return;

    try {
      const { error } = await supabase
        .from("applications")
        .update({ status: newStatus })
        .in("id", ids);
      if (error) throw error;

      setApplications((prev) =>
        prev.map((app) =>
          ids.includes(app.id) ? { ...app, status: newStatus } : app
        )
      );
      setRowSelection({});
      toast(`Updated ${ids.length} applications to ${newStatus}`);
    } catch (error) {
      console.error("Bulk update error:", error);
      toast("Failed to update applications");
    }
  };

  const handleBulkDelete = async () => {
    const ids = selectedRows.map((r) => r.id);
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} applications?`)) return;

    try {
      const { error } = await supabase
        .from("applications")
        .delete()
        .in("id", ids);
      if (error) throw error;

      setApplications((prev) => prev.filter((app) => !ids.includes(app.id)));
      setTotalApplications((prev) => prev - ids.length);
      setRowSelection({});
      toast(`Deleted ${ids.length} applications`);
    } catch (error) {
      console.error("Bulk delete error:", error);
      toast("Failed to delete applications");
    }
  };

  // --- Duplicate ---
  const handleDuplicate = async (application) => {
    try {
      const { data, error } = await supabase
        .from("applications")
        .insert({
          user_id: user.id,
          company: application.companyName,
          role: application.role,
          status: "Applied",
          location: application.location,
          portal_link: application.portalLink,
          comments: application.comments,
          applied_date: new Date().toISOString().split("T")[0],
        })
        .select()
        .single();

      if (error) throw error;

      setApplications((prev) => [
        {
          id: data.id,
          companyName: data.company,
          role: data.role,
          status: data.status,
          location: data.location,
          date: new Date(data.applied_date).toLocaleDateString("en-US"),
          comments: data.comments,
          portalLink: data.portal_link,
        },
        ...prev,
      ]);
      setTotalApplications((prev) => prev + 1);
      toast("Application duplicated");
    } catch (error) {
      console.error("Duplicate error:", error);
      toast("Failed to duplicate application");
    }
  };

  // --- Export CSV ---
  const handleExportCSV = () => {
    const headers = ["Company", "Role", "Status", "Location", "Date", "Comments", "Portal Link"];
    const rows = applications.map((app) => [
      app.companyName,
      app.role,
      app.status,
      app.location,
      app.date,
      (app.comments || "").replace(/,/g, ";").replace(/\n/g, " "),
      app.portalLink,
    ]);

    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v || ""}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `applications_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast("Exported to CSV");
  };

  const columns = [
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
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Company Name
          <ArrowUpDown className="ml-2 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) =>
        row.original.portalLink ? (
          <a href={row.original.portalLink} target="_blank" rel="noopener noreferrer">
            <Button className="p-0 m-0 font-normal" variant="link">
              {row.getValue("companyName")}
            </Button>
          </a>
        ) : (
          <span>{row.getValue("companyName")}</span>
        ),
    },
    {
      accessorKey: "role",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Role
          <ArrowUpDown className="ml-2 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => <div>{row.getValue("role")}</div>,
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Status
          <ArrowUpDown className="ml-2 h-3 w-3" />
        </Button>
      ),
      cell: StatusCell,
    },
    {
      accessorKey: "location",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Location
          <ArrowUpDown className="ml-2 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => <div>{row.getValue("location")}</div>,
    },
    {
      accessorKey: "date",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Date
          <ArrowUpDown className="ml-2 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => <div>{row.getValue("date")}</div>,
    },
    {
      accessorKey: "comments",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Comments
          <ArrowUpDown className="ml-2 h-3 w-3" />
        </Button>
      ),
      cell: CommentsCell,
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => {
        const application = row.original;
        const handleDelete = async () => {
          try {
            const { error } = await supabase
              .from("applications")
              .delete()
              .eq("id", application.id);
            if (error) throw error;
            setApplications((current) =>
              current.filter((app) => app.id !== application.id)
            );
            setTotalApplications((prev) => prev - 1);
            toast("Application deleted");
          } catch (error) {
            console.error("Error deleting application:", error);
            toast("Failed to delete application");
          }
        };
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleDuplicate(application)}>
                <Copy size={14} className="mr-2" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleDelete} className="text-red-600">
                <Trash2 size={14} className="mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const table = useReactTable({
    data: applications,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });

  if (loading) {
    return (
      <div className="mx-4">
        <div className="flex justify-between">
          <Skeleton className="mt-4 w-1/4 h-[40px]" />
          <Skeleton className="mt-4 w-[90px] h-[40px]" />
        </div>
        <Skeleton className="mt-4 w-full h-[400px]" />
        <div className="flex justify-between items-center">
          <Skeleton className="mt-4 w-2/12 h-[15px]" />
          <div className="flex space-x-2">
            <Skeleton className="mt-4 w-[80px] h-[35px]" />
            <Skeleton className="mt-4 w-[60px] h-[35px]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="">
      {/* Toolbar */}
      <div className="flex items-center justify-between py-4 mx-4 gap-2">
        <Input
          placeholder="Filter by company name"
          value={table.getColumn("companyName")?.getFilterValue() || ""}
          onChange={(event) =>
            table.getColumn("companyName")?.setFilterValue(event.target.value)
          }
          className="max-w-sm"
        />
        <div className="flex items-center gap-2">
          {/* Bulk actions — visible when rows selected */}
          {selectedRows.length > 0 && (
            <>
              <span className="text-xs text-gray-500">{selectedRows.length} selected</span>
              <Select onValueChange={handleBulkStatusUpdate}>
                <SelectTrigger className="w-[140px] h-9 text-xs">
                  <SelectValue placeholder="Set status..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        <Badge variant={s.toLowerCase()}>{s}</Badge>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="text-red-600 h-9" onClick={handleBulkDelete}>
                <Trash2 size={14} className="mr-1" /> Delete
              </Button>
            </>
          )}

          {/* Export CSV */}
          <Button variant="outline" size="sm" className="h-9" onClick={handleExportCSV}>
            <FileDown size={14} className="mr-1" /> CSV
          </Button>

          {/* Column filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <ListFilter className="mr-1 h-4 w-4" /> Filter
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border mx-4">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer hover:bg-gray-50"
                  data-state={row.getIsSelected() && "selected"}
                  onClick={() => router.push(`/applications/${row.original.id}`)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      onClick={(e) => {
                        if (["select", "status", "comments", "actions"].includes(cell.column.id)) {
                          e.stopPropagation();
                        }
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between space-x-2 py-4 mx-4">
        <div className="text-xs text-muted-foreground">
          Showing{" "}
          <strong>
            {applications.length
              ? `${page * PAGE_SIZE + 1}-${page * PAGE_SIZE + applications.length}`
              : "No"}
          </strong>{" "}
          of <strong>{totalApplications}</strong> applications
        </div>

        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p - 1)}
            disabled={page === 0}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={applications.length < PAGE_SIZE}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ApplicationTable;
