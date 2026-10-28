"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createTitleSave } from "@/features/resumes/titleSave";
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
import { FitBadge } from "@/features/resumes/studio/FitGauge";

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5];

const SAVE_STATUS = {
  saved: { Icon: Check, label: "Saved", className: "text-muted-foreground" },
  saving: { Icon: Loader2, label: "Saving", className: "text-muted-foreground", spin: true },
  error: { Icon: AlertCircle, label: "Not saved", className: "text-destructive" },
};

// Document name, saved through `rename` (a Server Action returning { ok, error })
// after a short pause or on blur. An empty name returns to the saved one.
function TitleInput({ title, onChange, rename, label, onSaveState }) {
  const callbacks = useRef({ rename, title });
  callbacks.current = { rename, title };
  const saver = useRef(null);
  const timer = useRef(null);
  useEffect(() => {
    const instance = createTitleSave({
      initial: callbacks.current.title,
      save: value => callbacks.current.rename(value),
      onState: onSaveState,
      onRevert: onChange,
    });
    saver.current = instance;
    const warnIfUnsaved = event => { if (instance.hasUnsaved()) event.preventDefault(); };
    window.addEventListener("beforeunload", warnIfUnsaved);
    return () => {
      window.removeEventListener("beforeunload", warnIfUnsaved);
      clearTimeout(timer.current);
      void instance.flush();
      instance.dispose();
      saver.current = null;
    };
  }, [onChange, onSaveState]);
  useEffect(() => {
    saver.current?.update(title);
    clearTimeout(timer.current);
    if (title.trim()) timer.current = setTimeout(() => { void saver.current?.flush(); }, 800);
    return () => clearTimeout(timer.current);
  }, [title]);

  return (
    <input
      value={title}
      onChange={(e) => { saver.current?.update(e.target.value); onChange(e.target.value); }}
      onBlur={() => { clearTimeout(timer.current); void saver.current?.flush(); }}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      maxLength={200}
      aria-label={`${label} name`}
      placeholder={`Untitled ${label.toLowerCase()}`}
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

const RESUME_DOWNLOADS = [
  { format: "pdf", label: "PDF" },
  { format: "tex", label: "LaTeX source (.tex, for Overleaf)" },
];

/**
 * The editor's top bar: back, name, save status, page fit, zoom, download and
 * (below xl) the assistant toggle. Shared by the resume and cover letter
 * editors: `rename(title)` saves the name, `downloads` lists the formats
 * download.download(format) accepts, and `fitBadgeClassName` hides the fit
 * badge where the page shows its own gauge.
 */
export default function StudioToolbar({
  label = "Resume",
  rename,
  downloads = RESUME_DOWNLOADS,
  fitBadgeClassName = "lg:hidden",
  title,
  onTitleChange,
  saveStatus,
  saveError,
  zoom,
  scale,
  onZoom,
  download,
  fit,
  pdfPages,
  onToggleAssistant,
}) {
  const [titleState, setTitleState] = useState({ status: "saved", error: null });
  const mergedStatus = saveStatus === "error" || titleState.status === "error" ? "error"
    : saveStatus === "saving" || titleState.status === "saving" ? "saving" : "saved";
  const status = SAVE_STATUS[mergedStatus];

  return (
    <div className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-3 md:px-4">
      <Button asChild variant="ghost" size="icon" className="h-8 w-8 shrink-0">
        <Link href="/documents" aria-label="Back to Documents">
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </Button>
      <TitleInput title={title} onChange={onTitleChange} rename={rename} label={label} onSaveState={setTitleState} />
      <span
        className={`hidden shrink-0 items-center gap-1 text-xs sm:flex ${status.className}`}
        role="status"
        title={titleState.error || saveError || undefined}
        aria-live="polite"
      >
        <status.Icon className={`h-3.5 w-3.5 ${status.spin ? "animate-spin" : ""}`} /> {status.label}
      </span>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <span className={fitBadgeClassName}>
          <FitBadge fit={fit} pdfPages={pdfPages} />
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
            {downloads.map(({ format, label: formatLabel }) => (
              <DropdownMenuItem key={format} onSelect={() => download.download(format)}>
                <FileDown className="mr-2 h-4 w-4" /> {formatLabel}
              </DropdownMenuItem>
            ))}
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
