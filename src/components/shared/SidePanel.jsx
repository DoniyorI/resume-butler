import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

// Width of the slide-out panels; the editor adds a matching right margin
export const SIDE_PANEL_MARGIN_CLASS = "mr-[420px]";

// Slide-out panel fixed to the right of the resume and cover letter editors
export function SidePanel({ open, title, subtitle, onClose, children }) {
  return (
    <div
      className={`fixed top-16 right-0 h-[calc(100vh-64px)] w-[420px] bg-white border-l shadow-lg z-30 transform transition-transform duration-300 ease-in-out ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h2 className="font-semibold text-brand text-lg flex items-center gap-2">{title}</h2>
          <p className="text-xs text-gray-400">{subtitle}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X size={16} />
        </Button>
      </div>
      <ScrollArea className="h-[calc(100vh-145px)]">{children}</ScrollArea>
    </div>
  );
}
