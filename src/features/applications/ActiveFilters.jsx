import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import StatusDot from "@/features/applications/StatusDot";
import { dateRangeLabel } from "@/features/applications/listParams";

function Chip({ children, label, onRemove }) {
  return (
    <span className="inline-flex h-6 items-center gap-1 rounded-full border bg-background pl-2 pr-0.5 text-xs">
      {children}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove filter: ${label}`}
        className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

// One removable chip per active filter, plus "Clear filters"
export default function ActiveFilters({ params, onChange }) {
  const { statuses, q, from, to } = params;
  const dates = dateRangeLabel(from, to);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {q && (
        <Chip label={`search ${q}`} onRemove={() => onChange({ q: "" })}>
          <span className="max-w-[200px] truncate" title={q}>
            &ldquo;{q}&rdquo;
          </span>
        </Chip>
      )}
      {statuses.map((status) => (
        <Chip
          key={status}
          label={status}
          onRemove={() => onChange({ statuses: statuses.filter((other) => other !== status) })}
        >
          <StatusDot status={status} />
          {status}
        </Chip>
      ))}
      {dates && (
        <Chip label={`applied ${dates}`} onRemove={() => onChange({ from: "", to: "" })}>
          Applied: {dates}
        </Chip>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-xs text-muted-foreground"
        onClick={() => onChange({ statuses: [], q: "", from: "", to: "" })}
      >
        Clear filters
      </Button>
    </div>
  );
}
