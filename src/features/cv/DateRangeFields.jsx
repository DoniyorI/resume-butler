import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { MonthYearPicker } from "@/components/shared/MonthYearPicker";

// Start/End month pickers shared by experience, project and education entries.
// allowPresent adds a "Present" end date; only use it where the entry has a
// currently_working column to store it in.
export default function DateRangeFields({ startDate, endDate, onChange, allowPresent = false }) {
  return (
    <div className="flex space-x-6">
      <div>
        <Label>Start Date</Label>
        <MonthYearPicker value={startDate} onChange={(date) => onChange("startDate", date)} />
      </div>
      <div>
        <Label>End Date</Label>
        <MonthYearPicker
          value={endDate}
          onChange={(date) => onChange("endDate", date)}
          allowPresent={allowPresent}
        />
      </div>
    </div>
  );
}

export function CurrentlyWorkingField({ id, checked, onChange }) {
  return (
    <div className="flex items-center space-x-2 pb-4">
      <Checkbox id={id} checked={checked} onCheckedChange={onChange} />
      <Label className="font-light" htmlFor={id}>
        Currently Working
      </Label>
    </div>
  );
}
