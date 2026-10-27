import { useState } from "react";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { applicationColumns } from "@/features/applications/columns";

// Column visibility and row selection for one server-loaded page. Filtering,
// sorting and paging happen on the server from the URL; sort and onSort are
// handed to the headers through the table meta.
// Rows are keyed by application id so a selection survives data refreshes.
export function useApplicationsTable(applications, { sort, onSort }) {
  const [columnVisibility, setColumnVisibility] = useState({});
  const [rowSelection, setRowSelection] = useState({});

  return useReactTable({
    data: applications,
    columns: applicationColumns,
    getRowId: (row) => row.id,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualFiltering: true,
    manualPagination: true,
    meta: { sort, onSort },
    state: { columnVisibility, rowSelection },
  });
}
