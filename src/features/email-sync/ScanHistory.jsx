import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const ACTION_LABELS = {
  created: { text: "New", className: "text-green-600" },
  updated: { text: "Updated", className: "text-blue-600" },
  skipped: { text: "Skipped", className: "text-gray-400" },
};

export default function ScanHistory({ items }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Scan History</CardTitle>
        <CardDescription>{items.length} processed emails</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">
            No scans yet. Connect your email and hit &quot;Scan Now&quot; to get started.
          </p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {items.map((item) => {
              const action = ACTION_LABELS[item.action];
              return (
                <div key={item.id} className="flex items-center justify-between p-2 border rounded text-xs">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.subject || "No subject"}</p>
                    <p className="text-gray-400 truncate">{item.from}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-2 shrink-0">
                    {item.status && <Badge variant={item.status.toLowerCase()}>{item.status}</Badge>}
                    {action && <span className={action.className}>{action.text}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
