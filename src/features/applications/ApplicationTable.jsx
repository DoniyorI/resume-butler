"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { flexRender } from "@tanstack/react-table";
import { toast } from "sonner";
import { Briefcase, ChevronLeft, ChevronRight, Loader2, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ActiveFilters from "@/features/applications/ActiveFilters";
import ApplicationToolbar from "@/features/applications/ApplicationToolbar";
import { INTERACTIVE_COLUMNS } from "@/features/applications/columns";
import { applicationsToCsv, downloadCsv } from "@/features/applications/csv";
import { APPLICATIONS_PAGE_SIZE, hasActiveFilters, listHref } from "@/features/applications/listParams";
import { useApplicationsTable } from "@/features/applications/hooks/useApplicationsTable";

const CLEARED_FILTERS = { statuses: [], q: "", from: "", to: "" };

function EmptyState({ filtered, onClear }) {
  if (filtered) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <SearchX className="h-8 w-8 text-muted-foreground/60" />
        <p className="font-medium">No applications match these filters</p>
        <p className="text-sm text-muted-foreground">Try a different search, status or date range.</p>
        <Button variant="outline" size="sm" className="mt-1 h-8" onClick={onClear}>
          Clear filters
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <Briefcase className="h-8 w-8 text-brand/70" />
      <p className="font-medium">No applications yet</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Add one with New Application at the top of the page, or scan your email to find the ones you have
        already sent.
      </p>
    </div>
  );
}

// The list for the current URL (filters, sort and page come from params).
// Every change navigates; the old rows stay dimmed until the new ones arrive.
export default function ApplicationTable({ applications, total, allTotal, statusCounts, params }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const tableRef = useRef(null);
  const filtered = hasActiveFilters(params);

  const navigate = (changes, { push = false } = {}) => {
    table.resetRowSelection();
    const href = listHref(params, changes);
    startTransition(() => {
      if (push) router.push(href, { scroll: false });
      else router.replace(href, { scroll: false });
    });
  };

  const table = useApplicationsTable(applications, {
    sort: params.sort,
    onSort: (sort) => navigate({ sort }),
  });

  // A new page starts at its first row
  useEffect(() => {
    const scroller = tableRef.current?.parentElement;
    if (scroller) scroller.scrollTop = 0;
  }, [params.page]);

  const pageCount = Math.max(1, Math.ceil(total / APPLICATIONS_PAGE_SIZE));
  const firstShown = (params.page - 1) * APPLICATIONS_PAGE_SIZE + 1;
  const lastShown = firstShown + applications.length - 1;
  const goToPage = (page) => navigate({ page }, { push: true });

  const handleExportCsv = () => {
    const date = new Date().toISOString().split("T")[0];
    downloadCsv(applicationsToCsv(applications), `applications_${date}.csv`);
    toast("Exported to CSV");
  };

  const rows = table.getRowModel().rows;

  return (
    <div className="flex flex-col gap-2">
      <ApplicationToolbar
        table={table}
        params={params}
        statusCounts={statusCounts}
        onChange={navigate}
        onExport={handleExportCsv}
      />
      {filtered && <ActiveFilters params={params} onChange={navigate} />}

      <div className="flex flex-col overflow-hidden rounded-lg border bg-card" aria-busy={isPending}>
        <Table
          ref={tableRef}
          className="min-w-[860px] text-[13px]"
          containerClassName="max-h-[max(20rem,calc(100dvh-15rem))]"
        >
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={`sticky top-0 z-10 h-9 whitespace-nowrap bg-muted px-2 text-xs shadow-[inset_0_-1px_0_hsl(var(--border))] first:pl-3 ${header.column.columnDef.meta?.className || ""}`}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody className={`transition-opacity ${isPending ? "opacity-50" : ""}`}>
            {rows.length ? (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="h-10 cursor-pointer"
                  data-state={row.getIsSelected() && "selected"}
                  onClick={() => router.push(`/applications/${row.original.id}`)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={`px-2 py-0 first:pl-3 ${cell.column.columnDef.meta?.className || ""}`}
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
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={table.getVisibleLeafColumns().length} className="p-0">
                  <EmptyState filtered={filtered && allTotal > 0} onClear={() => navigate(CLEARED_FILTERS)} />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <div className="flex h-10 items-center justify-between gap-2 border-t px-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5 tabular-nums">
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-label="Loading" />}
            {applications.length ? (
              <>
                <strong className="font-medium text-foreground">
                  {firstShown}-{lastShown}
                </strong>{" "}
                of {total}
              </>
            ) : (
              "No results"
            )}
          </span>
          <div className="flex items-center gap-1">
            <span className="mr-1 hidden tabular-nums sm:inline">
              Page {params.page} of {pageCount}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => goToPage(params.page - 1)}
              disabled={params.page <= 1 || isPending}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => goToPage(params.page + 1)}
              disabled={lastShown >= total || isPending}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
