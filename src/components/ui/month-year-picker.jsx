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
import { Calendar as CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const YEARS = Array.from({ length: 30 }, (_, i) => 2040 - i);

export function MonthYearPicker({ value, onChange, placeholder = "Select date", allowPresent = false }) {
  const [open, setOpen] = React.useState(false);
  const [isPresent, setIsPresent] = React.useState(value === "present");

  const selectedDate = value && value !== "present" ? new Date(value) : null;
  const selectedMonth = selectedDate ? selectedDate.getMonth().toString() : "";
  const selectedYear = selectedDate ? selectedDate.getFullYear().toString() : "";

  const displayText = isPresent
    ? "Present"
    : selectedDate
    ? `${MONTHS[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`
    : null;

  const handleMonthChange = (month) => {
    setIsPresent(false);
    const year = selectedYear || new Date().getFullYear().toString();
    const date = new Date(parseInt(year), parseInt(month), 1);
    onChange(date);
  };

  const handleYearChange = (year) => {
    setIsPresent(false);
    const month = selectedMonth || "0";
    const date = new Date(parseInt(year), parseInt(month), 1);
    onChange(date);
  };

  const handleClear = () => {
    setIsPresent(false);
    onChange("");
    setOpen(false);
  };

  const handlePresent = () => {
    setIsPresent(true);
    onChange("present");
    setOpen(false);
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
          <div className="space-y-3">
            <div className="flex gap-2">
              <Select value={isPresent ? "" : selectedMonth} onValueChange={handleMonthChange}>
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
              <Select value={isPresent ? "" : selectedYear} onValueChange={handleYearChange}>
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
            <div className="flex gap-2">
              {allowPresent && (
                <Button
                  variant={isPresent ? "default" : "outline"}
                  size="sm"
                  className="text-xs h-7"
                  onClick={handlePresent}
                >
                  Present
                </Button>
              )}
              {value && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7 text-gray-500"
                  onClick={handleClear}
                >
                  <X size={12} className="mr-1" /> Clear
                </Button>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
