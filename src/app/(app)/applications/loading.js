import ApplicationTableSkeleton from "@/features/applications/ApplicationTableSkeleton";

// Same shell as the page (its own Suspense shows this skeleton while rows load)
export default function Loading() {
  return (
    <div className="flex w-full flex-col gap-3 px-3 pb-6 pt-[85px] sm:px-4">
      <ApplicationTableSkeleton />
    </div>
  );
}
