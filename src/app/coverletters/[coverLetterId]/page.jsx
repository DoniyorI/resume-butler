// CoverLetterEditor.jsx
"use client";

import React, { useState, useEffect } from "react";
import { Editor, EditorState, convertToRaw, convertFromRaw, ContentState } from "draft-js";
import "draft-js/dist/Draft.css";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { isValid, format } from "date-fns";
import {
  Sparkles,
  X,
  Loader2,
  Check,
  Download,
} from "lucide-react";

function CoverLetterEditor({ params }) {
  const { user, loading, supabase } = useAuth({ redirect: true });
  const [editorState, setEditorState] = useState(EditorState.createEmpty());
  const [date, setDate] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);

  const router = useRouter();
  const [header, setHeader] = useState({
    contactPhone: "",
    contactEmail: "",
    name: "",
    linkedin: "",
    portfolio: "",
  });
  const [coverLetterTitle, setCoverLetterTitle] = useState("");

  useEffect(() => {
    if (!user || !params.coverLetterId) return;

    const fetchCoverLetter = async () => {
      // Fetch cover letter and profile in parallel
      const [clRes, profileRes] = await Promise.all([
        supabase
          .from("cover_letters")
          .select("*")
          .eq("id", params.coverLetterId)
          .eq("user_id", user.id)
          .single(),
        supabase
          .from("profiles")
          .select("first_name, last_name, email, phone, linkedin, portfolio")
          .eq("id", user.id)
          .single(),
      ]);

      if (clRes.error || !clRes.data) {
        console.error("Cover letter not found:", clRes.error);
        return;
      }

      const data = clRes.data;
      const profile = profileRes.data || {};

      setCoverLetterTitle(data.title);

      if (data.content) {
        const content = typeof data.content === "string" ? JSON.parse(data.content) : data.content;
        if (content.header) {
          setHeader(content.header);
        }
        if (content.date) setDate(new Date(content.date));
        if (content.body) {
          try {
            setEditorState(EditorState.createWithContent(convertFromRaw(content.body)));
          } catch (e) {
            console.error("Error parsing editor content:", e);
          }
        }
      }

      // Auto-fill header from profile if empty
      setHeader((prev) => ({
        contactPhone: prev.contactPhone || profile.phone || "",
        contactEmail: prev.contactEmail || profile.email || user.email || "",
        name: prev.name || `${profile.first_name || ""} ${profile.last_name || ""}`.trim(),
        linkedin: prev.linkedin || profile.linkedin || "",
        portfolio: prev.portfolio || profile.portfolio || "",
      }));
    };

    fetchCoverLetter();
  }, [user, params.coverLetterId, supabase]);

  const handleSave = async () => {
    if (!user) return;

    const contentState = editorState.getCurrentContent();
    const rawContent = convertToRaw(contentState);

    const { error } = await supabase
      .from("cover_letters")
      .update({
        title: coverLetterTitle,
        content: {
          body: rawContent,
          header: header,
          date: date ? date.toISOString() : null,
        },
      })
      .eq("id", params.coverLetterId);

    if (error) {
      console.error("Error saving cover letter:", error);
      return;
    }
    toast("Cover letter saved");
  };

  const autoSave = async () => {
    if (!user || !params.coverLetterId) return;
    const { error } = await supabase
      .from("cover_letters")
      .update({ title: coverLetterTitle })
      .eq("id", params.coverLetterId);
    if (!error) {
      toast("Title Updated Successfully", {
        action: { label: "OK", onClick: () => toast.dismiss() },
      });
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setHeader({ ...header, [name]: value });
  };

  const handleDateChange = (selectedDate) => {
    setDate(selectedDate);
  };

  // Remove onBlur auto-save from header inputs — user saves manually via Save button

  // Apply AI-generated text to editor
  const handleApplyGenerated = (text) => {
    const contentState = ContentState.createFromText(text);
    setEditorState(EditorState.createWithContent(contentState));
    handleSave();
  };

  const handleDownload = () => {
    const content = editorState.getCurrentContent().getPlainText("\n");
    const fullText = [
      header.name,
      header.contactPhone,
      header.contactEmail,
      header.linkedin,
      "",
      isValid(date) ? format(date, "PPP") : "",
      "",
      "Dear Hiring Manager,",
      "",
      content,
      "",
      "Sincerely,",
      header.name,
      header.contactPhone,
      header.contactEmail,
    ].filter((line) => line !== undefined).join("\n");

    const blob = new Blob([fullText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${coverLetterTitle || "cover-letter"}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast("Cover letter downloaded");
  };

  if (loading || !user) {
    return <p>Loading...</p>;
  }

  return (
    <div className="flex w-full font-sans my-10">
      <div className={`flex-grow transition-all duration-300 p-10 ${aiPanelOpen ? "mr-[420px]" : ""}`}>
        <div className="flex items-center justify-between mb-4">
          <EditorHeader
            title={coverLetterTitle}
            setCoverLetterTitle={setCoverLetterTitle}
            editingTitle={editingTitle}
            setEditingTitle={setEditingTitle}
            autoSave={autoSave}
          />
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleDownload}>
              <Download size={16} className="mr-2" /> Download
            </Button>
            <Button variant="outline" onClick={handleSave}>
              Save
            </Button>
            <Button
              variant="outline"
              className="border-[#559F87] text-[#559F87] hover:bg-green-50"
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
                <input type="text" name="contactPhone" value={header.contactPhone} onChange={handleInputChange} className="border px-1 cursor-text" placeholder="Phone" />
                <input type="text" name="contactEmail" value={header.contactEmail} onChange={handleInputChange} className="border px-1 flex-grow cursor-text" placeholder="Email" />
              </div>
              <div className="text-center">
                <input type="text" name="name" value={header.name} onChange={handleInputChange} className="text-2xl font-bold border text-center cursor-text" placeholder="Your Name" />
              </div>
              <div className="flex flex-col space-y-1 text-right">
                <input type="text" name="linkedin" value={header.linkedin} onChange={handleInputChange} className="border px-1 text-right cursor-text" placeholder="LinkedIn" />
                <input type="text" name="portfolio" value={header.portfolio} onChange={handleInputChange} className="border px-1 text-right cursor-text" placeholder="Portfolio" />
              </div>
            </div>
            <div className="flex flex-col p-4">
              <div className="flex items-center pb-1">
                <div>Date:</div>
                <div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" className="text-left text-md p-2 font-medium">
                        {isValid(date) ? format(date, "PPP") : "Select a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent>
                      <Calendar mode="single" selected={date} onSelect={handleDateChange} />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="py-1 pb-3">Dear Hiring Manager,</div>
              <Editor
                editorState={editorState}
                onChange={setEditorState}
                               placeholder="Write your cover letter here..."
              />
              <div className="mt-3">Sincerely,</div>
              <input type="text" name="name" value={header.name} onChange={handleInputChange} className="w-1/5 cursor-text" />
              <input type="text" name="contactPhone" value={header.contactPhone} onChange={handleInputChange} className="w-1/5 cursor-text" />
              <input type="text" name="contactEmail" value={header.contactEmail} onChange={handleInputChange} className="w-1/3 cursor-text" />
            </div>
          </div>
        </div>
      </div>

      {/* AI Panel */}
      <AiCoverLetterPanel
        open={aiPanelOpen}
        onClose={() => setAiPanelOpen(false)}
        onApply={handleApplyGenerated}
        userName={header.name}
      />
    </div>
  );
}

export default CoverLetterEditor;

function AiCoverLetterPanel({ open, onClose, onApply, userName }) {
  const [jobDescription, setJobDescription] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [generatedText, setGeneratedText] = useState("");
  const [highlights, setHighlights] = useState([]);
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!jobDescription.trim()) return;
    setGenerating(true);
    setGeneratedText("");
    setHighlights([]);

    try {
      const response = await fetch("/api/generate-cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription, companyName }),
      });

      if (!response.ok) throw new Error("Failed to generate");
      const data = await response.json();
      setGeneratedText(data.body || "");
      setHighlights(data.highlights || []);
    } catch (error) {
      console.error("Generation error:", error);
      toast("Failed to generate cover letter");
    } finally {
      setGenerating(false);
    }
  };

  const handleApply = () => {
    // Remove the "Dear Hiring Manager," and "Sincerely, Name" since those are in the template
    let text = generatedText;
    text = text.replace(/^Dear Hiring Manager,?\s*/i, "");
    text = text.replace(/\s*Sincerely,?\s*\n?.*/s, "");
    onApply(text.trim());
    toast("Cover letter applied to editor");
  };

  return (
    <div
      className={`fixed top-16 right-0 h-[calc(100vh-64px)] w-[420px] bg-white border-l shadow-lg z-30 transform transition-transform duration-300 ease-in-out ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h2 className="font-semibold text-[#559F87] text-lg flex items-center gap-2">
            <Sparkles size={18} /> AI Cover Letter
          </h2>
          <p className="text-xs text-gray-400">
            Generate a cover letter from your Master CV
          </p>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X size={16} />
        </Button>
      </div>

      <ScrollArea className="h-[calc(100vh-145px)]">
        <div className="p-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Company Name</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Google"
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Job Description</label>
            <Textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the job description here..."
              className="min-h-[150px] text-sm"
            />
          </div>
          <Button
            onClick={handleGenerate}
            disabled={generating || !jobDescription.trim()}
            className="w-full"
          >
            {generating ? (
              <><Loader2 size={14} className="mr-2 animate-spin" /> Generating...</>
            ) : (
              <><Sparkles size={14} className="mr-2" /> Generate Cover Letter</>
            )}
          </Button>

          {generatedText && (
            <div className="space-y-4 pt-2">
              {/* Highlights */}
              {highlights.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                    CV items used
                  </p>
                  <div className="space-y-1">
                    {highlights.map((h, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-gray-600">
                        <Check size={12} className="text-green-500 mt-0.5 flex-shrink-0" />
                        {h}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview */}
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                  Preview
                </p>
                <div className="border rounded-md p-3 bg-gray-50 text-sm whitespace-pre-wrap max-h-[400px] overflow-y-auto">
                  {generatedText}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button onClick={handleApply} className="flex-grow">
                  <Check size={14} className="mr-2" /> Apply to Editor
                </Button>
                <Button variant="outline" onClick={handleGenerate} disabled={generating}>
                  Regenerate
                </Button>
              </div>

              <p className="text-xs text-gray-400 text-center">
                Review and edit the text after applying — this is a starting point, not the final version
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

const EditorHeader = ({ title, setCoverLetterTitle, editingTitle, setEditingTitle, autoSave }) => (
  <h1 className="text-3xl font-medium text-[#559F87]">
    Cover Letter:
    {editingTitle ? (
      <input
        type="text"
        value={title}
        onChange={(e) => setCoverLetterTitle(e.target.value)}
        onBlur={() => { autoSave(); setEditingTitle(false); }}
        className="bg-transparent border-gray-600 ml-2"
        placeholder="Untitled Cover Letter"
      />
    ) : (
      <span onDoubleClick={() => setEditingTitle(true)} className="ml-2 cursor-pointer">
        {title || "Untitled Cover Letter"}
      </span>
    )}
  </h1>
);
