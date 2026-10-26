import { Card, CardContent } from "@/components/ui/card";

export default function StatCard({ icon: Icon, label, value, sub }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-50">
            <Icon size={18} className="text-brand" />
          </div>
          <div>
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-xl font-bold">{value}</p>
            {sub && <p className="text-xs text-gray-400">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
