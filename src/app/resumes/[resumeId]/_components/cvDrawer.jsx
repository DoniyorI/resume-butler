"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  GraduationCap,
  Briefcase,
  FolderKanban,
  Wrench,
  Plus,
  BookOpen,
  X,
  PanelRightOpen,
} from "lucide-react";

export function CvDrawer({ onAddEducation, onAddExperience, onAddProject, onAddSkills, open, onToggle }) {
  const { user, supabase } = useAuth();
  const [cvData, setCvData] = useState({
    education: [],
    experience: [],
    projects: [],
    skills: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !open) return;
    const fetchCvData = async () => {
      setLoading(true);
      const [eduRes, expRes, projRes, skillRes] = await Promise.all([
        supabase
          .from("cv_education")
          .select("*")
          .eq("user_id", user.id)
          .order("sort_order"),
        supabase
          .from("cv_experience")
          .select("*, cv_experience_bullets(*)")
          .eq("user_id", user.id)
          .order("sort_order"),
        supabase
          .from("cv_projects")
          .select("*, cv_project_bullets(*)")
          .eq("user_id", user.id)
          .order("sort_order"),
        supabase
          .from("cv_skills")
          .select("*")
          .eq("user_id", user.id)
          .order("sort_order"),
      ]);

      setCvData({
        education: eduRes.data || [],
        experience: (expRes.data || []).map((exp) => ({
          ...exp,
          bullets: (exp.cv_experience_bullets || [])
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((b) => b.content),
        })),
        projects: (projRes.data || []).map((proj) => ({
          ...proj,
          bullets: (proj.cv_project_bullets || [])
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((b) => b.content),
        })),
        skills: skillRes.data || [],
      });
      setLoading(false);
    };
    fetchCvData();
  }, [user, supabase, open]);

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  };

  const handleAddEducation = (edu) => {
    onAddEducation({
      school: edu.school || "",
      location: edu.location || "",
      major: edu.major || "",
      degreeType: edu.degree_type || "",
      gpa: edu.gpa || "",
      startDate: edu.start_date || "",
      endDate: edu.end_date || "",
    });
  };

  const handleAddExperience = (exp) => {
    onAddExperience({
      companyName: exp.company || "",
      position: exp.position || "",
      location: exp.location || "",
      startDate: exp.start_date || "",
      endDate: exp.end_date || "",
      currentlyWorking: exp.currently_working || false,
      description: exp.bullets?.length > 0 ? [...exp.bullets] : [""],
    });
  };

  const handleAddProject = (proj) => {
    onAddProject({
      projectName: proj.name || "",
      description: proj.bullets?.length > 0 ? [...proj.bullets] : [proj.description || ""],
      startDate: proj.start_date || "",
      endDate: proj.end_date || "",
      currentlyWorking: proj.currently_working || false,
    });
  };

  const handleAddAllSkills = () => {
    const grouped = {};
    cvData.skills.forEach((s) => {
      const cat = s.category || "Skills";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(s.name);
    });
    Object.entries(grouped).forEach(([header, skillList]) => {
      onAddSkills({ header, skills: skillList.join(", ") });
    });
  };

  const skillsByCategory = cvData.skills.reduce((acc, s) => {
    const cat = s.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  return (
    <>
      <Button
        variant="outline"
        className="border-[#559F87] text-[#559F87] hover:bg-green-50"
        onClick={onToggle}
      >
        <PanelRightOpen size={16} className="mr-2" />
        {open ? "Close CV" : "Master CV"}
      </Button>

      {/* Side panel — fixed to the right, page content adjusts via margin */}
      <div
        className={`fixed top-16 right-0 h-[calc(100vh-64px)] w-[420px] bg-white border-l shadow-lg z-30 transform transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="font-semibold text-[#559F87] text-lg">Master CV</h2>
            <p className="text-xs text-gray-400">
              Click + to add items to this resume
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onToggle}
          >
            <X size={16} />
          </Button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="p-6 text-sm text-gray-400">Loading CV data...</div>
        ) : (
          <ScrollArea className="h-[calc(100vh-145px)]">
            <div className="p-4 space-y-6">
              {/* Education */}
              <Section
                icon={GraduationCap}
                title="Education"
                count={cvData.education.length}
              >
                {cvData.education.map((edu) => (
                  <ItemCard
                    key={edu.id}
                    onAdd={() => handleAddEducation(edu)}
                  >
                    <p className="font-medium text-sm">{edu.school}</p>
                    <p className="text-xs text-gray-500">
                      {edu.degree_type}{edu.major ? ` in ${edu.major}` : ""}
                    </p>
                    {(edu.start_date || edu.end_date) && (
                      <p className="text-xs text-gray-400">
                        {formatDate(edu.start_date)} - {formatDate(edu.end_date)}
                      </p>
                    )}
                    {edu.gpa && (
                      <p className="text-xs text-gray-400">GPA: {edu.gpa}</p>
                    )}
                  </ItemCard>
                ))}
              </Section>

              {/* Experience */}
              <Section
                icon={Briefcase}
                title="Experience"
                count={cvData.experience.length}
              >
                {cvData.experience.map((exp) => (
                  <ItemCard
                    key={exp.id}
                    onAdd={() => handleAddExperience(exp)}
                  >
                    <p className="font-medium text-sm">{exp.company}</p>
                    <p className="text-xs text-gray-500">{exp.position}</p>
                    <p className="text-xs text-gray-400">
                      {formatDate(exp.start_date)} -{" "}
                      {exp.currently_working ? "Present" : formatDate(exp.end_date)}
                    </p>
                    {exp.bullets?.length > 0 && (
                      <ul className="mt-1.5 space-y-0.5">
                        {exp.bullets.map((b, i) => (
                          <li key={i} className="text-xs text-gray-500 pl-3 relative">
                            <span className="absolute left-0">•</span>
                            {b}
                          </li>
                        ))}
                      </ul>
                    )}
                  </ItemCard>
                ))}
              </Section>

              {/* Projects */}
              <Section
                icon={FolderKanban}
                title="Projects"
                count={cvData.projects.length}
              >
                {cvData.projects.map((proj) => (
                  <ItemCard
                    key={proj.id}
                    onAdd={() => handleAddProject(proj)}
                  >
                    <p className="font-medium text-sm">{proj.name}</p>
                    {proj.description && (
                      <p className="text-xs text-gray-500">{proj.description}</p>
                    )}
                    {(proj.start_date || proj.end_date) && (
                      <p className="text-xs text-gray-400">
                        {formatDate(proj.start_date)} - {formatDate(proj.end_date)}
                      </p>
                    )}
                    {proj.bullets?.length > 0 && (
                      <ul className="mt-1.5 space-y-0.5">
                        {proj.bullets.map((b, i) => (
                          <li key={i} className="text-xs text-gray-500 pl-3 relative">
                            <span className="absolute left-0">•</span>
                            {b}
                          </li>
                        ))}
                      </ul>
                    )}
                  </ItemCard>
                ))}
              </Section>

              {/* Skills */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Wrench size={16} className="text-[#559F87]" />
                    <h3 className="font-semibold text-sm">Skills</h3>
                    <Badge variant="secondary" className="text-xs">
                      {cvData.skills.length}
                    </Badge>
                  </div>
                  {cvData.skills.length > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs text-[#559F87] hover:bg-green-50 h-7"
                      onClick={handleAddAllSkills}
                    >
                      <Plus size={12} className="mr-1" /> Add All
                    </Button>
                  )}
                </div>
                {cvData.skills.length === 0 ? (
                  <p className="text-xs text-gray-400">No skills in CV</p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(skillsByCategory).map(([category, skills]) => (
                      <div key={category}>
                        <p className="text-xs text-gray-500 font-medium mb-1">{category}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {skills.map((skill) => (
                            <span
                              key={skill.id}
                              className="text-xs bg-green-50 border border-green-200 px-2 py-0.5 rounded-full"
                            >
                              {skill.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </ScrollArea>
        )}
      </div>
    </>
  );
}

function Section({ icon: Icon, title, count, children }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <Icon size={16} className="text-[#559F87]" />
        <h3 className="font-semibold text-sm">{title}</h3>
        <Badge variant="secondary" className="text-xs">{count}</Badge>
      </div>
      {count === 0 ? (
        <p className="text-xs text-gray-400">No {title.toLowerCase()} in CV</p>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </section>
  );
}

function ItemCard({ children, onAdd }) {
  return (
    <div className="border rounded-md p-3 hover:border-[#559F87] transition-colors">
      <div className="flex gap-2">
        <div className="flex-grow min-w-0">{children}</div>
        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8 flex-shrink-0 border-[#559F87] text-[#559F87] hover:bg-green-50 self-start"
          onClick={onAdd}
        >
          <Plus size={14} />
        </Button>
      </div>
    </div>
  );
}
