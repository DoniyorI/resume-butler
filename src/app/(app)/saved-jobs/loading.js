export default function Loading() {
  return <div className="mx-auto w-full max-w-6xl animate-pulse space-y-6 px-4 pt-[97px] sm:px-6" aria-label="Loading saved jobs"><div className="h-8 w-48 rounded bg-muted" /><div className="h-16 rounded-xl bg-muted" /><div className="grid gap-4 sm:grid-cols-2">{[1, 2, 3, 4].map(id => <div key={id} className="h-64 rounded-xl border bg-muted/40" />)}</div></div>;
}
