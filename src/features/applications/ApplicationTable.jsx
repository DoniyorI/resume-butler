"use client";

import { useRouter } from "next/navigation";
import { flexRender } from "@tanstack/react-table";
import { toast } from "sonner";
import { FileDown, ListFilter, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import BulkActions from "@/features/applications/BulkActions";
import { INTERACTIVE_COLUMNS } from "@/features/applications/columns";
import { applicationsToCsv, downloadCsv } from "@/features/applications/csv";
import { useApplicationsTable } from "@/features/applications/hooks/useApplicationsTable";
import { useEmailScan } from "@/features/applications/hooks/useEmailScan";

// page is zero-based; the URL uses ?page=1, 2, ...
export default function ApplicationTable({ applications, total, page, pageSize }) {
  const router = useRouter();
  const table = useApplicationsTable(applications);
  const { scanning, scan } = useEmailScan();

  const selectedIds = table.getSelectedRowModel().rows.map((row) => row.original.id);
  const firstShown = page * pageSize + 1;
  const lastShown = page * pageSize + applications.length;

  const goToPage = (index) =>
    router.push(index > 0 ? `/?page=${index + 1}` : "/", { scroll: false });

  const handleExportCsv = () => {
    const date = new Date().toISOString().split("T")[0];
    downloadCsv(applicationsToCsv(applications), `applications_${date}.csv`);
    toast("Exported to CSV");
  };

  return (
    <div>
      <div className="flex items-center justify-between py-4 mx-4 gap-2">
        <Input
          placeholder="Filter by company name"
          value={table.getColumn("companyName")?.getFilterValue() || ""}
          onChange={(event) => table.getColumn("companyName")?.setFilterValue(event.target.value)}
          className="max-w-sm"
        />
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <BulkActions ids={selectedIds} onDone={() => table.resetRowSelection()} />
          )}

          <Button
            variant="outline"
            size="sm"
            className="h-9 text-brand border-brand/30 hover:bg-green-50"
            onClick={scan}
            disabled={scanning}
          >
            {scanning ? (
              <>
                <Loader2 size={14} className="mr-1 animate-spin" /> Scanning...
              </>
            ) : (
              <>
                <RefreshCw size={14} className="mr-1" /> Scan Emails
              </>
            )}
          </Button>

          <Button variant="outline" size="sm" className="h-9" onClick={handleExportCsv}>
            <FileDown size={14} className="mr-1" /> CSV
          </Button>

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
            {table.getRowModel().rows.length ? (
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
                        if (INTERACTIVE_COLUMNS.includes(cell.column.id)) e.stopPropagation();
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={table.getAllColumns().length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between space-x-2 py-4 mx-4">
        <div className="text-xs text-muted-foreground">
          Showing <strong>{applications.length ? `${firstShown}-${lastShown}` : "No"}</strong> of{" "}
          <strong>{total}</strong> applications
        </div>

        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(page - 1)}
            disabled={page === 0}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(page + 1)}
            disabled={lastShown >= total}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
