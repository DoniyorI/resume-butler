import { CheckCircle2, FileSearch, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LINE_PX } from "@/features/resumes/studio/PaperCanvas";

// Within this many lines of the page end the estimate can't call it either
// way (the PDF's typeface wraps a little differently), so it says so
const NEAR_LINES = 1;

/**
 * How full the one page is, from PaperCanvas's measurement, and what to tell
 * the user. `pdfPages` is the page count of the compiled PDF when it was
 * checked since the last edit, which beats the estimate.
 * state: "fits" | "near" | "over" | "pdf-fits" | "pdf-over"
 */
export function pageFit({ usedPx, limitPx }, pdfPages = null) {
  const ratio = limitPx ? (usedPx / limitPx) * 100 : 0;
  const spare = (limitPx - usedPx) / LINE_PX;
  const lines = Math.max(1, Math.round(Math.abs(spare)));
  let state = spare < -NEAR_LINES ? "over" : spare <= NEAR_LINES ? "near" : "fits";
  if (pdfPages) state = pdfPages === 1 ? "pdf-fits" : "pdf-over";
  const percent = state === "over" ? Math.max(101, Math.round(ratio)) : Math.min(100, Math.round(ratio));
  return { percent, state, lines, over: state === "over" || state === "pdf-over" };
}

const TONE = {
  fits: { text: "", fill: "bg-brand/70", badge: "bg-brand/10 text-brand" },
  "pdf-fits": { text: "", fill: "bg-brand/70", badge: "bg-brand/10 text-brand" },
  near: { text: "text-amber-600", fill: "bg-amber-400/80", badge: "bg-amber-50 text-amber-700" },
  over: { text: "text-red-600", fill: "bg-red-400/80", badge: "bg-red-50 text-red-700" },
  "pdf-over": { text: "text-red-600", fill: "bg-red-400/80", badge: "bg-red-50 text-red-700" },
};

function describe({ state, lines }, pdfPages) {
  switch (state) {
    case "pdf-fits":
      return ["Fits on one page", "Checked against the PDF"];
    case "pdf-over":
      return [`The PDF is ${pdfPages} pages`, "Checked against the PDF"];
    case "near":
      return ["Right at the limit", "Within a line of the page end. Check the PDF to be sure."];
    case "over":
      return ["Runs onto page 2", `About ${lines} ${lines === 1 ? "line" : "lines"} too long`];
    default:
      return ["Fits on one page", `Room for about ${lines} more ${lines === 1 ? "line" : "lines"}`];
  }
}

// Compact version for the toolbar on narrow screens
export function FitBadge({ fit, pdfPages }) {
  const result = pageFit(fit, pdfPages);
  return (
    <span
      className={cn("rounded-full px-2 py-0.5 text-xs font-medium tabular-nums", TONE[result.state].badge)}
      title={describe(result, pdfPages).join(". ")}
    >
      {result.state === "pdf-over" ? `${pdfPages} pages` : `${result.percent}% of page`}
    </span>
  );
}

/**
 * The one-page gauge: a small page that fills as the resume grows, how much
 * room is left (or how far over it runs), an exact check against the PDF,
 * and an AI shortcut when it's over.
 */
export default function FitGauge({ fit, pdfCheck, onCheckPdf, onTighten, tightening, canTighten }) {
  const result = pageFit(fit, pdfCheck.pages);
  const [title, detail] = describe(result, pdfCheck.pages);
  const tone = TONE[result.state];
  const checked = result.state.startsWith("pdf-");

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div
          aria-hidden
          className="relative h-14 w-11 shrink-0 overflow-hidden rounded-[3px] border border-border bg-white"
        >
          <div
            className={cn(
              "absolute inset-x-0 top-0 transition-[height] duration-300 motion-reduce:transition-none",
              tone.fill
            )}
            style={{ height: `${Math.min(100, result.percent)}%` }}
          />
          <div className="absolute inset-x-1.5 top-1.5 space-y-1">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-px bg-white/70" />
            ))}
          </div>
        </div>
        <div className="min-w-0">
          <p className={cn("text-2xl font-semibold tabular-nums leading-none", tone.text)}>
            {result.state === "pdf-over" ? `${pdfCheck.pages} pages` : `${result.percent}%`}
          </p>
          <p className="mt-1 text-sm font-medium">{title}</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            {checked && <CheckCircle2 className="h-3 w-3 shrink-0 text-brand" />}
            {detail}
          </p>
        </div>
      </div>

      {!checked && (
        <Button
          size="sm"
          variant={result.state === "near" ? "outline" : "ghost"}
          className={cn("w-full", result.state !== "near" && "h-8 text-xs text-muted-foreground")}
          onClick={onCheckPdf}
          disabled={pdfCheck.status === "checking"}
        >
          {pdfCheck.status === "checking" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <FileSearch className="mr-2 h-4 w-4" />
          )}
          {pdfCheck.status === "checking" ? "Building the PDF..." : "Check with the PDF"}
        </Button>
      )}
      {pdfCheck.status === "error" && <p className="text-xs text-destructive">{pdfCheck.error}</p>}

      {result.over && onTighten && (
        <Button
          size="sm"
          variant="outline"
          className="w-full border-brand/40 text-brand hover:bg-brand/10 hover:text-brand"
          onClick={onTighten}
          disabled={tightening || !canTighten}
          title={canTighten ? undefined : "There are no long bullets to shorten"}
        >
          {tightening ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          Shorten long bullets
        </Button>
      )}
    </div>
  );
}
