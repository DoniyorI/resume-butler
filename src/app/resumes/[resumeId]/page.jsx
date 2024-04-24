"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "@/lib/firebase/config";
import { doc, getDoc } from "firebase/firestore";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

// Import UI components
import { Slider } from "@/components/ui/slider";
import { InputSizer } from "@/components/InputSizer";
import { ZoomIn, ZoomOut } from "lucide-react";

export default function Page({ params }) {
  const [user, loading, error] = useAuthState(auth);
  const router = useRouter();

  // Redirect logic based on authentication state
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // State hooks for managing resume data
  const [resumeTitle, setResumeTitle] = useState("");

  const exampleEducation = [
    {
      degreeType: "Bachelor's",
      endDate: "December 20, 2024 at 12:00:00 AM UTC-5",
      location: "Buffalo, NY",
      gpa: "3.72",
      major: "Computer Science",
      school: "University At Buffalo",
      startDate: "August 30, 2021 at 12:00:00 AM UTC-4",
    },
  ];
  const exampleExperience = [
    {
      companyName: "Resilience, Inc",
      currentlyWorking: false,
      description: [
        "Revitalized legacy software using Expo with React Native, overhauling performance by 23% through modern development practices.",
        "Led development of a robust quiz application, facilitating interactive learning and assessment.",
        "Utilized LearnPress for quiz content delivery, enhancing user interaction & establishing a direct feedback loop.",
      ],
      endDate: "November 19, 2023 at 12:00:00 AM UTC-5",
      experienceType: "",
      location: "Remote",
      position: "Software Developer Intern",
      startDate: "July 14, 2023 at 12:00:00 AM UTC-4",
    },
    {
      companyName: "University at Buffalo - Engineering & Applied Sciences",
      currentlyWorking: true,
      description: [
        "Facilitated office hours for 250+ students in Web Applications, covering HTML/CSS, JavaScript, Python, Docker, RESTful APIs, Websockets, & OAuth, enhancing students’ full-stack development capabilities.",
        "Boosted students’ understanding in Data Structures using Java by leading interactive recitations and hands-on exercises, resulting in a 20% increase in class comprehension among 300+ students.",
        "Pioneered integration of project-based learning in curriculum, directly contributing to improved practical skills in software development and system design.",
      ],
      endDate: null,
      experienceType: "Part-time",
      location: "Buffalo, NY",
      position: "Undergraduate Teaching Assistant",
      startDate: "January 1, 2023 at 12:00:00 AM UTC-5",
    },
  ];
  const exampleProjects = [
    {
      currentlyWorking: true,
      description: [
        "Designed an application to manage and tailor resumes, increasing interview callbacks by 25% through use of OpenAI’s APIs.",
        "Established a user dashboard, improving user engagement by 20% by providing insights into application statuses and management tools.",
        "Implemented a PDF reader to streamline resume and cover letter tailoring process.",
        "Designed and implemented a resume and cover letter editor, enabling users to craft and personalize documents with an intuitive interface, option to download the final versions as PDFs.",
      ],
      endDate: null,
      location: "Buffalo, NY",
      position: "Full Stack Developer",
      projectName: "Resume Butler",
      startDate: "March 1, 2024 at 12:00:00 AM UTC-5",
    },
    {
      currentlyWorking: false,
      description: [
        "Spearheaded development of a social media platform, implementing real-time chat and image upload features.",
        "Enhanced security and user trust by integrating OAuth 2.0 with Gmail API for authentication.",
        "Utilized Docker to standardize deployment processes across multiple development environments.",
        "Secured against DoS attacks via Nginx, ensuring platform reliability and user safety.",
      ],
      endDate: "December 17, 2023 at 12:00:00 AM UTC-5",
      location: "Buffalo, NY",
      position: "Full Stack Developer",
      projectName: "FiLo Chat",
      startDate: "September 1, 2023 at 12:00:00 AM UTC-4",
    },
    {
      currentlyWorking: false,
      description: [
          "Integrated OpenAI APIs for real-time, AI-driven solutions, enriching user interaction across various fields such as financial analysis, artistic creation, & programming and programming language translation.",
          "Secured an exciting 1st place in the UB Hacking Machine Learning/Artificial Intelligence Category, recognized for developing a high-quality, innovative project within a 24-hour time frame."
      ],
      endDate: "November 19, 2022 at 12:00:00 AM UTC-5",
      location: "Buffalo, NY",
      position: "Frontend Developer",
      projectName: "Transform *WINNER*",
      startDate: "November 19, 2022 at 12:00:00 AM UTC-5"
  }
  
  ];

  const [education, setEducation] = useState(exampleEducation);
  const [experience, setExperience] = useState(exampleExperience);
  const [projects, setProjects] = useState(exampleProjects);
  const [skills, setSkills] = useState([]);
  const initialSections = [
    { id: "education", title: "Education", content: education },
    { id: "experience", title: "Experience", content: experience },
    { id: "projects", title: "Projects", content: projects },
    { id: "skills", title: "Skills", content: skills },
  ];
  const [sections, setSections] = useState(initialSections);
  console.log("sections", sections);

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
  const [scale, setScale] = useState(114);
  const width = 850;
  const height = 1100;
  const scaledPadding = 30;
  const scaledBorderWidth = 2 * (scale / 100); // Scale border thickness
  const scaledFontSize = 16 * (scale / 100); // Scale font size

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

  const renderItem = (item, sectionId) => {
    switch (sectionId) {
      case "education":
        return <Education item={item} />;
      case "experience":
        return <Experience item={item} />;
      case "projects":
        return <Projects item={item} />;
      case "skills":
        return item.name;
      default:
        return null;
    }
  };
  // const onDragEnd = (result) => {
  //   const { source, destination } = result;
  //   if (!destination) return;

  //   if (source.droppableId === destination.droppableId) {
  //     if (source.droppableId === "sections") {
  //       // Reordering sections
  //       const newSections = Array.from(sections);
  //       const [removed] = newSections.splice(source.index, 1);
  //       newSections.splice(destination.index, 0, removed);
  //       setSections(newSections);
  //     } else {
  //       // Reordering items within the same section
  //       const section = sections.find((s) => s.id === source.droppableId);
  //       const items = Array.from(section.content);
  //       const [removed] = items.splice(source.index, 1);
  //       items.splice(destination.index, 0, removed);
  //       const newSections = sections.map((s) =>
  //         s.id === section.id ? { ...s, content: items } : s
  //       );
  //       setSections(newSections);
  //     }
  //   }
  // };

  if (loading || !user) {
    return <p>Loading...</p>;
  }

  return (
    <div className="flex flex-col w-full p-10 font-sans">
      <Header title={resumeTitle} />
      <div className="flex-grow flex flex-col">
        <div className="flex flex-col items-center justify-center flex-grow p-4">
          <div
            style={{
              width: `${width}px`,
              height: `${height}px`,
              padding: `${scaledPadding}px`,
            }}
            className="border border-black bg-white box-border overflow-hidden"
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
                            className="mb-2 mt-[-6pt] "
                          >
                            <h2 className="text-left text-lg font-bold small-caps border-black pl-1 border-b-2">
                              {section.title}
                            </h2>

                            {section.content.map((item, innerIndex) => (
                              <div
                                key={innerIndex}
                                className="text-left text-sm pl-2"
                              >
                                {renderItem(item, section.id)}
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

const Header = ({ title }) => (
  <h1 className="text-3xl font-medium text-[#559F87] mb-4">Resume: {title}</h1>
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

const Education = ({ item }) => {
  // Extract the date as "December 20, 2024"
  const dateString = item.endDate.split(" at ")[0];

  // Parse and format the date
  const date = new Date(dateString);
  const formattedDate = date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="">
      <div className="flex justify-between items-baseline">
        <h2 className="text-md font-bold">{item.school}</h2>
        <span className="text-sm font-bold">Expected {formattedDate}</span>
      </div>
      <div className="text-sm flex justify-between">
        <p>
          {item.degreeType} in {item.major}, {item.gpa} GPA
        </p>
        <p className="italic">{item.location}</p>
      </div>
    </div>
  );
};

const Experience = ({ item }) => {
  const formatDate = (dateString) => {
    const date = new Date(dateString.split(" at ")[0]); // Assuming the date format includes unnecessary suffixes
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };
  const formattedStartDate = formatDate(item.startDate);
  let formattedEndDate = item.currentlyWorking
    ? "Current"
    : formatDate(item.endDate);

  return (
    <div className="Experience">
    <div className="flex justify-between items-baseline">
      <h2 className="text-md font-bold">{item.companyName}</h2>
      <span className="text-sm font-bold">
        {formattedStartDate} -- {formattedEndDate}
      </span>
    </div>
    <div className="text-sm flex justify-between">
      <p>{item.position}</p>
      <p className="italic">{item.location}</p>
    </div>
    <div className="ml-[22px]"> {/* Adjust the margin-left here to move bullets to the right */}
      <ul className="list-disc list-inside">
        {item.description.map((point, index) => (
          <li key={index} className="text-sm">
            {point}
          </li>
        ))}
      </ul>
    </div>
  </div>
  
  );
};

const Projects = ({ item }) => {
  const formatDate = (dateString) => {
    const date = new Date(dateString.split(" at ")[0]); // Assuming the date format includes unnecessary suffixes
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };
  const formattedStartDate = formatDate(item.startDate);
  let formattedEndDate = item.currentlyWorking
    ? "Current"
    : formatDate(item.endDate);

  return (
    <div className="">
    <div className="flex justify-between items-baseline">
      <h2 className="text-md font-bold">{item.projectName}</h2>
      <span className="text-sm font-bold">
        {formattedStartDate} -- {formattedEndDate}
      </span>
    </div>
    <div className="text-sm flex justify-between">
      <p>{item.position}</p>
      <p className="italic">{item.location}</p>
    </div>
    <div className="ml-[22px]"> {/* Adjust the margin-left here to move bullets to the right */}
      <ul className="list-disc list-inside">
        {item.description.map((point, index) => (
          <li key={index} className="text-sm">
            {point}
          </li>
        ))}
      </ul>
    </div>
  </div>
  
  );
};
// {
//   currentlyWorking: true,
//   description: [
//     "Designed an application to manage and tailor resumes, increasing interview callbacks by 25% through use of OpenAI’s APIs.",
//     "Established a user dashboard, improving user engagement by 20% by providing insights into application statuses and management tools.",
//     "Implemented a PDF reader to streamline resume and cover letter tailoring process.",
//     "Designed and implemented a resume and cover letter editor, enabling users to craft and personalize documents with an intuitive interface, option to download the final versions as PDFs.",
//   ],
//   endDate: null,
//   location: "Buffalo, NY",
//   position: "Full Stack Developer",
//   projectName: "Resume Butler",
//   startDate: "March 1, 2024 at 12:00:00 AM UTC-5",
// },