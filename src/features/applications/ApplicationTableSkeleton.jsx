import { Skeleton } from "@/components/ui/skeleton";

export default function ApplicationTableSkeleton() {
  return (
    <div className="mx-4">
      <div className="flex justify-between">
        <Skeleton className="mt-4 w-1/4 h-[40px]" />
        <Skeleton className="mt-4 w-[90px] h-[40px]" />
      </div>
      <Skeleton className="mt-4 w-full h-[400px]" />
      <div className="flex justify-between items-center">
        <Skeleton className="mt-4 w-2/12 h-[15px]" />
        <div className="flex space-x-2">
          <Skeleton className="mt-4 w-[80px] h-[35px]" />
          <Skeleton className="mt-4 w-[60px] h-[35px]" />
        </div>
      </div>
    </div>
  );
}
