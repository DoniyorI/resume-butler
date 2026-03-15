"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const YEARS = Array.from({ length: 30 }, (_, i) => 2040 - i);

export function MonthYearPicker({ value, onChange, placeholder = "Select date" }) {
  const [open, setOpen] = React.useState(false);

  const selectedDate = value ? new Date(value) : null;
  const selectedMonth = selectedDate ? selectedDate.getMonth().toString() : "";
  const selectedYear = selectedDate ? selectedDate.getFullYear().toString() : "";

  const displayText = selectedDate
    ? `${MONTHS[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`
    : null;

  const handleMonthChange = (month) => {
    const year = selectedYear || new Date().getFullYear().toString();
    const date = new Date(parseInt(year), parseInt(month), 1);
    onChange(date);
  };

  const handleYearChange = (year) => {
    const month = selectedMonth || "0";
    const date = new Date(parseInt(year), parseInt(month), 1);
    onChange(date);
  };

  return (
    <div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-[240px] justify-start text-left font-normal",
              !value && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
            {displayText || placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-4">
          <div className="flex gap-2">
            <Select value={selectedMonth} onValueChange={handleMonthChange}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((month, i) => (
                  <SelectItem key={month} value={i.toString()}>
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedYear} onValueChange={handleYearChange}>
              <SelectTrigger className="w-[90px]">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
