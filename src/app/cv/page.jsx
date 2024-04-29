import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FileUpload from "@/components/FileUpload";
import EducationForm from "@/components/EducationForm";
import ExperienceForm from "@/components/ExperienceForm";
import ProjectForm from "@/components/ProjectForm";
import SkillForm from "@/components/SkillForm";

export default function CV() {
  return (
    <div className="flex flex-col w-full min-h-screen py-16 px-10 my-10">
      <div className="text-center mb-10">
        <h1 className="text-2xl font-semibold text-[#559F87]">
          Curriculum Vitae
        </h1>
        <p className="pt-1 font-light text-sm">
          Fill out the form below so we can later use to optimize your resume
          for every application
        </p>
      </div>
      {/* <FileUpload />
      <div className="flex items-center justify-center my-6">
        <div className="w-1/3 rounded bg-gray-300 h-[1px] mr-4"></div>
        <span className="text-gray-3 text-sm font-light">OR</span>
        <div className="w-1/3 bg-gray-300 h-[1px] ml-4"></div>
      </div> */}
      <div className="flex justify-center">
        <Tabs defaultValue="education">
          <TabsList className="grid w-full grid-cols-4 lg:w-[900px] ">
            <TabsTrigger value="education">Education</TabsTrigger>
            <TabsTrigger value="experiences">Experience</TabsTrigger>
            <TabsTrigger value="projects">Project</TabsTrigger>
            <TabsTrigger value="skills">Skills</TabsTrigger>
          </TabsList>
          <TabsContent className="pb-10" value="education">
            <EducationForm />
          </TabsContent>
          <TabsContent className="pb-10" value="experiences">
            <ExperienceForm />
          </TabsContent>
          <TabsContent className="pb-10" value="projects">
            <ProjectForm />
          </TabsContent>
          <TabsContent className="pb-10" value="skills">
            <SkillForm />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
