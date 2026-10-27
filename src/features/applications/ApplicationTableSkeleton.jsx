import { Skeleton } from "@/components/ui/skeleton";

// Same shape as the loaded page: title row, toolbar, then a card of compact rows
export default function ApplicationTableSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-brand">Applications</h1>
        <Skeleton className="h-8 w-28" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-8 w-full sm:w-64" />
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-24" />
        <Skeleton className="ml-auto h-8 w-40" />
      </div>
      <div className="overflow-hidden rounded-lg border">
        <div className="h-9 bg-muted" />
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="flex h-10 items-center gap-4 border-t px-3">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-3.5 w-1/6" />
            <Skeleton className="h-3.5 w-1/5" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="hidden h-3.5 w-1/6 sm:block" />
            <Skeleton className="hidden h-3.5 w-20 sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
