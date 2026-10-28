"use client";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPdfFitCheck } from "@/features/resumes/pdfFitCheck";

export function useAutomaticPdfFit({ contentKey, over, flush, compile }) {
  const callbacks = useRef({ flush, compile });
  callbacks.current = { flush, compile };
  const scheduler = useRef(null);
  const [state, setState] = useState({ status: "idle", key: null, pages: null, error: null });
  useEffect(() => {
    const instance = createPdfFitCheck({
      flush: () => callbacks.current.flush(),
      compile: key => callbacks.current.compile(key),
      onChange: setState,
    });
    scheduler.current = instance;
    return () => { instance.dispose(); scheduler.current = null; };
  }, []);
  useEffect(() => { scheduler.current?.update(contentKey, over); }, [contentKey, over]);
  const checkPdf = useCallback(() => scheduler.current?.checkNow(), []);
  const pdfCheck = useMemo(() => state.key === contentKey ? state
    : { status: "idle", key: contentKey, pages: null, error: null }, [contentKey, state]);
  return { pdfCheck, checkPdf };
}
