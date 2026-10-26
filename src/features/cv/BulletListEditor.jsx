import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// The "Description" bullet list shared by experience and project entries
export default function BulletListEditor({ bullets, onAdd, onChange, onDelete }) {
  return (
    <div>
      <div className="flex justify-between items-center">
        <Label className="font-normal">Description</Label>
        <Button
          className="text-[#188665] font-light hover:bg-green-100"
          variant="ghost"
          onClick={onAdd}
        >
          + Add
        </Button>
      </div>

      {bullets.map((bullet, index) => (
        <div key={index} className="flex items-center ml-4 space-x-2 space-y-2">
          <span>•</span>
          <Input value={bullet} onChange={(e) => onChange(index, e.target.value)} />
          <Trash2
            strokeWidth={1.25}
            className="cursor-pointer hover:text-red-500"
            onClick={() => onDelete(index)}
          />
        </div>
      ))}
    </div>
  );
}
