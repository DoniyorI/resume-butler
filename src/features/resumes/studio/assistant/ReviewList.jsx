import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const KIND_LABEL = {
  keyword: "Adds a keyword",
  metric: "Adds a number",
  verb: "Stronger verb",
  concise: "Shorter",
};

// Word-level diff (longest common subsequence) for showing what a suggestion changes
function wordDiff(before, after) {
  const a = before.split(/(\s+)/);
  const b = after.split(/(\s+)/);
  const lcs = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const parts = [];
  const push = (type, text) => {
    const last = parts[parts.length - 1];
    if (last?.type === type) last.text += text;
    else parts.push({ type, text });
  };
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push("same", a[i++]);
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      push("del", a[i++]);
    } else {
      push("add", b[j++]);
    }
  }
  while (i < a.length) push("del", a[i++]);
  while (j < b.length) push("add", b[j++]);
  return parts;
}

function Diff({ before, after }) {
  return (
    <p className="text-sm leading-relaxed">
      {wordDiff(before, after).map((part, index) =>
        part.type === "same" ? (
          <span key={index}>{part.text}</span>
        ) : part.type === "add" ? (
          <ins key={index} className="rounded-sm bg-brand/15 text-foreground no-underline">
            {part.text}
          </ins>
        ) : (
          <del key={index} className="text-red-600/80">
            {part.text}
          </del>
        )
      )}
    </p>
  );
}

/**
 * AI suggestions for bullets on the page. Hovering one highlights its bullet;
 * `active` is the suggestion the page last pointed at.
 */
export default function ReviewList({
  suggestions,
  active,
  onFocus,
  onAccept,
  onDismiss,
  onAcceptAll,
  onClear,
}) {
  if (suggestions.length === 0) return null;

  return (
    <section className="space-y-2" aria-labelledby="review-heading">
      <div className="flex items-center justify-between">
        <h3 id="review-heading" className="text-sm font-semibold">
          {suggestions.length} {suggestions.length === 1 ? "suggestion" : "suggestions"}
        </h3>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onClear}>
            Dismiss all
          </Button>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={onAcceptAll}>
            Accept all
          </Button>
        </div>
      </div>
      <ul className="space-y-2">
        {suggestions.map((s) => (
          <li
            key={s.id}
            id={`suggestion-${s.id}`}
            onMouseEnter={() => onFocus(s, false)}
            onMouseLeave={() => onFocus(null, false)}
            className={cn(
              "scroll-mt-4 rounded-lg border p-3 transition-colors",
              active === s.id ? "border-brand/60 bg-brand/5" : "hover:border-brand/40"
            )}
          >
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="truncate text-xs text-muted-foreground">{s.where}</span>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">
                {KIND_LABEL[s.kind] || "Edit"}
              </span>
            </div>
            <Diff before={s.original} after={s.suggested} />
            {s.reason && <p className="mt-1.5 text-xs text-muted-foreground">{s.reason}</p>}
            <div className="mt-2 flex gap-2">
              <Button size="sm" className="h-7 px-2.5 text-xs" onClick={() => onAccept(s)}>
                <Check className="mr-1 h-3 w-3" /> Accept
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs" onClick={() => onDismiss(s)}>
                <X className="mr-1 h-3 w-3" /> Dismiss
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto h-7 px-2 text-xs text-muted-foreground"
                onClick={() => onFocus(s, true)}
              >
                Show on page
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
