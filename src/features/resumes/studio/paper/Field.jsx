import { forwardRef } from "react";
import { EditableText } from "@/features/resumes/studio/paper/EditableText";
import { cn } from "@/lib/utils";

// Paste as plain text so no markup ends up in the page
export function pastePlainText(event) {
  event.preventDefault();
  document.execCommand("insertText", false, event.clipboardData.getData("text/plain"));
}

// Browsers leave a <br> behind when a field is emptied; remove it so the
// :empty placeholder shows again
export function clearStrayBreak(event) {
  if (!event.currentTarget.textContent) event.currentTarget.replaceChildren();
}

/**
 * One line of text on the resume page that reads as print until hovered or
 * focused. Saves through onCommit(text) when it loses focus and the text
 * changed; Enter finishes editing. Text is written with textContent only
 * (see EditableText), so stored or AI text can't inject markup.
 */
export const Field = forwardRef(function Field(
  { value, onCommit, placeholder, className, as = "span", onKeyDown, ...props },
  ref
) {
  const text = value ? String(value) : "";

  const handleBlur = (event) => {
    const next = event.currentTarget.textContent.trim();
    if (next !== text) onCommit(next);
  };

  const handleKeyDown = (event) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (event.key === "Enter" || event.key === "Escape") {
      event.preventDefault();
      event.currentTarget.blur();
    }
  };

  return (
    <EditableText
      ref={ref}
      as={as}
      role="textbox"
      aria-label={placeholder}
      data-placeholder={placeholder}
      spellCheck
      className={cn("rb-field", className)}
      value={text}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onPaste={pastePlainText}
      onInput={clearStrayBreak}
      {...props}
    />
  );
});
