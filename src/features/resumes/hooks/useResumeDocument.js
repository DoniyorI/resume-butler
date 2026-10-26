import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { saveResumeContent } from "@/features/resumes/actions";
import { DATED_SECTIONS, blankItem, sortByDateDesc } from "@/features/resumes/resumeDocument";

const AUTOSAVE_DELAY_MS = 500;
const BULLET_SECTIONS = new Set(["experience", "projects"]);

// Editor state for one resume: the content document, debounced autosave
// through a Server Action, and the edits the editor makes to it.
// `initialContent` comes from features/resumes/data.js (already normalized).
export function useResumeDocument({ resumeId, initialContent, needsInitialSave = false }) {
  const [doc, setDoc] = useState(initialContent);

  // The document last written to the database. Autosave runs whenever `doc`
  // differs from it, so the initial render doesn't save (unless the header
  // was filled in from the profile and needs persisting).
  const savedDocRef = useRef(needsInitialSave ? null : initialContent);
  const latestDocRef = useRef(doc);
  const saveQueueRef = useRef(Promise.resolve());

  useEffect(() => {
    latestDocRef.current = doc;
  }, [doc]);

  // Saves run one after another so an older save can't land after a newer one.
  // Resolves to true when the snapshot is saved, false when saving failed.
  const persist = useCallback(
    (snapshot) => {
      saveQueueRef.current = saveQueueRef.current.then(async () => {
        if (snapshot === savedDocRef.current) return true;
        let error = "Failed to save resume";
        try {
          const result = await saveResumeContent(resumeId, snapshot);
          if (result.ok) {
            savedDocRef.current = snapshot;
            return true;
          }
          error = result.error;
        } catch {
          // Network failure: keep the default message
        }
        toast.error(error, { id: "resume-autosave" });
        return false;
      });
      return saveQueueRef.current;
    },
    [resumeId]
  );

  useEffect(() => {
    if (doc === savedDocRef.current) return;
    const timer = setTimeout(() => persist(doc), AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [doc, persist]);

  // Fields commit on blur, so clicking a link can leave an edit inside the
  // autosave delay. Save it when the editor unmounts, and warn before closing
  // the tab while changes are unsaved.
  useEffect(() => {
    const warnIfUnsaved = (event) => {
      if (latestDocRef.current !== savedDocRef.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", warnIfUnsaved);
    return () => {
      window.removeEventListener("beforeunload", warnIfUnsaved);
      if (latestDocRef.current !== savedDocRef.current) persist(latestDocRef.current);
    };
  }, [persist]);

  // Save pending edits now (e.g. before downloading the stored resume).
  // Resolves to false if the save failed.
  const flush = useCallback(() => persist(latestDocRef.current), [persist]);

  const updateSection = useCallback((sectionId, update) => {
    setDoc((prev) => {
      const items = update(prev[sectionId]);
      return { ...prev, [sectionId]: DATED_SECTIONS.has(sectionId) ? sortByDateDesc(items) : items };
    });
  }, []);

  const updateItem = useCallback(
    (sectionId, index, changes) =>
      updateSection(sectionId, (items) =>
        items.map((item, i) => (i === index ? { ...item, ...changes } : item))
      ),
    [updateSection]
  );

  const addBlankItem = useCallback((sectionId) => {
    setDoc((prev) => ({ ...prev, [sectionId]: [...prev[sectionId], blankItem(sectionId)] }));
  }, []);

  const addItem = useCallback(
    (sectionId, item) => updateSection(sectionId, (items) => [...items, item]),
    [updateSection]
  );

  const deleteItem = useCallback((sectionId, index) => {
    setDoc((prev) => ({ ...prev, [sectionId]: prev[sectionId].filter((_, i) => i !== index) }));
  }, []);

  // Applies an AI suggestion. Only experience/project bullets have suggestions;
  // anything that doesn't point at an existing bullet is ignored.
  const replaceBullet = useCallback((sectionId, itemIndex, bulletIndex, text) => {
    setDoc((prev) => {
      const item = BULLET_SECTIONS.has(sectionId) ? prev[sectionId]?.[itemIndex] : undefined;
      if (!item || !Number.isInteger(bulletIndex) || bulletIndex < 0) return prev;
      // Older items may store bullets as one newline-separated string
      const bullets = Array.isArray(item.description)
        ? [...item.description]
        : String(item.description || "").split("\n");
      if (bulletIndex >= bullets.length) return prev;
      bullets[bulletIndex] = text;
      return {
        ...prev,
        [sectionId]: prev[sectionId].map((it, i) => (i === itemIndex ? { ...it, description: bullets } : it)),
      };
    });
  }, []);

  const moveSection = useCallback((fromIndex, toIndex) => {
    setDoc((prev) => {
      const order = [...prev.order];
      const [moved] = order.splice(fromIndex, 1);
      order.splice(toIndex, 0, moved);
      return { ...prev, order };
    });
  }, []);

  const updateHeaderField = useCallback((field, value) => {
    setDoc((prev) => ({ ...prev, header: { ...prev.header, [field]: value } }));
  }, []);

  const sections = useMemo(
    () => doc.order.map((section) => ({ ...section, items: doc[section.id] })),
    [doc]
  );

  // What /api/ats-score and /api/suggest-bullets expect
  const resumeContent = useMemo(
    () => ({
      header: doc.header,
      education: doc.education,
      experience: doc.experience,
      projects: doc.projects,
      skills: doc.skills,
    }),
    [doc]
  );

  return {
    header: doc.header,
    sections,
    resumeContent,
    flush,
    updateHeaderField,
    updateItem,
    addBlankItem,
    addItem,
    deleteItem,
    replaceBullet,
    moveSection,
  };
}
