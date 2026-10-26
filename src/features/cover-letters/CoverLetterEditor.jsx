"use client";
import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { format, isValid } from "date-fns";
import { toast } from "sonner";
import { Download, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { renameCoverLetter, saveCoverLetter } from "@/features/cover-letters/actions";
import { EditableTitleHeader } from "@/features/resumes/EditableTitleHeader";
import { SIDE_PANEL_MARGIN_CLASS } from "@/components/shared/SidePanel";

// Draft.js and the AI panel are client-only chunks
const CoverLetterBodyEditor = dynamic(() => import("@/features/cover-letters/CoverLetterBodyEditor"), {
  ssr: false,
  loading: () => <p className="text-gray-400">Loading editor...</p>,
});
const AiCoverLetterPanel = dynamic(() => import("@/features/cover-letters/AiCoverLetterPanel"), {
  ssr: false,
});

const GREETING = "Dear Hiring Manager,";
const SIGN_OFF = "Sincerely,";

function formatLetterDate(date) {
  return isValid(date) ? format(date, "PPP") : "";
}

function downloadText(text, filename) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function HeaderInput({ header, name, onChange, ...props }) {
  return <input type="text" name={name} value={header[name]} onChange={onChange} {...props} />;
}

// `coverLetter` comes from getCoverLetterForEditor in features/cover-letters/data.js
export default function CoverLetterEditor({ coverLetter }) {
  const [title, setTitle] = useState(coverLetter.title);
  const [header, setHeader] = useState(coverLetter.header);
  const [date, setDate] = useState(() => (coverLetter.date ? new Date(coverLetter.date) : undefined));
  const [aiPanelOpen, setAiPanelOpen] = useState(false);

  // The body lives in the Draft.js editor; it reports { raw, plainText } here.
  // Replacing the text (AI apply) remounts the editor with a new key.
  const bodyRef = useRef({ raw: coverLetter.body, plainText: "" });
  const [bodySeed, setBodySeed] = useState({ key: 0, initial: { raw: coverLetter.body } });
  const saveAfterApplyRef = useRef(false);

  const save = async (body = bodyRef.current.raw) => {
    if (!body) {
      toast.error("The editor is still loading");
      return;
    }
    const result = await saveCoverLetter(coverLetter.id, {
      title,
      content: { body, header, date: isValid(date) ? date.toISOString() : null },
    }).catch(() => ({ ok: false, error: "Failed to save cover letter" }));
    if (result.ok) toast("Cover letter saved");
    else toast.error(result.error);
  };

  const handleBodyChange = (body) => {
    bodyRef.current = body;
    if (saveAfterApplyRef.current) {
      saveAfterApplyRef.current = false;
      save(body.raw);
    }
  };

  const handleApplyGenerated = (text) => {
    saveAfterApplyRef.current = true;
    setBodySeed((prev) => ({ key: prev.key + 1, initial: { text } }));
  };

  const handleHeaderChange = (e) => {
    const { name, value } = e.target;
    setHeader((prev) => ({ ...prev, [name]: value }));
  };

  const handleDownload = () => {
    const lines = [
      header.name,
      header.contactPhone,
      header.contactEmail,
      header.linkedin,
      "",
      formatLetterDate(date),
      "",
      GREETING,
      "",
      bodyRef.current.plainText,
      "",
      SIGN_OFF,
      header.name,
      header.contactPhone,
      header.contactEmail,
    ];
    downloadText(lines.join("\n"), `${title || "cover-letter"}.txt`);
    toast("Cover letter downloaded");
  };

  const headerInputProps = { header, onChange: handleHeaderChange };

  return (
    <div className="flex w-full font-sans my-10">
      <div className={`flex-grow transition-all duration-300 p-10 ${aiPanelOpen ? SIDE_PANEL_MARGIN_CLASS : ""}`}>
        <div className="flex items-center justify-between mb-4">
          <EditableTitleHeader
            label="Cover Letter"
            title={title}
            onTitleChange={setTitle}
            saveTitle={(newTitle) => renameCoverLetter(coverLetter.id, newTitle)}
            placeholder="Untitled Cover Letter"
          />
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleDownload}>
              <Download size={16} className="mr-2" /> Download
            </Button>
            <Button variant="outline" onClick={() => save()}>
              Save
            </Button>
            <Button
              variant="outline"
              className="border-brand text-brand hover:bg-green-50"
              onClick={() => setAiPanelOpen(!aiPanelOpen)}
            >
              <Sparkles size={16} className="mr-2" />
              {aiPanelOpen ? "Close AI" : "AI Assistant"}
            </Button>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center flex-grow p-4">
          <div className="w-[850px] min-h-[1100px] border border-gray-800 rounded-md bg-white box-border overflow-hidden p-4">
            <div className="border-b-2 border-black p-4 flex justify-between items-center">
              <div className="flex flex-col space-y-1">
                <HeaderInput {...headerInputProps} name="contactPhone" className="border px-1 cursor-text" placeholder="Phone" />
                <HeaderInput {...headerInputProps} name="contactEmail" className="border px-1 flex-grow cursor-text" placeholder="Email" />
              </div>
              <div className="text-center">
                <HeaderInput {...headerInputProps} name="name" className="text-2xl font-bold border text-center cursor-text" placeholder="Your Name" />
              </div>
              <div className="flex flex-col space-y-1 text-right">
                <HeaderInput {...headerInputProps} name="linkedin" className="border px-1 text-right cursor-text" placeholder="LinkedIn" />
                <HeaderInput {...headerInputProps} name="portfolio" className="border px-1 text-right cursor-text" placeholder="Portfolio" />
              </div>
            </div>
            <div className="flex flex-col p-4">
              <div className="flex items-center pb-1">
                <div>Date:</div>
                <div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" className="text-left text-md p-2 font-medium">
                        {formatLetterDate(date) || "Select a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent>
                      <Calendar mode="single" selected={date} onSelect={setDate} />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="py-1 pb-3">{GREETING}</div>
              <CoverLetterBodyEditor key={bodySeed.key} initial={bodySeed.initial} onChange={handleBodyChange} />
              <div className="mt-3">{SIGN_OFF}</div>
              <HeaderInput {...headerInputProps} name="name" className="w-1/5 cursor-text" />
              <HeaderInput {...headerInputProps} name="contactPhone" className="w-1/5 cursor-text" />
              <HeaderInput {...headerInputProps} name="contactEmail" className="w-1/3 cursor-text" />
            </div>
          </div>
        </div>
      </div>

      <AiCoverLetterPanel
        open={aiPanelOpen}
        onClose={() => setAiPanelOpen(false)}
        onApply={handleApplyGenerated}
      />
    </div>
  );
}
