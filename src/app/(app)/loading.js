import { Skeleton } from "@/components/ui/skeleton";

// Shown while a page in (app) loads its data on the server
export default function AppLoading() {
  return (
    <div className="flex flex-col w-full min-h-screen py-16 px-10 my-10 gap-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
