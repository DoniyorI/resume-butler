"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "@/lib/firebase/config";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { InputSizer } from "@/app/resumes/[resumeId]/_components/InputSizer";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";


export default function Page({ params }) {
  const [user, loading, error] = useAuthState(auth);
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  const [coverLetterTitle, setCoverLetterTitle] = useState("");
  const [content, setContent] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);

  useEffect(() => {
    if (user && params.coverLetterId) {
      const coverLetterRef = doc(db, `users/${user.uid}/coverletters`, params.coverLetterId);

      getDoc(coverLetterRef)
        .then((docSnap) => {
          if (docSnap.exists()) {
            const coverLetterData = docSnap.data();
            setCoverLetterTitle(coverLetterData.title);
            setContent(coverLetterData.content);
          } else {
            console.error("Cover letter not found or you're not authorized to view it");
            router.push("/404");
          }
        })
        .catch((error) => {
          console.error("Error fetching cover letter:", error);
          router.push("/404");
        });
    }
  }, [user, params.coverLetterId, router]);

  const autoSave = async () => {
    if (user && params.coverLetterId) {
      const coverLetterRef = doc(db, `users/${user.uid}/coverletters`, params.coverLetterId);
      await setDoc(coverLetterRef, { title: coverLetterTitle }, { merge: true });
      console.log("Cover letter saved");
      toast("Title Updated Successfully", {
        action: {
          label: "OK",
          onClick: () => toast.dismiss(),
        },
      })
    }
  };

  if (loading || !user) {
    return <p>Loading...</p>;
  }

  return (
    <div className="flex flex-col w-full p-10 font-sans my-10">
      <Header title={coverLetterTitle} setCoverLetterTitle={setCoverLetterTitle} editingTitle={editingTitle} setEditingTitle={setEditingTitle} autoSave={autoSave} />
      <div className="flex-grow flex flex-col">
        <div className="flex flex-col items-center justify-center flex-grow p-4">
          <div class="w-[850px] h-[1100px] border border-gray-800 rounded-md bg-white box-border overflow-hidden p-4">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your cover letter here..."
              className="w-full h-full resize-none border-none focus:outline-none"
            />
          </div>
        </div>
        <div className="flex justify-center mt-4">
          <button className="btn-primary" onClick={autoSave}>Save</button>
        </div>
      </div>
    </div>
  );
}

const Header = ({ title, setCoverLetterTitle, editingTitle, setEditingTitle, autoSave }) => (
  <h1 className="text-3xl font-medium text-[#559F87] mb-4">
    Cover Letter:
    {editingTitle ? (
      <input
        type="text"
        value={title}
        onChange={(e) => setCoverLetterTitle(e.target.value)}
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
