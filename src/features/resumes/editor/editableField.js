// Event handlers shared by the EditableText fields in the resume sections

function clearPlaceholderOnFocus(e) {
  if (e.target.textContent === e.target.getAttribute("data-placeholder")) {
    e.target.textContent = "";
  }
}

function blurOnEnter(e) {
  if (e.key === "Enter") {
    e.preventDefault();
    e.target.blur();
  }
}

// Paste as plain text so no markup ends up in the contentEditable
function pastePlainText(e) {
  e.preventDefault();
  const text = e.clipboardData.getData("text/plain");
  document.execCommand("insertText", false, text);
}

export const editableFieldProps = {
  role: "textbox",
  onFocus: clearPlaceholderOnFocus,
  onPaste: pastePlainText,
  onKeyDown: blurOnEnter,
};

// On blur: shows the placeholder again if the field was left empty and
// returns the edited field name (data-field) and its trimmed text
export function readFieldOnBlur(e) {
  const field = e.target.getAttribute("data-field");
  const value = e.target.textContent.trim();
  if (!value) {
    e.target.textContent = e.target.getAttribute("data-placeholder");
    e.target.classList.add("contentEditablePlaceholder");
  } else {
    e.target.classList.remove("contentEditablePlaceholder");
  }
  return { field, value };
}

// Bullet points are stored as an array; tolerate a single string
export function toBullets(description) {
  if (Array.isArray(description)) return description;
  return description ? [description] : [];
}
