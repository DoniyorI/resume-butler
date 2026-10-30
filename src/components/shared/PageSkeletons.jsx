import { Skeleton } from "@/components/ui/skeleton";

// Loading placeholders shaped like each page (same container, grid and card
// sizes), so content fills in where the grey blocks were instead of jumping.
// Used by the routes' loading.js files. Keep them in step with the pages.

function CardBlock({ className = "", lines = 2 }) {
  return (
    <div className={`space-y-3 rounded-xl border bg-card p-5 ${className}`}>
      <Skeleton className="h-4 w-32" />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={i === 0 ? "h-7 w-24" : "h-3 w-40"} />
      ))}
    </div>
  );
}

function PageTitle({ actions = true }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div className="space-y-2">
        <Skeleton className="h-6 w-52" />
        <Skeleton className="h-4 w-64" />
      </div>
      {actions && <Skeleton className="h-9 w-36" />}
    </div>
  );
}

// src/app/(app)/page.jsx
export function DashboardSkeleton() {
  return (
    <div className="flex w-full flex-col gap-4 px-4 pb-10 pt-[85px] md:px-6" aria-busy="true">
      <PageTitle />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <CardBlock key={i} lines={2} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <CardBlock className="h-40" />
        <CardBlock className="h-40" />
        <CardBlock className="h-40 md:col-span-2 xl:col-span-1" />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Skeleton className="h-[330px] rounded-xl xl:col-span-2" />
        <Skeleton className="h-[330px] rounded-xl" />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Skeleton className="h-[420px] rounded-xl xl:col-span-2" />
        <Skeleton className="h-[420px] rounded-xl" />
      </div>
      <div>
        <Skeleton className="h-[480px] rounded-xl" />
      </div>
    </div>
  );
}

// src/app/(app)/documents/page.jsx (DocumentLibrary)
export function DocumentsSkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl px-5 pb-16 pt-24 md:px-8" aria-busy="true">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2"><Skeleton className="h-8 w-44" /><Skeleton className="h-4 w-72" /></div>
        <div className="flex flex-wrap gap-2"><Skeleton className="h-10 w-32" /><Skeleton className="h-10 w-40" /></div>
      </div>
      <div className="mt-5 flex gap-2">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-40" />
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-36" />
      </div>
      <ul className="mt-6 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <li key={i} className="space-y-2">
            {/* Letter-size thumbnails */}
            <Skeleton className="aspect-[8.5/11] w-full rounded-md" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </li>
        ))}
      </ul>
    </div>
  );
}

// src/app/(app)/profile/page.jsx (CareerProfile: identity rail, then CV sections)
export function ProfileSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 pb-16 pt-24 md:px-8" aria-busy="true">
      <Skeleton className="mb-8 h-4 w-80" />
      <div className="grid gap-8 lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-12">
        <div className="space-y-6">
          <div className="space-y-4 rounded-xl border p-5">
            <Skeleton className="h-14 w-14 rounded-full" />
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-56" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        </div>
        <div className="space-y-10">
          {["w-28", "w-24", "w-24"].map((width, i) => (
            <section key={i} className="space-y-4">
              <Skeleton className={`h-5 ${width}`} />
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

// src/app/(app)/email-sync/page.jsx
export function EmailSyncSkeleton() {
  return (
    <div className="flex min-h-screen w-full flex-col px-5 pb-10 pt-24 md:px-10" aria-busy="true">
      <Skeleton className="mb-2 h-7 w-40" />
      <Skeleton className="mb-6 h-4 w-full max-w-xl" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <CardBlock className="h-56" lines={3} />
        <CardBlock className="h-56" lines={3} />
      </div>
      <Skeleton className="mt-6 h-64 w-full rounded-xl" />
    </div>
  );
}

// src/app/(app)/extension/page.jsx
export function ExtensionSkeleton() {
  return (
    <div
      className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pb-10 pt-[85px] md:px-6"
      aria-busy="true"
    >
      <PageTitle actions={false} />
      <CardBlock className="h-40" lines={3} />
      <CardBlock className="h-32" lines={2} />
    </div>
  );
}

// The resume and cover letter editors: toolbar, outline, the page, the assistant
export function StudioSkeleton() {
  return (
    <div className="fixed inset-x-0 bottom-0 top-[73px] z-10 flex flex-col bg-background" aria-busy="true">
      <div className="flex h-12 shrink-0 items-center gap-3 border-b px-4">
        <Skeleton className="h-5 w-40" />
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-28" />
        </div>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="hidden w-64 shrink-0 space-y-3 border-r p-4 lg:block">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
        <div className="flex min-w-0 flex-1 justify-center overflow-hidden bg-muted/40 p-8">
          {/* A letter-size page */}
          <Skeleton className="aspect-[8.5/11] w-full max-w-[640px] rounded-sm bg-white shadow-sm" />
        </div>
        <div className="hidden w-80 shrink-0 space-y-3 border-l p-4 xl:block">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      </div>
    </div>
  );
}
