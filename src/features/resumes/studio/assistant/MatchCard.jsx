import { useState } from "react";
import { Loader2 } from "lucide-react";
import { UNSCORED_MESSAGES, yearsNote } from "@/features/ats/AtsResults";
import { ScoreRing } from "@/features/ats/ScoreRing";

function Chip({ children }) {
  return (
    <span className="rounded-full border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground">
      {children}
    </span>
  );
}

/**
 * How well the page matches the job, re-scored as you edit (keyword and
 * structure checks, no AI). Adding what the Master CV backs is the Fit card's job.
 */
export default function MatchCard({ result, loading, error }) {
  const [showMatched, setShowMatched] = useState(false);

  if (!result) {
    return (
      <div className="flex items-center gap-2 rounded-lg border p-3 text-sm text-muted-foreground">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {error || (loading ? "Scoring the match..." : "Waiting for the job description")}
      </div>
    );
  }

  const needsWork = (result.bulletFeedback || []).filter((fb) => fb.severity !== "ok").length;
  const hasScore = typeof result.overallScore === "number";
  const years = yearsNote(result.yearsRequired);

  return (
    <section className="space-y-3 rounded-lg border p-3">
      <div className="flex items-center gap-3">
        {hasScore && <ScoreRing score={result.overallScore} size={52} strokeWidth={5} textClassName="text-sm" />}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-semibold">
            Job match
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </p>
          <p className="text-xs text-muted-foreground">
            {UNSCORED_MESSAGES[result.status] ||
              (result.totalKeywords
                ? `${result.matched.length} of ${result.totalKeywords} keywords from the job are on the page`
                : "No known keywords found in the job description")}
          </p>
        </div>
      </div>

      {years && <p className="text-xs text-muted-foreground">{years}</p>}

      {result.missing.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium">Missing from the page</p>
          <div className="flex flex-wrap gap-1.5">
            {result.missing.map((keyword) => (
              <Chip key={keyword}>{keyword}</Chip>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Use Fit for this job above to add what your Master CV backs.
          </p>
        </div>
      )}

      {result.matched.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowMatched(!showMatched)}
            className="text-xs font-medium text-brand hover:underline"
          >
            {showMatched ? "Hide matched keywords" : `Show ${result.matched.length} matched keywords`}
          </button>
          {showMatched && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {result.matched.map((keyword) => (
                <Chip key={keyword}>{keyword}</Chip>
              ))}
            </div>
          )}
        </div>
      )}

      {needsWork > 0 && (
        <p className="border-t pt-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {needsWork} {needsWork === 1 ? "bullet" : "bullets"} could be stronger.
          </span>{" "}
          Their dots are amber or red on the page; hover one to see why.
        </p>
      )}
    </section>
  );
}
