import { Skeleton } from "@/components/ui/skeleton";

// Same layout as ApplicationEditor: breadcrumb, title and facts, then the
// details column and the status timeline beside it
export default function ApplicationDetailLoading() {
  return (
    <div
      className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 pb-16 pt-[85px] md:px-6"
      aria-busy="true"
    >
      <div className="space-y-4">
        <Skeleton className="h-4 w-40" />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-8 w-72" />
            <Skeleton className="h-5 w-40" />
          </div>
          <Skeleton className="h-9 w-40" />
        </div>
        <div className="flex flex-wrap gap-5">
          {["w-32", "w-20", "w-24", "w-36"].map((width) => (
            <Skeleton key={width} className={`h-4 ${width}`} />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5">
          <Skeleton className="h-72 w-full rounded-xl" />
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
        <div className="space-y-5">
          <Skeleton className="h-56 w-full rounded-xl" />
          <Skeleton className="h-36 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
