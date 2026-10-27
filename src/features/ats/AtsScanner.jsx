"use client";
import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Loader2, ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { scoreResume } from "@/features/ats/api";
import { AtsResults } from "@/features/ats/AtsResults";
import { ScoreRing } from "@/features/ats/ScoreRing";

// Collapsible ATS score card (used on the application detail page)
export default function AtsScanner({ resumeContent, initialJobDescription = "" }) {
  const [jobDescription, setJobDescription] = useState(initialJobDescription);
  const [result, setResult] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const handleScan = async () => {
    if (!jobDescription.trim()) return;
    setScanning(true);
    setResult(null);
    try {
      setResult(await scoreResume({ jobDescription, resumeContent }));
    } catch (error) {
      toast.error(error.message);
    } finally {
      setScanning(false);
    }
  };

  return (
    <Card>
      <CardHeader className="cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ScanSearch size={18} className="text-brand" />
            <CardTitle className="text-lg">ATS Scanner</CardTitle>
          </div>
          {result && !expanded && <ScoreRing score={result.overallScore} size={40} strokeWidth={3} />}
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
        <CardDescription>Paste a job description to see how well your resume matches</CardDescription>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4">
          <Textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the job description here..."
            className="min-h-[120px] text-sm"
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

          {result && <AtsResults result={result} />}
        </CardContent>
      )}
    </Card>
  );
}
