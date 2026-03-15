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

import { Trash2, GripVertical, Download, FileDown, Loader2 } from "lucide-react";
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
  const [downloading, setDownloading] = useState(false);
  const [initialized, setInitialized] = useState(false);

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

  const renderItem = (item, sectionId, index) => {
    switch (sectionId) {
      case "education":
        return <EducationForm item={item} onChange={(data) => handleEducationChange(index, data)} />;
      case "experience":
        return <ExperienceForm item={item} onChange={(data) => handleExperienceChange(index, data)} />;
      case "projects":
        return <ProjectsForm item={item} onChange={(data) => handleProjectChange(index, data)} />;
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
      <div className={`flex-grow transition-all duration-300 p-10 ${drawerOpen ? "mr-[420px]" : ""}`}>
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
            <CvDrawer {...addFromCV} open={drawerOpen} onToggle={() => setDrawerOpen(!drawerOpen)} />
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
