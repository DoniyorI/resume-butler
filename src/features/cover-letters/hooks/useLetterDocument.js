import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { saveCoverLetterContent } from "@/features/cover-letters/actions";
import { letterToContent } from "@/features/cover-letters/letterDocument";

const AUTOSAVE_DELAY_MS = 600;

// Editor state for one cover letter (the shape from letterDocument.js) with
// debounced autosave, like useResumeDocument: saves run one after another,
// edits made just before leaving are saved on unmount, and closing the tab
// with unsaved changes asks first.
export function useLetterDocument({ coverLetterId, initialLetter }) {
  const [letter, setLetter] = useState(initialLetter);
  // "saved" | "saving" (includes edits waiting for the delay) | "error"
  const [saveStatus, setSaveStatus] = useState("saved");

  const savedRef = useRef(initialLetter);
  const latestRef = useRef(letter);
  const queueRef = useRef(Promise.resolve());

  useEffect(() => {
    latestRef.current = letter;
  }, [letter]);

  // Resolves to true when the snapshot is saved, false when saving failed
  const persist = useCallback(
    (snapshot) => {
      queueRef.current = queueRef.current.then(async () => {
        if (snapshot === savedRef.current) return true;
        let error = "Failed to save cover letter";
        try {
          const result = await saveCoverLetterContent(coverLetterId, letterToContent(snapshot));
          if (result.ok) {
            savedRef.current = snapshot;
            if (latestRef.current === snapshot) setSaveStatus("saved");
            return true;
          }
          error = result.error;
        } catch {
          // Network failure: keep the default message
        }
        toast.error(error, { id: "letter-autosave" });
        setSaveStatus("error");
        return false;
      });
      return queueRef.current;
    },
    [coverLetterId]
  );

  useEffect(() => {
    if (letter === savedRef.current) {
      setSaveStatus("saved");
      return;
    }
    setSaveStatus("saving");
    const timer = setTimeout(() => persist(letter), AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [letter, persist]);

  useEffect(() => {
    const warnIfUnsaved = (event) => {
      if (latestRef.current !== savedRef.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", warnIfUnsaved);
    return () => {
      window.removeEventListener("beforeunload", warnIfUnsaved);
      if (latestRef.current !== savedRef.current) persist(latestRef.current);
    };
  }, [persist]);

  const flush = useCallback(() => persist(latestRef.current), [persist]);

  const update = useCallback((changes) => setLetter((prev) => ({ ...prev, ...changes })), []);
  const updateHeader = useCallback(
    (field, value) => setLetter((prev) => ({ ...prev, header: { ...prev.header, [field]: value } })),
    []
  );
  const updateRecipient = useCallback(
    (field, value) => setLetter((prev) => ({ ...prev, recipient: { ...prev.recipient, [field]: value } })),
    []
  );
  const setParagraphs = useCallback((paragraphs) => setLetter((prev) => ({ ...prev, paragraphs })), []);

  // For undoing bulk changes (an applied AI draft)
  const snapshot = useCallback(() => latestRef.current, []);
  const restore = useCallback((saved) => setLetter(saved), []);

  return {
    letter,
    saveStatus,
    flush,
    update,
    updateHeader,
    updateRecipient,
    setParagraphs,
    snapshot,
    restore,
  };
}
