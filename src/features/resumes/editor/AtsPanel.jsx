"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, ScanSearch, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { scoreResume, suggestBullets } from "@/features/ats/api";
import { AtsResults } from "@/features/ats/AtsResults";
import { SidePanel } from "@/components/shared/SidePanel";

function SuggestionCard({ suggestion, onAccept, onDismiss }) {
  return (
    <div className="border rounded-lg p-3 space-y-2 bg-gray-50">
      <p className="text-xs text-gray-400">
        {suggestion.section} — bullet {suggestion.bulletIndex + 1}
      </p>
      <div className="text-xs space-y-1">
        <p className="text-red-600 line-through">{suggestion.original}</p>
        <p className="text-green-700">{suggestion.suggested}</p>
      </div>
      {suggestion.reason && <p className="text-xs text-gray-500 italic">{suggestion.reason}</p>}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs text-green-700 border-green-200 hover:bg-green-50"
          onClick={onAccept}
        >
          <Check size={12} className="mr-1" /> Accept
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs text-gray-500 hover:bg-gray-100"
          onClick={onDismiss}
        >
          <X size={12} className="mr-1" /> Dismiss
        </Button>
      </div>
    </div>
  );
}

// ATS score + AI bullet suggestions for the resume being edited
export default function AtsPanel({ open, onClose, resumeContent, onScanComplete, onAcceptSuggestion }) {
  const [jobDescription, setJobDescription] = useState("");
  const [result, setResult] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  // Indexes of suggestions that were accepted or dismissed
  const [handled, setHandled] = useState(() => new Set());

  const handleScan = async () => {
    if (!jobDescription.trim()) return;
    setScanning(true);
    setResult(null);
    setSuggestions([]);
    setHandled(new Set());
    try {
      const data = await scoreResume({ jobDescription, resumeContent });
      setResult(data);
      onScanComplete(data.bulletFeedback || []);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setScanning(false);
    }
  };

  const handleGetSuggestions = async () => {
    setLoadingSuggestions(true);
    try {
      setSuggestions(await suggestBullets({ jobDescription, resumeContent }));
      setHandled(new Set());
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const markHandled = (index) => setHandled((prev) => new Set(prev).add(index));

  const handleAccept = (suggestion, index) => {
    onAcceptSuggestion(
      suggestion.section,
      suggestion.itemIndex,
      suggestion.bulletIndex,
      suggestion.suggested
    );
    markHandled(index);
  };

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={
        <>
          <ScanSearch size={18} /> ATS Scanner
        </>
      }
      subtitle="Check how your resume matches a job posting"
    >
      <div className="p-4 space-y-4">
        <Textarea
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          placeholder="Paste the job description here..."
          className="min-h-[150px] text-sm"
        />
        <Button
          onClick={handleScan}
          disabled={scanning || !jobDescription.trim()}
          className="w-full"
          variant="outline"
        >
          {scanning ? (
            <>
              <Loader2 size={14} className="mr-2 animate-spin" /> Scanning...
            </>
          ) : (
            <>
              <ScanSearch size={14} className="mr-2" /> Scan Resume
            </>
          )}
        </Button>

        {result && (
          <>
            <AtsResults result={result} size="compact" />

            <div className="border-t pt-4">
              <Button
                onClick={handleGetSuggestions}
                disabled={loadingSuggestions}
                className="w-full"
                variant="default"
                size="sm"
              >
                {loadingSuggestions ? (
                  <>
                    <Loader2 size={14} className="mr-2 animate-spin" /> Generating suggestions...
                  </>
                ) : (
                  <>
                    <ScanSearch size={14} className="mr-2" />
                    {suggestions.length > 0 ? "Refresh Suggestions" : "Get AI Suggestions"}
                  </>
                )}
              </Button>
            </div>

            {suggestions.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                  Suggestions ({suggestions.length - handled.size} remaining)
                </p>
                <div className="space-y-3">
                  {suggestions.map((suggestion, index) =>
                    handled.has(index) ? null : (
                      <SuggestionCard
                        key={index}
                        suggestion={suggestion}
                        onAccept={() => handleAccept(suggestion, index)}
                        onDismiss={() => markHandled(index)}
                      />
                    )
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </SidePanel>
  );
}
