"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { Download, FileDown, Loader2, PanelRightOpen, ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { renameResume } from "@/features/resumes/actions";
import { EditableTitleHeader } from "@/features/resumes/EditableTitleHeader";
import { SIDE_PANEL_MARGIN_CLASS } from "@/components/shared/SidePanel";
import { ResumeHeader } from "@/features/resumes/editor/ResumeHeader";
import { useResumeDocument } from "@/features/resumes/hooks/useResumeDocument";

// The on-screen resume page, in CSS pixels
const PAGE_WIDTH_PX = 850;
const PAGE_HEIGHT_PX = 1230;
const PAGE_PADDING_PX = 30;

// Client-only chunks: the drag-and-drop board and the two side panels
const SectionBoard = dynamic(() => import("@/features/resumes/editor/SectionBoard"), {
  ssr: false,
  loading: () => <p className="text-sm text-gray-400">Loading...</p>,
});
const AtsPanel = dynamic(() => import("@/features/resumes/editor/AtsPanel"), { ssr: false });
const CvDrawer = dynamic(() => import("@/features/resumes/editor/CvDrawer"), { ssr: false });

const ADDED_FROM_CV = {
  education: "Education added from CV",
  experience: "Experience added from CV",
  projects: "Project added from CV",
  skills: "Skills added from CV",
};

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// `resume` and `masterCv` come from features/resumes/data.js
export default function ResumeEditor({ resume, masterCv }) {
  const resumeDoc = useResumeDocument({
    resumeId: resume.id,
    initialContent: resume.content,
    needsInitialSave: resume.needsHeaderSave,
  });
  const [title, setTitle] = useState(resume.title);
  // Only one side panel is open at a time: "cv", "ats" or null
  const [openPanel, setOpenPanel] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [bulletFeedback, setBulletFeedback] = useState([]);

  const togglePanel = (panel) => setOpenPanel((current) => (current === panel ? null : panel));
  const closePanel = () => setOpenPanel(null);

  const handleAddFromCv = (sectionId, item) => {
    resumeDoc.addItem(sectionId, item);
    toast(ADDED_FROM_CV[sectionId]);
  };

  const handleDownload = async (format) => {
    setDownloading(true);
    try {
      // The route renders the saved resume, so write pending edits first.
      // If that failed the save toast already explains why; don't download stale content.
      if (!(await resumeDoc.flush())) return;
      const response = await fetch("/api/download-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeId: resume.id, format }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to download resume");
      }

      // PDF compilation falls back to the .tex source when it fails
      const isTex = response.headers.get("Content-Type")?.includes("x-tex") || format === "tex";
      const extension = isTex ? "tex" : "pdf";
      saveBlob(await response.blob(), `${title || "resume"}.${extension}`);

      if (isTex && format === "pdf") {
        toast("PDF compilation unavailable — downloaded .tex file instead. Open it in Overleaf to compile.");
      } else {
        toast(`Resume downloaded as .${extension}`);
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex w-full font-sans my-10">
      <div className={`flex-grow transition-all duration-300 p-10 ${openPanel ? SIDE_PANEL_MARGIN_CLASS : ""}`}>
        <div className="flex items-center justify-between mb-4">
          <EditableTitleHeader
            label="Resume"
            title={title}
            onTitleChange={setTitle}
            saveTitle={(newTitle) => renameResume(resume.id, newTitle)}
            placeholder="Untitled Resume"
          />
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={downloading}>
                  {downloading ? (
                    <Loader2 size={16} className="mr-2 animate-spin" />
                  ) : (
                    <Download size={16} className="mr-2" />
                  )}
                  {downloading ? "Downloading..." : "Download"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleDownload("pdf")}>
                  <FileDown size={14} className="mr-2" /> Download PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDownload("tex")}>
                  <FileDown size={14} className="mr-2" /> Download .tex (Overleaf)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              className="border-brand text-brand hover:bg-green-50"
              onClick={() => togglePanel("ats")}
            >
              <ScanSearch size={16} className="mr-2" />
              {openPanel === "ats" ? "Close ATS" : "ATS Score"}
            </Button>
            <Button
              variant="outline"
              className="border-brand text-brand hover:bg-green-50"
              onClick={() => togglePanel("cv")}
            >
              <PanelRightOpen size={16} className="mr-2" />
              {openPanel === "cv" ? "Close CV" : "Master CV"}
            </Button>
          </div>
        </div>
        <div className="flex-grow flex flex-col">
          <div className="flex flex-col items-center justify-center flex-grow p-4">
            <div
              style={{ width: PAGE_WIDTH_PX, height: PAGE_HEIGHT_PX, padding: PAGE_PADDING_PX }}
              className="border border-gray-800 rounded-md bg-white box-border overflow-hidden"
            >
              <ResumeHeader header={resumeDoc.header} onChange={resumeDoc.updateHeaderField} />
              <SectionBoard
                sections={resumeDoc.sections}
                bulletFeedback={bulletFeedback}
                onMoveSection={resumeDoc.moveSection}
                onAddItem={resumeDoc.addBlankItem}
                onChangeItem={resumeDoc.updateItem}
                onDeleteItem={resumeDoc.deleteItem}
              />
            </div>
          </div>
        </div>
      </div>

      <CvDrawer cv={masterCv} open={openPanel === "cv"} onClose={closePanel} onAdd={handleAddFromCv} />
      <AtsPanel
        open={openPanel === "ats"}
        onClose={closePanel}
        resumeContent={resumeDoc.resumeContent}
        onScanComplete={setBulletFeedback}
        onAcceptSuggestion={resumeDoc.replaceBullet}
      />
    </div>
  );
}
