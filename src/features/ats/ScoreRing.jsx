const RING_TRACK_COLOR = "#e5e7eb";

function scoreColor(score) {
  if (score >= 80) return "#22c55e"; // green
  if (score >= 60) return "#eab308"; // yellow
  if (score >= 40) return "#f97316"; // orange
  return "#ef4444"; // red
}

const UNRATED_COLOR = "#9ca3af";

// Circular 0-100 score gauge. A score that wasn't rated (null) draws an empty
// grey ring with a dash, never a red 0.
export function ScoreRing({ score, size = 80, strokeWidth = 6, textClassName = "text-lg" }) {
  const rated = typeof score === "number" && Number.isFinite(score);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = rated ? circumference - (score / 100) * circumference : circumference;
  const color = rated ? scoreColor(score) : UNRATED_COLOR;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={RING_TRACK_COLOR}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <span className={`absolute font-bold ${textClassName}`} style={{ color }}>
        {rated ? score : "–"}
      </span>
    </div>
  );
}
