"use client";
import { useRef } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Download,
  FileDown,
  Loader2,
  Minus,
  PanelRight,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ViewSwitch from "@/components/shared/ViewSwitch";
import { renameResume } from "@/features/resumes/actions";
import { FitBadge } from "@/features/resumes/studio/FitGauge";
import { editorViews } from "@/features/resumes/studio/editorViews";

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5];

const SAVE_STATUS = {
  saved: { Icon: Check, label: "Saved", className: "text-muted-foreground" },
  saving: { Icon: Loader2, label: "Saving", className: "text-muted-foreground", spin: true },
  error: { Icon: AlertCircle, label: "Not saved", className: "text-destructive" },
};

// Resume name, saved when the field loses focus. An empty name goes back to the saved one.
function TitleInput({ resumeId, title, onChange }) {
  const savedRef = useRef(title);

  const handleBlur = async () => {
    const trimmed = title.trim();
    if (!trimmed) return onChange(savedRef.current);
    if (trimmed === savedRef.current) return;
    const result = await renameResume(resumeId, trimmed).catch(() => ({
      ok: false,
      error: "Failed to rename",
    }));
    if (!result.ok) return toast.error(result.error);
    savedRef.current = trimmed;
    toast("Resume renamed");
  };

  return (
    <input
      value={title}
      onChange={(e) => onChange(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      maxLength={200}
      aria-label="Resume name"
      placeholder="Untitled resume"
      className="min-w-0 max-w-[22rem] flex-1 truncate rounded-md bg-transparent px-1.5 py-1 text-base font-semibold hover:bg-muted focus:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    />
  );
}

function ZoomControl({ zoom, scale, onZoom }) {
  const step = (direction) => {
    const next =
      direction > 0
        ? ZOOM_STEPS.find((z) => z > scale + 0.01)
        : [...ZOOM_STEPS].reverse().find((z) => z < scale - 0.01);
    if (next) onZoom(next);
  };
  return (
    <div className="hidden items-center rounded-md border md:flex">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-r-none"
        onClick={() => step(-1)}
        aria-label="Zoom out"
      >
        <Minus className="h-3.5 w-3.5" />
      </Button>
      <button
        type="button"
        onClick={() => onZoom("fit")}
        title="Fit the page to the window"
        className="h-8 min-w-[3.75rem] border-x px-2 text-xs tabular-nums hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {zoom === "fit" ? "Fit" : `${Math.round(scale * 100)}%`}
      </button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-l-none"
        onClick={() => step(1)}
        aria-label="Zoom in"
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export default function StudioToolbar({
  resumeId,
  title,
  onTitleChange,
  saveStatus,
  zoom,
  scale,
  onZoom,
  download,
  fit,
  pdfPages,
  onToggleAssistant,
}) {
  const status = SAVE_STATUS[saveStatus];

  return (
    <div className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-3 md:px-4">
      <Button asChild variant="ghost" size="icon" className="h-8 w-8 shrink-0">
        <Link href="/documents" aria-label="Back to Documents">
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </Button>
      <TitleInput resumeId={resumeId} title={title} onChange={onTitleChange} />
      <span
        className={`hidden shrink-0 items-center gap-1 text-xs sm:flex ${status.className}`}
        aria-live="polite"
      >
        <status.Icon className={`h-3.5 w-3.5 ${status.spin ? "animate-spin" : ""}`} /> {status.label}
      </span>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <span className="lg:hidden">
          <FitBadge fit={fit} pdfPages={pdfPages} />
        </span>
        <span className="hidden lg:block">
          <ViewSwitch views={editorViews(resumeId)} current={`/resumes/${resumeId}/new`} />
        </span>
        <ZoomControl zoom={zoom} scale={scale} onZoom={onZoom} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="h-8" disabled={download.downloading}>
              {download.downloading ? (
                <Loader2 className="h-4 w-4 animate-spin sm:mr-2" />
              ) : (
                <Download className="h-4 w-4 sm:mr-2" />
              )}
              <span className="hidden sm:inline">Download</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => download.download("pdf")}>
              <FileDown className="mr-2 h-4 w-4" /> PDF
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => download.download("tex")}>
              <FileDown className="mr-2 h-4 w-4" /> LaTeX source (.tex, for Overleaf)
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="lg:hidden">
              <Link href={`/resumes/${resumeId}`}>Open the classic editor</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="outline"
          size="sm"
          className="h-8 xl:hidden"
          onClick={onToggleAssistant}
          aria-label="Open the assistant panel"
        >
          <PanelRight className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Assistant</span>
        </Button>
      </div>
    </div>
  );
}
