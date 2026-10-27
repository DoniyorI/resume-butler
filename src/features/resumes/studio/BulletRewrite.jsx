"use client";
import { useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { rewriteBullet } from "@/features/resumes/api";

// AI rewrites of one bullet (stronger, tailored, shorter); picking one replaces
// it. `fetchVariants` swaps in another source (cover letter paragraphs), and
// `what` names the thing being rewritten in its labels.
export default function BulletRewrite({
  text,
  context,
  jobDescription,
  onApply,
  fetchVariants = () => rewriteBullet({ text, context, jobDescription }),
  what = "bullet",
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState({ status: "idle", variants: [], error: null });

  const load = async () => {
    setState({ status: "loading", variants: [], error: null });
    try {
      const variants = await fetchVariants();
      setState({ status: "done", variants, error: null });
    } catch (error) {
      setState({ status: "error", variants: [], error: error.message });
    }
  };

  const handleOpenChange = (next) => {
    setOpen(next);
    if (next) load();
  };

  const apply = (value) => {
    onApply(value);
    setOpen(false);
  };

  const empty = !text?.trim();

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={empty}
          title={empty ? `Write the ${what} first` : "Rewrite with AI"}
          aria-label={`Rewrite this ${what} with AI`}
          className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-white text-brand shadow-sm hover:bg-brand/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
        >
          <Sparkles className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" side="right" className="w-[340px] p-0 font-sans">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-medium">Rewrite with AI</p>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={load}
            disabled={state.status === "loading"}
          >
            <RefreshCw className="mr-1 h-3 w-3" /> Try again
          </Button>
        </div>
        <div className="space-y-1 p-2">
          {state.status === "loading" &&
            [0, 1, 2].map((i) => (
              <div key={i} className="space-y-1.5 rounded-md p-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            ))}
          {state.status === "error" && <p className="p-2 text-sm text-destructive">{state.error}</p>}
          {state.status === "done" && state.variants.length === 0 && (
            <p className="p-2 text-sm text-muted-foreground">
              This {what} already reads well. Try again for other options.
            </p>
          )}
          {state.variants.map((variant) => (
            <button
              key={variant.label}
              type="button"
              onClick={() => apply(variant.text)}
              className="w-full rounded-md p-2 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="block text-xs font-medium text-brand">{variant.label}</span>
              <span className="mt-0.5 block text-sm leading-snug">{variant.text}</span>
            </button>
          ))}
        </div>
        <p className="border-t px-3 py-2 text-xs text-muted-foreground">
          Replace any [placeholders] with your real numbers.
        </p>
      </PopoverContent>
    </Popover>
  );
}
