// CoverLetterEditor.jsx
"use client";

import React, { useState, useEffect } from 'react';
import { Editor, EditorState, convertToRaw, convertFromRaw } from 'draft-js';
import 'draft-js/dist/Draft.css';
import { auth, db } from "@/lib/firebase/config";
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useRouter } from 'next/navigation';

function CoverLetterEditor({ params }) {
   const [user, loading, error] = useAuthState(auth);
   const [editorState, setEditorState] = useState(EditorState.createEmpty());
    const router = useRouter();
   const [header, setHeader] = useState({
      contactPhone: "",
      contactEmail: "",
      name: "",
      linkedin: "",
      portfolio: "",
   });
   const [coverLetterTitle, setCoverLetterTitle] = useState("");

   useEffect(() => {
    if (!loading && !user) {
       router.push("/login");
    }
 }, [user, loading, router]);
 
 useEffect(() => {
    if (user && params.coverLetterId) {
       const coverLetterRef = doc(db, `users/${user.uid}/coverletters`, params.coverLetterId);
 
       getDoc(coverLetterRef)
          .then(docSnap => {
             if (docSnap.exists()) {
                const coverLetterData = docSnap.data();
                setCoverLetterTitle(coverLetterData.title);
                setHeader(coverLetterData.header);
                setEditorState(EditorState.createWithContent(convertFromRaw(coverLetterData.content)));
             } else {
                console.error("Cover letter not found or you're not authorized to view it");
             }
          })
          .catch(error => console.error("Error fetching cover letter:", error));
    }
 }, [user, params.coverLetterId]);
 

 const handleSave = async () => {
  if (!user) {
      const contentState = editorState.getCurrentContent();
      const rawContent = convertToRaw(contentState);

      const coverLetterRef = doc(db, `users/${user.uid}/coverletters`, params.coverLetterId);

      await setDoc(coverLetterRef, {
         title: coverLetterTitle,
         content: rawContent,
         header: header,
      }, { merge: true });

      console.log("Cover letter saved");
  }

  const contentState = editorState.getCurrentContent();
  const rawContent = convertToRaw(contentState);

  const coverLetterRef = doc(db, `users/${user.uid}/coverletters`, params.coverLetterId);

  await setDoc(coverLetterRef, {
     title: coverLetterTitle,
     content: rawContent,
     header: header,
  }, { merge: true });

  console.log("Cover letter saved");
};


   const handleInputChange = (e) => {
      const { name, value } = e.target;
      setHeader({ ...header, [name]: value });
   };

   if (loading || !user) {
      return <p>Loading...</p>;
   }

   return (
      <div className="flex flex-col w-full p-10 font-sans my-10">
         <div className="flex flex-col items-center justify-center flex-grow p-4">
            <div className="w-[850px] h-[1100px] border border-gray-800 rounded-md bg-white box-border overflow-hidden p-4">
               <div className="border-b-2 border-black p-4 flex justify-between items-center">
                  {/* Left side: Contact Info */}
                  <div className="flex flex-col space-y-1">
                     <input
                        type="text"
                        name="contactPhone"
                        value={header.contactPhone}
                        onChange={handleInputChange}
                        className="p-2"
                     />
                     <input
                        type="text"
                        name="contactEmail"
                        value={header.contactEmail}
                        onChange={handleInputChange}
                        className="p-2"
                     />
                  </div>

                  {/* Center: Name and Target Job */}
                  <div className="text-center">
                     <input
                        type="text"
                        name="name"
                        value={header.name}
                        onChange={handleInputChange}
                        className="text-2xl font-bold border text-center"
                     />
                  </div>

                  {/* Right side: Links */}
                  <div className="flex flex-col space-y-1 text-right">
                     <input
                        type="text"
                        name="linkedin"
                        value={header.linkedin}
                        onChange={handleInputChange}
                        className="text-right"
                     />
                     <input
                        type="text"
                        name="portfolio"
                        value={header.portfolio}
                        onChange={handleInputChange}
                        className="text-right"
                     />
                  </div>
               </div>

               <div className="flex flex-col">
                  <div>Date</div>
                  <div>Dear Hiring Manager,</div>
                  <Editor
                     editorState={editorState}
                     onChange={setEditorState}
                     placeholder="Write your cover letter here..."
                  />
                  <div>Thank you,</div>
                  <input
                     type="text"
                     name="name"
                     value={header.name}
                     onChange={handleInputChange}
                     className="w-1/5"
                  />
                  <input
                     type="text"
                     name="contactPhone"
                     value={header.contactPhone}
                     onChange={handleInputChange}
                     className="w-1/5"
                  />
                  <input
                     type="text"
                     name="contactEmail"
                     value={header.contactEmail}
                     onChange={handleInputChange}
                     className="w-1/3"
                  />
               </div>
            </div>
         </div>
         <div className="flex justify-center mt-4">
            <button
               onClick={handleSave}
               className="px-4 py-2 bg-blue-500 text-white"
            >
               Save
            </button>
         </div>
      </div>
   );
}

export default CoverLetterEditor;
