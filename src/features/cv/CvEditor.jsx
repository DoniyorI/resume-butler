"use client";
import { useState } from "react";
import { Award, Briefcase, FolderKanban, GraduationCap, Wrench } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import FileUpload from "@/features/cv/FileUpload";
import EducationForm from "@/features/cv/EducationForm";
import ExperienceForm from "@/features/cv/ExperienceForm";
import ProjectForm from "@/features/cv/ProjectForm";
import SkillForm from "@/features/cv/SkillForm";
import CertificationForm from "@/features/cv/CertificationForm";

// The forms copy `data` into local state when they mount. Saves update that
// state directly, but an upload adds rows behind their back, so once the
// refreshed data arrives the forms are remounted to pick it up.
export default function CvEditor({ data }) {
  const [shownData, setShownData] = useState(data);
  const [awaitingUpload, setAwaitingUpload] = useState(false);
  const [version, setVersion] = useState(0);

  if (data !== shownData) {
    setShownData(data);
    if (awaitingUpload) {
      setAwaitingUpload(false);
      setVersion((v) => v + 1);
    }
  }

  return (
    <>
      <FileUpload onComplete={() => setAwaitingUpload(true)} />

      <div className="flex items-center justify-center my-6">
        <div className="w-1/3 rounded bg-gray-200 h-[1px] mr-4"></div>
        <span className="text-gray-400 text-xs font-light">OR FILL IN MANUALLY</span>
        <div className="w-1/3 bg-gray-200 h-[1px] ml-4"></div>
      </div>

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

          {/* Only the active tab is mounted, so switching tabs also re-reads `data` */}
          <Card className="mt-4 border-0 shadow-none">
            <CardContent className="pt-2">
              <TabsContent value="experience">
                <ExperienceForm key={version} initialEntries={data.experience} />
              </TabsContent>
              <TabsContent value="education">
                <EducationForm key={version} initialEntries={data.education} />
              </TabsContent>
              <TabsContent value="projects">
                <ProjectForm key={version} initialEntries={data.projects} />
              </TabsContent>
              <TabsContent value="skills">
                <SkillForm key={version} initialSkills={data.skills} />
              </TabsContent>
              <TabsContent value="certifications">
                <CertificationForm key={version} initialEntries={data.certifications} />
              </TabsContent>
            </CardContent>
          </Card>
        </Tabs>
      </div>
    </>
  );
}
