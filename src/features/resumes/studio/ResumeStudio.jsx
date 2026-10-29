"use client";
import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { itemBullets } from "@/features/resumes/resumeDocument";
import { renameResume } from "@/features/resumes/actions";
import { checkResumePages, reviewBullets, tailorFromCv } from "@/features/resumes/api";
import { useResumeDocument } from "@/features/resumes/hooks/useResumeDocument";
import { useResumeDownload } from "@/features/resumes/hooks/useResumeDownload";
import { useAutomaticPdfFit } from "@/features/resumes/hooks/useAutomaticPdfFit";
import { printableResumeKey, hashPdfContentKey } from "@/features/resumes/pdfContentKey";
import AssistantPanel from "@/features/resumes/studio/AssistantPanel";
import { pageFit } from "@/features/resumes/studio/FitGauge";
import PaperCanvas, { PAGE_CONTENT_PX } from "@/features/resumes/studio/PaperCanvas";
import Paper from "@/features/resumes/studio/paper/Paper";
import StudioToolbar from "@/features/resumes/studio/StudioToolbar";
import { useJobMatch } from "@/features/resumes/studio/useJobMatch";

// Client-only: the drag-and-drop library
const OutlinePanel = dynamic(() => import("@/features/resumes/studio/OutlinePanel"), {
  ssr: false,
  loading: () => <p className="p-4 text-sm text-muted-foreground">Loading...</p>,
});

// Bullets longer than this are what "Shorten long bullets" sends to the AI
const LONG_BULLET_CHARS = 90;
const MAX_BULLETS_TO_SHORTEN = 12;
const NO_FEEDBACK = {};

let suggestionCount = 0;

function scrollToBullet(section, itemIndex, bulletIndex) {
  document
    .querySelector(`[data-item-key="${section}:${itemIndex}"] [data-bullet-index="${bulletIndex}"]`)
    ?.scrollIntoView({ block: "center", behavior: "smooth" });
}

// Where a suggestion's bullet is now. Entries are kept sorted by date, so they
// can move; then the same text is looked up in the section. A suggestion whose
// bullet was edited since is dropped (null), so it can't overwrite new text.
function locate(suggestion, itemsOf) {
  const items = itemsOf(suggestion.section);
  const where = (itemIndex, bulletIndex) => {
    const item = items[itemIndex];
    const name =
      item.companyName || item.projectName || (suggestion.section === "projects" ? "Project" : "Experience");
    return { ...suggestion, itemIndex, bulletIndex, where: `${name}, bullet ${bulletIndex + 1}` };
  };
  if (itemBullets(items[suggestion.itemIndex])[suggestion.bulletIndex]?.trim() === suggestion.original) {
    return where(suggestion.itemIndex, suggestion.bulletIndex);
  }
  for (let i = 0; i < items.length; i++) {
    const j = itemBullets(items[i]).findIndex((bullet) => bullet?.trim() === suggestion.original);
    if (j !== -1) return where(i, j);
  }
  return null;
}

/**
 * The resume editor: outline and page fit on the left, the editable page in
 * the middle, tailoring and the master CV on the right. `resume`, `masterCv`
 * and `jobOptions` come from features/resumes/data.js.
 */
