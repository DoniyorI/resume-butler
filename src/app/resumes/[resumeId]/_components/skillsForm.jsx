export const SkillsForm = ({ item, onChange }) => {
  const handleInputChange = (field, value) => {
    onChange({ ...item, [field]: value.trim() }); // Update the item with the field changed
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.target.blur(); // Trigger onBlur
    }
  };

  const handleFocus = (e) => {
    // Clears placeholder if the content is the placeholder
    if (e.target.textContent === e.target.getAttribute("data-placeholder")) {
      e.target.textContent = "";
    }
  };

  const handleBlur = (e) => {
    // Gets the field and updates the item on blur
    const field = e.target.getAttribute("data-field");
    handleInputChange(field, e.target.textContent);
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text); // Inserts plain text
  };

  return (
    <div className="my-1">
      <div className="text-md flex items-center">
        <span
          contentEditable
          className={`input text-md font-semibold ${
            !item.header ? "contentEditablePlaceholder" : ""
          }`}
          role="textbox"
          onFocus={handleFocus}
          onBlur={handleBlur}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          data-placeholder="Header"
          data-field="header" // Added for clarity in handleBlur
          dangerouslySetInnerHTML={{ __html: item.header || "" }}
        />
        :{" "}
        <span
          contentEditable
          className={`input text-md font-normal ${
            !item.skills ? "contentEditablePlaceholder" : ""
          }`}
          role="textbox"
          onFocus={handleFocus}
          onBlur={handleBlur}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          data-placeholder="Skill1, Skill2, Skill3..."
          data-field="skills" // Added for clarity in handleBlur
          dangerouslySetInnerHTML={{ __html: item.skills || "" }}
        />
      </div>
    </div>
  );
};
