import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const ACTION_TEXT = { created: "New", updated: "Updated" };

// `results` is the /api/scan-emails response
export default function ScanResults({ results }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Scan Results</CardTitle>
        <CardDescription>
          Scanned {results.emails_scanned} emails, found {results.job_emails_found} job-related
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center p-2 bg-green-50 rounded">
            <div className="text-xl font-bold text-green-700">{results.new_applications}</div>
            <div className="text-xs text-gray-500">New Apps</div>
          </div>
          <div className="text-center p-2 bg-blue-50 rounded">
            <div className="text-xl font-bold text-blue-700">{results.status_updates}</div>
            <div className="text-xs text-gray-500">Updates</div>
          </div>
          <div className="text-center p-2 bg-teal-50 rounded">
            <div className="text-xl font-bold text-teal-700">{results.reached_out}</div>
            <div className="text-xs text-gray-500">Reached Out</div>
          </div>
        </div>

        {results.details?.length > 0 && (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {results.details.map((d, i) => (
              <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {d.company} &mdash; {d.position}
                  </p>
                  <p className="text-gray-400 truncate">{d.subject}</p>
                </div>
                <div className="flex items-center gap-2 ml-2 shrink-0">
                  <Badge variant={d.status.toLowerCase()}>{d.status}</Badge>
                  <span className="text-gray-400">{ACTION_TEXT[d.action] || "Skipped"}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
