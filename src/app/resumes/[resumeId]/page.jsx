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
import { ResumeHeader } from "./_components/resumeHeader";

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
  const [sections, setSections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const saveSectionsToFirestore = async () => {
    if (user && params.resumeId) {
      const resumeRef = doc(db, `users/${user.uid}/resumes`, params.resumeId);
      await setDoc(
        resumeRef,
        {
          title: resumeTitle,
          education: education,
          experience: experience,
          projects: projects,
          skills: skills,
        },
        { merge: true }
      );
    }
  };

  useEffect(() => {
    if (user && params.resumeId) {
      const resumeRef = doc(db, `users/${user.uid}/resumes`, params.resumeId);
      console.log("Fetching resume data...");
      console.log("Resume ref:", resumeRef);

      getDoc(resumeRef)
        .then((docSnap) => {
          if (docSnap.exists()) {
            const resumeData = docSnap.data();
            console.log("Resume data:", resumeData);
            setResumeTitle(resumeData.title);
            setEducation(resumeData.education || []);
            setExperience(resumeData.experience || []);
            setProjects(resumeData.projects || []);
            setSkills(resumeData.skills || []);

            const orderedSections = resumeData.order || [
              {
                id: "education",
                title: "Education",
                content: resumeData.education || [],
              },
              {
                id: "experience",
                title: "Experience",
                content: resumeData.experience || [],
              },
              {
                id: "projects",
                title: "Projects",
                content: resumeData.projects || [],
              },
              {
                id: "skills",
                title: "Skills",
                content: resumeData.skills || [],
              },
            ];

            setSections(orderedSections);
            setIsLoading(false); // Set loading to false once data is fetched
          } else {
            router.push("/404");
          }
        })
        .catch((error) => {
          console.error("Error fetching resume:", error);
          router.push("/404");
        });
    }
  }, [user, params.resumeId, router]);

  useEffect(() => {
    const updatedSections = sections.map((section) => {
      switch (section.id) {
        case "education":
          return { ...section, content: education };
        case "experience":
          return { ...section, content: experience };
        case "projects":
          return { ...section, content: projects };
        case "skills":
          return { ...section, content: skills };
        default:
          return section;
      }
    });
    setSections(updatedSections);
  }, [education, experience, projects, skills]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  // Zoom controls
  // * (scale / 100);
  // const [scale, setScale] = useState(114);
  const width = 850;
  const height = 1254;
  const scaledPadding = 30;
  // const handleScaleChange = (value) => {
  //   setScale(value[0]);
  // };

  const onDragEnd = async (result) => {
    if (!result.destination) return;
    const items = Array.from(sections);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setSections(items);
    if (user && params.resumeId) {
      const resumeRef = doc(db, `users/${user.uid}/resumes`, params.resumeId);
      await setDoc(
        resumeRef,
        {
          order: items,
        },
        { merge: true }
      );
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
      });
    }
  };

  const handleEducationChange = async (index, newEducationData) => {
    await setEducation((prev) =>
      prev.map((item, idx) =>
        idx === index ? { ...item, ...newEducationData } : item
      )
    );
    saveSectionsToFirestore();
  };

  const handleExperienceChange = async (index, newExperience) => {
    console.log("Experience data:", newExperience);
    await setExperience((prev) =>
      prev.map((item, idx) =>
        idx === index ? { ...item, ...newExperience } : item
      )
    );
    saveSectionsToFirestore();
  };

  const handleProjectChange = async (index, newProject) => {
    await setProjects((prev) =>
      prev.map((item, idx) =>
        idx === index ? { ...item, ...newProject } : item
      )
    );
    saveSectionsToFirestore();
  };

  const handleAdd = (section) => {
    switch (section) {
      case "Education":
        console.log("Adding education");
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
    console.log("Adding education in function");
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

    saveSectionsToFirestore();
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
    saveSectionsToFirestore();
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
    saveSectionsToFirestore();
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
    saveSectionsToFirestore();
  };

  const deleteExperience = (index) => {
    setExperience((prev) => prev.filter((_, i) => i !== index));
    saveSectionsToFirestore();
  };

  const deleteProjects = (index) => {
    setProjects((prev) => prev.filter((_, i) => i !== index));
    saveSectionsToFirestore();
  };

  const deleteSkills = (index) => {};

  if (loading || !user) {
    return <p>Loading...</p>;
  }

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

  return (
    <div className="flex flex-col w-full p-10 font-sans my-10">
      <Header
        resumeTitle={resumeTitle}
        setResumeTitle={setResumeTitle}
        editingTitle={editingTitle}
        setEditingTitle={setEditingTitle}
        autoSave={autoSave}
      />
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
            <ResumeHeader className="mb-2" params={params} />
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

const Header = ({
  resumeTitle,
  setResumeTitle,
  editingTitle,
  setEditingTitle,
  autoSave,
}) => (
  <h1 className="text-3xl font-medium text-[#559F87] mb-4 cursor-default">
    Resume:
    <input
      type="text"
      value={resumeTitle}
      onChange={(e) => setResumeTitle(e.target.value)}
      onBlur={() => {
        autoSave();
      }}
      className="bg-transparent ml-2"
      placeholder="Untitled Resume"
    />
  </h1>
);

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
