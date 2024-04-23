"use client";

import { useAuthState } from 'react-firebase-hooks/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/config';
import React, { useState, useEffect } from "react";
import { Slider } from "@/components/ui/slider";
import { ZoomIn, ZoomOut } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

import { useRouter } from "next/navigation";


export default function Page({ params }) {
  const [email, setEmail] = useState("email@resumebutler.ai");
  const [phone, setPhone] = useState("(123) 456-7890");
  const [linkedin, setLinkedin] = useState("linkedin.com/in/Username");
  const [github, setGithub] = useState("github.com/Username");

  const [scale, setScale] = useState(114);
  const width = 816 * (scale / 100);
  const height = 1056 * (scale / 100);
  const scaledPadding = 30 * (scale / 100);

  const handleScaleChange = (value) => {
    setScale(value[0]);
  };

  const onDragEnd = (result) => {
    if (!result.destination) {
      return;
    }
    const items = Array.from(sections);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setSections(items);
  };

  const initialSections = [
    { id: "education", content: "Education" },
    { id: "experience", content: "Experience" },
    { id: "projects", content: "Projects" },
    { id: "skills", content: "Skills" },
  ];
  const [sections, setSections] = useState(initialSections);

  const [resumeTitle, setResumeTitle] = useState('');
  const [user, loading, error] = useAuthState(auth);
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && params.resumeId) {
      const resumeRef = doc(db, `users/${user.uid}/resumes`, params.resumeId);

      getDoc(resumeRef).then(docSnap => {
        if (docSnap.exists()) {
          setResumeTitle(docSnap.data().title);
        } else {
          console.error("Resume not found or you're not authorized to view it");
          router.push('/404');
        }
      }).catch(error => {
        console.error('Error fetching resume:', error);
        router.push('/404');
      });
    }
  }, [user, params.resumeId, router]);

  if (loading || !user) {
    return <p>Loading...</p>; 
  };


  return (
    <div className="flex flex-col w-full p-10 font-sans">
      <h1 className="text-3xl font-medium text-[#559F87] mb-4">
        Resume: {resumeTitle}
      </h1>

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
            <div className="text-center">
              <input
                type="text"
                className="bg-transparent text-center w-full focus:outline-none text-3xl uppercase font-bold"
                placeholder="Your Name"
              />
            </div>

            <div className="flex justify-center items-center">
              <InputSizer
                placeholder="Email"
                value={email}
                onChange={setEmail}
              />
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

            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="sections">
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef}>
                    {sections.map(({ id, content }, index) => (
                      <Draggable key={id} draggableId={id} index={index}>
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className="mb-2 mt-[-6pt] text-left text-lg font-bold small-caps border-black pl-1 border-b-2"
                          >
                            {content}
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
      </div>
    </div>
  );
}

const InputSizer = ({ placeholder, value, onChange }) => {
  const handleInputChange = (event) => {
    onChange(event.target.value);
  };
  return (
    <label className="input-sizer">
      <input
        type="text"
        className="text-center underline underline-offset-3"
        value={value}
        onChange={handleInputChange}
        size={Math.max(1, value.length)}
        placeholder={placeholder}
        onInput={(e) => (e.target.parentNode.dataset.value = e.target.value)}
      />
    </label>
  );
};
