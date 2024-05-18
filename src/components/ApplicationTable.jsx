"use client";

import React, { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase/config";
import { onAuthStateChanged } from "firebase/auth";
import { Skeleton } from "@/components/ui/skeleton";
import {
  doc,
  collection,
  getDocs,
  deleteDoc,
  query,
  startAt,
  orderBy,
  startAfter,
  limit,
  where,
} from "firebase/firestore";
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
import { Textarea } from "@/components/ui/textarea";
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

function ApplicationTable() {
  const [user, setUser] = useState(null);
  const [applications, setApplications] = useState([]);
  const [sorting, setSorting] = useState([]);
  const [columnFilters, setColumnFilters] = useState([]);
  const [columnVisibility, setColumnVisibility] = useState({});
  const [rowSelection, setRowSelection] = useState({});
  const [loading, setLoading] = useState(true);
  const [lastVisible, setLastVisible] = useState(null);
  const [firstVisible, setFirstVisible] = useState(null);
  const [cursorHistory, setCursorHistory] = useState([]);
  const [totalApplications, setTotalApplications] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const handleNewApplication = (event) => {
      const newApp = event.detail;
      setApplications((prevApplications) => [...prevApplications, newApp]);
    };

    window.addEventListener("newApplication", handleNewApplication);

    // Clean up the event listener
    return () => {
      window.removeEventListener("newApplication", handleNewApplication);
    };
  }, []);

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
          let queryConfig = query(applicationsRef, orderBy("date"), limit(50));
          if (searchTerm) {
            queryConfig = query(
              applicationsRef,
              orderBy("companyName"),
              where("companyName", ">=", searchTerm),
              where("companyName", "<=", searchTerm + "\uf8ff")
            );
          }

          const querySnapshot = await getDocs(queryConfig);
          const loadedApplications = querySnapshot.docs.map((doc) => {
            const rawData = doc.data();
            const date = new Date(rawData.date); // Parse the date from the Firestore data
            const formattedDate = date.toLocaleDateString("en-US"); // Format the date as MM/DD/YYYY

            return {
              id: doc.id,
              ...rawData,
              date: formattedDate,
            };
          });

          setApplications(loadedApplications);
          setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1]); // Save the last document for next page navigation
          setFirstVisible(querySnapshot.docs[0]); // Save the first document for previous page navigation
          setCursorHistory([querySnapshot.docs[0]]); // Initialize cursor history
          const totalCountQuery = query(applicationsRef);
          const totalCountSnapshot = await getDocs(totalCountQuery);
          setTotalApplications(totalCountSnapshot.size);
        } catch (error) {
          console.error("Error fetching applications:", error);
        } finally {
          setLoading(false);
        }
      }
    });
    return () => {
      unsubscribe();
    };
  }, [searchTerm]);

  const nextPage = async () => {
    if (!lastVisible) return;

    setLoading(true);

    const applicationsRef = collection(db, "users", user.uid, "applications");
    const queryConfig = query(
      applicationsRef,
      orderBy("date"),
      startAfter(lastVisible),
      limit(50)
    );

    const querySnapshot = await getDocs(queryConfig);

    const loadedApplications = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      date: doc.data().date.toDate().toISOString().slice(0, 50),
    }));

    setApplications(loadedApplications);
    setCursorHistory([...cursorHistory, querySnapshot.docs[0]]); // Add new cursor to history
    setFirstVisible(querySnapshot.docs[0]); // Update first visible cursor
    setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1]); // Update last visible cursor

    setLoading(false);
  };
  const previousPage = async () => {
    if (cursorHistory.length < 2) return; // No previous page

    setLoading(true);

    const prevCursor = cursorHistory[cursorHistory.length - 2];
    const applicationsRef = collection(db, "users", user.uid, "applications");
    const queryConfig = query(
      applicationsRef,
      orderBy("date"),
      startAt(prevCursor),
      limit(50)
    );

    const querySnapshot = await getDocs(queryConfig);

    const loadedApplications = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      date: doc.data().date.toDate().toISOString().slice(0, 50),
    }));

    setApplications(loadedApplications);
    setCursorHistory(cursorHistory.slice(0, cursorHistory.length - 1));
    setFirstVisible(querySnapshot.docs[0]); // First visible cursor
    setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1]); // Last visible cursor
    setLoading(false);
  };

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
            >
              {row.original.resumeType === "pdf" ? (
                <AiOutlineFilePdf className="mx-auto text-red-700" size={20} />
              ) : (
                <AiOutlineFileText
                  className="mx-auto text-blue-700"
                  size={20}
                />
              )}
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
            >
              {row.original.coverLetterType === "pdf" ? (
                <AiOutlineFilePdf className="mx-auto text-red-500" size={20} />
              ) : (
                <AiOutlineFileText
                  className="mx-auto text-blue-500"
                  size={20}
                />
              )}
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
        ), // Using <span> for consistent HTML element usage
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
            const docRef = doc(
              db,
              "users",
              user.uid,
              "applications",
              application.id
            );
            await deleteDoc(docRef);
            setApplications((currentApplications) =>
              currentApplications.filter((app) => app.id !== application.id)
            );
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
              {/* <DropdownMenuItem>
                <Link href={`/${application.id}`}>
                  View application details
                </Link>
              </DropdownMenuItem> */}
              <DropdownMenuItem onClick={handleDelete}>
                <Button
                  variant="ghost"
                  className="text-red-700 hover:text-red-500 py-1 px-2 h-8 flex items-center justify-center" // Adjusted padding and height
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

      <div className="flex items-center justify-between space-x-2 py-4 mx-4">
        <div className="text-xs text-muted-foreground">
          Showing{" "}
          <strong>
            {applications.length ? `${1}-${applications.length}` : "No"}
          </strong>{" "}
          of <strong>{totalApplications}</strong> applications
        </div>

        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => previousPage()}
            disabled={cursorHistory.length < 2}
          >
            Previous
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => nextPage()}
            disabled={applications.length < 50}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ApplicationTable;
