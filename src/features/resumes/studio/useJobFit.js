import { useCallback, useEffect, useRef, useState } from "react";
import { fetchResumeFit } from "@/features/resumes/api";

const REFIT_DELAY_MS = 900;
const MIN_DESCRIPTION_CHARS = 40;
const IDLE = { result: null, loading: false, error: null };

// How the job fits the Master CV, with what the page could still show, refreshed
// shortly after each edit. /api/resume-fit runs no AI.
// `refresh()` cancels a pending refetch, runs now, and resolves to that request's
// result (null when it failed or there is no description to check).
export function useJobFit(resumeContent, jobDescription) {
  const [state, setState] = useState(IDLE);
  const requestRef = useRef(0);
  const timerRef = useRef(null);
  const inputRef = useRef({ resumeContent, jobDescription });
  inputRef.current = { resumeContent, jobDescription };

  const load = useCallback(async () => {
    clearTimeout(timerRef.current);
    const { resumeContent: content, jobDescription: description } = inputRef.current;
    const request = ++requestRef.current;
    if (description.trim().length < MIN_DESCRIPTION_CHARS) {
      setState(IDLE);
      return null;
    }
    setState((prev) => ({ ...prev, loading: true }));
    try {
      const result = await fetchResumeFit({ jobDescription: description, resumeContent: content });
      if (request === requestRef.current) setState({ result, loading: false, error: null });
      return result;
    } catch (error) {
      if (request === requestRef.current) setState((prev) => ({ ...prev, loading: false, error: error.message }));
      return null;
    }
  }, []);

  useEffect(() => {
    if (jobDescription.trim().length < MIN_DESCRIPTION_CHARS) {
      requestRef.current++;
      setState(IDLE);
      return;
    }
    requestRef.current++; // an answer for the previous edit is stale now
    setState((prev) => ({ ...prev, loading: true }));
    timerRef.current = setTimeout(load, REFIT_DELAY_MS);
    return () => clearTimeout(timerRef.current);
  }, [resumeContent, jobDescription, load]);

  return { ...state, refresh: load };
}