export default function ResumeStudio({ resume, masterCv, jobOptions }) {
  const resumeDoc = useResumeDocument({
    resumeId: resume.id,
    initialContent: resume.content,
    needsInitialSave: resume.needsHeaderSave,
  });
  const [title, setTitle] = useState(resume.title);
  const download = useResumeDownload({ resumeId: resume.id, title, flush: resumeDoc.flush });

  const [zoom, setZoom] = useState("fit");
  const [scale, setScale] = useState(1);
  const [fit, setFit] = useState({ usedPx: 0, limitPx: PAGE_CONTENT_PX });
  const [tab, setTab] = useState("tailor");
  // The assistant is a drawer below the xl breakpoint
  const [assistantOpen, setAssistantOpen] = useState(false);

  const [suggestions, setSuggestions] = useState([]);
  const [reviewing, setReviewing] = useState(null);
  const [picks, setPicks] = useState(null);
  const [picking, setPicking] = useState(false);
  const [hoveredId, setHoveredId] = useState(null);
  const [pinnedId, setPinnedId] = useState(null);
  const contentKey = useMemo(() => printableResumeKey(resumeDoc.content), [resumeDoc.content]);
  const compilePages = useCallback(async (key) => {
    const expectedKey = await hashPdfContentKey(key);
    const result = await checkResumePages({ resumeId: resume.id });
    if (result.contentKey !== expectedKey) throw new Error("The resume changed while the PDF was being built. Check it again.");
    return result.pages;
  }, [resume.id]);
  const { pdfCheck, checkPdf } = useAutomaticPdfFit({
    contentKey, over: pageFit(fit).over, flush: resumeDoc.flush, compile: compilePages,
  });
  const pdfPages = pdfCheck.status === "done" ? pdfCheck.pages : null;

  const { sections, target } = resumeDoc;
  const jobDescription = target.jobDescription;
  const match = useJobMatch(resumeDoc.resumeContent, jobDescription);

  const itemsOf = useCallback((id) => sections.find((section) => section.id === id)?.items || [], [sections]);
  const sectionOf = (id) => sections.find((section) => section.id === id);

  const liveSuggestions = useMemo(
    () => suggestions.map((s) => locate(s, itemsOf)).filter(Boolean),
    [suggestions, itemsOf]
  );

  const openPanel = (nextTab) => {
    setTab(nextTab);
    setAssistantOpen(true);
  };

  // Changes that replace a lot at once get an Undo
  const withUndo = (message, change) => {
    const before = resumeDoc.snapshot();
    change();
    toast(message, { action: { label: "Undo", onClick: () => resumeDoc.restore(before) } });
  };

  // --- What the page shows on bullets: ATS feedback and AI suggestions ---

  const feedbackByItem = useMemo(() => {
    const map = new Map();
    for (const fb of match.result?.bulletFeedback || []) {
      const key = `${fb.section}:${fb.itemIndex}`;
      if (!map.has(key)) map.set(key, {});
      map.get(key)[fb.bulletIndex] = fb;
    }
    return map;
  }, [match.result]);

  const suggestedByItem = useMemo(() => {
    const map = new Map();
    for (const s of liveSuggestions) {
      const key = `${s.section}:${s.itemIndex}`;
      if (!map.has(key)) map.set(key, new Set());
      map.get(key).add(s.bulletIndex);
    }
    return map;
  }, [liveSuggestions]);

  const active = liveSuggestions.find((s) => s.id === (hoveredId ?? pinnedId));

  const review = {
    jobDescription,
    feedbackFor: (section, itemIndex) => feedbackByItem.get(`${section}:${itemIndex}`) || NO_FEEDBACK,
    suggestedFor: (section, itemIndex) => suggestedByItem.get(`${section}:${itemIndex}`),
    activeFor: (section, itemIndex) =>
      active?.section === section && active.itemIndex === itemIndex ? active.bulletIndex : undefined,
    onShowSuggestion: (section, itemIndex, bulletIndex) => {
      const s = liveSuggestions.find(
        (x) => x.section === section && x.itemIndex === itemIndex && x.bulletIndex === bulletIndex
      );
      if (!s) return;
      setPinnedId(s.id);
      openPanel("tailor");
      requestAnimationFrame(() =>
        document
          .getElementById(`suggestion-${s.id}`)
          ?.scrollIntoView({ block: "nearest", behavior: "smooth" })
      );
    },
  };

  // --- AI ---

  const runReview = async (focus, only) => {
    setReviewing(focus);
    try {
      const result = await reviewBullets({
        focus,
        jobDescription,
        resumeContent: resumeDoc.resumeContent,
        only,
      });
      setSuggestions(result.map((s) => ({ ...s, id: ++suggestionCount })));
      setPinnedId(null);
      openPanel("tailor");
      if (result.length === 0) toast("No changes to suggest. These bullets already read well.");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setReviewing(null);
    }
  };

  // The longest visible bullets, enough of them to win back the lines that spill over
  const longBullets = useMemo(() => {
    const bullets = [];
    for (const section of sections) {
      if (section.hidden || (section.id !== "experience" && section.id !== "projects")) continue;
      section.items.forEach((item, itemIndex) =>
        itemBullets(item).forEach((text, bulletIndex) => {
          if (text && text.length > LONG_BULLET_CHARS) {
            bullets.push({ section: section.id, itemIndex, bulletIndex, length: text.length });
          }
        })
      );
    }
    return bullets.sort((a, b) => b.length - a.length);
  }, [sections]);

  const shortenLongBullets = () => {
    const { lines } = pageFit(fit);
    const only = longBullets
      .slice(0, Math.min(MAX_BULLETS_TO_SHORTEN, lines + 4))
      .map(({ section, itemIndex, bulletIndex }) => ({ section, itemIndex, bulletIndex }));
    runReview("concise", only);
  };

  const pickFromCv = async () => {
    setPicking(true);
    try {
      const result = await tailorFromCv({ jobDescription });
      if (!result.content) toast("Add entries to your Master CV first");
      else setPicks(result);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setPicking(false);
    }
  };

  const applyPicks = () => {
    withUndo("Resume rebuilt from your Master CV", () => resumeDoc.replaceSections(picks.content));
    setPicks(null);
    setSuggestions([]);
  };

  const acceptSuggestion = (s) => {
    withUndo("Suggestion applied", () =>
      resumeDoc.replaceBullet(s.section, s.itemIndex, s.bulletIndex, s.suggested)
    );
    setSuggestions((prev) => prev.filter((x) => x.id !== s.id));
  };

  const acceptAll = () => {
    withUndo(`${liveSuggestions.length} suggestions applied`, () =>
      liveSuggestions.forEach((s) =>
        resumeDoc.replaceBullet(s.section, s.itemIndex, s.bulletIndex, s.suggested)
      )
    );
    setSuggestions([]);
  };

  // --- Edits from the panels ---

  const showSection = (id) => {
    if (sectionOf(id)?.hidden) resumeDoc.updateSectionMeta(id, { hidden: false });
  };

  const addSkill = (keyword) => {
    const lines = itemsOf("skills");
    showSection("skills");
    if (lines.length === 0) {
      resumeDoc.addItem("skills", { header: "Skills", skills: keyword });
      return;
    }
    const last = lines[lines.length - 1];
    const current = Array.isArray(last.skills) ? last.skills.join(", ") : last.skills || "";
    resumeDoc.updateItem("skills", lines.length - 1, {
      skills: current ? `${current}, ${keyword}` : keyword,
    });
  };

  const addFromCv = (sectionId, item) => {
    if (sectionId === "custom-section") { resumeDoc.addCustomSection(item); return; }
    if (itemsOf(sectionId).length === 0 && masterCv.sectionTitles?.[sectionId]) resumeDoc.updateSectionMeta(sectionId, { title: masterCv.sectionTitles[sectionId] });
    resumeDoc.addItem(sectionId, item);
    showSection(sectionId);
  };

  const removeItem = (sectionId, index) =>
    withUndo("Removed from this resume", () => resumeDoc.deleteItem(sectionId, index));

  const changeTarget = (next) => {
    resumeDoc.setTarget(next);
    // Suggestions and picks were for the previous job
    setSuggestions([]);
    setPicks(null);
  };

  const onMeasure = useCallback((next) => setFit(next), []);

  const outline = (
    <OutlinePanel
      resumeDoc={resumeDoc}
      fit={fit}
      pdfCheck={{ ...pdfCheck, pages: pdfPages }}
      onCheckPdf={checkPdf}
      onTighten={shortenLongBullets}
      tightening={reviewing === "concise"}
      canTighten={longBullets.length > 0}
      onOpenCv={() => openPanel("cv")}
      onRemoveSection={id => withUndo("Section removed", () => resumeDoc.removeSection(id))}
    />
  );

  return (
    // Fixed under the nav bar so the editor fills the window and the page
    // itself never scrolls (each pane scrolls on its own)
    <div className="fixed inset-x-0 bottom-0 top-[73px] z-10 flex flex-col bg-background">
      <StudioToolbar
        rename={(newTitle) => renameResume(resume.id, newTitle)}
        title={title}
        onTitleChange={setTitle}
        saveStatus={resumeDoc.saveStatus}
        saveError={resumeDoc.saveError}
        zoom={zoom}
        scale={scale}
        onZoom={setZoom}
        download={download}
        fit={fit}
        pdfPages={pdfPages}
        onToggleAssistant={() => setAssistantOpen((open) => !open)}
      />
      {resumeDoc.saveError ? <div role="alert" className="border-b border-red-200 bg-red-50 px-4 py-2 text-xs leading-relaxed text-red-800">{resumeDoc.saveError} Your edits are still visible in this tab.</div> : null}
      <div className="relative flex min-h-0 flex-1">
        <aside
          aria-label="Outline"
          className="hidden w-64 shrink-0 overflow-y-auto border-r bg-background lg:block"
        >
          {outline}
        </aside>

        <div className="min-w-0 flex-1">
          <PaperCanvas zoom={zoom} onMeasure={onMeasure} onScaleChange={setScale}>
            <Paper resumeDoc={resumeDoc} review={review} onRemoveItem={removeItem} />
          </PaperCanvas>
        </div>

        {assistantOpen && (
          <button
            type="button"
            aria-label="Close the assistant panel"
            onClick={() => setAssistantOpen(false)}
            className="absolute inset-0 z-20 bg-black/20 xl:hidden"
          />
        )}
        <aside
          aria-label="Assistant"
          className={cn(
            "w-[380px] shrink-0 border-l bg-background",
            "max-xl:absolute max-xl:inset-y-0 max-xl:right-0 max-xl:z-30 max-xl:w-full max-xl:max-w-[400px] max-xl:shadow-xl",
            assistantOpen ? "flex" : "max-xl:hidden xl:flex"
          )}
        >
          <AssistantPanel
            tab={tab}
            onTabChange={setTab}
            onClose={() => setAssistantOpen(false)}
            layout={outline}
            job={{ target, options: jobOptions, onChange: changeTarget }}
            match={{ ...match, onAddSkill: addSkill }}
            ai={{
              onReview: () => runReview("match"),
              reviewing: reviewing === "match",
              onPick: pickFromCv,
              picking,
              picks,
              onApplyPicks: applyPicks,
              onDiscardPicks: () => setPicks(null),
            }}
            review={{
              suggestions: liveSuggestions,
              active: pinnedId,
              onFocus: (s, scroll) => {
                if (scroll) {
                  setPinnedId(s.id);
                  setAssistantOpen(false);
                  scrollToBullet(s.section, s.itemIndex, s.bulletIndex);
                } else {
                  setHoveredId(s?.id ?? null);
                }
              },
              onAccept: acceptSuggestion,
              onDismiss: (s) => setSuggestions((prev) => prev.filter((x) => x.id !== s.id)),
              onAcceptAll: acceptAll,
              onClear: () => setSuggestions([]),
            }}
            cv={{ data: masterCv, sections, onAdd: addFromCv }}
          />
        </aside>
      </div>
    </div>
  );
}
