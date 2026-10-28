import { CheckCircle2, FileSearch, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { pageFit } from "@/features/resumes/pageFit";
export { pageFit } from "@/features/resumes/pageFit";

const TONE = {
  green: { text: "text-brand", fill: "bg-brand/70", badge: "bg-brand/10 text-brand" },
  amber: { text: "text-amber-600", fill: "bg-amber-400/80", badge: "bg-amber-50 text-amber-700" },
  red: { text: "text-red-600", fill: "bg-red-400/80", badge: "bg-red-50 text-red-700" },
  neutral: { text: "text-muted-foreground", fill: "bg-muted", badge: "bg-muted text-muted-foreground" },
};

function describe({ state, lines, percent, measured }, pdfPages) {
  switch (state) {
    case "pdf-fits":
      return ["Fits on one page", measured
        ? `PDF checked. Editor estimate: ${percent}% of the page.`
        : "Checked against the PDF"];
    case "pdf-over":
      return [`The PDF is ${pdfPages} pages`, "Checked against the PDF"];
    case "fits":
      return ["Good page usage", "Estimated 90–100% filled. Check the PDF to confirm."];
    case "over":
      return ["Check the PDF for page fit", `Editor estimate: about ${lines} extra ${lines === 1 ? "line" : "lines"}. PDF layout can differ.`];
    case "unmeasured":
      return ["Measuring page usage", "Waiting for the page layout"];
    default:
      return ["Room for relevant detail", `Aim for 90–100% without adding filler. About ${lines} ${lines === 1 ? "line" : "lines"} available.`];
  }
}

// Compact version for the toolbar on narrow screens
export function FitBadge({ fit, pdfPages }) {
  const result = pageFit(fit, pdfPages);
  return (
    <span
      className={cn("rounded-full px-2 py-0.5 text-xs font-medium tabular-nums", TONE[result.tone].badge)}
      title={describe(result, pdfPages).join(". ")}
    >
      {result.state === "pdf-over" ? `${pdfPages} pages` : result.state === "pdf-fits" ? "1 page · checked" : result.state === "unmeasured" ? "Measuring…" : `~${result.percent}% of page`}
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
  const tone = TONE[result.tone];
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
            {result.state === "pdf-over" ? `${pdfCheck.pages} pages` : result.state === "pdf-fits" ? "1 page" : result.state === "unmeasured" ? "…" : `~${result.percent}%`}
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
          variant="outline"
          className="w-full h-8 text-xs"
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
