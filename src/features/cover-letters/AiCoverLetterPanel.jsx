"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SidePanel } from "@/components/shared/SidePanel";
import { postJson } from "@/lib/postJson";

// The editor template already has the greeting and sign-off
function stripGreetingAndSignOff(text) {
  return text
    .replace(/^Dear Hiring Manager,?\s*/i, "")
    .replace(/\s*Sincerely,?\s*\n?.*/s, "")
    .trim();
}

function generateCoverLetter({ jobDescription, companyName }) {
  return postJson(
    "/api/generate-cover-letter",
    { jobDescription, companyName },
    "Failed to generate cover letter"
  );
}

// Side panel that drafts a cover letter from the master CV and a job description
export default function AiCoverLetterPanel({ open, onClose, onApply }) {
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
      const data = await generateCoverLetter({ jobDescription, companyName });
      setGeneratedText(data.body || "");
      setHighlights(data.highlights || []);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleApply = () => {
    onApply(stripGreetingAndSignOff(generatedText));
    toast("Cover letter applied to editor");
  };

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={
        <>
          <Sparkles size={18} /> AI Cover Letter
        </>
      }
      subtitle="Generate a cover letter from your Master CV"
    >
      <div className="p-4 space-y-4">
        <div>
          <label htmlFor="ai-company-name" className="text-sm font-medium text-gray-700 mb-1 block">
            Company Name
          </label>
          <input
            id="ai-company-name"
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="e.g. Google"
            className="w-full border rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="ai-job-description" className="text-sm font-medium text-gray-700 mb-1 block">
            Job Description
          </label>
          <Textarea
            id="ai-job-description"
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the job description here..."
            className="min-h-[150px] text-sm"
          />
        </div>
        <Button onClick={handleGenerate} disabled={generating || !jobDescription.trim()} className="w-full">
          {generating ? (
            <>
              <Loader2 size={14} className="mr-2 animate-spin" /> Generating...
            </>
          ) : (
            <>
              <Sparkles size={14} className="mr-2" /> Generate Cover Letter
            </>
          )}
        </Button>

        {generatedText && (
          <div className="space-y-4 pt-2">
            {highlights.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                  CV items used
                </p>
                <div className="space-y-1">
                  {highlights.map((highlight, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-gray-600">
                      <Check size={12} className="text-green-500 mt-0.5 flex-shrink-0" />
                      {highlight}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Preview</p>
              <div className="border rounded-md p-3 bg-gray-50 text-sm whitespace-pre-wrap max-h-[400px] overflow-y-auto">
                {generatedText}
              </div>
            </div>

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
    </SidePanel>
  );
}
