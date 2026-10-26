import { useLayoutEffect, useRef } from "react";

// A contentEditable element whose text is written with textContent, never
// innerHTML, so saved resume text (including AI or PDF-imported text) can't
// inject markup or scripts. Like the previous dangerouslySetInnerHTML version,
// the DOM is only rewritten when `value` changes, so typing isn't interrupted.
export function EditableText({ as: Tag = "span", value, ...props }) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const text = value ? String(value) : "";
    if (ref.current && ref.current.textContent !== text) {
      ref.current.textContent = text;
    }
  }, [value]);

  return <Tag ref={ref} contentEditable suppressContentEditableWarning {...props} />;
}
