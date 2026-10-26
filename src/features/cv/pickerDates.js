import { format } from "date-fns";
import { parseDate } from "@/lib/dates";

// MonthYearPicker works with local Date objects ("" when empty, "present" for
// Present); the database stores "yyyy-MM-dd". Converting on the client keeps
// the month the user picked in their own time zone.

export function toPickerDate(value) {
  return parseDate(value) || "";
}

// "present" and empty values are stored as null
export function toDateString(value) {
  return value instanceof Date && !isNaN(value.getTime()) ? format(value, "yyyy-MM-dd") : null;
}
