"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "@/lib/firebase/config";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { toast } from "sonner";

import { Slider } from "@/components/ui/slider";
import { InputSizer } from "@/app/resumes/[resumeId]/_components/InputSizer";
import { ZoomIn, ZoomOut } from "lucide-react";

import { EducationForm } from "./_components/educationForm";
import { ExperienceForm } from "./_components/experienceForm";
import { ProjectsForm } from "./_components/projectForm";

import { Trash2 } from "lucide-react";

export default function Page({ params }) {
  const [user, loading, error] = useAuthState(auth);
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);
  const [editingTitle, setEditingTitle] = useState(false);
  const [resumeTitle, setResumeTitle] = useState("");
  const [education, setEducation] = useState([]);
  const [experience, setExperience] = useState([]);
  const [projects, setProjects] = useState([]);
  const [skills, setSkills] = useState([]);
  const [sections, setSections] = useState([
    { id: "education", title: "Education", content: education },
    { id: "experience", title: "Experience", content: experience },
    { id: "projects", title: "Projects", content: projects },
    { id: "skills", title: "Skills", content: skills },
  ]);

  useEffect(() => {
    setSections([
      { id: "education", title: "Education", content: education },
      { id: "experience", title: "Experience", content: experience },
      { id: "projects", title: "Projects", content: projects },
      { id: "skills", title: "Skills", content: skills },
    ]);
  }, [education, experience, projects, skills]);

  useEffect(() => {
    if (user && params.resumeId) {
      const resumeRef = doc(db, `users/${user.uid}/resumes`, params.resumeId);

      getDoc(resumeRef)
        .then((docSnap) => {
          if (docSnap.exists()) {
            const resumeData = docSnap.data();
            setResumeTitle(resumeData.title);
            // setSections({
            //   education: resumeData.education || [],
            //   experience: resumeData.experience || [],
            //   projects: resumeData.projects || [],
            //   skills: resumeData.skills.map(skill => ({ id: skill, content: skill })) || [] // Assuming skills are simple strings
            // });
          } else {
            console.error(
              "Resume not found or you're not authorized to view it"
            );
            router.push("/404");
          }
        })
        .catch((error) => {
          console.error("Error fetching resume:", error);
          router.push("/404");
        });
    }
  }, [user, params.resumeId, router]);

  // Zoom controls
  // * (scale / 100);
  // const [scale, setScale] = useState(114);
  const width = 850;
  const height = 1100;
  const scaledPadding = 30;
  // const handleScaleChange = (value) => {
  //   setScale(value[0]);
  // };

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(sections);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setSections(items);
    console.log("Reordered sections:", items);
  };

  const renderItem = (item, sectionId, index) => {
    switch (sectionId) {
      case "education":
        return (
          <EducationForm
            item={item}
            onChange={(data) => handleEducationChange(index, data)}
          />
        );
      case "experience":
        return (
          <ExperienceForm
            item={item}
            onChange={(data) => handleExperienceChange(index, data)}
          />
        );
      case "projects":
        return (
          <ProjectsForm
            item={item}
            onChange={(data) => handleProjectChange(index, data)}
          />
        );
      case "skills":
        return item.name;
      default:
        return null;
    }
  };

  const autoSave = async () => {
    if (user && params.resumeId) {
      const resumeRef = doc(db, `users/${user.uid}/resumes`, params.resumeId);
      await setDoc(resumeRef, { title: resumeTitle }, { merge: true });
      toast("Title Updated Successfully", {
        action: {
          label: "OK",
          onClick: () => toast.dismiss(),
        },
      })
    }
  };

  const handleEducationChange = (index, newEducationData) => {
    setEducation((prevEducation) =>
      prevEducation.map((item, idx) =>
        idx === index ? { ...item, ...newEducationData } : item
      )
    );
  };
  const handleExperienceChange = (index, newExperience) => {
    setExperience((prevExperience) =>
      prevExperience.map((item, idx) =>
        idx === index ? { ...item, ...newExperience } : item
      )
    );
  };
  const handleProjectChange = (index, newProject) => {
    setProjects((prevProject) =>
      prevProject.map((item, idx) =>
        idx === index ? { ...item, ...newProject } : item
      )
    );
  };

  if (loading || !user) {
    return <p>Loading...</p>;
  }

  const handleAdd = (section) => {
    switch (section) {
      case "Education":
        addEducation();
        break;
      case "Experience":
        addExperience();
        break;
      case "Projects":
        addProjects();
        break;
      case "Skills":
        addSkills();
        break;
      default:
        console.log("Unknown section");
    }
  };

  const addEducation = () => {
    const newEducation = {
      degreeType: "",
      endDate: "",
      location: "",
      gpa: "",
      major: "",
      school: "",
      startDate: "",
    };
    setEducation((prev) => [...prev, newEducation]);
  };
  const addExperience = () => {
    const newExperience = {
      companyName: "",
      position: "",
      startDate: "",
      endDate: "",
      location: "",
      description: "",
      currentlyWorking: false,
    };
    setExperience((prev) => [...prev, newExperience]);
  };

  const addProjects = () => {
    const newProject = {
      projectName: "",
      description: "",
      startDate: "",
      endDate: "",
      currentlyWorking: false,
    };
    setProjects((prev) => [...prev, newProject]);
  };

  const addSkills = () => {};

  const handleDelete = (section, index) => {    
    switch (section) {
      case "education":
        deleteEducation(index);
        break;
      case "experience":
        deleteExperience(index);
        break;
      case "projects":
        deleteProjects(index);
        break;
      case "skills":
        deleteSkills(index);
        break;
      default:
        console.log("Unknown section");
    }
  };
  
  const deleteEducation = (index) => {
    setEducation((prev) => prev.filter((_, i) => i !== index));
  };

  const deleteExperience = (index) => {
    setExperience((prev) => prev.filter((_, i) => i !== index));
  };

  const deleteProjects = (index) => {
    setProjects((prev) => prev.filter((_, i) => i !== index));
  };

  const deleteSkills = (index) => {
    // implement similar logic here if needed
  };

  return (
    <div className="flex flex-col w-full p-10 font-sans my-10">
      <Header title={resumeTitle} setResumeTitle={setResumeTitle} editingTitle={editingTitle} setEditingTitle={setEditingTitle} autoSave={autoSave} />
      <div className="flex-grow flex flex-col">
        <div className="flex flex-col items-center justify-center flex-grow p-4">
          <div
            style={{
              width: `${width}px`,
              height: `${height}px`,
              padding: `${scaledPadding}px`,
            }}
            className="border border-gray-800 rounded-md bg-white box-border overflow-hidden"
          >
            <ResumeHeader />
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="sections" type="sections">
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef}>
                    {sections.map((section, index) => (
                      <Draggable
                        key={section.id}
                        draggableId={section.id}
                        index={index}
                      >
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className="mb-2 mt-[-6pt]"
                          >
                            <h2 className="flex justify-between text-left text-lg font-bold small-caps border-black pl-1 border-b-2">
                              <div>{section.title}</div>
                              <button
                                className="text-[#188665] font-light text-sm hover:bg-green-100 px-2 py-1"
                                variant="ghost"
                                onClick={() => handleAdd(section.title)}
                              >
                                + Add {section.title}
                              </button>
                            </h2>

                            {section.content.map((item, innerIndex) => (
                              <div
                                key={innerIndex}
                                className="text-left text-sm pl-2 relative"
                              >
                                {renderItem(item, section.id, innerIndex)}
                                <Trash2
                                  size={16}
                                  strokeWidth={1}

                                  className="absolute -left-5 top-1/3 cursor-pointer hover:text-red-500"
                                  onClick={() =>
                                    handleDelete(section.id, innerIndex)
                                  }
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
        {/* <ZoomControls handleScaleChange={handleScaleChange} /> */}
      </div>
    </div>
  );
}

const Header = ({ title, setResumeTitle, editingTitle, setEditingTitle, autoSave }) => (
  <h1 className="text-3xl font-medium text-[#559F87] mb-4">
    Resume:
    {editingTitle ? (
      <input
        type="text"
        value={title}
        onChange={(e) => setResumeTitle(e.target.value)}
        onBlur={() => { autoSave(); setEditingTitle(false); }}
        className="bg-transparent border-b border-gray-600 ml-2"
        placeholder="Title"
      />
    ) : (
      <span
      onDoubleClick={() => setEditingTitle(true)}
      className="ml-2 cursor-pointer"
      >
        {title || "Title"}
      </span>
    )}
  </h1>
);

const ResumeHeader = () => {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [github, setGithub] = useState("");

  return (
    <>
      <div className="text-center">
        <input
          type="text"
          className="bg-transparent text-center w-full focus:outline-none text-3xl uppercase font-bold"
          placeholder="Your Name"
        />
      </div>
      <div className="flex justify-center items-center space-x-2">
        <InputSizer placeholder="Email" value={email} onChange={setEmail} />
        <span>|</span>
        <InputSizer
          placeholder="Phone Number"
          value={phone}
          onChange={setPhone}
        />
        <span>|</span>
        <InputSizer
          placeholder="LinkedIn Profile"
          value={linkedin}
          onChange={setLinkedin}
        />
        <span>|</span>
        <InputSizer
          label="GitHub: "
          placeholder="GitHub Profile"
          value={github}
          onChange={setGithub}
        />
      </div>
    </>
  );
};

const ZoomControls = ({ handleScaleChange }) => (
  <div className="fixed flex space-x-2 right-5 bottom-5 w-[15%]">
    <ZoomOut strokeWidth={2} />
    <Slider
      defaultValue={[100]}
      max={200}
      step={1}
      onValueChange={handleScaleChange}
    />
    <ZoomIn strokeWidth={2} />
  </div>
);

