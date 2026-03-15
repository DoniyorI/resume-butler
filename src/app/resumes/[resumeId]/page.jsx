"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { toast } from "sonner";

import { Slider } from "@/components/ui/slider";
import { ZoomIn, ZoomOut } from "lucide-react";

import { EducationForm } from "./_components/educationForm";
import { ExperienceForm } from "./_components/experienceForm";
import { ProjectsForm } from "./_components/projectForm";
import { SkillsForm } from "./_components/skillsForm";
import { ResumeHeader } from "./_components/resumeHeader";

import { Trash2, GripVertical, Download, FileDown, Loader2, ScanSearch, X, Check, AlertTriangle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { CvDrawer } from "./_components/cvDrawer";

export default function Page({ params }) {
  const { user, loading, supabase } = useAuth({ redirect: true });
  const router = useRouter();

  const [editingTitle, setEditingTitle] = useState(false);
  const [resumeTitle, setResumeTitle] = useState("");
  const [education, setEducation] = useState([]);
  const [experience, setExperience] = useState([]);
  const [projects, setProjects] = useState([]);
  const [skills, setSkills] = useState([]);
  const [sections, setSections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [resumeData, setResumeData] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [atsOpen, setAtsOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [bulletFeedback, setBulletFeedback] = useState([]);

  const saveToSupabase = async (updates) => {
    if (!user || !params.resumeId) return;
    const { error } = await supabase
      .from("resumes")
      .update(updates)
      .eq("id", params.resumeId);
    if (error) console.error("Error saving resume:", error);
  };

  useEffect(() => {
    if (!user || !params.resumeId) return;

    const fetchResume = async () => {
      const { data, error } = await supabase
        .from("resumes")
        .select("*")
        .eq("id", params.resumeId)
        .eq("user_id", user.id)
        .single();

      if (error || !data) {
        console.error("Error fetching resume:", error);
        router.push("/404");
        return;
      }

      setResumeData(data);
      setResumeTitle(data.title);

      // Resume content is stored as JSONB or we use resume_items
      // For now, keep inline arrays for backward compat
      const content = data.content || {};
      setEducation(content.education || []);
      setExperience(content.experience || []);
      setProjects(content.projects || []);
      setSkills(content.skills || []);

      const orderedSections = content.order || [
        { id: "education", title: "Education", content: content.education || [] },
        { id: "experience", title: "Experience", content: content.experience || [] },
        { id: "projects", title: "Projects", content: content.projects || [] },
        { id: "skills", title: "Skills", content: content.skills || [] },
      ];

      setSections(orderedSections);
      setIsLoading(false);
      // Mark initialized so auto-save starts after load
      setTimeout(() => setInitialized(true), 100);
    };

    fetchResume();
  }, [user, params.resumeId, router, supabase]);

  useEffect(() => {
    const updatedSections = sections.map((section) => {
      switch (section.id) {
        case "education": return { ...section, content: education };
        case "experience": return { ...section, content: experience };
        case "projects": return { ...section, content: projects };
        case "skills": return { ...section, content: skills };
        default: return section;
      }
    });
    setSections(updatedSections);
  }, [education, experience, projects, skills]);

  // Auto-save whenever content changes (after initial load)
  useEffect(() => {
    if (!initialized || !user || !params.resumeId) return;

    const saveTimeout = setTimeout(async () => {
      const { data } = await supabase
        .from("resumes")
        .select("content")
        .eq("id", params.resumeId)
        .single();

      const existing = data?.content || {};
      saveToSupabase({
        content: {
          ...existing,
          education,
          experience,
          projects,
          skills,
          order: sections,
        },
      });
    }, 500); // Debounce 500ms

    return () => clearTimeout(saveTimeout);
  }, [education, experience, projects, skills, sections, initialized]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  const width = 850;
  const height = 1230;
  const scaledPadding = 30;

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(sections);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setSections(items); // auto-save useEffect will handle persistence
  };

  const autoSave = async () => {
    await saveToSupabase({ title: resumeTitle });
    toast("Title Updated Successfully", {
      action: { label: "OK", onClick: () => toast.dismiss() },
    });
  };

  const getBulletSeverities = (sectionId, itemIndex) => {
    return bulletFeedback
      .filter((fb) => fb.section === sectionId && fb.itemIndex === itemIndex)
      .reduce((acc, fb) => {
        acc[fb.bulletIndex] = fb;
        return acc;
      }, {});
  };

  const renderItem = (item, sectionId, index) => {
    switch (sectionId) {
      case "education":
        return <EducationForm item={item} onChange={(data) => handleEducationChange(index, data)} />;
      case "experience":
        return <ExperienceForm item={item} onChange={(data) => handleExperienceChange(index, data)} bulletSeverities={getBulletSeverities("experience", index)} />;
      case "projects":
        return <ProjectsForm item={item} onChange={(data) => handleProjectChange(index, data)} bulletSeverities={getBulletSeverities("projects", index)} />;
      case "skills":
        return <SkillsForm item={item} onChange={(data) => handleSkillChange(index, data)} />;
      default: return null;
    }
  };

  const sortByDateDesc = (items) => {
    return [...items].sort((a, b) => {
      const aCurrent = a.currentlyWorking || a.currently_working;
      const bCurrent = b.currentlyWorking || b.currently_working;
      // Current/present items always go first
      if (aCurrent && !bCurrent) return -1;
      if (!aCurrent && bCurrent) return 1;
      // Then sort by start date descending
      const dateA = a.startDate || a.start_date;
      const dateB = b.startDate || b.start_date;
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      return new Date(dateB) - new Date(dateA);
    });
  };

  const handleEducationChange = (index, newData) => {
    setEducation((prev) => {
      const updated = prev.map((item, idx) => idx === index ? { ...item, ...newData } : item);
      return sortByDateDesc(updated);
    });
  };

  const handleExperienceChange = (index, newData) => {
    setExperience((prev) => {
      const updated = prev.map((item, idx) => idx === index ? { ...item, ...newData } : item);
      return sortByDateDesc(updated);
    });
  };

  const handleProjectChange = (index, newData) => {
    setProjects((prev) => {
      const updated = prev.map((item, idx) => idx === index ? { ...item, ...newData } : item);
      return sortByDateDesc(updated);
    });
  };

  const handleSkillChange = (index, newData) => {
    setSkills((prev) => prev.map((item, idx) => idx === index ? { ...item, ...newData } : item));
  };

  const handleAdd = (section) => {
    switch (section) {
      case "Education": addEducation(); break;
      case "Experience": addExperience(); break;
      case "Projects": addProjects(); break;
      case "Skills": addSkills(); break;
    }
  };

  const addEducation = () => {
    setEducation((prev) => [...prev, { degreeType: "", endDate: "", location: "", gpa: "", major: "", school: "", startDate: "" }]);
  };

  const addExperience = () => {
    setExperience((prev) => [...prev, { companyName: "", position: "", startDate: "", endDate: "", location: "", description: "", currentlyWorking: false }]);
  };

  const addProjects = () => {
    setProjects((prev) => [...prev, { projectName: "", description: "", startDate: "", endDate: "", currentlyWorking: false }]);
  };

  const addSkills = () => {
    setSkills((prev) => [...prev, { header: "", skills: [] }]);
  };

  const handleDelete = (section, index) => {
    switch (section) {
      case "education": setEducation((prev) => prev.filter((_, i) => i !== index)); break;
      case "experience": setExperience((prev) => prev.filter((_, i) => i !== index)); break;
      case "projects": setProjects((prev) => prev.filter((_, i) => i !== index)); break;
      case "skills": setSkills((prev) => prev.filter((_, i) => i !== index)); break;
    }
  };

  if (loading || !user) {
    return <p>Loading...</p>;
  }

  const handleDownload = async (format) => {
    setDownloading(true);
    try {
      const response = await fetch("/api/download-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeId: params.resumeId, format }),
      });

      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
      const ext = format === "tex" ? "tex" : "pdf";
      const contentType = response.headers.get("Content-Type");
      const actualExt = contentType?.includes("x-tex") ? "tex" : ext;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${resumeTitle || "resume"}.${actualExt}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (actualExt === "tex" && format === "pdf") {
        toast("PDF compilation unavailable — downloaded .tex file instead. Open it in Overleaf to compile.");
      } else {
        toast(`Resume downloaded as .${actualExt}`);
      }
    } catch (error) {
      console.error("Download error:", error);
      toast("Failed to download resume");
    } finally {
      setDownloading(false);
    }
  };

  const addFromCV = {
    onAddEducation: (item) => {
      setEducation((prev) => sortByDateDesc([...prev, item]));
      toast("Education added from CV");
    },
    onAddExperience: (item) => {
      setExperience((prev) => sortByDateDesc([...prev, item]));
      toast("Experience added from CV");
    },
    onAddProject: (item) => {
      setProjects((prev) => sortByDateDesc([...prev, item]));
      toast("Project added from CV");
    },
    onAddSkills: (item) => {
      setSkills((prev) => [...prev, item]);
      toast("Skills added from CV");
    },
  };

  return (
    <div className="flex w-full font-sans my-10">
      {/* Main content — shrinks when drawer opens */}
      <div className={`flex-grow transition-all duration-300 p-10 ${drawerOpen || atsOpen ? "mr-[420px]" : ""}`}>
        <div className="flex items-center justify-between mb-4">
          <Header
            resumeTitle={resumeTitle}
            setResumeTitle={setResumeTitle}
            editingTitle={editingTitle}
            setEditingTitle={setEditingTitle}
            autoSave={autoSave}
          />
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  disabled={downloading}
                >
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
              className="border-[#559F87] text-[#559F87] hover:bg-green-50"
              onClick={() => { setAtsOpen(!atsOpen); if (!atsOpen) setDrawerOpen(false); }}
            >
              <ScanSearch size={16} className="mr-2" />
              {atsOpen ? "Close ATS" : "ATS Score"}
            </Button>
            <CvDrawer {...addFromCV} open={drawerOpen} onToggle={() => { setDrawerOpen(!drawerOpen); if (!drawerOpen) setAtsOpen(false); }} />
          </div>
        </div>
        <div className="flex-grow flex flex-col">
          <div className="flex flex-col items-center justify-center flex-grow p-4">
            <div
              style={{ width: `${width}px`, height: `${height}px`, padding: `${scaledPadding}px` }}
              className="border border-gray-800 rounded-md bg-white box-border overflow-hidden"
            >
            <ResumeHeader className="mb-2" params={params} />
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="sections" type="sections">
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef}>
                    {sections.map((section, index) => (
                      <Draggable key={section.id} draggableId={section.id} index={index}>
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className="mb-2 mt-[-6pt]"
                          >
                            <h2 className="flex justify-between items-center text-left text-lg font-bold small-caps border-black pl-1 border-b-2">
                              <div className="flex items-center gap-1">
                                <GripVertical size={14} className="text-gray-300 cursor-grab" />
                                {section.title}
                              </div>
                              <button
                                className="text-[#188665] font-light text-sm hover:bg-green-100 px-2 py-1"
                                onClick={() => handleAdd(section.title)}
                              >
                                + Add {section.title}
                              </button>
                            </h2>
                            {section.content.map((item, innerIndex) => (
                              <div key={innerIndex} className="text-left text-sm pl-2 relative">
                                {renderItem(item, section.id, innerIndex)}
                                <Trash2
                                  size={16}
                                  strokeWidth={1}
                                  className="absolute -left-5 top-1/3 cursor-pointer hover:text-red-500"
                                  onClick={() => handleDelete(section.id, innerIndex)}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </div>
        </div>
        </div>
      </div>

      {/* ATS Scanner slide-out panel */}
      <AtsPanel
        open={atsOpen}
        onClose={() => setAtsOpen(false)}
        resumeContent={{
          header: resumeData?.content?.header || {},
          education,
          experience,
          projects,
          skills,
        }}
        onScanComplete={(feedback) => setBulletFeedback(feedback)}
        onAcceptSuggestion={(section, itemIndex, bulletIndex, newText) => {
          if (section === "experience") {
            setExperience((prev) => prev.map((item, idx) => {
              if (idx !== itemIndex) return item;
              const desc = Array.isArray(item.description) ? [...item.description] : [];
              desc[bulletIndex] = newText;
              return { ...item, description: desc };
            }));
          } else if (section === "projects") {
            setProjects((prev) => prev.map((item, idx) => {
              if (idx !== itemIndex) return item;
              const desc = Array.isArray(item.description) ? [...item.description] : [];
              desc[bulletIndex] = newText;
              return { ...item, description: desc };
            }));
          }
        }}
      />
    </div>
  );
}

function AtsPanel({ open, onClose, resumeContent, onScanComplete, onAcceptSuggestion }) {
  const [jobDescription, setJobDescription] = useState("");
  const [result, setResult] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [acceptedIds, setAcceptedIds] = useState(new Set());
  const [dismissedIds, setDismissedIds] = useState(new Set());

  const handleScan = async () => {
    if (!jobDescription.trim()) return;
    setScanning(true);
    setResult(null);
    setSuggestions([]);
    setAcceptedIds(new Set());
    setDismissedIds(new Set());
    try {
      const response = await fetch("/api/ats-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription, resumeContent }),
      });
      if (!response.ok) throw new Error("Scan failed");
      const data = await response.json();
      setResult(data);
      if (onScanComplete) onScanComplete(data.bulletFeedback || []);
    } catch (error) {
      console.error("ATS scan error:", error);
    } finally {
      setScanning(false);
    }
  };

  const handleGetSuggestions = async () => {
    setLoadingSuggestions(true);
    try {
      const response = await fetch("/api/suggest-bullets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription, resumeContent }),
      });
      if (!response.ok) throw new Error("Failed to get suggestions");
      const data = await response.json();
      setSuggestions(data.suggestions || []);
    } catch (error) {
      console.error("Suggestion error:", error);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleAccept = (suggestion, idx) => {
    onAcceptSuggestion(suggestion.section, suggestion.itemIndex, suggestion.bulletIndex, suggestion.suggested);
    setAcceptedIds((prev) => new Set([...prev, idx]));
  };

  const handleDismiss = (idx) => {
    setDismissedIds((prev) => new Set([...prev, idx]));
  };

  const ScoreRing = ({ score, size = 70, strokeWidth = 5 }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (score / 100) * circumference;
    let color = "#ef4444";
    if (score >= 80) color = "#22c55e";
    else if (score >= 60) color = "#eab308";
    else if (score >= 40) color = "#f97316";
    return (
      <div className="relative inline-flex items-center justify-center">
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth} />
          <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} className="transition-all duration-700 ease-out" />
        </svg>
        <span className="absolute text-sm font-bold" style={{ color }}>{score}</span>
      </div>
    );
  };

  return (
    <div className={`fixed top-16 right-0 h-[calc(100vh-64px)] w-[420px] bg-white border-l shadow-lg z-30 transform transition-transform duration-300 ease-in-out ${open ? "translate-x-0" : "translate-x-full"}`}>
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h2 className="font-semibold text-[#559F87] text-lg flex items-center gap-2">
            <ScanSearch size={18} /> ATS Scanner
          </h2>
          <p className="text-xs text-gray-400">Check how your resume matches a job posting</p>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X size={16} />
        </Button>
      </div>

      <ScrollArea className="h-[calc(100vh-145px)]">
        <div className="p-4 space-y-4">
          <div>
            <Textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the job description here..."
              className="min-h-[150px] text-sm"
            />
          </div>
          <Button onClick={handleScan} disabled={scanning || !jobDescription.trim()} className="w-full" variant="outline">
            {scanning ? (<><Loader2 size={14} className="mr-2 animate-spin" /> Scanning...</>) : (<><ScanSearch size={14} className="mr-2" /> Scan Resume</>)}
          </Button>

          {result && (
            <div className="space-y-5 pt-2">
              {/* Scores */}
              <div className="flex items-center justify-around py-4 bg-gray-50 rounded-lg">
                <div className="text-center">
                  <ScoreRing score={result.overallScore} />
                  <p className="text-xs text-gray-500 mt-1">Overall</p>
                </div>
                <div className="text-center">
                  <ScoreRing score={result.keywordScore} size={50} strokeWidth={4} />
                  <p className="text-xs text-gray-500 mt-1">Keywords</p>
                </div>
                <div className="text-center">
                  <ScoreRing score={result.sectionScore} size={50} strokeWidth={4} />
                  <p className="text-xs text-gray-500 mt-1">Sections</p>
                </div>
                <div className="text-center">
                  <ScoreRing score={result.qualityScore} size={50} strokeWidth={4} />
                  <p className="text-xs text-gray-500 mt-1">Quality</p>
                </div>
              </div>

              {/* Matched */}
              {result.matched.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                    Matched ({result.matched.length}/{result.totalKeywords})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.matched.map((kw) => (
                      <span key={kw} className="inline-flex items-center text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">
                        <Check size={10} className="mr-1" />{kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Missing */}
              {result.missing.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                    Missing ({result.missing.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.missing.map((kw) => (
                      <span key={kw} className="inline-flex items-center text-xs bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full">
                        <X size={10} className="mr-1" />{kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Grouped Checklist */}
              {[
                { key: "header", title: "Header" },
                { key: "sections", title: "Sections" },
                { key: "quality", title: "Bullet Point Quality" },
              ].map(({ key, title }) => {
                const items = result.sectionChecks.filter((c) => c.category === key);
                if (items.length === 0) return null;
                return (
                  <div key={key}>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">{title}</p>
                    <div className="space-y-1.5">
                      {items.map((check) => (
                        <div key={check.label} className="flex items-center gap-2 text-sm">
                          {check.present ? <Check size={14} className="text-green-500" /> : <AlertTriangle size={14} className="text-amber-500" />}
                          <span className={check.present ? "text-gray-600" : "text-amber-700"}>
                            {check.label}
                          </span>
                          {check.detail && (
                            <span className="text-xs text-gray-400">({check.detail})</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* AI Suggestions */}
              <div className="border-t pt-4">
                <Button
                  onClick={handleGetSuggestions}
                  disabled={loadingSuggestions}
                  className="w-full"
                  variant="default"
                  size="sm"
                >
                  {loadingSuggestions ? (
                    <><Loader2 size={14} className="mr-2 animate-spin" /> Generating suggestions...</>
                  ) : suggestions.length > 0 ? (
                    <><ScanSearch size={14} className="mr-2" /> Refresh Suggestions</>
                  ) : (
                    <><ScanSearch size={14} className="mr-2" /> Get AI Suggestions</>
                  )}
                </Button>
              </div>

              {/* Suggestion cards */}
              {suggestions.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                    Suggestions ({suggestions.length - acceptedIds.size - dismissedIds.size} remaining)
                  </p>
                  <div className="space-y-3">
                    {suggestions.map((s, idx) => {
                      if (acceptedIds.has(idx) || dismissedIds.has(idx)) return null;
                      return (
                        <div key={idx} className="border rounded-lg p-3 space-y-2 bg-gray-50">
                          <p className="text-xs text-gray-400">{s.section} — bullet {s.bulletIndex + 1}</p>
                          <div className="text-xs space-y-1">
                            <p className="text-red-600 line-through">{s.original}</p>
                            <p className="text-green-700">{s.suggested}</p>
                          </div>
                          {s.reason && (
                            <p className="text-xs text-gray-500 italic">{s.reason}</p>
                          )}
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="h-7 text-xs text-green-700 border-green-200 hover:bg-green-50" onClick={() => handleAccept(s, idx)}>
                              <Check size={12} className="mr-1" /> Accept
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs text-gray-500 hover:bg-gray-100" onClick={() => handleDismiss(idx)}>
                              <X size={12} className="mr-1" /> Dismiss
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

const Header = ({ resumeTitle, setResumeTitle, editingTitle, setEditingTitle, autoSave }) => (
  <h1 className="text-3xl font-medium text-[#559F87] cursor-default">
    Resume:
    <input
      type="text"
      value={resumeTitle}
      onChange={(e) => setResumeTitle(e.target.value)}
      onBlur={() => autoSave()}
      className="bg-transparent ml-2"
      placeholder="Untitled Resume"
    />
  </h1>
);
