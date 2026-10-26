import { useEffect, useRef, useState } from "react";
import { scoreResume } from "@/features/ats/api";

const RESCORE_DELAY_MS = 900;

// Keyword/structure score of the page against the job, refreshed shortly
// after each edit. /api/ats-score runs no AI, so re-scoring is cheap.
export function useJobMatch(resumeContent, jobDescription) {
  const [state, setState] = useState({ result: null, loading: false, error: null });
  const requestRef = useRef(0);

  useEffect(() => {
    if (!jobDescription.trim()) {
      setState({ result: null, loading: false, error: null });
      return;
    }
    setState((prev) => ({ ...prev, loading: true }));
    const request = ++requestRef.current;
    const timer = setTimeout(async () => {
      try {
        const result = await scoreResume({ jobDescription, resumeContent });
        if (request === requestRef.current) setState({ result, loading: false, error: null });
      } catch (error) {
        if (request === requestRef.current)
          setState((prev) => ({ ...prev, loading: false, error: error.message }));
      }
    }, RESCORE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [resumeContent, jobDescription]);

  return state;
}
