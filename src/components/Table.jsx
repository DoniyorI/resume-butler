"use client";

import React, { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase/config";
import { onAuthStateChanged } from "firebase/auth";
import { doc, collection, getDocs, updateDoc, deleteDoc} from "firebase/firestore";
import { AiOutlineFilePdf } from "react-icons/ai";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, ChevronDown, MoreHorizontal } from "lucide-react";
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
import AddApplicationDialog from "@/components/AddApplication";
import Link from "next/link";
import { toast } from "sonner";

function ApplicationTable() {
  const [user, setUser] = useState(null);
  const [applications, setApplications] = useState([]);
  const [sorting, setSorting] = useState([]);
  const [columnFilters, setColumnFilters] = useState([]);
  const [columnVisibility, setColumnVisibility] = useState({});
  const [rowSelection, setRowSelection] = useState({});
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setLoading(true);
        setUser(user);
        try {
          const applicationsRef = collection(
            db,
            "users",
            user.uid,
            "applications"
          );
          const querySnapshot = await getDocs(applicationsRef);
          const loadedApplications = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            date: doc.data().date.toDate().toISOString().slice(0, 10), // Format Firestore Timestamp to Date String
          }));
          setApplications(loadedApplications);
          console.log("Applications loaded:", loadedApplications);
        } catch (error) {
          console.error("Error fetching applications:", error);
        } finally {
          setLoading(false);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const columns = [
    {
      accessorKey: "resume", 
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Resume
          <ArrowUpDown className="ml-2 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="flex justify-start mx-10">
          {row.getValue("resume") && ( 
            <a
              href={row.getValue("resume")}
              target="_blank" // Open in a new tab
              rel="noopener noreferrer"
              className="text-red-700 "
            >
              <AiOutlineFilePdf className="mx-auto" size={20} />
            </a>
          )}
        </div>
      ),
    },
    {
      accessorKey: "coverLetter", 
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Cover Letter
          <ArrowUpDown className="ml-2 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="flex justify-start mx-10">
          {row.getValue("coverLetter") && (
            <a
              href={row.getValue("coverLetter")}
              target="_blank" // Open in a new tab
              rel="noopener noreferrer"
              className="text-green-700"
            >
              <AiOutlineFilePdf className="mx-auto" size={20} />
            </a>
          )}
        </div>
      ),
    },
    {
      accessorKey: "companyName",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Company Name
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        );
      },
      cell: ({ row }) => <div className="">{row.getValue("companyName")}</div>,
    },
    {
      accessorKey: "role",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Role
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        );
      },
      cell: ({ row }) => <div className="">{row.getValue("role")}</div>,
    },
    {
      accessorKey: "status",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Status
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const [value, setValue] = useState(row.getValue("status"));
        const handleChange = (newStatus) => {
          updateStatus(row.original.id, newStatus); // Update the status in the database
          setValue(newStatus);
        };
        return (
          <div className="flex justify-start">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="outline-none select-none -ml-3">
                <Badge variant={value.toLowerCase()}>{value}</Badge>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="text-sm">
              {[
                "Applied",
                "Interviewed",
                "Pending",
                "Rejected",
                "Offered",
                "Withdrew",
              ].map((status) => (
                <DropdownMenuItem
                  key={status}
                  onClick={() => handleChange(status)}
                  className="text-xs cursor-pointer"
                >
                  <Badge variant={status.toLowerCase()}>{status}</Badge>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        );
      },
    },
    {
      accessorKey: "location",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Location
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        );
      },
      cell: ({ row }) => <div className="">{row.getValue("location")}</div>,
    },
    {
      accessorKey: "date",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Date
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        );
      },
      cell: ({ row }) => <div className="">{row.getValue("date")}</div>,
    },
    {
      accessorKey: "comments",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Comments
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const [editing, setEditing] = useState(false);
        const [value, setValue] = useState(row.getValue("comments"));
  
        const toggleEdit = () => {
          setEditing(!editing);
        };
  
        const handleChange = (e) => {
          setValue(e.target.value);
        };
  
        const handleBlur = () => {
          updateComment(row.original.id, value); // Update the comment in the database
          setEditing(false);
        };
  
        return (
          <div onDoubleClick={toggleEdit}>
            {editing ? (
              <Input
                type="text"
                value={value}
                onChange={handleChange}
                onBlur={handleBlur}
                autoFocus
              />
            ) : (
              <span>{value}</span>
            )}
          </div>
        );
      },
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => {
        const application = row.original;

        const handleDelete = async () => {
          try {
            console.log(user.uid, application.id)
            const docRef = doc(db, "users", user.uid, "applications", application.id);
            await deleteDoc(docRef);
            alert("Application deleted successfully!"); // Notify the user of success
          } catch (error) {
            console.error("Error deleting application:", error);
            alert("Failed to delete application."); // Notify the user of failure
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
              <DropdownMenuItem>
                <Link href={`/applications/${application.id}`}>
                  View application details
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <button className="text-red-500" onClick={handleDelete}>
                  Delete
                </button>
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


const updateStatus = async (id, newStatus) => {
  console.log(`Changing status for ID ${id} to ${newStatus}`);
  const applicationRef = doc(db, "users", user.uid, "applications", id);
  try {
    await updateDoc(applicationRef, {
      status: newStatus
    });
    console.log(`Status updated to ${newStatus} for ID ${id}`);
  } catch (error) {
    console.error("Failed to update status:", error);
  }
};


const updateComment = async (id, newComment) => {
  console.log(`Updating comment for ID ${id} to ${newComment}`);
  const applicationRef = doc(db, "users", user.uid, "applications", id);
  try {
    await updateDoc(applicationRef, {
      comments: newComment
    });
    console.log(`Comment updated to "${newComment}" for ID ${id}`);
  } catch (error) {
    console.error("Failed to update comment:", error);
  }
};


  if (loading) {
    return <div>Loading applications...</div>; // Loading state
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
              Columns <ChevronDown className="ml-2 h-4 w-4" />
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
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
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

      <div className="flex items-center justify-end space-x-2 py-4 mx-4">
        <div>
          <AddApplicationDialog />
        </div>
        {/* <div className="space-x-2 ">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div> */}
      </div>
    </div>
  );
}

export default ApplicationTable;
