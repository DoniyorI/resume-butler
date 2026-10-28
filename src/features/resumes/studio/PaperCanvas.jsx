"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

// Letter paper at 96 CSS px per inch; matches .rb-paper in globals.css
export const PAGE_WIDTH_PX = 816;
const PAGE_HEIGHT_PX = 1056;
// The resume's 0.5in top and bottom margin (cover letters pass 0.75in)
const RESUME_MARGIN_Y_PX = 48;
// Room for writing on a resume page, and the height of one line of 10pt bullets
export const PAGE_CONTENT_PX = PAGE_HEIGHT_PX - 2 * RESUME_MARGIN_Y_PX;
export { LINE_PX } from "@/features/resumes/pageFit";
// Space beside the page for the hover controls in its margins
const GUTTER_PX = 56;

/**
 * Shows the page scaled to fit the canvas (zoom "fit") or at a fixed zoom,
 * measures how much of the page the content uses and reports it through
 * onMeasure({ usedPx, limitPx }). When the content runs past one page, the
 * part that would spill onto page 2 is marked. `paperClassName` and
 * `marginYPx` describe the page (the resume by default).
 */
export default function PaperCanvas({
  zoom,
  onMeasure,
  onScaleChange,
  paperClassName = "rb-paper",
  marginYPx = RESUME_MARGIN_Y_PX,
  children,
}) {
  const limitPx = PAGE_HEIGHT_PX - 2 * marginYPx;
  const viewportRef = useRef(null);
  const contentRef = useRef(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [usedPx, setUsedPx] = useState(0);

  // Height the PDF will use: the content minus what it leaves out (empty
  // bullets, sections without entries), marked with data-unprinted. offsetHeight
  // ignores the zoom transform, so this is in page pixels.
  const measure = useCallback(() => {
    const content = contentRef.current;
    let unprinted = 0;
    for (const el of content.querySelectorAll("[data-unprinted]")) {
      const style = getComputedStyle(el);
      unprinted += el.offsetHeight + parseFloat(style.marginTop) + parseFloat(style.marginBottom);
    }
    setUsedPx(content.offsetHeight - unprinted);
  }, []);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const observer = new ResizeObserver(() => {
      setViewportWidth(viewport.clientWidth);
      measure();
    });
    observer.observe(viewport);
    observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, [measure]);

  // What's printed can change without the height changing (a bullet typed
  // into), so measure after every render too
  useLayoutEffect(measure);

  useEffect(() => {
    onMeasure({ usedPx, limitPx });
  }, [usedPx, limitPx, onMeasure]);

  const fitScale = viewportWidth ? Math.min(1, (viewportWidth - 2 * GUTTER_PX) / PAGE_WIDTH_PX) : 1;
  const scale = zoom === "fit" ? Math.max(0.35, fitScale) : zoom;

  useEffect(() => {
    onScaleChange?.(scale);
  }, [scale, onScaleChange]);

  const overflowing = usedPx > limitPx;
  const paperHeight = Math.max(PAGE_HEIGHT_PX, usedPx + 2 * marginYPx);

  return (
    <div ref={viewportRef} className="h-full overflow-auto bg-muted/60">
      <div
        className="relative mx-auto my-8"
        style={{ width: PAGE_WIDTH_PX * scale, height: paperHeight * scale }}
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{ width: PAGE_WIDTH_PX, transform: `scale(${scale})` }}
        >
          <div
            className={`${paperClassName} relative shadow-[0_1px_3px_rgba(15,23,42,0.08),0_8px_24px_-12px_rgba(15,23,42,0.18)] ring-1 ring-black/5`}
          >
            <div ref={contentRef}>{children}</div>
            {overflowing && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 border-t-2 border-dashed border-amber-400 bg-amber-500/[0.06]"
                style={{ top: PAGE_HEIGHT_PX - marginYPx }}
              >
                <span className="absolute -top-3 right-3 rounded-full bg-amber-500 px-2 py-0.5 font-sans text-[11px] font-medium text-white">
                  Estimated page boundary
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
