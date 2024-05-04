"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "@/lib/firebase/config";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { InputSizer } from "./InputSizer";

export const ResumeHeader = ({ params }) => {
  const [user, loading, error] = useAuthState(auth);
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [github, setGithub] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    if (user && params.resumeId) {
      const resumeRef = doc(db, `users/${user.uid}/resumes`, params.resumeId);
      getDoc(resumeRef)
        .then((docSnap) => {
          if (docSnap.exists()) {
            const resumeData = docSnap.data();
            setEmail(resumeData.email || "");
            setPhone(resumeData.phone || "");
            setLinkedin(resumeData.linkedin || "");
            setGithub(resumeData.github || "");
            setName(resumeData.name || "");
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

  const saveToFirestore = (field, value) => {
    if (user && params.resumeId) {
      const resumeRef = doc(db, `users/${user.uid}/resumes`, params.resumeId);

      setDoc(resumeRef, { [field]: value }, { merge: true })
        .then(() => console.log(`Saved ${field} to Firestore`))
        .catch((error) => console.error(`Error saving ${field}:`, error));
    }
  };

  const handleChange = (setter, field) => (value) => {
    setter(value);
    saveToFirestore(field, value);
  };

  const handleSaveName = async (event) => {
    const newName = event.target.value;
    setName(newName);

    if (user && params.resumeId) {
      const resumeRef = doc(db, `users/${user.uid}/resumes`, params.resumeId);
      await setDoc(resumeRef, { name: newName }, { merge: true })
        .then(() => console.log("Name saved to Firestore"))
        .catch((error) => console.error("Error saving name:", error));
    }
  };

  return (
    <>
      <div className="text-center">
        <input
          type="text"
          className="bg-transparent text-center w-full focus:outline-none text-3xl uppercase font-bold"
          placeholder="Your Name"
          value={name}
          onChange={handleSaveName}
        />
      </div>
      <div className="flex -mt-2 mb-2 text-sm justify-center items-center font-light">
        <div className="flex justify-center items-center">
          <InputSizer
            placeholder="Email"
            value={email}
            onChange={handleChange(setEmail, "email")}
          />
          <span>|</span>
          <InputSizer
            placeholder="Phone Number"
            value={phone}
            onChange={handleChange(setPhone, "phone")}
          />
          <span>|</span>
          <InputSizer
            placeholder="LinkedIn Profile"
            value={linkedin}
            onChange={handleChange(setLinkedin, "linkedin")}
          />
          <span>|</span>
          <InputSizer
            placeholder="GitHub Profile"
            value={github}
            onChange={handleChange(setGithub, "github")}
          />
        </div>
      </div>
    </>
  );
};
