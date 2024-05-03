import React from "react";

export function EducationForm({ item, onChange }) {
  const handleInputChange = (field, e) => {
    const value = e.target.textContent.trim();
    const newEducationData = { ...item, [field]: value };
    onChange(newEducationData);
  };

  const handleBlur = (e) => {
    const field = e.target.getAttribute("data-field");
    const value = e.target.textContent.trim();
    if (!value) {
      e.target.textContent = e.target.getAttribute("data-placeholder");
      e.target.classList.add("contentEditablePlaceholder");
    } else {
      e.target.classList.remove("contentEditablePlaceholder");
    }
    handleInputChange(field, { target: { textContent: value } });
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault(); // Stop the default enter key action
      e.target.blur(); // Remove focus from element
    }
  };

  const handleFocus = (e) => {
    if (e.target.textContent === e.target.getAttribute("data-placeholder")) {
      e.target.textContent = ""; // Clear placeholder on focus if text is placeholder
    }
  };
  const handlePaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  };

  // const handleBlur = (e) => {
  //   const field = e.target.getAttribute('data-field');
  //   const value = e.target.textContent.trim();
  //   if (!value) {
  //     e.target.textContent = e.target.getAttribute("data-placeholder");
  //     e.target.classList.add('contentEditablePlaceholder');
  //   } else {
  //     e.target.classList.remove('contentEditablePlaceholder');
  //   }
  //   handleInputChange(field, { target: { textContent: value } });
  // };

  const endDateString = item.endDate ? item.endDate.split(" at ")[0] : "";
  const endDate = endDateString ? new Date(endDateString) : new Date();
  const formattedEndDate = endDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
  });

  return (
    <div>
      <div className="flex justify-between items-end mt-3">
        <span
          contentEditable
          className={`input text-md font-semibold ${
            !item.school ? "contentEditablePlaceholder" : ""
          }`}
          role="textbox"
          onFocus={handleFocus}
          onBlur={handleBlur}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          data-placeholder="Enter School Name"
          data-field="school"
          dangerouslySetInnerHTML={{ __html: item.school || "" }}
        />
        <div className="font-semibold">
          Expected{" "}
          <span
            contentEditable
            className={`input text-sm${
              !item.endDate ? "contentEditablePlaceholder" : ""
            }`}
            role="textbox"
            onFocus={handleFocus}
            onBlur={handleBlur}
            onPaste={handlePaste}
            onKeyDown={handleKeyDown}
            data-placeholder="Enter End Date"
            data-field="endDate"
            dangerouslySetInnerHTML={{ __html: formattedEndDate || "" }}
          />
        </div>
      </div>
      <div className="text-sm flex justify-between italic">
        <div className="flex items-center">
          <span
            contentEditable
            className={`input ${
              !item.degreeType ? "contentEditablePlaceholder" : ""
            }`}
            role="textbox"
            onFocus={handleFocus}
            onPaste={handlePaste}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            data-placeholder="Degree Type"
            data-field="degreeType"
            dangerouslySetInnerHTML={{ __html: item.degreeType || "" }}
          />
          <span className="label"> ,</span>
          <span
            contentEditable
            className={`input ${
              !item.major ? "contentEditablePlaceholder" : ""
            }`}
            role="textbox"
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            data-placeholder="Major"
            data-field="major"
            dangerouslySetInnerHTML={{ __html: item.major || "" }}
          />
          <span className="label"> ,</span>
          <span
            contentEditable
            className={`input ${!item.gpa ? "contentEditablePlaceholder" : ""}`}
            role="textbox"
            onFocus={handleFocus}
            onPaste={handlePaste}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            data-placeholder="GPA"
            data-field="gpa"
            dangerouslySetInnerHTML={{ __html: item.gpa || "" }}
          />
          GPA
        </div>

        <span
          contentEditable
          className={`input italic ${
            !item.location ? "contentEditablePlaceholder" : ""
          }`}
          role="textbox"
          onFocus={handleFocus}
          onPaste={handlePaste}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          data-placeholder="Location"
          data-field="location"
          dangerouslySetInnerHTML={{ __html: item.location || "" }}
        />
      </div>
    </div>
  );
}
