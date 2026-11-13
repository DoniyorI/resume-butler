// Shaped like page.jsx: title block, the add form, company cards, the sort switch, posting cards
export default function Loading() {
  return <div className="mx-auto w-full max-w-6xl animate-pulse space-y-6 px-4 pt-[85px] sm:px-6" aria-label="Loading watchlist">
    <div className="space-y-3"><div className="h-4 w-24 rounded bg-muted" /><div className="h-8 w-40 rounded bg-muted" /><div className="h-4 w-96 max-w-full rounded bg-muted" /></div>
    <div className="h-48 rounded-xl bg-muted" />
    <div className="grid gap-3 md:grid-cols-2">{[1, 2].map(id => <div key={id} className="h-28 rounded-xl bg-muted/60" />)}</div>
    <div className="flex items-center justify-between gap-3"><div className="h-6 w-28 rounded bg-muted" /><div className="h-9 w-40 rounded-lg bg-muted" /></div>
    <div className="grid gap-4 md:grid-cols-2">{[1, 2, 3, 4].map(id => <div key={id} className="space-y-3 rounded-xl border bg-muted/40 p-5"><div className="h-6 w-28 rounded-full bg-muted" /><div className="h-4 w-full rounded bg-muted" /><div className="h-6 w-2/3 rounded bg-muted" /><div className="h-4 w-1/3 rounded bg-muted" /><div className="h-9 w-48 rounded bg-muted" /></div>)}</div>
  </div>;
}
