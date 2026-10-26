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
import { useResumeDownload } from "@/features/resumes/hooks/useResumeDownload";
import ViewSwitch from "@/components/shared/ViewSwitch";
import { editorViews } from "@/features/resumes/studio/editorViews";

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
  const [bulletFeedback, setBulletFeedback] = useState([]);
  const { download: handleDownload, downloading } = useResumeDownload({
    resumeId: resume.id,
    title,
    flush: resumeDoc.flush,
  });

  const togglePanel = (panel) => setOpenPanel((current) => (current === panel ? null : panel));
  const closePanel = () => setOpenPanel(null);

  const handleAddFromCv = (sectionId, item) => {
    resumeDoc.addItem(sectionId, item);
    toast(ADDED_FROM_CV[sectionId]);
  };

  return (
    <div className="flex w-full font-sans my-10">
      <div
        className={`flex-grow transition-all duration-300 p-10 ${openPanel ? SIDE_PANEL_MARGIN_CLASS : ""}`}
      >
        <div className="flex items-center justify-between mb-4">
          <EditableTitleHeader
            label="Resume"
            title={title}
            onTitleChange={setTitle}
            saveTitle={(newTitle) => renameResume(resume.id, newTitle)}
            placeholder="Untitled Resume"
          />
          <div className="flex items-center gap-2">
            <ViewSwitch views={editorViews(resume.id)} current={`/resumes/${resume.id}`} />
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
