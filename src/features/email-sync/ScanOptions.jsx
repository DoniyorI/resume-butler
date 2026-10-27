"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DEFAULT_SCAN_CATEGORIES, EMAIL_CATEGORIES } from "@/lib/emailCategories";

const RANGES = [
  { value: "7", label: "Last 7 days" },
  { value: "14", label: "Last 14 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "custom", label: "Custom range" },
];

// YYYY-MM-DD in the viewer's time zone
function localIsoDate(date) {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 10);
}

export const DEFAULT_SCAN_OPTIONS = {
  range: "14",
  from: "",
  to: "",
  categories: DEFAULT_SCAN_CATEGORIES,
};

// The JSON body for POST /api/scan-emails
export function scanRequestBody(options) {
  const today = new Date();
  if (options.range === "custom") {
    return { from: options.from, to: options.to || localIsoDate(today), categories: options.categories };
  }
  const start = new Date(today);
  start.setDate(start.getDate() - (Number(options.range) - 1));
  return { from: localIsoDate(start), to: localIsoDate(today), categories: options.categories };
}

export function scanOptionsError(options) {
  if (options.categories.length === 0) return "Pick at least one email type";
  if (options.range === "custom" && !options.from) return "Pick a start date";
  return null;
}

// What a scan looks for: the date range and which kinds of email to suggest
export default function ScanOptions({ value, onChange, disabled }) {
  const today = localIsoDate(new Date());
  const update = (changes) => onChange({ ...value, ...changes });

  const toggleCategory = (id, checked) =>
    update({
      categories: checked ? [...value.categories, id] : value.categories.filter((c) => c !== id),
    });

  return (
    <div className="space-y-4 rounded-lg border p-3">
      <div className="space-y-2">
        <Label>Emails from</Label>
        <Select value={value.range} onValueChange={(range) => update({ range })} disabled={disabled}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGES.map((range) => (
              <SelectItem key={range.value} value={range.value}>
                {range.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {value.range === "custom" && (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="scan-from" className="text-xs text-gray-500">
                From
              </Label>
              <Input
                id="scan-from"
                type="date"
                max={value.to || today}
                value={value.from}
                onChange={(e) => update({ from: e.target.value })}
                disabled={disabled}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="scan-to" className="text-xs text-gray-500">
                To
              </Label>
              <Input
                id="scan-to"
                type="date"
                min={value.from || undefined}
                max={today}
                value={value.to}
                placeholder="Today"
                onChange={(e) => update({ to: e.target.value })}
                disabled={disabled}
              />
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>Look for</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {EMAIL_CATEGORIES.map((category) => (
            <label key={category.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={value.categories.includes(category.id)}
                onCheckedChange={(checked) => toggleCategory(category.id, checked === true)}
                disabled={disabled}
              />
              {category.label}
            </label>
          ))}
        </div>
        <p className="text-xs text-gray-400">
          Job alerts, newsletters and Gmail&apos;s Promotions and Social tabs are always skipped.
        </p>
      </div>
    </div>
  );
}
