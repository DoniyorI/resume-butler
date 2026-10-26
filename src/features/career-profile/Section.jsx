import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

// One section of the CV document: heading, count, add action, and either the
// entries or an empty state that says what to add and why
export function Section({ id, title, count, addLabel, onAdd, empty, children }) {
  const isEmpty = count === 0;
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-28 py-8 first:pt-0">
      <div className="mb-5 flex items-baseline justify-between gap-4 border-b pb-3">
        <h2 id={`${id}-title`} className="text-lg font-semibold tracking-tight">
          {title}
          {!isEmpty && <span className="ml-2 text-sm font-normal text-muted-foreground">{count}</span>}
        </h2>
        {onAdd && (
          <Button variant="ghost" size="sm" onClick={onAdd} className="h-8 text-brand hover:text-brand">
            <Plus className="mr-1 h-4 w-4" /> {addLabel}
          </Button>
        )}
      </div>
      {isEmpty ? (
        <button
          type="button"
          onClick={onAdd}
          className="w-full rounded-lg border border-dashed px-6 py-8 text-left transition-colors hover:border-brand/50 hover:bg-brand/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <p className="text-sm font-medium">{empty.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{empty.body}</p>
        </button>
      ) : (
        children
      )}
    </section>
  );
}

// Edit button that sits on an entry; always visible on touch, quiet until hover on desktop
export function EditButton({ label, onClick }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      aria-label={label}
      className="h-8 w-8 shrink-0 text-muted-foreground opacity-100 transition-opacity hover:text-foreground focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100"
    >
      <Pencil className="h-3.5 w-3.5" />
    </Button>
  );
}

export function Bullets({ items }) {
  const bullets = items.filter(Boolean);
  if (!bullets.length) return null;
  return (
    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-foreground/85 marker:text-muted-foreground">
      {bullets.map((bullet, i) => (
        <li key={i}>{bullet}</li>
      ))}
    </ul>
  );
}
