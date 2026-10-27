"use client";

import { useEffect, useRef, useState } from "react";
import { Columns3, FileDown, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import BulkActions from "@/features/applications/BulkActions";
import DateRangeFilter from "@/features/applications/DateRangeFilter";
import StatusFilter from "@/features/applications/StatusFilter";

const SEARCH_DELAY_MS = 300;

// Search box that updates the URL once typing pauses. It follows the URL when
// q changes from elsewhere (Clear filters, back button) without fighting the
// value the user is still typing.
function SearchInput({ value, onSearch }) {
  const [text, setText] = useState(value);
  const sent = useRef(value);
  // Latest callback, so a new onSearch each render doesn't restart the delay
  const onSearchRef = useRef(onSearch);
  useEffect(() => {
    onSearchRef.current = onSearch;
  });

  useEffect(() => {
    if (value === sent.current) return;
    sent.current = value;
    setText(value);
  }, [value]);

  useEffect(() => {
    const query = text.trim();
    if (query === sent.current) return;
    const timer = setTimeout(() => {
      sent.current = query;
      onSearchRef.current(query);
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text]);

  return (
    <div className="relative w-full sm:w-64">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Search company, role, location"
        aria-label="Search applications"
        maxLength={100}
        className="h-8 pl-8 pr-7 text-sm [&::-webkit-search-cancel-button]:hidden"
      />
      {text && (
        <button
          type="button"
          onClick={() => setText("")}
          aria-label="Clear search"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function ColumnsMenu({ table }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs">
          <Columns3 className="mr-1.5 h-3.5 w-3.5" /> Columns
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Show columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {table
          .getAllColumns()
          .filter((column) => column.getCanHide())
          .map((column) => (
            <DropdownMenuCheckboxItem
              key={column.id}
              checked={column.getIsVisible()}
              onCheckedChange={(value) => column.toggleVisibility(!!value)}
              onSelect={(event) => event.preventDefault()}
            >
              {column.columnDef.meta?.label || column.id}
            </DropdownMenuCheckboxItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Filters on the left; selection actions, export and columns on the right.
// Wraps onto more lines on narrow screens.
export default function ApplicationToolbar({ table, params, statusCounts, onChange, onExport }) {
  const selectedIds = table.getSelectedRowModel().rows.map((row) => row.original.id);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <SearchInput value={params.q} onSearch={(q) => onChange({ q })} />
      <StatusFilter
        selected={params.statuses}
        counts={statusCounts}
        onChange={(statuses) => onChange({ statuses })}
      />
      <DateRangeFilter from={params.from} to={params.to} onChange={onChange} />

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {selectedIds.length > 0 && <BulkActions ids={selectedIds} onDone={() => table.resetRowSelection()} />}
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2.5 text-xs"
          onClick={onExport}
          title="Export the rows on this page to CSV"
        >
          <FileDown className="mr-1.5 h-3.5 w-3.5" /> CSV
        </Button>
        <ColumnsMenu table={table} />
      </div>
    </div>
  );
}
