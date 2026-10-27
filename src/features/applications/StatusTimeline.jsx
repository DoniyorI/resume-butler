"use client";

import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import LocalDateTime from "@/components/shared/LocalDateTime";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function StatusTimeline({ history }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock size={16} /> Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <p className="text-sm text-gray-400">No history yet</p>
        ) : (
          <div className="relative">
            <div className="absolute left-[7px] top-2 bottom-2 w-[2px] bg-gray-200" />
            <div className="space-y-4">
              {history.map((entry, index) => (
                <div key={entry.id} className="flex gap-3 relative">
                  <div
                    className={`w-4 h-4 rounded-full border-2 bg-white z-10 mt-0.5 flex-shrink-0 ${
                      index === history.length - 1 ? "border-brand" : "border-gray-300"
                    }`}
                  />
                  <div className="flex-grow">
                    <Badge variant={entry.status.toLowerCase()} className="text-xs">
                      {entry.status}
                    </Badge>
                    <p className="text-xs text-gray-400 mt-1 min-h-[1rem]">
                      <LocalDateTime value={entry.changedAt} format="long" />
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
