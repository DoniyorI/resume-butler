import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ApplicationFunnel({ stages, total }) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-base">Application Funnel</CardTitle>
        <CardDescription>Conversion from applied to offered</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-around">
          {stages.map((stage, i) => (
            <div key={stage.label} className="flex items-center">
              <div className="text-center">
                <div
                  className="text-2xl font-bold rounded-full w-16 h-16 flex items-center justify-center mx-auto"
                  style={{ backgroundColor: stage.color }}
                >
                  {stage.count}
                </div>
                <p className="text-xs text-gray-500 mt-2">{stage.label}</p>
                {i > 0 && total > 0 && <p className="text-xs text-gray-400">{stage.percent}%</p>}
              </div>
              {i < stages.length - 1 && <ArrowRight size={20} className="text-gray-300 mx-3" />}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
