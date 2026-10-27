import { useLayoutEffect, useRef } from "react";
import { Field } from "@/features/resumes/studio/paper/Field";
import BulletRewrite from "@/features/resumes/studio/BulletRewrite";
import { rewriteParagraph } from "@/features/cover-letters/api";

function focusAtEnd(element) {
  if (!element) return;
  element.focus();
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

/**
 * The letter's body paragraphs, edited like a document: Enter starts a new
 * paragraph, Backspace in an empty one removes it, Alt+Up/Down moves it. Each
 * paragraph has an AI rewrite in the right margin.
 */
export default function ParagraphList({ paragraphs, onChange, jobDescription }) {
  const fieldRefs = useRef([]);
  const pendingFocusRef = useRef(null);
  // An empty letter still shows one paragraph to type into
  const rows = paragraphs.length > 0 ? paragraphs : [""];

  useLayoutEffect(() => {
    if (pendingFocusRef.current === null) return;
    focusAtEnd(fieldRefs.current[pendingFocusRef.current]);
    pendingFocusRef.current = null;
  });

  const withTyped = (index) => {
    const next = [...rows];
    next[index] = fieldRefs.current[index]?.textContent.trim() ?? next[index];
    return next;
  };

  const commit = (index, text) => {
    if (paragraphs.length === 0 && !text) return;
    const next = [...rows];
    next[index] = text;
    onChange(next);
  };

  const handleKeyDown = (index) => (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const next = withTyped(index);
      next.splice(index + 1, 0, "");
      pendingFocusRef.current = index + 1;
      onChange(next);
    } else if (event.key === "Backspace" && !event.currentTarget.textContent && rows.length > 1) {
      event.preventDefault();
      const next = [...rows];
      next.splice(index, 1);
      pendingFocusRef.current = Math.max(0, index - 1);
      onChange(next);
    } else if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      const to = event.key === "ArrowUp" ? index - 1 : index + 1;
      if (to < 0 || to >= rows.length) return;
      event.preventDefault();
      const next = withTyped(index);
      [next[index], next[to]] = [next[to], next[index]];
      pendingFocusRef.current = to;
      onChange(next);
    }
  };

  return rows.map((text, index) => (
    <div
      key={index}
      className="rb-letter-block group/paragraph relative"
      // Empty paragraphs aren't printed (see PaperCanvas's measurement)
      data-unprinted={!text.trim() && rows.length > 1 ? true : undefined}
    >
      <Field
        ref={(node) => (fieldRefs.current[index] = node)}
        as="p"
        value={text}
        placeholder={index === 0 ? "Start with the role and why you're a fit" : "Write the next paragraph"}
        onCommit={(value) => commit(index, value)}
        onKeyDown={handleKeyDown(index)}
        className="block"
      />
      <div className="absolute -right-[0.62in] top-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover/paragraph:opacity-100 group-focus-within/paragraph:opacity-100">
        <BulletRewrite
          text={text}
          what="paragraph"
          onApply={(value) => commit(index, value)}
          fetchVariants={() => rewriteParagraph({ text, jobDescription })}
        />
      </div>
    </div>
  ));
}
