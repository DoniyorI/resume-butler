"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ScanSearch,
  Check,
  X,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

function ScoreRing({ score, size = 80, strokeWidth = 6 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (score / 100) * circumference;

  let color = "#ef4444"; // red
  if (score >= 80) color = "#22c55e"; // green
  else if (score >= 60) color = "#eab308"; // yellow
  else if (score >= 40) color = "#f97316"; // orange

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <span
        className="absolute text-lg font-bold"
        style={{ color }}
      >
        {score}
      </span>
    </div>
  );
}

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
      const response = await fetch("/api/ats-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobDescription,
          resumeContent,
        }),
      });

      if (!response.ok) throw new Error("Scan failed");
      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error("ATS scan error:", error);
    } finally {
      setScanning(false);
    }
  };

  return (
    <Card>
      <CardHeader
        className="cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ScanSearch size={18} className="text-[#559F87]" />
            <CardTitle className="text-lg">ATS Scanner</CardTitle>
          </div>
          {result && !expanded && (
            <ScoreRing score={result.overallScore} size={40} strokeWidth={3} />
          )}
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
        <CardDescription>
          Paste a job description to see how well your resume matches
        </CardDescription>
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

          {result && (
            <div className="space-y-5 pt-2">
              {/* Score Overview */}
              <div className="flex items-center justify-around py-3 bg-gray-50 rounded-lg">
                <div className="text-center">
                  <ScoreRing score={result.overallScore} />
                  <p className="text-xs text-gray-500 mt-1">Overall</p>
                </div>
                <div className="text-center">
                  <ScoreRing score={result.keywordScore} size={60} strokeWidth={5} />
                  <p className="text-xs text-gray-500 mt-1">Keywords</p>
                </div>
                <div className="text-center">
                  <ScoreRing score={result.sectionScore} size={60} strokeWidth={5} />
                  <p className="text-xs text-gray-500 mt-1">Sections</p>
                </div>
              </div>

              {/* Matched Keywords */}
              {result.matched.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                    Matched ({result.matched.length}/{result.totalKeywords})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.matched.map((kw) => (
                      <Badge
                        key={kw}
                        variant="outline"
                        className="text-green-700 border-green-200 bg-green-50 text-xs"
                      >
                        <Check size={10} className="mr-1" />
                        {kw}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Missing Keywords */}
              {result.missing.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                    Missing ({result.missing.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.missing.map((kw) => (
                      <Badge
                        key={kw}
                        variant="outline"
                        className="text-red-700 border-red-200 bg-red-50 text-xs"
                      >
                        <X size={10} className="mr-1" />
                        {kw}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Section Checks */}
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                  Section Checklist
                </p>
                <div className="space-y-1">
                  {result.sectionChecks.map((check) => (
                    <div
                      key={check.label}
                      className="flex items-center gap-2 text-sm"
                    >
                      {check.present ? (
                        <Check size={14} className="text-green-500" />
                      ) : (
                        <AlertTriangle size={14} className="text-amber-500" />
                      )}
                      <span
                        className={
                          check.present ? "text-gray-600" : "text-amber-700"
                        }
                      >
                        {check.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
