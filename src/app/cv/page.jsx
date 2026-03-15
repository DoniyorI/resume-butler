"use client";
import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import FileUpload from "@/components/FileUpload";
import EducationForm from "@/components/EducationForm";
import ExperienceForm from "@/components/ExperienceForm";
import ProjectForm from "@/components/ProjectForm";
import SkillForm from "@/components/SkillForm";
import CertificationForm from "@/components/CertificationForm";
import {
  GraduationCap,
  Briefcase,
  FolderKanban,
  Wrench,
  Award,
} from "lucide-react";

function StatBadge({ icon: Icon, label, count }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-50 border text-sm">
      <Icon size={14} className="text-[#559F87]" />
      <span className="text-gray-600">{label}</span>
      <span className="font-semibold text-[#559F87]">{count}</span>
    </div>
  );
}

export default function CV() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [stats, setStats] = useState({
    education: 0,
    experience: 0,
    projects: 0,
    skills: 0,
    certifications: 0,
  });
  const { user, supabase } = useAuth({ redirect: true });

  // Fetch counts for the summary bar
  useEffect(() => {
    if (!user) return;
    const fetchCounts = async () => {
      const [edu, exp, proj, skill, cert] = await Promise.all([
        supabase
          .from("cv_education")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
        supabase
          .from("cv_experience")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
        supabase
          .from("cv_projects")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
        supabase
          .from("cv_skills")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
        supabase
          .from("cv_certifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
      ]);
      setStats({
        education: edu.count || 0,
        experience: exp.count || 0,
        projects: proj.count || 0,
        skills: skill.count || 0,
        certifications: cert.count || 0,
      });
    };
    fetchCounts();
  }, [user, supabase, refreshKey]);

  const handleUploadComplete = () => {
    setRefreshKey((k) => k + 1);
  };

  const totalItems =
    stats.education + stats.experience + stats.projects + stats.skills + stats.certifications;

  return (
    <div className="flex flex-col w-full min-h-screen py-16 px-6 md:px-10 my-10">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-semibold text-[#559F87]">
          Master CV
        </h1>
        <p className="pt-1 font-light text-sm text-gray-500 max-w-lg mx-auto">
          Add everything here — all your experience, projects, education, and
          skills. When you apply to a job, we&apos;ll pick the most relevant
          items to build a tailored resume.
        </p>
      </div>

      {/* Summary stats */}
      {totalItems > 0 && (
        <div className="flex flex-wrap justify-center gap-2 mb-6">
          <StatBadge icon={GraduationCap} label="Education" count={stats.education} />
          <StatBadge icon={Briefcase} label="Experience" count={stats.experience} />
          <StatBadge icon={FolderKanban} label="Projects" count={stats.projects} />
          <StatBadge icon={Wrench} label="Skills" count={stats.skills} />
          <StatBadge icon={Award} label="Certs" count={stats.certifications} />
        </div>
      )}

      {/* Upload area */}
      <FileUpload onComplete={handleUploadComplete} />

      <div className="flex items-center justify-center my-6">
        <div className="w-1/3 rounded bg-gray-200 h-[1px] mr-4"></div>
        <span className="text-gray-400 text-xs font-light">
          OR FILL IN MANUALLY
        </span>
        <div className="w-1/3 bg-gray-200 h-[1px] ml-4"></div>
      </div>

      {/* Tabs */}
      <div className="flex justify-center">
        <Tabs defaultValue="experience" className="w-full max-w-[900px]">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="experience" className="gap-1.5">
              <Briefcase size={14} />
              <span className="hidden sm:inline">Experience</span>
            </TabsTrigger>
            <TabsTrigger value="education" className="gap-1.5">
              <GraduationCap size={14} />
              <span className="hidden sm:inline">Education</span>
            </TabsTrigger>
            <TabsTrigger value="projects" className="gap-1.5">
              <FolderKanban size={14} />
              <span className="hidden sm:inline">Projects</span>
            </TabsTrigger>
            <TabsTrigger value="skills" className="gap-1.5">
              <Wrench size={14} />
              <span className="hidden sm:inline">Skills</span>
            </TabsTrigger>
            <TabsTrigger value="certifications" className="gap-1.5">
              <Award size={14} />
              <span className="hidden sm:inline">Certs</span>
            </TabsTrigger>
          </TabsList>

          <Card className="mt-4 border-0 shadow-none">
            <CardContent className="pt-2">
              <TabsContent value="experience">
                <ExperienceForm key={`exp-${refreshKey}`} />
              </TabsContent>
              <TabsContent value="education">
                <EducationForm key={`edu-${refreshKey}`} />
              </TabsContent>
              <TabsContent value="projects">
                <ProjectForm key={`proj-${refreshKey}`} />
              </TabsContent>
              <TabsContent value="skills">
                <SkillForm key={`skill-${refreshKey}`} />
              </TabsContent>
              <TabsContent value="certifications">
                <CertificationForm key={`cert-${refreshKey}`} />
              </TabsContent>
            </CardContent>
          </Card>
        </Tabs>
      </div>
    </div>
  );
}
