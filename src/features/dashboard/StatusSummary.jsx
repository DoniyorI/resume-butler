import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function StatusSummary({ counts, percents }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Status Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {Object.entries(counts).map(([status, count]) => (
            <div key={status} className="text-center p-3 rounded-lg bg-gray-50">
              <Badge variant={status.toLowerCase()} className="mb-2">
                {status}
              </Badge>
              <div className="text-2xl font-bold">{count}</div>
              <div className="text-xs text-gray-400">{percents[status]}%</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
