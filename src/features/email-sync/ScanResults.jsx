import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CATEGORY_LABELS } from "@/lib/emailCategories";

// Why an email didn't become a suggestion
const IGNORED_REASONS = {
  job_alert: "Job alert",
  marketing: "Marketing",
  not_job: "Not about a job",
  not_selected: "Type not selected",
  low_confidence: "Unclear",
  no_company: "No company",
  no_change: "Already up to date",
  duplicate: "Already suggested",
  error: "Couldn't read",
};

function outcomeText({ outcome, category }) {
  if (outcome === "suggested") return { text: "To review", className: "text-brand font-medium" };
  if (outcome === "merged") return { text: "Updated a suggestion", className: "text-brand" };
  const reason = outcome.split(":")[1];
  return {
    text: IGNORED_REASONS[reason] || CATEGORY_LABELS[category] || "Ignored",
    className: "text-gray-400",
  };
}

// `results` is the /api/scan-emails response
export default function ScanResults({ results }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Scan Results</CardTitle>
        <CardDescription>
          Scanned {results.emails_scanned} emails; {results.candidates} looked like application updates
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center p-2 bg-green-50 rounded">
            <div className="text-xl font-bold text-green-700">{results.suggestions}</div>
            <div className="text-xs text-gray-500">To review</div>
          </div>
          <div className="text-center p-2 bg-gray-50 rounded">
            <div className="text-xl font-bold text-gray-600">{results.ignored}</div>
            <div className="text-xs text-gray-500">Ignored</div>
          </div>
          <div className="text-center p-2 bg-red-50 rounded">
            <div className="text-xl font-bold text-red-600">{results.errors}</div>
            <div className="text-xs text-gray-500">Errors</div>
          </div>
        </div>

        {results.details?.length > 0 && (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {results.details.map((d, i) => {
              const outcome = outcomeText(d);
              return (
                <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {d.company || "Unknown"}
                      {d.role ? ` — ${d.role}` : ""}
                    </p>
                    <p className="text-gray-400 truncate">{d.subject}</p>
                  </div>
                  <span className={`ml-2 shrink-0 ${outcome.className}`}>{outcome.text}</span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
