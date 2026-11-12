import { AlertTriangle, Check, Info, X } from "lucide-react";
import { ScoreRing } from "@/features/ats/ScoreRing";

const RING_SIZES = {
  regular: {
    main: { size: 80, strokeWidth: 6, textClassName: "text-lg" },
    sub: { size: 60, strokeWidth: 5, textClassName: "text-lg" },
  },
  compact: {
    main: { size: 70, strokeWidth: 5, textClassName: "text-sm" },
    sub: { size: 50, strokeWidth: 4, textClassName: "text-sm" },
  },
};

const CHECK_GROUPS = [
  { key: "header", title: "Header" },
  { key: "sections", title: "Sections" },
  { key: "quality", title: "Bullet Point Quality" },
];

// Why a result has no overall score (scoreResume's status)
export const UNSCORED_MESSAGES = {
  empty: "Add experience, projects or skills before scoring this resume.",
  "no-keywords":
    "We could not recognise specific skills in this posting, so there is no keyword comparison. Paste the full description if this is a summary.",
};

// Unscored note for the posting's experience requirement, or null
export function yearsNote(yearsRequired) {
  if (typeof yearsRequired !== "number") return null;
  return `The posting asks for ${yearsRequired}+ ${yearsRequired === 1 ? "year" : "years"} of experience. Check that your dates show it.`;
}

function Note({ children }) {
  return (
    <p className="flex items-start gap-2 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
      <Info size={14} className="mt-0.5 shrink-0 text-gray-400" />
      <span>{children}</span>
    </p>
  );
}

function SectionLabel({ children }) {
  return <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">{children}</p>;
}

function KeywordChips({ keywords, matched }) {
  const Icon = matched ? Check : X;
  const colors = matched
    ? "bg-green-50 text-green-700 border-green-200"
    : "bg-red-50 text-red-700 border-red-200";
  return (
    <div className="flex flex-wrap gap-1.5">
      {keywords.map((keyword) => (
        <span
          key={keyword}
          className={`inline-flex items-center text-xs border px-2 py-0.5 rounded-full ${colors}`}
        >
          <Icon size={10} className="mr-1" />
          {keyword}
        </span>
      ))}
    </div>
  );
}

// The score breakdown returned by /api/ats-score
export function AtsResults({ result, size = "regular" }) {
  if (result.status === "empty") {
    return (
      <div className="pt-2">
        <Note>{UNSCORED_MESSAGES.empty}</Note>
      </div>
    );
  }

  const rings = RING_SIZES[size] || RING_SIZES.regular;
  const hasOverall = typeof result.overallScore === "number";
  // Only rated components get a ring; null means "not rated", not 0
  const scores = [
    { label: "Keywords", value: result.keywordScore },
    { label: "Sections", value: result.sectionScore },
    { label: "Quality", value: result.qualityScore },
  ].filter((score) => typeof score.value === "number");
  const checks = result.sectionChecks || [];
  const years = yearsNote(result.yearsRequired);

  return (
    <div className="space-y-5 pt-2">
      {UNSCORED_MESSAGES[result.status] && <Note>{UNSCORED_MESSAGES[result.status]}</Note>}

      {(hasOverall || scores.length > 0) && (
        <div className="flex items-center justify-around py-4 bg-gray-50 rounded-lg">
          {hasOverall && (
            <div className="text-center">
              <ScoreRing score={result.overallScore} {...rings.main} />
              <p className="text-xs text-gray-500 mt-1">Overall</p>
            </div>
          )}
          {scores.map((score) => (
            <div key={score.label} className="text-center">
              <ScoreRing score={score.value} {...rings.sub} />
              <p className="text-xs text-gray-500 mt-1">{score.label}</p>
            </div>
          ))}
        </div>
      )}

      {years && <Note>{years}</Note>}

      {result.matched?.length > 0 && (
        <div>
          <SectionLabel>
            Matched ({result.matched.length}/{result.totalKeywords})
          </SectionLabel>
          <KeywordChips keywords={result.matched} matched />
        </div>
      )}

      {result.missing?.length > 0 && (
        <div>
          <SectionLabel>Missing ({result.missing.length})</SectionLabel>
          <KeywordChips keywords={result.missing} matched={false} />
        </div>
      )}

      {CHECK_GROUPS.map(({ key, title }) => {
        const items = checks.filter((check) => check.category === key);
        if (items.length === 0) return null;
        return (
          <div key={key}>
            <SectionLabel>{title}</SectionLabel>
            <div className="space-y-1.5">
              {items.map((check) => (
                <div key={check.label} className="flex items-center gap-2 text-sm">
                  {check.present ? (
                    <Check size={14} className="text-green-500" />
                  ) : (
                    <AlertTriangle size={14} className="text-amber-500" />
                  )}
                  <span className={check.present ? "text-gray-600" : "text-amber-700"}>{check.label}</span>
                  {check.detail && <span className="text-xs text-gray-400">({check.detail})</span>}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
