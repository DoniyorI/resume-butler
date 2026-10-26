import { useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Field } from "@/features/resumes/studio/paper/Field";
import BulletRewrite from "@/features/resumes/studio/BulletRewrite";

const SEVERITY_COLOR = {
  error: "text-red-600",
  warning: "text-amber-500",
};

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
 * The bullets of one experience or project, edited like a document: Enter
 * adds a bullet below, Backspace on an empty bullet removes it, Alt+Up/Down
 * moves it. `feedback` maps a bullet index to ATS feedback, `suggested` holds
 * the indexes with a pending AI suggestion and `active` is the one the review
 * panel is pointing at.
 */
export default function BulletList({
  itemKey,
  bullets,
  onChange,
  context,
  jobDescription,
  feedback = {},
  suggested,
  active,
  onShowSuggestion,
}) {
  const fieldRefs = useRef([]);
  const pendingFocusRef = useRef(null);
  // An item without bullets still shows one empty bullet to type into
  const rows = bullets.length > 0 ? bullets : [""];
  // Empty bullets are left out of the PDF, so they're left out of the page-fit measurement
  const isBlank = (text) => !text?.trim();
  const allBlank = rows.every(isBlank);

  useLayoutEffect(() => {
    if (pendingFocusRef.current === null) return;
    focusAtEnd(fieldRefs.current[pendingFocusRef.current]);
    pendingFocusRef.current = null;
  });

  // The bullets with the text currently typed into bullet `index`
  const withTyped = (index) => {
    const next = [...rows];
    next[index] = fieldRefs.current[index]?.textContent.trim() ?? next[index];
    return next;
  };

  const commit = (index, text) => {
    if (bullets.length === 0 && !text) return;
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

  return (
    <ul data-item-key={itemKey} data-unprinted={allBlank || undefined} className="rb-small rb-bullets">
      {rows.map((text, index) => {
        const severity = feedback[index]?.severity;
        const issues = feedback[index]?.issues?.map((issue) => issue.message).join("\n");
        const hasSuggestion = suggested?.has(index);
        return (
          <li
            key={index}
            data-bullet-index={index}
            data-unprinted={(!allBlank && isBlank(text)) || undefined}
            className={cn(
              "group/bullet relative rounded-sm transition-colors",
              active === index && "bg-brand/10 ring-2 ring-brand/30"
            )}
          >
            <span
              aria-hidden
              title={issues || undefined}
              className={cn(
                "absolute -left-[0.16in] top-0 select-none text-[6pt]",
                SEVERITY_COLOR[severity] || "text-black"
              )}
            >
              ●
            </span>
            <Field
              ref={(node) => (fieldRefs.current[index] = node)}
              as="div"
              value={text}
              placeholder={index === 0 ? "Describe what you did and the result" : "Another result"}
              onCommit={(value) => commit(index, value)}
              onKeyDown={handleKeyDown(index)}
              className={cn(
                "block",
                hasSuggestion && "underline decoration-brand/70 decoration-wavy underline-offset-[3px]"
              )}
            />
            {hasSuggestion && (
              <button
                type="button"
                onClick={() => onShowSuggestion(index)}
                title="See the AI suggestion for this bullet"
                aria-label="See the AI suggestion for this bullet"
                className="absolute -left-[0.42in] top-[1pt] h-[9pt] w-[9pt] rounded-full bg-brand ring-2 ring-white hover:scale-125 focus-visible:outline-none focus-visible:ring-brand/40"
              />
            )}
            <div className="absolute -right-[0.42in] -top-[2pt] opacity-0 transition-opacity focus-within:opacity-100 group-hover/bullet:opacity-100 group-focus-within/bullet:opacity-100">
              <BulletRewrite
                text={text}
                context={context}
                jobDescription={jobDescription}
                onApply={(value) => commit(index, value)}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
