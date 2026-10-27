"use client";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import PaperCanvas from "@/features/resumes/studio/PaperCanvas";
import StudioToolbar from "@/features/resumes/studio/StudioToolbar";
import { saveBlob, useResumeDownload } from "@/features/resumes/hooks/useResumeDownload";
import { renameCoverLetter } from "@/features/cover-letters/actions";
import { countLetterPages, draftCoverLetter } from "@/features/cover-letters/api";
import { useLetterDocument } from "@/features/cover-letters/hooks/useLetterDocument";
import LetterAssistant from "@/features/cover-letters/studio/LetterAssistant";
import LetterPaper from "@/features/cover-letters/studio/LetterPaper";

// 0.75in top and bottom margin at 96 CSS px per inch (.rb-letter in globals.css)
const LETTER_MARGIN_Y_PX = 72;

const DOWNLOADS = [
  { format: "pdf", label: "PDF" },
  { format: "txt", label: "Plain text (.txt)" },
  { format: "tex", label: "LaTeX source (.tex, for Overleaf)" },
];

function plainText(letter) {
  const date = letter.date
    ? new Date(letter.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "";
  const { header, recipient } = letter;
  return [
    header.name,
    [header.contactEmail, header.contactPhone, header.linkedin, header.portfolio].filter(Boolean).join(" | "),
    "",
    date,
    recipient.name,
    recipient.company,
    "",
    letter.greeting,
    "",
    letter.paragraphs.filter((p) => p.trim()).join("\n\n"),
    "",
    letter.signOff,
    header.name,
  ]
    .filter((line, i, lines) => line !== "" || lines[i - 1] !== "")
    .join("\n")
    .trim();
}

/**
 * The cover letter editor: the editable letter page and an assistant for
 * tailoring it to a job. `coverLetter` and `jobOptions` come from
 * features/cover-letters/data.js and features/resumes/data.js.
 */
export default function LetterStudio({ coverLetter, jobOptions }) {
  const letterDoc = useLetterDocument({ coverLetterId: coverLetter.id, initialLetter: coverLetter.letter });
  const { letter } = letterDoc;
  const [title, setTitle] = useState(coverLetter.title);

  const fileDownload = useResumeDownload({
    title,
    flush: letterDoc.flush,
    endpoint: "/api/download-cover-letter",
    body: { coverLetterId: coverLetter.id },
    noun: "Cover letter",
  });
  const download = {
    downloading: fileDownload.downloading,
    download: (format) => {
      if (format !== "txt") return fileDownload.download(format);
      saveBlob(new Blob([plainText(letter)], { type: "text/plain" }), `${title || "cover-letter"}.txt`);
      toast("Cover letter downloaded as .txt");
    },
  };

  const [zoom, setZoom] = useState("fit");
  const [scale, setScale] = useState(1);
  const [fit, setFit] = useState({ usedPx: 0, limitPx: 0 });
  const onMeasure = useCallback((next) => setFit(next), []);
  const [assistantOpen, setAssistantOpen] = useState(false);

  // The compiled PDF's page count, valid until the letter changes
  const [pdfCheck, setPdfCheck] = useState({ status: "idle", pages: null, checked: null, error: null });
  const pdfPages = pdfCheck.status === "done" && pdfCheck.checked === letter ? pdfCheck.pages : null;
  const checkPdf = async () => {
    const checked = letter;
    setPdfCheck({ status: "checking", pages: null, checked: null, error: null });
    try {
      if (!(await letterDoc.flush()))
        return setPdfCheck({ status: "idle", pages: null, checked: null, error: null });
      const pages = await countLetterPages({ coverLetterId: coverLetter.id });
      setPdfCheck({ status: "done", pages, checked, error: null });
    } catch (error) {
      setPdfCheck({ status: "error", pages: null, checked: null, error: error.message });
    }
  };

  const [tone, setTone] = useState("professional");
  const [length, setLength] = useState("standard");
  const [drafting, setDrafting] = useState(false);
  const [draft, setDraft] = useState(null);

  const runDraft = async () => {
    setDrafting(true);
    try {
      const result = await draftCoverLetter({
        jobDescription: letter.target.jobDescription,
        companyName: letter.target.company || letter.recipient.company,
        role: letter.target.role,
        tone,
        length,
      });
      if (!result.paragraphs?.length) toast.error("The draft came back empty. Try again.");
      else setDraft(result);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setDrafting(false);
    }
  };

  const applyDraft = () => {
    const before = letterDoc.snapshot();
    letterDoc.update({
      paragraphs: draft.paragraphs,
      // Address the company the job is at, unless the user already wrote one
      recipient: {
        ...letter.recipient,
        company: letter.recipient.company || letter.target.company,
      },
    });
    setDraft(null);
    toast("Draft applied", { action: { label: "Undo", onClick: () => letterDoc.restore(before) } });
  };

  const changeTarget = (target) => {
    letterDoc.update({ target });
    setDraft(null);
  };

  return (
    // Fixed under the 73px nav bar so the editor fills the window; panes scroll on their own
    <div className="fixed inset-x-0 bottom-0 top-[73px] z-10 flex flex-col bg-background">
      <StudioToolbar
        label="Cover letter"
        rename={(newTitle) => renameCoverLetter(coverLetter.id, newTitle)}
        downloads={DOWNLOADS}
        fitBadgeClassName="xl:hidden"
        title={title}
        onTitleChange={setTitle}
        saveStatus={letterDoc.saveStatus}
        zoom={zoom}
        scale={scale}
        onZoom={setZoom}
        download={download}
        fit={fit}
        pdfPages={pdfPages}
        onToggleAssistant={() => setAssistantOpen((open) => !open)}
      />
      <div className="relative flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          <PaperCanvas
            zoom={zoom}
            onMeasure={onMeasure}
            onScaleChange={setScale}
            paperClassName="rb-paper rb-letter"
            marginYPx={LETTER_MARGIN_Y_PX}
          >
            <LetterPaper letterDoc={letterDoc} jobDescription={letter.target.jobDescription} />
          </PaperCanvas>
        </div>

        {assistantOpen && (
          <button
            type="button"
            aria-label="Close the assistant panel"
            onClick={() => setAssistantOpen(false)}
            className="absolute inset-0 z-20 bg-black/20 xl:hidden"
          />
        )}
        <aside
          aria-label="Assistant"
          className={cn(
            "w-[360px] shrink-0 border-l bg-background",
            "max-xl:absolute max-xl:inset-y-0 max-xl:right-0 max-xl:z-30 max-xl:w-full max-xl:max-w-[380px] max-xl:shadow-xl",
            assistantOpen ? "flex" : "max-xl:hidden xl:flex"
          )}
        >
          <LetterAssistant
            fit={fit}
            pdfCheck={{ ...pdfCheck, pages: pdfPages }}
            onCheckPdf={checkPdf}
            job={{ target: letter.target, options: jobOptions, onChange: changeTarget }}
            draft={{
              tone,
              setTone,
              length,
              setLength,
              drafting,
              result: draft,
              onDraft: runDraft,
              onApply: applyDraft,
              onDiscard: () => setDraft(null),
            }}
            onClose={() => setAssistantOpen(false)}
          />
        </aside>
      </div>
    </div>
  );
}
