"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { AiOutlineFilePdf, AiOutlineFileText } from "react-icons/ai";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, MoreHorizontal, ListFilter, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
        // Get total count
        const { count } = await supabase
          .from("applications")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id);
        setTotalApplications(count || 0);

        // Get page of applications
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
          resume: app.resume_id,
          coverLetter: app.cover_letter_id,
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

  const columns = [
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
          <a
            href={row.original.portalLink}
            target="_blank"
            rel="noopener noreferrer"
          >
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
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Role
          <ArrowUpDown className="ml-2 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => <div>{row.getValue("role")}</div>,
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Status
          <ArrowUpDown className="ml-2 h-3 w-3" />
        </Button>
      ),
      cell: StatusCell,
    },
    {
      accessorKey: "location",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Location
          <ArrowUpDown className="ml-2 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => <div>{row.getValue("location")}</div>,
    },
    {
      accessorKey: "date",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Date
          <ArrowUpDown className="ml-2 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => <div>{row.getValue("date")}</div>,
    },
    {
      accessorKey: "comments",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
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
            toast("Application deleted successfully!");
          } catch (error) {
            console.error("Error deleting application:", error);
            toast("Failed to delete application.");
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
              <DropdownMenuItem onClick={handleDelete}>
                <Button
                  variant="ghost"
                  className="text-red-700 hover:text-red-500 py-1 px-2 h-8 flex items-center justify-center"
                >
                  <Trash2 className="mr-1" size={15} />
                  <span>Delete</span>
                </Button>
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
      <div className="flex items-center py-4 mx-4">
        <Input
          placeholder="Filter by company name"
          value={table.getColumn("companyName")?.getFilterValue() || ""}
          onChange={(event) =>
            table.getColumn("companyName")?.setFilterValue(event.target.value)
          }
          className="max-w-sm"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="ml-auto ">
              <ListFilter className="mr-2 h-4 w-4" /> Filter
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
      <div className="rounded-md border mx-4">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
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
                  onClick={() => router.push(`/applications/${row.original.id}`)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      onClick={(e) => {
                        // Don't navigate when clicking interactive cells
                        if (["status", "comments", "actions"].includes(cell.column.id)) {
                          e.stopPropagation();
                        }
                      }}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

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
