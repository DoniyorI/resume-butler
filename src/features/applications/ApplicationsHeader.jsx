import ScanEmailsButton from "@/features/applications/ScanEmailsButton";

// Title row: how many applications there are and, with filters on, how many match
export default function ApplicationsHeader({ total, allTotal, filtered }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-baseline gap-2">
        <h1 className="text-xl font-semibold text-brand">Applications</h1>
        <span className="text-sm tabular-nums text-muted-foreground">{allTotal}</span>
        {filtered && (
          <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium tabular-nums text-brand">
            {total} matching
          </span>
        )}
      </div>
      <ScanEmailsButton />
    </div>
  );
}
